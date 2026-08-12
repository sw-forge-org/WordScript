//! The native half of the colour scheme (docs/archive/plans/settings-rework.md §15.3).
//!
//! `AppConfig.color_scheme` persists the choice and `useColorScheme` puts the
//! resolved value on `<html data-theme>`, which is everything the WEB surface
//! needs. Two things live outside it and are what this module answers.
//!
//! **The window's own chrome does not read a CSS attribute.** A person who
//! picks Light while the desktop is Dark gets a light workspace inside a dark
//! title bar, and the seam is exactly the place a product looks unfinished.
//! `set_theme` is what moves it, and it is the only thing here that has an
//! effect.
//!
//! **`system` has a better source than the media query.** Inside WebKitGTK
//! `prefers-color-scheme` does report the GTK preference, so the media query is
//! not wrong — it is second-hand. `window.theme()` is the host's own answer, it
//! is the same one the decoration follows, and asking it removes the case where
//! the two disagree. Tauri already emits `tauri://theme-changed` to the window
//! when the desktop switches, so the renderer subscribes to that directly and
//! this module owes no event of its own.
//!
//! The OVERLAY window is deliberately not touched. Its pill defines its own
//! token capsule in `overlay-pill.css` and has one palette by design; giving it
//! a light one is a design decision, not a wiring gap (relay rule 5).

use tauri::{AppHandle, Manager, Runtime, Theme};

use super::config::normalize_color_scheme;

/// The window whose decoration the choice applies to. Named rather than
/// iterated: the overlay must not follow, and a loop over every window would
/// take it along the first time somebody added one.
const THEMED_WINDOWS: [&str; 2] = ["settings", "rebuild-lab"];

fn theme_for(scheme: &str) -> Option<Theme> {
    match normalize_color_scheme(scheme).as_str() {
        "light" => Some(Theme::Light),
        "dark" => Some(Theme::Dark),
        // `None` is "follow the desktop", which is what `system` means and
        // what the platform already does on its own.
        _ => None,
    }
}

/// What the host says the desktop is set to, as the two values the renderer's
/// `ResolvedScheme` has. `None` when the platform cannot answer — the caller
/// then keeps the media query, which is what it used before this existed.
#[tauri::command]
pub fn system_color_scheme<R: Runtime>(app: AppHandle<R>) -> Option<String> {
    let window = THEMED_WINDOWS
        .iter()
        .find_map(|label| app.get_webview_window(label))?;

    match window.theme().ok()? {
        Theme::Light => Some("light".to_string()),
        _ => Some("dark".to_string()),
    }
}

/// Apply the stored choice to the native window chrome.
///
/// Errors are logged rather than returned: the decoration following the choice
/// is a finish, and a platform that cannot do it must not make the setting look
/// like it failed when the workspace has already changed.
pub fn apply_color_scheme<R: Runtime>(app: &AppHandle<R>, scheme: &str) {
    let theme = theme_for(scheme);
    for label in THEMED_WINDOWS {
        if let Some(window) = app.get_webview_window(label) {
            if let Err(error) = window.set_theme(theme) {
                super::runtime_log::record(format!(
                    "[WordScript] Window theme not applied label={label} scheme={scheme} error={error}"
                ));
            }
        }
    }
}

/// The renderer's call, made when the palette's theme rows change the scheme
/// and once when the window adopts the stored one.
#[tauri::command]
pub fn set_window_color_scheme<R: Runtime>(app: AppHandle<R>, scheme: String) {
    apply_color_scheme(&app, &scheme);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_two_explicit_schemes_pin_the_window_and_system_releases_it() {
        assert!(matches!(theme_for("light"), Some(Theme::Light)));
        assert!(matches!(theme_for("dark"), Some(Theme::Dark)));
        // `None` is the platform's own default, not a third palette (ADR 0048).
        assert!(theme_for("system").is_none());
    }

    /// The normalizer is shared with the config, so an unknown value lands on
    /// the same answer in both places rather than on two different ones.
    #[test]
    fn an_unrecognised_scheme_follows_the_config_default() {
        assert!(matches!(theme_for("solarized"), Some(Theme::Dark)));
    }
}
