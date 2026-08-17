//! Where a credential lives, for every vendor that stores one.
//!
//! **Extracted with the first second vendor, and for the reason ADR 0113 gives
//! about the request shape one file over**: the keyring code is identical
//! across lanes except for the id in front of the entry name, and a second copy
//! of it is not a second implementation — it is the same implementation with a
//! second chance to drift. What is per vendor is which prefix a key carries and
//! what the sentence says when one is missing; both are arguments here.
//!
//! **The entry name is `{scope}.{role}.{kind}`, and the scope is the
//! connection** (ADR 0208). It was the vendor id through A3 and the extraction
//! that followed — one vendor, one account — and the format is unchanged, which
//! is what let the axis move with a re-key rather than with a second place to
//! look. Changing one of these strings still orphans every credential stored
//! under it (ADR 0105), so `rekey` moves them and deletes what it moved.

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

/// The entry one credential lives under: the scope, the role and the kind.
///
/// **Changing one of these strings orphans every credential already stored**,
/// which is why the parts come from `ProviderRole::as_str` and
/// `CredentialKind::as_str` rather than from literals written twice.
///
/// **The scope was the vendor and is the connection** (ADR 0208). One vendor
/// held one account, so the vendor id answered *whose credential is this*; two
/// accounts on one vendor is exactly what a profile switch has to move, and the
/// id that tells them apart is the connection's. The shape did not change and
/// the property above did not either — which is why the axis change ships with
/// a re-key ([`rekey`]) rather than with a second place to look.
pub fn entry_user(scope: &str, role: ProviderRole, kind: CredentialKind) -> String {
    format!("{}.{}.{}", scope, role.as_str(), kind.as_str())
}

/// Moves one `(role, kind)` credential from one scope to another.
///
/// **The migration door for the connection axis, and it moves rather than
/// copies.** A key left behind under its old name is a secret in the OS store
/// that no surface can show and no reader can clear — the orphan the doc
/// comment at the top of this file has warned about since the entry name was
/// first extracted.
///
/// `Ok(false)` means there was nothing stored under the old name, which is the
/// ordinary case for most `(role, kind)` pairs and not a failure. The write
/// happens before the delete, so an interrupted move leaves the secret readable
/// under the old name rather than under neither.
pub fn rekey(
    store: &impl SecretStore,
    from_scope: &str,
    to_scope: &str,
    role: ProviderRole,
    kind: CredentialKind,
) -> Result<bool, KeyringError> {
    if from_scope == to_scope {
        return Ok(false);
    }

    let from = entry_user(from_scope, role, kind);
    let Some(secret) = store.read(KEY_SERVICE, &from)? else {
        return Ok(false);
    };

    store.write(KEY_SERVICE, &entry_user(to_scope, role, kind), &secret)?;
    store.delete(KEY_SERVICE, &from)?;
    cache_key(&from, None);
    Ok(true)
}

/// Reads the key stored for one `(scope, role, kind)`.
///
/// `Ok(None)` means no entry this build knows holds a key for that role —
/// which is a legitimate state, not a store failure, and it is the state that
/// makes a job inert with a name rather than with a stack trace.
pub fn read_from(
    store: &impl SecretStore,
    scope: &str,
    role: ProviderRole,
    kind: CredentialKind,
) -> Result<Option<String>, KeyringError> {
    store.read(KEY_SERVICE, &entry_user(scope, role, kind))
}

/// Writes one role's credential and touches no other entry.
pub fn write_to(
    store: &impl SecretStore,
    scope: &str,
    role: ProviderRole,
    kind: CredentialKind,
    api_key: &str,
) -> Result<(), KeyringError> {
    store.write(KEY_SERVICE, &entry_user(scope, role, kind), api_key)
}

/// Clears one role's credential and nothing else.
///
/// **Clearing one role never clears another's** (ADR 0105), and clearing one
/// account never clears another's (ADR 0208) — the rule A3 established, which
/// holds across scopes for the reason it held within one: the entry names are
/// one per `(scope, role, kind)`.
pub fn clear_in(
    store: &impl SecretStore,
    scope: &str,
    role: ProviderRole,
    kind: CredentialKind,
) -> Result<(), KeyringError> {
    store.delete(KEY_SERVICE, &entry_user(scope, role, kind))
}

/// Clears one role's credential and answers whether there was one to clear.
///
/// **The answer is the whole difference from [`clear_in`], and it is what makes
/// a removal countable.** A reader pressing *Remove* on a credential row wants
/// the entry gone and does not care whether it existed a moment earlier;
/// removing the ACCOUNT that owns it asks the other question — *how many
/// secrets did that take with it* — because that is a claim a test can hold the
/// path to without knowing what this machine happens to be carrying.
///
/// **The cache goes with the entry**, which [`clear_in`] leaves to its callers
/// and both of them then remember to do (`self_hosted::clear_api_key` and the
/// openai-compatible one). A key read earlier in this session would otherwise
/// keep answering for an entry that no longer exists — the same hazard [`rekey`]
/// clears the old name for.
pub fn clear_stored(
    store: &impl SecretStore,
    scope: &str,
    role: ProviderRole,
    kind: CredentialKind,
) -> Result<bool, KeyringError> {
    let user = entry_user(scope, role, kind);
    let stored = store.read(KEY_SERVICE, &user)?.is_some();

    store.delete(KEY_SERVICE, &user)?;
    cache_key(&user, None);

    Ok(stored)
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

/// The in-memory secret store every test in this crate writes into, so none of
/// them touches the developer's real keyring.
///
/// **Crate-visible rather than private to this file's tests**, because the
/// question *which key does this profile spend* is answered by `core::config`
/// and asserted there (ADR 0208) — and a second copy of a fake store is a
/// second thing that can stop behaving like the first.
#[cfg(test)]
#[derive(Default)]
pub(crate) struct MemorySecretStore {
    entries: Mutex<HashMap<String, String>>,
}

#[cfg(test)]
impl SecretStore for MemorySecretStore {
    fn read(&self, service: &str, user: &str) -> Result<Option<String>, KeyringError> {
        Ok(self
            .entries
            .lock()
            .unwrap()
            .get(&format!("{service}/{user}"))
            .cloned())
    }

    fn write(&self, service: &str, user: &str, secret: &str) -> Result<(), KeyringError> {
        self.entries
            .lock()
            .unwrap()
            .insert(format!("{service}/{user}"), secret.to_string());
        Ok(())
    }

    fn delete(&self, service: &str, user: &str) -> Result<(), KeyringError> {
        self.entries
            .lock()
            .unwrap()
            .remove(&format!("{service}/{user}"));
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_entry_name_is_the_scope_then_the_role_then_the_kind() {
        // THE SHAPE THAT MAY NOT MOVE, AND THE SCOPE THAT DID. A3 stored
        // Groq's credentials under `groq.{role}.{kind}`; ADR 0208 makes the
        // first component the connection, because one vendor no longer means
        // one account. The format is byte-identical either way, which is what
        // lets `rekey` move a key from one scope to the other instead of this
        // build growing a second place to look.
        assert_eq!(
            entry_user("groq", ProviderRole::Speech, CredentialKind::ApiKey),
            "groq.speech.api_key",
        );
        assert_eq!(
            entry_user("connection-default", ProviderRole::Chat, CredentialKind::ApiKey),
            "connection-default.chat.api_key",
        );
    }

    #[test]
    fn two_scopes_cannot_collide_in_one_entry_name() {
        // Two accounts on ONE vendor is the case the connection axis exists
        // for, so this asserts the pair that used to be impossible to tell
        // apart rather than two different vendors.
        assert_ne!(
            entry_user("connection-work", ProviderRole::Speech, CredentialKind::ApiKey),
            entry_user("connection-private", ProviderRole::Speech, CredentialKind::ApiKey),
        );
    }

    #[test]
    fn a_rekey_moves_the_secret_and_leaves_nothing_behind() {
        let store = MemorySecretStore::default();
        store
            .write(KEY_SERVICE, "groq.speech.api_key", "gsk_abcdefghijklmnop")
            .unwrap();

        assert!(rekey(
            &store,
            "groq",
            "connection-default",
            ProviderRole::Speech,
            CredentialKind::ApiKey,
        )
        .unwrap());

        assert_eq!(
            store.read(KEY_SERVICE, "connection-default.speech.api_key").unwrap(),
            Some("gsk_abcdefghijklmnop".to_string()),
        );
        // THE HALF THAT IS EASY TO FORGET. A copy rather than a move leaves a
        // secret in the OS store that no surface can show and no reader can
        // clear from inside the product.
        assert_eq!(store.read(KEY_SERVICE, "groq.speech.api_key").unwrap(), None);
    }

    #[test]
    fn a_rekey_with_nothing_stored_is_not_a_failure() {
        let store = MemorySecretStore::default();

        assert!(!rekey(
            &store,
            "groq",
            "connection-default",
            ProviderRole::Chat,
            CredentialKind::ApiKey,
        )
        .unwrap());
        assert_eq!(
            store.read(KEY_SERVICE, "connection-default.chat.api_key").unwrap(),
            None,
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
