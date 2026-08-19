//! WHAT THE TWO LOCAL COLLECTIONS MAY COST, IN BYTES (ADR 0241).
//!
//! **Months are the policy, gigabytes are the backstop, records are neither.**
//! The rule a reader sets is `history_retention_days`, in months, and it is the
//! only one meant to reach them. What is here is the answer to a different
//! question — *can this application fill a disk without ever saying so* — and
//! the answer has to be no even when the retention is `Keep everything`.
//!
//! **THE NUMBERS ARE THE SAME FOR BOTH COLLECTIONS AND THE BUDGETS ARE NOT
//! SHARED.** The index and the transcript archive have separate lifetimes since
//! ADR 0237, and a bound that pooled them would put that back: a large archive
//! would start evicting history records, which is precisely the coupling that
//! record was written to break. Two collections, two budgets, one pair of
//! thresholds.
//!
//! **NEITHER WILL ARRIVE, AND THAT IS THE INTENDED SHAPE.** At the reporting
//! machine's measured 217 dictations a day, 10 GB of index is roughly 4.1
//! million records and about fifty years; the archive is further still. A bound
//! nobody reaches is a bound that never takes anything from anybody. What the
//! reader is meant to feel is the retention rule, and what they are meant to
//! READ is the live figure on Privacy & Data — the threshold is the backstop's
//! voice, not their instrument.
//!
//! ## Which byte, and why this one
//!
//! **CONTENT BYTES, NOT DISK OCCUPANCY.** ADR 0241 measured the archive at
//! 320,933 bytes of content against 1.9 MB of `du`: at a 392-byte median every
//! transcript occupies one 4 KB block, so 86% of what the archive costs a disk
//! is filesystem slack. The record says explicitly that whoever implements this
//! must choose deliberately, so: it is content.
//!
//! Occupancy is the number a reader would see in their file manager and it is
//! also not a property of this product — it is a property of their filesystem's
//! block size, and the same archive would be six times larger on one machine
//! than on another. A bound that moves when you change filesystems is a bound
//! that cannot be stated, and this one is stated on a screen.

use std::path::PathBuf;

use super::runtime_log;

/// The reading that turns a notice on. Never fires in any realistic life of an
/// install, which is why the live figure beside it is the actual surface.
pub const STORAGE_WARNING_BYTES: u64 = 5 * 1024 * 1024 * 1024;

/// The reading at which the oldest records start leaving, in the collection
/// that reached it and only in that one.
pub const STORAGE_CEILING_BYTES: u64 = 10 * 1024 * 1024 * 1024;

/// What eviction cuts back to, rather than to the ceiling itself.
///
/// EVICTING TO EXACTLY THE CEILING WOULD EVICT AGAIN ON THE NEXT DICTATION, and
/// again on the one after that, forever — the store would sit permanently at its
/// limit doing a compaction per sentence. Ninety percent buys back a tenth of
/// the budget, which at these sizes is hundreds of thousands of records.
const EVICT_TO: u64 = STORAGE_CEILING_BYTES / 10 * 9;

/// Where a collection stands against its two numbers.
#[derive(Debug, Clone, Copy, serde::Serialize)]
pub struct StorageBudget {
    pub bytes: u64,
    pub warning_bytes: u64,
    pub ceiling_bytes: u64,
}

impl StorageBudget {
    pub fn of(bytes: u64) -> Self {
        Self {
            bytes,
            warning_bytes: STORAGE_WARNING_BYTES,
            ceiling_bytes: STORAGE_CEILING_BYTES,
        }
    }

    /// Whether the notice is on. Deliberately not a field the two runtimes can
    /// disagree about by comparing differently.
    pub fn warned(&self) -> bool {
        self.bytes >= self.warning_bytes
    }
}

/// Bring both collections back under their ceilings, if either is over one.
///
/// **CALLED AT STARTUP AND NOWHERE ELSE**, beside `prune_retained_captures` and
/// for the same reason. A check on the dictation path would cost every sentence
/// a measurement to defend against a threshold fifty years away; a check that
/// runs once when the application opens costs one `metadata()` and one pass over
/// the archive's day stamps, and cannot miss by more than a session.
pub fn enforce_at_startup() {
    let index = super::history::enforce_journal_ceiling(STORAGE_CEILING_BYTES, EVICT_TO);
    if index > 0 {
        runtime_log::record(format!(
            "[WordScript] History index over its ceiling, evicted oldest records={index}"
        ));
    }

    let archive = super::transcript_store::enforce_archive_ceiling(STORAGE_CEILING_BYTES, EVICT_TO);
    if archive > 0 {
        runtime_log::record(format!(
            "[WordScript] Transcript archive over its ceiling, evicted oldest files={archive}"
        ));
    }
}

/// The bytes a file costs, or zero where there is no file.
///
/// A store that has never been written is zero rather than an error: on a
/// machine that has not dictated yet, *how large is your history* has an answer
/// and it is none.
pub fn file_bytes(path: &PathBuf) -> u64 {
    std::fs::metadata(path).map(|meta| meta.len()).unwrap_or(0)
}
