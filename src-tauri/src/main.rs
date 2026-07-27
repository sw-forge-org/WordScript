// Hide the extra terminal window on Windows outside debug builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Linux backend selection (see handoff OVERLAY_LINUX_BLACK_BLOCK_HANDOFF.md).
    // DEFAULT = XWayland (GDK_BACKEND=x11). Rationale: docs/STATUS.md:108 documents
    // that on native Wayland `startDragging`/`setPosition` are unreliable for the
    // overlay window (xdg_toplevel.move / Compositor-ownership) — drag regressed
    // when the default was switched to native Wayland. XWayland keeps drag working.
    // The black-block bug is handled by the shadow fix (overlay-pill.css) on both
    // backends, so XWayland is safe again. Opt into native Wayland for testing via
    // WORDSCRIPT_NATIVE_WAYLAND=1 (skips the GDK_BACKEND/WAYLAND_DISPLAY override).
    #[cfg(target_os = "linux")]
    {
        unsafe {
            let native_wayland = std::env::var_os("WORDSCRIPT_NATIVE_WAYLAND").is_some();
            if !native_wayland {
                std::env::set_var("GDK_BACKEND", "x11");
                // WebKitGTK also reads WAYLAND_DISPLAY directly — hide it so it
                // falls back to X11.
                if let Ok(wayland_display) = std::env::var("WAYLAND_DISPLAY") {
                    std::env::set_var("WORDSCRIPT_WAS_WAYLAND", "1");
                    std::env::set_var("WORDSCRIPT_WAYLAND_DISPLAY", wayland_display);
                    std::env::remove_var("WAYLAND_DISPLAY");
                }
            }

            // GPU compositing is now ON by default. The previous default
            // (WEBKIT_DISABLE_COMPOSITING_MODE=1) forced WebKitGTK into the cairo
            // software-rendering path, which fixed the overlay black-block bug on
            // Nvidia hybrid GPUs (tauri-apps/tauri#14924) but made every scroll in
            // the settings window CPU-bound and janky, especially on window resize.
            // The overlay's shadow fix (overlay-pill.css) together with the DMABUF
            // renderer disable below now keeps the overlay rendering correctly even
            // with the GPU compositor enabled, so hardware-accelerated scrolling
            // works across all windows.
            //
            // DMA-BUF renderer breaks larger XWayland webviews on some setups
            // (`Failed to create GBM buffer ...`); keep it off while compositing on.
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");

            // Opt out of GPU compositing on hardware where the overlay still shows
            // black blocks or other rendering artefacts. This restores the old cairo
            // software-rendering path.
            if std::env::var_os("WORDSCRIPT_DISABLE_WEBKIT_COMPOSITING").is_some() {
                std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
            } else {
                std::env::remove_var("WEBKIT_DISABLE_COMPOSITING_MODE");
            }

            // How WordScript identifies itself in the system volume mixer.
            // cpal goes through the ALSA compatibility layer, which otherwise
            // names both streams after the binary ("PipeWire ALSA [wordscript]")
            // — the playback stream carrying the sound cues and the capture
            // stream carrying the microphone.
            //
            // The name matters beyond cosmetics: PipeWire keys the remembered
            // per-application volume on it (`module-stream-restore.id =
            // sink-input-by-application-name:...`), so a stable, readable name
            // is what makes that setting findable and durable.
            //
            // Deliberately only `application.name` and the icon. These
            // variables apply to the whole process, so a stream-specific
            // property such as `media.role=event` would also be stamped onto
            // the microphone capture, where PulseAudio would then apply
            // notification-sound routing and ducking rules to it.
            //
            // Must be set before any audio device is opened.
            if std::env::var_os("PIPEWIRE_PROPS").is_none() {
                std::env::set_var(
                    "PIPEWIRE_PROPS",
                    r#"{application.name="WordScript" application.icon_name="wordscript"}"#,
                );
            }
            if std::env::var_os("PULSE_PROP").is_none() {
                std::env::set_var(
                    "PULSE_PROP",
                    "application.name=WordScript application.icon_name=wordscript",
                );
            }
        }
    }

    wordscript_lib::run();
}
