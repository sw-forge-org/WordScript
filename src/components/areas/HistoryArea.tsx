import { useEffect, useMemo, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { Download, RefreshCw, RotateCcw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormCard, FormRow, Select, StatusBadge, Toggle } from "@/components/shell";
import type { StatusTone } from "@/components/shell";
import { useTranscriptionHistory } from "@/hooks/useTranscriptionHistory";
import { relativeTime, truncate } from "@/lib/format";
import type { AppConfig } from "@/types/ipc";
import type {
  TranscriptionHistoryQuery,
  TranscriptionHistoryStatus,
} from "@/types/history";

interface HistoryAreaProps {
  isActive: boolean;
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}

const HISTORY_LIMITS = [50, 100, 200, 500, 1000];
const RETENTION_OPTIONS: { value: number; label: string }[] = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
  { value: 0, label: "Keep all" },
];

const statusTone: Record<TranscriptionHistoryStatus, StatusTone> = {
  completed: "success",
  empty: "neutral",
  failed: "error",
};

export function HistoryArea({ isActive, config, onChange }: HistoryAreaProps) {
  const history = useTranscriptionHistory(isActive);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TranscriptionHistoryStatus | "">("");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const query = useMemo<TranscriptionHistoryQuery>(
    () => ({
      search: search || undefined,
      status: status || undefined,
      include_errors_only: errorsOnly || undefined,
    }),
    [search, status, errorsOnly],
  );

  useEffect(() => {
    if (!isActive) return;
    void history.refresh(query, { background: true });
  }, [isActive, query, history]);

  const handleExport = async () => {
    const path = await save({
      title: "Export transcription history",
      defaultPath: "wordscript-history.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;
    const result = await history.exportEntries(path, query);
    setNote(result ? `Exported ${result.exported_count} entries.` : "Export failed.");
    setTimeout(() => setNote(null), 2500);
  };

  return (
    <div className="flex flex-col gap-8">
      <FormCard
        title="Filters"
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void history.refresh(query)}>
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
            <Button size="sm" variant="outline" onClick={() => void handleExport()}>
              <Download className="size-3.5" /> Export
            </Button>
          </div>
        }
      >
        <FormRow
          label="Search"
          layout="stacked"
          control={
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search transcripts…"
                className="pl-8"
              />
            </div>
          }
        />
        <FormRow
          label="Status"
          control={
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as TranscriptionHistoryStatus | "")}
              className="w-44"
            >
              <option value="">All</option>
              <option value="completed">Completed</option>
              <option value="empty">Empty</option>
              <option value="failed">Failed</option>
            </Select>
          }
        />
        <FormRow
          label="Errors only"
          hint="Show only captures that failed to transcribe or insert."
          divider={false}
          control={<Toggle checked={errorsOnly} onCheckedChange={setErrorsOnly} />}
        />
      </FormCard>

      <FormCard
        title={`Transcriptions (${history.entries.length})`}
        action={
          <Button
            size="sm"
            variant="ghost"
            disabled={history.entries.length === 0 || history.isLoading}
            onClick={() => void history.clear()}
          >
            <Trash2 className="size-3.5" /> Clear all
          </Button>
        }
      >
        {history.entries.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-fg-muted">
            No transcriptions match these filters.
          </div>
        ) : (
          <ul className="flex flex-col">
            {history.entries.map((entry) => {
              const text =
                entry.transformed_transcript ||
                entry.raw_transcript ||
                (entry.status === "failed" ? entry.error ?? "Failed" : "Empty capture");
              // Retry works from a transcript (re-run the transform) or from a
              // recording the runtime kept after a recoverable failure
              // (re-transcribe it). With neither there is nothing behind the
              // button, and a button that only sometimes does something is
              // worse than one that is plainly unavailable — the same rule the
              // overlay's error surface follows.
              const retryable =
                Boolean(entry.raw_transcript?.trim()) || Boolean(entry.audio_path?.trim());
              return (
                <li
                  key={entry.id}
                  className="ws-list-item-default flex items-start gap-3 border-b border-border py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <StatusBadge tone={statusTone[entry.status]} dot>
                        {entry.status}
                      </StatusBadge>
                      <span className="text-[11px] text-fg-muted">
                        {entry.provider}
                        {entry.model ? ` · ${entry.model}` : ""}
                      </span>
                      {entry.active_profile && (
                        <span className="text-[11px] text-fg-muted">· {entry.active_profile}</span>
                      )}
                      {entry.source === "retry" && (
                        <span className="text-[11px] text-[var(--voice)]">· retry</span>
                      )}
                    </div>
                    <p className="text-[12px] leading-snug text-fg-dim">{truncate(text, 180)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-[11px] tabular-nums text-fg-muted">
                      {relativeTime(entry.created_at_ms)}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label={
                          entry.audio_path && !entry.raw_transcript?.trim()
                            ? "Retry from the recording"
                            : "Retry"
                        }
                        title={
                          retryable
                            ? entry.audio_path && !entry.raw_transcript?.trim()
                              ? "Transcribe the kept recording again"
                              : "Run the transform over this transcript again"
                            : "Nothing to retry from: this entry has no transcript and no kept recording"
                        }
                        disabled={history.isLoading || !retryable}
                        onClick={() => void history.retry(entry.id)}
                      >
                        <RotateCcw className="size-3.5" />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label="Delete"
                        disabled={history.isLoading}
                        onClick={() => void history.remove(entry.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </FormCard>

      <FormCard title="History policy" description="How much history WordScript keeps on this machine.">
        <FormRow
          label="Stored entries"
          hint="Maximum number of transcriptions kept locally."
          control={
            <Select
              value={String(config.history_limit)}
              onChange={(e) => onChange({ history_limit: Number(e.target.value) })}
              className="w-32"
            >
              {HISTORY_LIMITS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          }
        />
        <FormRow
          label="Retention window"
          hint="Older entries are pruned automatically."
          divider={false}
          control={
            <Select
              value={String(config.history_retention_days)}
              onChange={(e) => onChange({ history_retention_days: Number(e.target.value) })}
              className="w-32"
            >
              {RETENTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          }
        />
      </FormCard>

      {(note || history.error) && (
        <p className={`text-[12px] ${history.error ? "text-[var(--red)]" : "text-fg-dim"}`}>
          {history.error ?? note}
        </p>
      )}
    </div>
  );
}
