import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { ProviderMark } from "./ProviderMark";

/**
 * A JOB IS A ROW THAT OPENS — `demo.js`'s `job()`.
 *
 * Closed, it answers the only question most people have: what is running this,
 * and is it the default or something I changed. Open, it is that job's whole
 * settings — no second screen, no tab, no navigation.
 *
 * THE BADGE CARRIES THE ONE FACT THE LIST EXISTS FOR. `default` means it
 * follows the connection above, so changing the connection changes it. Anything
 * else is an override and says which provider it went to, because an override
 * is the reason a list like this is ever read.
 */
export function JobList({ children }: { children: ReactNode }) {
  return <div className="ws-joblist">{children}</div>;
}

export function Job({
  name,
  what,
  control,
  rows,
  extra,
}: {
  name: string;
  /** What this job is. One line, under the name. */
  what: ReactNode;
  /** The `JobModel` badge, or whatever stands in for it. */
  control: ReactNode;
  /** The job's own settings, as a `CardRows`. */
  rows: ReactNode;
  /** Notes below the rows, inside the open body. */
  extra?: ReactNode;
}) {
  return (
    <details className="ws-job ws-job-open">
      <summary>
        <Icon name="chevron" />
        <span className="ws-job-text">
          <b>{name}</b>
          <span>{what}</span>
        </span>
        <span className="ws-job-ctl">{control}</span>
      </summary>
      <div className="ws-job-body">
        {rows}
        {extra}
      </div>
    </details>
  );
}

/**
 * A job with nothing to open. Two cases and they are the same drawing: a mode
 * that runs no model at all, and a job this lane cannot run.
 *
 * The second one says so in place of a model and names the lane that can — an
 * empty picker would be worse than the sentence. They belong on this screen for
 * one reason: "why can I not set a model for Verbatim" is answered by seeing it
 * stated. An absence answers nothing.
 */
export function JobNone({
  name,
  why,
  control,
}: {
  name: string;
  why: ReactNode;
  control?: ReactNode;
}) {
  return (
    <div className="ws-job" data-none="">
      <div className="ws-job-text">
        <b>{name}</b>
        <span>{why}</span>
      </div>
      <div className="ws-job-ctl">{control}</div>
    </div>
  );
}

/**
 * THE MODEL A JOB RUNS. Not a badge — a badge is a status, and this is an
 * identity: a mark, a name and where it came from.
 *
 * THE MARK IS WHAT MAKES THE COLUMN SCANNABLE. Twelve rows of model names are
 * twelve strings that have to be read; the same twelve with a provider mark in
 * front are sorted by shape at a glance, and the one that went somewhere else is
 * visible without reading any of them.
 *
 * `mark: null` means this job is not on the connection's axis at all — speech
 * synthesis has its own lane — so it gets neither a mark nor the `default`
 * suffix, which would be claiming it follows something.
 */
export function JobModel({
  mark,
  model,
  override,
}: {
  /** The brand to draw. `null` takes this row off the connection's axis. */
  mark: string | null;
  model: string;
  /** The provider this job went to instead. Absent means it follows. */
  override?: string;
}) {
  const offAxis = mark === null;
  return (
    <span className="ws-jobmodel" data-override={override ? "true" : undefined}>
      {!offAxis && <ProviderMark name={mark} />}
      <span className="ws-jobmodel-name">{model}</span>
      {!offAxis && <span className="ws-job-prov">{override ?? "default"}</span>}
    </span>
  );
}

/**
 * The mark that travels with a select. The connection row and the per-job
 * override rows use the same pairing, which is what makes them read as one
 * control appearing twice rather than as two designs for one decision.
 */
export function SelectMark({ name }: { name: string }) {
  return (
    <span className="ws-selmark">
      <ProviderMark name={name} />
    </span>
  );
}
