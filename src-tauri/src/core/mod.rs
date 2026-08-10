pub mod agent;
pub mod capture;
pub mod capture_budget;
pub mod communication_style;
pub mod confidence_gate;
pub mod config;
pub mod hallucination_detect;
pub mod history;
pub mod insertion;
pub mod mode_router;
pub mod paths;
pub mod portal;
pub mod profile_context;
pub mod prompt_enhance;
pub mod providers;
pub mod runtime_log;
pub mod sessions;
pub mod shortcut;
pub mod sound;
pub mod text_rules;
pub mod transcript_store;
pub mod transcription_hints;
pub mod transform;
pub mod translate;
pub mod trigger;
pub mod updates;
pub mod vocabulary_learning;
pub mod vocabulary_repair;
pub mod workspace_context;

#[cfg(test)]
mod e2e_tests;

#[cfg(test)]
mod regression_corpus;
