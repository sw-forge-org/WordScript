use super::{
    insertion::{
        execute_insert_request_with_io, InsertIo, NativeClipboardRestoreStatus, NativeInsertDriver,
        NativeInsertMode, NativeInsertPlatformContext, NativeInsertRecoveryAction,
        NativeInsertRequest, NativeInsertionConfig,
    },
    sessions::{NativeSessionStage, NativeSessionState},
    transform::{apply_native_transform, NativeTransformConfig},
};
use crate::core::config::{DictionaryEntry, SnippetEntry};

struct FakeInsertIo {
    clipboard_ok: bool,
    clipboard_text: Option<String>,
    paste_ok: bool,
    restores: Vec<Option<String>>,
    writes: Vec<String>,
}

impl FakeInsertIo {
    fn direct() -> Self {
        Self {
            clipboard_ok: true,
            clipboard_text: Some("Existing clipboard".to_string()),
            paste_ok: true,
            restores: Vec::new(),
            writes: Vec::new(),
        }
    }

    fn clipboard_fallback() -> Self {
        Self {
            clipboard_ok: true,
            clipboard_text: Some("Existing clipboard".to_string()),
            paste_ok: false,
            restores: Vec::new(),
            writes: Vec::new(),
        }
    }

    fn direct_without_previous_clipboard() -> Self {
        Self {
            clipboard_ok: true,
            clipboard_text: None,
            paste_ok: true,
            restores: Vec::new(),
            writes: Vec::new(),
        }
    }

    fn scratchpad_fallback() -> Self {
        Self {
            clipboard_ok: false,
            clipboard_text: Some("Existing clipboard".to_string()),
            paste_ok: false,
            restores: Vec::new(),
            writes: Vec::new(),
        }
    }
}

impl InsertIo for FakeInsertIo {
    fn write_clipboard_with_driver(
        &mut self,
        _driver: NativeInsertDriver,
        text: &str,
    ) -> Result<(), String> {
        self.writes.push(text.to_string());
        if self.clipboard_ok {
            Ok(())
        } else {
            Err("Clipboard unavailable".to_string())
        }
    }

    fn read_clipboard_text(&mut self) -> Option<String> {
        self.clipboard_text.clone()
    }

    fn paste_with_driver(&mut self, _driver: NativeInsertDriver) -> Result<(), String> {
        if self.paste_ok {
            Ok(())
        } else {
            Err("Target app blocked paste".to_string())
        }
    }

    fn type_with_driver(
        &mut self,
        _driver: NativeInsertDriver,
        _text: &str,
    ) -> Result<(), String> {
        Err("xdotool type not available in e2e dummy".to_string())
    }

    fn schedule_clipboard_restore(&mut self, text: Option<String>, _delay_ms: u64) {
        self.restores.push(text);
    }

    fn wait_before_paste(&mut self, _delay_ms: u64) {}
}

#[tokio::test]
async fn resolves_native_session_transform_insert_chain_with_direct_paste() {
    let mut session = NativeSessionState::default();
    let started = session.start_capture("native_tap_hotkey").unwrap();
    assert_eq!(started.stage, NativeSessionStage::Capturing);

    let processing = session.stop_for_processing().unwrap();
    assert_eq!(processing.stage, NativeSessionStage::Processing);

    let transformed = apply_native_transform(
        "word script follow up note",
        NativeTransformConfig {
            provider: "groq".to_string(),
            profile_prompt: String::new(),
            dictionary_entries: vec![DictionaryEntry {
                id: "dict-brand".to_string(),
                phrase: "word script".to_string(),
                replace_with: "WordScript".to_string(),
            }],
            snippet_entries: vec![SnippetEntry {
                id: "snippet-followup".to_string(),
                label: "Follow-up".to_string(),
                trigger: "follow up note".to_string(),
                expansion: "Danke fuer das Update. Wir melden uns mit dem naechsten Stand."
                    .to_string(),
            }],
            post_process: false,
            correction_model: "llama-3.1-8b-instant".to_string(),
            filter_fillers: true,
            professionalize: false,
            ..Default::default()
        },
    )
    .await;

    let mut io = FakeInsertIo::direct();
    let result = execute_insert_request_with_io(
        NativeInsertRequest {
            text: transformed.text.clone(),
            source: Some("e2e_direct".to_string()),
            corrected: Some(transformed.corrected),
            auto_paste: Some(true),
        },
        &NativeInsertionConfig {
            auto_paste: true,
            paste_delay_ms: 0,
            xdotool_type_max_chars: 800,
        },
        1,
        NativeInsertPlatformContext {
            auto_paste: true,
            is_wayland: false,
            has_x11_display: false,
            has_wl_copy: false,
            has_xdotool: false,
            has_wtype: false,
            has_ydotool: false,
            try_xdotool_type_first: false,
        },
         &mut io, None,
    );

    assert!(result.ok);
    assert_eq!(result.insert_mode, NativeInsertMode::DirectPaste);
    assert_eq!(result.recovery_action, NativeInsertRecoveryAction::None);
    assert_eq!(
        result.clipboard_restore,
        NativeClipboardRestoreStatus::Scheduled
    );
    assert_eq!(
        result.recovery_message,
        "Inserted at the cursor. No recovery action is needed."
    );
    assert_eq!(
        io.writes,
        vec![
            "WordScript Danke fuer das Update. Wir melden uns mit dem naechsten Stand. "
                .to_string()
        ]
    );
    assert_eq!(io.restores, vec![Some("Existing clipboard".to_string())]);

    let completed = session.complete_transcription(result.text);
    assert_eq!(completed.stage, NativeSessionStage::Completed);
    assert_eq!(
        completed.last_transcript.as_deref(),
        Some("WordScript Danke fuer das Update. Wir melden uns mit dem naechsten Stand. ")
    );
}

#[tokio::test]
async fn surfaces_direct_paste_failure_with_recovery_copy() {
    let mut session = NativeSessionState::default();
    session.start_capture("native_tap_hotkey").unwrap();
    session.stop_for_processing().unwrap();

    let transformed = apply_native_transform(
        "word script",
        NativeTransformConfig {
            provider: "groq".to_string(),
            profile_prompt: String::new(),
            dictionary_entries: vec![DictionaryEntry {
                id: "dict-brand".to_string(),
                phrase: "word script".to_string(),
                replace_with: "WordScript".to_string(),
            }],
            snippet_entries: Vec::new(),
            post_process: false,
            correction_model: "llama-3.1-8b-instant".to_string(),
            filter_fillers: true,
            professionalize: false,
            ..Default::default()
        },
    )
    .await;

    let mut io = FakeInsertIo::clipboard_fallback();
    let result = execute_insert_request_with_io(
        NativeInsertRequest {
            text: transformed.text.clone(),
            source: Some("e2e_fallback".to_string()),
            corrected: Some(transformed.corrected),
            auto_paste: Some(true),
        },
        &NativeInsertionConfig {
            auto_paste: true,
            paste_delay_ms: 0,
            xdotool_type_max_chars: 800,
        },
        1,
        NativeInsertPlatformContext {
            auto_paste: true,
            is_wayland: false,
            has_x11_display: false,
            has_wl_copy: false,
            has_xdotool: false,
            has_wtype: false,
            has_ydotool: false,
            try_xdotool_type_first: false,
        },
         &mut io, None,
    );

    assert!(!result.ok);
    assert_eq!(result.insert_mode, NativeInsertMode::ClipboardFallback);
    assert!(result.fallback_available);
    assert_eq!(
        result.error.as_deref(),
        Some("enigo: Target app blocked paste")
    );
    assert_eq!(
        result.recovery_action,
        NativeInsertRecoveryAction::ManualPaste
    );
    assert_eq!(
        result.clipboard_restore,
        NativeClipboardRestoreStatus::NotAttempted
    );
    assert!(result
        .recovery_message
        .contains("transcript is on the clipboard"));

    let completed = session.complete_transcription(result.text);
    assert_eq!(completed.stage, NativeSessionStage::Completed);
    assert_eq!(completed.last_transcript.as_deref(), Some("WordScript"));
}

#[tokio::test]
async fn skips_clipboard_restore_when_no_previous_clipboard_exists() {
    let transformed = apply_native_transform(
        "word script",
        NativeTransformConfig {
            provider: "groq".to_string(),
            profile_prompt: String::new(),
            dictionary_entries: vec![DictionaryEntry {
                id: "dict-brand".to_string(),
                phrase: "word script".to_string(),
                replace_with: "WordScript".to_string(),
            }],
            snippet_entries: Vec::new(),
            post_process: false,
            correction_model: "llama-3.1-8b-instant".to_string(),
            filter_fillers: true,
            professionalize: false,
            ..Default::default()
        },
    )
    .await;

    let mut io = FakeInsertIo::direct_without_previous_clipboard();
    let result = execute_insert_request_with_io(
        NativeInsertRequest {
            text: transformed.text.clone(),
            source: Some("e2e_no_clipboard_restore".to_string()),
            corrected: Some(transformed.corrected),
            auto_paste: Some(true),
        },
        &NativeInsertionConfig {
            auto_paste: true,
            paste_delay_ms: 0,
            xdotool_type_max_chars: 800,
        },
        1,
        NativeInsertPlatformContext {
            auto_paste: true,
            is_wayland: false,
            has_x11_display: false,
            has_wl_copy: false,
            has_xdotool: false,
            has_wtype: false,
            has_ydotool: false,
            try_xdotool_type_first: false,
        },
         &mut io, None,
    );

    assert!(result.ok);
    assert_eq!(result.insert_mode, NativeInsertMode::DirectPaste);
    assert_eq!(result.recovery_action, NativeInsertRecoveryAction::None);
    assert_eq!(
        result.clipboard_restore,
        NativeClipboardRestoreStatus::SkippedNoPreviousClipboard
    );
    assert!(io.restores.is_empty());
}

#[tokio::test]
async fn surfaces_clipboard_write_failure_with_scratchpad_recovery() {
    let transformed = apply_native_transform(
        "word script",
        NativeTransformConfig {
            provider: "groq".to_string(),
            profile_prompt: String::new(),
            dictionary_entries: vec![DictionaryEntry {
                id: "dict-brand".to_string(),
                phrase: "word script".to_string(),
                replace_with: "WordScript".to_string(),
            }],
            snippet_entries: Vec::new(),
            post_process: false,
            correction_model: "llama-3.1-8b-instant".to_string(),
            filter_fillers: true,
            professionalize: false,
            ..Default::default()
        },
    )
    .await;

    let mut io = FakeInsertIo::scratchpad_fallback();
    let result = execute_insert_request_with_io(
        NativeInsertRequest {
            text: transformed.text.clone(),
            source: Some("e2e_scratchpad_fallback".to_string()),
            corrected: Some(transformed.corrected),
            auto_paste: Some(true),
        },
        &NativeInsertionConfig {
            auto_paste: true,
            paste_delay_ms: 0,
            xdotool_type_max_chars: 800,
        },
        1,
        NativeInsertPlatformContext {
            auto_paste: true,
            is_wayland: false,
            has_x11_display: false,
            has_wl_copy: false,
            has_xdotool: false,
            has_wtype: false,
            has_ydotool: false,
            try_xdotool_type_first: false,
        },
         &mut io, None,
    );

    assert!(!result.ok);
    assert_eq!(result.insert_mode, NativeInsertMode::ScratchpadFallback);
    assert_eq!(
        result.recovery_action,
        NativeInsertRecoveryAction::UseScratchpad
    );
    assert_eq!(
        result.clipboard_restore,
        NativeClipboardRestoreStatus::NotAttempted
    );
    assert!(result.recovery_message.contains("recovery scratchpad"));
    assert!(io.restores.is_empty());
}
