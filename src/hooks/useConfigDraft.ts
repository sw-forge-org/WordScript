import { useCallback, useEffect, useRef, useState } from "react";
import type { AppConfig } from "../types/ipc";

/**
 * THE WRITE HALF OF THE SEAM — one config draft per window, and P1 lives here.
 *
 * A window reads the runtime once (`useRuntime`) and holds one draft of the
 * config; every wired screen it mounts is handed that draft and these two
 * writers. Two windows mount Diagnostics — the settings sheet and its pop-out —
 * so this is a hook rather than a block inside `WorkspaceWindow`: two copies of
 * an instant-save contract is exactly the shape of defect ADR 0054 is about.
 *
 * P1 — EVERY KEYSTROKE WAS AN IPC ROUND TRIP AND A DISK WRITE. `patch()` is one
 * `invoke("save_config")`, one Rust config lock and one JSON write. Bound
 * straight to an <input> that is roughly five of them a second at ordinary
 * typing speed, and plan §2.4 measured it as the single largest interaction
 * cost in the pre-port surface. `patchText()` puts the draft in the form on the
 * keystroke — what you typed is never behind the cursor — and debounces only
 * the write. A discrete control keeps instant save, because there is no such
 * thing as a half-pressed toggle.
 *
 * A DISCRETE PATCH FLUSHES A PENDING TEXT COMMIT FIRST. Without that, a
 * debounced keystroke could land after a later toggle, carrying the config the
 * keystroke was computed from, and quietly revert the toggle.
 */

/* Long enough that ordinary typing produces one write per pause rather than
   five a second, short enough that a user who types and immediately closes the
   window does not out-run it — and the close path flushes anyway. */
const TEXT_COMMIT_MS = 400;

export interface ConfigDraft {
  /** Null until the runtime has answered with a config. */
  form: AppConfig | null;
  patch: (partial: Partial<AppConfig>) => void;
  patchText: (partial: Partial<AppConfig>) => void;
  flushText: () => void;
}

export function useConfigDraft(
  config: AppConfig | null,
  saveConfig: (next: AppConfig) => Promise<AppConfig>,
): ConfigDraft {
  const [form, setForm] = useState<AppConfig | null>(null);

  /* Guards the form against a stale `ready` event clobbering an in-flight user
     edit. `save_config` emits a `ready` carrying the SAVED config; under the
     Rust config lock overlapping saves resolve in call order (A then B), so
     ready(A) can land AFTER the user already edited further to B. The
     unconditional sync would then revert the form A→B→A→B. (plan P1, root C1) */
  const inFlightSaveCountRef = useRef(0);
  const [formResyncNonce, setFormResyncNonce] = useState(0);
  const latestConfigRef = useRef<AppConfig | null>(null);
  useEffect(() => {
    latestConfigRef.current = config;
  }, [config]);

  // Populate the form when the runtime provides config.
  useEffect(() => {
    if (config && !form) setForm({ ...config });
  }, [config, form]);

  // Keep the form in sync if config reloads externally — but NEVER clobber an
  // in-flight user edit. (plan P1, root C1)
  useEffect(() => {
    if (inFlightSaveCountRef.current > 0) return;
    if (config) setForm({ ...config });
  }, [config, formResyncNonce]);

  const commit = useCallback((next: AppConfig, revertTo: AppConfig) => {
    inFlightSaveCountRef.current += 1;
    const settle = () => {
      inFlightSaveCountRef.current = Math.max(0, inFlightSaveCountRef.current - 1);
      if (inFlightSaveCountRef.current === 0) {
        if (latestConfigRef.current) setForm({ ...latestConfigRef.current });
        setFormResyncNonce((n) => n + 1);
      }
    };

    void saveConfig(next).then(settle).catch(() => {
      // The runtime refused it, so the form goes back to what the runtime
      // still holds rather than showing a value it rejected.
      setForm(revertTo);
      settle();
    });
  }, [saveConfig]);

  const pendingTextRef = useRef<AppConfig | null>(null);
  const textRevertRef = useRef<AppConfig | null>(null);
  const textTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushText = useCallback(() => {
    if (textTimerRef.current !== null) {
      clearTimeout(textTimerRef.current);
      textTimerRef.current = null;
    }
    const next = pendingTextRef.current;
    const revertTo = textRevertRef.current;
    pendingTextRef.current = null;
    textRevertRef.current = null;
    if (next && revertTo) commit(next, revertTo);
  }, [commit]);

  const flushTextRef = useRef(flushText);
  useEffect(() => {
    flushTextRef.current = flushText;
  }, [flushText]);

  // Nothing typed may be lost to a close, a reload or a hot update.
  useEffect(() => () => flushTextRef.current(), []);

  const patchText = useCallback((partial: Partial<AppConfig>) => {
    setForm((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      // Idempotent: React may run an updater twice, and twice with the same
      // `prev` produces the same `next`.
      pendingTextRef.current = next;
      if (textRevertRef.current === null) textRevertRef.current = prev;
      return next;
    });
    if (textTimerRef.current !== null) clearTimeout(textTimerRef.current);
    textTimerRef.current = setTimeout(() => {
      textTimerRef.current = null;
      flushTextRef.current();
    }, TEXT_COMMIT_MS);
  }, []);

  const patch = useCallback((partial: Partial<AppConfig>) => {
    flushText();
    setForm((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      commit(next, prev);
      return next;
    });
  }, [commit, flushText]);

  return { form, patch, patchText, flushText };
}
