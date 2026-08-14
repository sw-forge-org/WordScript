#!/usr/bin/env bash
# Reads the capture events the runtime-ownership track is waiting for, and
# applies ADR 0133's pre-registered reading to each one.
#
# WHY THIS EXISTS. Step 6 of docs/tracks/runtime-ownership.md waits on one
# natural `Short` capture -- about 1.5 % of captures, so a day or two of
# ordinary use. The reading that decides it was registered in advance, in
# ADR 0133, precisely so nobody chooses it after seeing the numbers. Between the
# registration and the event sit however many sessions it takes, and the risk is
# not that the reading is hard: it is that the event arrives, nobody is looking,
# and the log rotates. This turns the wait into one command.
#
#   scripts/read-capture-event.sh [logfile]
#
# It decides nothing on its own. It prints the two numbers ADR 0133 named and
# the verdict that follows from them, and it refuses to read an event that
# predates the instrument -- those are unreadable by construction, and saying so
# is the whole point of having built the instrument.
#
# Exit status: 0 when at least one readable Short capture was found, 1 when
# none was, 2 on a usage or input error.

set -euo pipefail

LOG="${1:-$HOME/.config/WordScript/logs/wordscript-runtime.log}"

if [[ ! -r "$LOG" ]]; then
  echo "No readable runtime log at: $LOG" >&2
  echo "Pass one as the first argument, or start the app once." >&2
  exit 2
fi

# The share of the longest gap that has to be our own lock before the gap stops
# being called a suspended stream. Mirrors LOCK_WAIT_DOMINATES_AT in
# src-tauri/src/core/capture.rs, which is the authority -- the runtime prints
# `signature=` from it, and this only explains what the runtime already decided.
LOCK_WAIT_DOMINATES_AT=0.5

awk -v dominates="$LOCK_WAIT_DOMINATES_AT" '
function field(line, key,   value) {
  # Reads `key=value` out of a runtime log line. Positional parsing is what the
  # soak report does and what ADR 0133 warned about; by name, a field appended
  # later cannot silently shift a column.
  if (match(line, key "=[^ ]+")) {
    value = substr(line, RSTART, RLENGTH)
    sub(key "=", "", value)
    return value
  }
  return ""
}

/Capture integrity/ && /verdict=Short/ {
  pending = $0
  next
}

/Capture callback cadence/ {
  if (pending == "") next

  found++
  stamp = pending
  sub(/^\[/, "", stamp)
  sub(/\].*/, "", stamp)

  wall = field(pending, "wall_seconds")
  recorded = field(pending, "recorded_seconds")
  missing = field(pending, "missing_ratio")

  longest_gap = field($0, "longest_gap_ms")
  lock_wait = field($0, "slowest_lock_wait_ms")
  lock_total = field($0, "lock_wait_total_ms")
  below = field($0, "lost_below_threshold_seconds")
  in_gaps = field($0, "lost_in_gaps_seconds")
  signature = field($0, "signature")

  printf "\n── Short capture at %s ──────────────────────────────\n", stamp
  printf "  wall %ss, recorded %ss, missing %s\n", wall, recorded, missing
  printf "  longest gap %s ms, lost in gaps %ss\n", longest_gap, in_gaps
  # Absent on every line older than step 3, and printed as absent rather than as
  # a bare unit: a blank number reads as zero, and zero is a measurement.
  printf "  lost below threshold: %s\n", (below == "" ? "not measured (predates ADR 0133)" : below "s")
  printf "  runtime signature: %s\n", signature

  if (lock_wait == "") {
    # Step 3 landed 2026-08-14. Before it, a suspended stream and a
    # self-inflicted stall were one number, and no amount of care re-reads them
    # apart: the ambiguity is in the numbers, not in how they were interpreted.
    printf "\n  UNREADABLE. This event predates the cadence instrument (ADR 0133):\n"
    printf "  it carries no slowest_lock_wait_ms, so a suspended stream and a\n"
    printf "  self-inflicted stall are the same number here. Not this step'"'"'s event.\n"
    unreadable++
    pending = ""
    next
  }

  readable++
  printf "  slowest lock wait %s ms, lock wait total %s ms\n", lock_wait, lock_total
  printf "\n  ADR 0133, registered in advance:\n"

  if (longest_gap + 0 > 0 && lock_wait + 0 >= (longest_gap + 0) * dominates) {
    printf "  -> THE APP BLOCKED ITS OWN AUDIO THREAD. The lock wait is %.0f%% of the\n", (lock_wait / longest_gap) * 100
    printf "     longest gap. The fix is ours: the three realtime violations named in\n"
    printf "     ADR 0133'"'"'s Consequences are no longer on hold.\n"
    ours++
  } else {
    printf "  -> THE CALLBACK GENUINELY WAS NOT CALLED. The lock wait is %s ms against\n", lock_wait
    printf "     a %s ms gap. Hypothesis 1 has real support for the first time, and the\n", longest_gap
    printf "     outcome is a PipeWire-side investigation rather than an app fix.\n"
    theirs++
  }

  pending = ""
}

END {
  if (found == 0) {
    printf "No Short capture in this log.\n"
    printf "That is the expected state: they run at about 1.5%% of captures.\n"
    printf "Step 6 of docs/tracks/runtime-ownership.md is waiting for one.\n"
    exit 1
  }

  printf "\n────────────────────────────────────────────────────────\n"
  printf "%d Short capture(s): %d readable, %d predating the instrument.\n", found, readable, unreadable
  if (readable > 0) {
    printf "Reading: %d name the app, %d name the stream.\n", ours, theirs
    printf "\nAppend the event to docs/known-issues/capture-loses-half-the-recording.md\n"
    printf "-- Core hardening writes there too, so re-read it before appending.\n"
    exit 0
  }
  exit 1
}
' "$LOG"
