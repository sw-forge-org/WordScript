//! Where a credential lives, for every vendor that stores one.
//!
//! **Extracted with the first second vendor, and for the reason ADR 0113 gives
//! about the request shape one file over**: the keyring code is identical
//! across lanes except for the id in front of the entry name, and a second copy
//! of it is not a second implementation — it is the same implementation with a
//! second chance to drift. What is per vendor is which prefix a key carries and
//! what the sentence says when one is missing; both are arguments here.
//!
//! **The entry names did not move.** `credential_entry_user` produced
//! `groq.{role}.{kind}` and this produces `{provider}.{role}.{kind}` with
//! `provider = "groq"` — byte-identical, which is the property that matters
//! because changing one of these strings orphans every credential already
//! stored under it (ADR 0105).

use std::{
    collections::HashMap,
    sync::{Mutex, OnceLock},
};

use keyring::{Entry, Error as KeyringError};

use super::{CredentialKind, ProviderRole};

/// One namespace for the whole product, and never a per-vendor service name.
///
/// The service half of a keyring entry answers *which application*, and the
/// user half answers *which credential of it*. A vendor is the second question,
/// which is why it is a component of the entry user below rather than a second
/// service.
pub const KEY_SERVICE: &str = "io.github.sw-forge-org.wordscript";

/// Every stored key this process has read, by full entry name.
///
/// One map for every vendor rather than one per module: the entry name already
/// carries the provider, so two vendors cannot collide in it, and a second map
/// would be a second lifetime to reason about for no gain.
static API_KEY_CACHE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

/// The secret-store surface every vendor's credential goes through.
///
/// The keyring is process-global OS state, so every read, write and delete sits
/// behind this trait: a test exercises it against an in-memory store instead of
/// writing into the developer's real secret store.
pub trait SecretStore {
    fn read(&self, service: &str, user: &str) -> Result<Option<String>, KeyringError>;
    fn write(&self, service: &str, user: &str, secret: &str) -> Result<(), KeyringError>;
    fn delete(&self, service: &str, user: &str) -> Result<(), KeyringError>;
}

pub struct OsSecretStore;

impl SecretStore for OsSecretStore {
    fn read(&self, service: &str, user: &str) -> Result<Option<String>, KeyringError> {
        match Entry::new(service, user)?.get_password() {
            Ok(secret) => Ok(Some(secret)),
            Err(KeyringError::NoEntry) => Ok(None),
            Err(error) => Err(error),
        }
    }

    fn write(&self, service: &str, user: &str, secret: &str) -> Result<(), KeyringError> {
        Entry::new(service, user)?.set_password(secret)
    }

    fn delete(&self, service: &str, user: &str) -> Result<(), KeyringError> {
        match Entry::new(service, user)?.delete_credential() {
            Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
            Err(error) => Err(error),
        }
    }
}

/// The entry one credential lives under: the provider, the role and the kind.
///
/// **Changing one of these strings orphans every credential already stored**,
/// which is why the parts come from `ProviderRole::as_str` and
/// `CredentialKind::as_str` rather than from literals written twice — and why
/// the provider arrives as the registry's canonical id rather than as a label.
pub fn entry_user(provider: &str, role: ProviderRole, kind: CredentialKind) -> String {
    format!("{}.{}.{}", provider, role.as_str(), kind.as_str())
}

/// Reads the key stored for one `(provider, role, kind)`.
///
/// `Ok(None)` means no entry this build knows holds a key for that role —
/// which is a legitimate state, not a store failure, and it is the state that
/// makes a job inert with a name rather than with a stack trace.
pub fn read_from(
    store: &impl SecretStore,
    provider: &str,
    role: ProviderRole,
    kind: CredentialKind,
) -> Result<Option<String>, KeyringError> {
    store.read(KEY_SERVICE, &entry_user(provider, role, kind))
}

/// Writes one role's credential and touches no other entry.
pub fn write_to(
    store: &impl SecretStore,
    provider: &str,
    role: ProviderRole,
    kind: CredentialKind,
    api_key: &str,
) -> Result<(), KeyringError> {
    store.write(KEY_SERVICE, &entry_user(provider, role, kind), api_key)
}

/// Clears one role's credential and nothing else.
///
/// **Clearing one role never clears another's** (ADR 0105) — the rule A3
/// established, which holds across vendors here for the same reason it held
/// within one: the entry names are one per `(provider, role, kind)`.
pub fn clear_in(
    store: &impl SecretStore,
    provider: &str,
    role: ProviderRole,
    kind: CredentialKind,
) -> Result<(), KeyringError> {
    store.delete(KEY_SERVICE, &entry_user(provider, role, kind))
}

fn cache() -> &'static Mutex<HashMap<String, String>> {
    API_KEY_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn cached(user: &str) -> Option<String> {
    cache()
        .lock()
        .ok()
        .and_then(|cache| cache.get(user).cloned())
}

pub fn cache_key(user: &str, value: Option<String>) {
    if let Ok(mut cache) = cache().lock() {
        match value {
            Some(api_key) => {
                cache.insert(user.to_string(), api_key);
            }
            None => {
                cache.remove(user);
            }
        }
    }
}

/// A key, shortened to what a settings row may show.
///
/// **Ten characters is the floor, and below it the answer is a word rather than
/// a shorter mask.** Four from each end of a short secret is most of the
/// secret.
pub fn mask_api_key(api_key: &str) -> String {
    let trimmed = api_key.trim();
    if trimmed.len() <= 10 {
        return "configured".to_string();
    }

    format!("{}...{}", &trimmed[..4], &trimmed[trimmed.len() - 4..])
}

/// Whether a typed key has the shape this vendor issues.
///
/// **The prefix is a courtesy, not an authentication.** It catches the everyday
/// mistake — a key pasted into the wrong vendor's field — before a request
/// carries it to a server that will answer 401 without saying which of the two
/// keys was wrong. `None` is for a lane that documents no prefix, where an
/// arbitrary refusal would be this build inventing a rule the vendor does not
/// have.
pub fn normalized_key<'a>(api_key: &'a str, prefix: Option<&str>) -> Result<&'a str, KeyShape> {
    let trimmed = api_key.trim();
    if trimmed.is_empty() {
        return Err(KeyShape::Empty);
    }

    match prefix {
        Some(prefix) if !trimmed.starts_with(prefix) => Err(KeyShape::WrongPrefix),
        _ => Ok(trimmed),
    }
}

/// What is wrong with a typed key, for a caller that owns the wording.
///
/// The sentence names the vendor and its prefix, so it is built where the
/// vendor is known rather than here where it is not.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyShape {
    Empty,
    WrongPrefix,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_entry_name_is_the_one_a3_stored_under() {
        // THE ONE ASSERTION THAT MAY NOT MOVE. A3 stored Groq's credentials
        // under `groq.{role}.{kind}` and this extraction has to produce that
        // string exactly, or every key already in the developer's keyring is
        // orphaned by a refactor that claimed to change nothing.
        assert_eq!(
            entry_user("groq", ProviderRole::Speech, CredentialKind::ApiKey),
            "groq.speech.api_key",
        );
        assert_eq!(
            entry_user("groq", ProviderRole::Chat, CredentialKind::ApiKey),
            "groq.chat.api_key",
        );
    }

    #[test]
    fn two_vendors_cannot_collide_in_one_entry_name() {
        assert_ne!(
            entry_user("groq", ProviderRole::Speech, CredentialKind::ApiKey),
            entry_user("openai", ProviderRole::Speech, CredentialKind::ApiKey),
        );
    }

    #[test]
    fn a_key_shorter_than_a_mask_is_named_rather_than_shown() {
        assert_eq!(mask_api_key("gsk_short"), "configured");
        assert_eq!(mask_api_key("gsk_abcdefghijklmnop"), "gsk_...mnop");
    }

    #[test]
    fn a_lane_without_a_documented_prefix_refuses_only_the_empty_key() {
        assert_eq!(normalized_key("  anything  ", None), Ok("anything"));
        assert_eq!(normalized_key("   ", None), Err(KeyShape::Empty));
    }

    #[test]
    fn a_key_for_the_wrong_vendor_is_caught_before_it_is_sent() {
        assert_eq!(
            normalized_key("gsk_abcdefghijklmnop", Some("sk-")),
            Err(KeyShape::WrongPrefix),
        );
        assert_eq!(
            normalized_key("sk-abcdefghijklmnop", Some("sk-")),
            Ok("sk-abcdefghijklmnop"),
        );
    }
}
