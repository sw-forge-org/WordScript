//! Native audio feedback.
//!
//! `cue.rs` owns what is played, `pack.rs` owns how it sounds, `synth.rs`
//! renders the two into samples. This module owns the runtime state that the
//! rest of the app talks to.

pub mod cue;
pub mod engine;
pub mod pack;
pub mod synth;

use std::sync::{
    atomic::{AtomicBool, AtomicU32, Ordering},
    OnceLock,
};

pub use cue::{SoundCue, ALL_CUES};
pub use pack::{SoundPack, ALL_PACKS, DEFAULT_PACK};

use super::config::AppConfig;

pub const DEFAULT_VOLUME: f32 = 0.6;

/// Opens the output device up front so the first cue does not pay for it.
pub fn init() {
    engine::init();
}

/// Plays the signature once at launch. The engine processes commands in order
/// on one thread, so this lands after the device open and its warm-up silence
/// without needing a timer.
pub fn play_startup(config: &AppConfig) {
    if config.play_sounds && config.play_startup_sound {
        engine::submit(SoundCue::Startup, volume());
    }
}

pub fn play_if_enabled(cue: SoundCue) {
    if sounds_enabled().load(Ordering::Relaxed) {
        engine::submit(cue, volume());
    }
}

/// Plays regardless of the master toggle so the settings preview still works
/// while sound feedback is switched off.
pub fn preview(cue: SoundCue, pack: Option<SoundPack>, volume_override: Option<f32>) {
    if let Some(pack) = pack {
        set_pack(pack);
    }
    engine::submit(cue, volume_override.unwrap_or_else(volume).clamp(0.0, 1.0));
}

pub fn set_enabled(enabled: bool) {
    sounds_enabled().store(enabled, Ordering::Relaxed);
}

pub fn set_volume(value: f32) {
    let clamped = value.clamp(0.0, 1.0);
    volume_bits().store(clamped.to_bits(), Ordering::Relaxed);
}

pub fn volume() -> f32 {
    f32::from_bits(volume_bits().load(Ordering::Relaxed))
}

pub fn set_pack(new_pack: SoundPack) {
    pack_index().store(new_pack as u32, Ordering::Relaxed);
    engine::invalidate_cache();
}

pub fn active_pack() -> SoundPack {
    ALL_PACKS
        .get(pack_index().load(Ordering::Relaxed) as usize)
        .copied()
        .unwrap_or(DEFAULT_PACK)
}

/// Pushes freshly saved config values into the audio runtime.
pub fn apply_config(config: &AppConfig) {
    set_enabled(config.play_sounds);
    set_volume(config.sound_volume);
    set_pack(SoundPack::from_str_or_default(&config.sound_pack));
}

/// Settings preview. Plays through the real native path so what is auditioned
/// is what the runtime will play.
#[tauri::command]
pub fn preview_sound_cue(
    cue: String,
    pack: Option<String>,
    volume: Option<f32>,
) -> Result<(), String> {
    let cue = SoundCue::from_str_opt(&cue).ok_or_else(|| format!("unknown sound cue: {cue}"))?;
    preview(
        cue,
        pack.as_deref().map(SoundPack::from_str_or_default),
        volume,
    );
    Ok(())
}

fn sounds_enabled() -> &'static AtomicBool {
    static ENABLED: OnceLock<AtomicBool> = OnceLock::new();
    ENABLED.get_or_init(|| AtomicBool::new(AppConfig::load_from_disk().play_sounds))
}

fn volume_bits() -> &'static AtomicU32 {
    static VOLUME: OnceLock<AtomicU32> = OnceLock::new();
    VOLUME.get_or_init(|| {
        AtomicU32::new(
            AppConfig::load_from_disk()
                .sound_volume
                .clamp(0.0, 1.0)
                .to_bits(),
        )
    })
}

fn pack_index() -> &'static AtomicU32 {
    static PACK: OnceLock<AtomicU32> = OnceLock::new();
    PACK.get_or_init(|| {
        let pack = SoundPack::from_str_or_default(&AppConfig::load_from_disk().sound_pack);
        AtomicU32::new(pack as u32)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pack_discriminants_match_the_lookup_table() {
        // `active_pack` indexes ALL_PACKS with the stored discriminant, so the
        // two must stay in the same order.
        for (index, pack) in ALL_PACKS.iter().enumerate() {
            assert_eq!(*pack as u32 as usize, index, "{} moved", pack.as_str());
        }
    }
}
