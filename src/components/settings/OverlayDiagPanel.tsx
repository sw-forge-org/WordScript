import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Bug, Trash2, Terminal } from "lucide-react";
import { Button } from "../ui/button";

// DEV-only Overlay Diagnose-Panel (plan 1784433288646, Phase 1.2).
// Polls /tmp/kilo/overlay-diag.log via the `read_diag_log` Rust command and
// displays it live. Provides buttons to open the overlay window's WebKit
// DevTools and to clear the log. This component is only rendered when
// `import.meta.env.DEV` is true — it is stripped from production builds.

const POLL_INTERVAL_MS = 500;
const MAX_LOG_CHARS = 50_000;

export function OverlayDiagPanel() {
  const [log, setLog] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const refresh = useCallback(async () => {
    try {
      const content = await invoke<string>("read_diag_log");
      // Tail-truncate so the browser doesn't choke on a multi-MB log after a
      // long dev session.
      setLog(content.length > MAX_LOG_CHARS ? content.slice(-MAX_LOG_CHARS) : content);
    } catch {
      // ignore — the log file may not exist yet
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (!autoScroll) return;
    const el = preRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log, autoScroll]);

  const handleOpenDevTools = async () => {
    try {
      await invoke("overlay_open_devtools");
      setStatus("DevTools opened (check for a new window).");
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    window.setTimeout(() => setStatus(null), 2000);
  };

  const handleClear = async () => {
    try {
      await invoke("clear_diag_log");
      setLog("");
      setStatus("Log cleared.");
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    window.setTimeout(() => setStatus(null), 1500);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void handleOpenDevTools()}>
            <Terminal className="mr-1.5 size-3.5" strokeWidth={2} />
            Open Overlay DevTools
          </Button>
          <Button size="sm" variant="outline" onClick={() => void handleClear()}>
            <Trash2 className="mr-1.5 size-3.5" strokeWidth={2} />
            Clear Diag Log
          </Button>
        </div>
        <label className="flex cursor-pointer select-none items-center gap-2 text-[12px] text-fg-muted">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="size-3.5 accent-[var(--accent)]"
          />
          Auto-scroll
        </label>
      </div>

      {status && (
        <p className="text-[12px] text-fg-muted">{status}</p>
      )}

      <div className="rounded-md border border-border bg-[#0d0d0f]">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Bug className="size-3.5 text-fg-dim" strokeWidth={2} />
          <span className="text-[11px] font-medium uppercase tracking-wide text-fg-dim">
            /tmp/kilo/overlay-diag.log
          </span>
        </div>
        <pre
          ref={preRef}
          className="max-h-[480px] overflow-auto p-3 font-mono text-[11px] leading-relaxed text-[#c8c8d0] [scrollbar-gutter:stable]"
        >
          {log || "(empty — tap the overlay ModeChip to generate [ov-*] entries)"}
        </pre>
      </div>
    </div>
  );
}
