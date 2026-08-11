use std::time::{Duration, SystemTime, UNIX_EPOCH};

use reqwest::{header, StatusCode};
use semver::Version;
use serde::{Deserialize, Serialize};

use crate::core::runtime_log;

const LATEST_RELEASE_URL: &str =
    "https://api.github.com/repos/sw-forge-org/WordScript/releases/latest";
const RELEASE_CHECK_TIMEOUT_SECS: u64 = 8;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AppUpdateStatusKind {
    ReleasePathBuilding,
    UpdateAvailable,
    UpToDate,
    CheckFailed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ReleaseBuildState {
    Building,
    Planned,
    Published,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReleaseBuildTrack {
    pub platform: String,
    pub artifact: String,
    pub state: ReleaseBuildState,
    pub note: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppUpdateStatus {
    pub current_version: String,
    pub status: AppUpdateStatusKind,
    pub summary: String,
    pub release_version: Option<String>,
    pub release_url: Option<String>,
    pub release_notes: Option<String>,
    pub checked_at_ms: u64,
    pub build_targets: Vec<ReleaseBuildTrack>,
}

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    html_url: String,
    body: Option<String>,
}

#[tauri::command]
pub async fn check_app_update() -> Result<AppUpdateStatus, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(RELEASE_CHECK_TIMEOUT_SECS))
        .build()
        .map_err(|error| format!("Could not build release-check client: {error}"))?;

    let response = client
        .get(LATEST_RELEASE_URL)
        .header(header::USER_AGENT, format!("WordScript/{current_version}"))
        .header(header::ACCEPT, "application/vnd.github+json")
        .send()
        .await;

    let status = match response {
        Ok(response) if response.status() == StatusCode::NOT_FOUND => release_path_building(
            &current_version,
            "No published WordScript release exists yet.",
            None,
            None,
            None,
        ),
        Ok(response) if !response.status().is_success() => {
            runtime_log::record(format!(
                "[WordScript] GitHub release check returned status {}",
                response.status()
            ));
            check_failed(
                &current_version,
                format!(
                    "WordScript could not confirm release availability right now (GitHub responded with {}).",
                    response.status()
                ),
            )
        }
        Ok(response) => match response.json::<GitHubRelease>().await {
            Ok(release) => classify_release_status(&current_version, release),
            Err(error) => {
                runtime_log::record(format!(
                    "[WordScript] GitHub release response could not be parsed: {error}"
                ));
                check_failed(
                    &current_version,
                    "WordScript could not parse the current GitHub release status.".to_string(),
                )
            }
        },
        Err(error) => {
            runtime_log::record(format!("[WordScript] GitHub release check failed: {error}"));
            check_failed(
                &current_version,
                "WordScript could not reach GitHub Releases.".to_string(),
            )
        }
    };

    Ok(status)
}

// A SUMMARY IS ONE FACT AND FITS ONE LINE. Every one of these five used to
// carry a second clause about the release path not being ready, which is a
// standing fact about the project rather than a result of the check — and it is
// stated once, on About's "This build" section header, which has the card's
// full width. The row that draws these has a badge and a button beside it and
// holds about 57 characters per line in WebKitGTK; the longest of the five ran
// 172 and drew three lines. The budget belongs to a row three files away, in
// another language, and nothing in either toolchain connects the two, so it is
// written here instead (Leg 11).
fn classify_release_status(current_version: &str, release: GitHubRelease) -> AppUpdateStatus {
    let release_version = normalize_release_version(&release.tag_name);
    let release_notes = release.body.and_then(|value| trim_optional(value));
    let current_semver = Version::parse(current_version).ok();
    let release_semver = release_version
        .as_ref()
        .and_then(|value| Version::parse(value).ok());

    match compare_versions(current_semver.as_ref(), release_semver.as_ref()) {
        VersionComparison::NewerReleaseAvailable => AppUpdateStatus {
            current_version: current_version.to_string(),
            status: AppUpdateStatusKind::UpdateAvailable,
            summary: "A newer GitHub release exists.".to_string(),
            release_version,
            release_url: Some(release.html_url),
            release_notes,
            checked_at_ms: now_ms(),
            build_targets: build_targets(ReleaseBuildState::Published),
        },
        VersionComparison::CurrentIsLatest | VersionComparison::Unknown => AppUpdateStatus {
            current_version: current_version.to_string(),
            status: AppUpdateStatusKind::UpToDate,
            summary: "This build matches the latest visible release tag.".to_string(),
            release_version,
            release_url: Some(release.html_url),
            release_notes,
            checked_at_ms: now_ms(),
            build_targets: build_targets(ReleaseBuildState::Building),
        },
    }
}

fn release_path_building(
    current_version: &str,
    summary: &str,
    release_version: Option<String>,
    release_url: Option<String>,
    release_notes: Option<String>,
) -> AppUpdateStatus {
    AppUpdateStatus {
        current_version: current_version.to_string(),
        status: AppUpdateStatusKind::ReleasePathBuilding,
        summary: summary.to_string(),
        release_version,
        release_url,
        release_notes,
        checked_at_ms: now_ms(),
        build_targets: build_targets(ReleaseBuildState::Building),
    }
}

fn check_failed(current_version: &str, summary: String) -> AppUpdateStatus {
    AppUpdateStatus {
        current_version: current_version.to_string(),
        status: AppUpdateStatusKind::CheckFailed,
        summary,
        release_version: None,
        release_url: None,
        release_notes: None,
        checked_at_ms: now_ms(),
        build_targets: build_targets(ReleaseBuildState::Planned),
    }
}

fn build_targets(state: ReleaseBuildState) -> Vec<ReleaseBuildTrack> {
    vec![
        ReleaseBuildTrack {
            platform: "macOS".to_string(),
            artifact: "DMG packaging lane".to_string(),
            state: state.clone(),
            note: "Installer packaging and signing checks are being assembled for the commercial release path.".to_string(),
        },
        ReleaseBuildTrack {
            platform: "Windows".to_string(),
            artifact: "NSIS installer lane".to_string(),
            state: state.clone(),
            note: "Cross-platform compilation is in place, while release handoff and signing policy are still being hardened.".to_string(),
        },
        ReleaseBuildTrack {
            platform: "Linux".to_string(),
            artifact: "AppImage and DEB lane".to_string(),
            state,
            note: "Linux packaging is part of the build-up, but it should not be treated as a published channel until the first tagged release exists.".to_string(),
        },
    ]
}

fn normalize_release_version(value: &str) -> Option<String> {
    let normalized = value.trim().trim_start_matches('v').trim();
    if normalized.is_empty() {
        return None;
    }
    Some(normalized.to_string())
}

fn trim_optional(value: String) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

enum VersionComparison {
    NewerReleaseAvailable,
    CurrentIsLatest,
    Unknown,
}

fn compare_versions(current: Option<&Version>, release: Option<&Version>) -> VersionComparison {
    match (current, release) {
        (Some(current), Some(release)) if release > current => {
            VersionComparison::NewerReleaseAvailable
        }
        (Some(_), Some(_)) => VersionComparison::CurrentIsLatest,
        _ => VersionComparison::Unknown,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_github_release_tags() {
        assert_eq!(
            normalize_release_version("v0.2.2-alpha"),
            Some("0.2.2-alpha".to_string())
        );
        assert_eq!(
            normalize_release_version(" 0.2.2-alpha "),
            Some("0.2.2-alpha".to_string())
        );
        assert_eq!(normalize_release_version("   "), None);
    }

    #[test]
    fn compares_semver_versions_for_release_status() {
        let current = Version::parse("0.2.2-alpha").ok();
        let newer = Version::parse("0.2.3-alpha").ok();
        let same = Version::parse("0.2.2-alpha").ok();

        assert!(matches!(
            compare_versions(current.as_ref(), newer.as_ref()),
            VersionComparison::NewerReleaseAvailable
        ));
        assert!(matches!(
            compare_versions(current.as_ref(), same.as_ref()),
            VersionComparison::CurrentIsLatest
        ));
        assert!(matches!(
            compare_versions(current.as_ref(), None),
            VersionComparison::Unknown
        ));
    }
}
