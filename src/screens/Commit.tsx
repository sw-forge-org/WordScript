import {
  Button,
  Card,
  CardRows,
  CheckList,
  Diff,
  DiffMark,
  DiffPane,
  Icon,
  Note,
  PreviewBanner,
  Row,
  StatusBadge,
  StatusDot,
} from "@/components/shell";

/**
 * LIVE PREVIEW & COMMIT — `SCREENS.commit`. WITHDRAWN (§11.15).
 *
 * IT IS DRAWN AND IT IS EXPLICITLY NOT A TARGET SHAPE. Do not build Phase 3
 * from this screen. It is here because a screen the plan decided against still
 * has to say so on itself, or the next reader builds from it — which is the
 * whole reason it was kept rather than deleted.
 *
 * Two reasons, both in the plan: Diagnostics already does this against the real
 * runtime and names roughly 25 applied rules where this showed four; and the
 * decision cannot live in a settings-shaped view, because you are dictating
 * into an editor, a chat or a form, and a window of this product is not where
 * you are looking.
 *
 * ONE IDEA SURVIVES — raw beside transformed rather than stacked. It moved to
 * Diagnostics as a layout line, with no commit action attached.
 *
 * The proposed layout is below a rule and at 62% opacity, so it reads as an
 * exhibit rather than as a proposal. It brightens on hover: readable when you
 * go looking, quiet while you read the argument above it.
 */
export function CommitScreen() {
  return (
    <>
      <div className="ws-view-top">
        <header className="ws-view-head">
          <h1>Live preview &amp; commit</h1>
          <p>Withdrawn. Kept as the illustration for the plan&apos;s open Phase 3 problem.</p>
        </header>
        <PreviewBanner id="commit" tone="withdrawn" />
      </div>

      {/* Three reasons, as rows. They used to be a check list, which is the
          component that reports a probe the runtime ran — a checkmark next to
          a paragraph of argument claims something was measured that was not. */}
      <Card title="Why it is withdrawn">
        <CardRows>
          <Row
            label="Diagnostics already carries it"
            hint="Diagnostics runs raw text through the real runtime and names roughly 25 applied rules. This screen showed four."
          />
          <Row
            label="The decision happens in another app"
            hint="You are dictating into an editor, a chat, a form — not looking at a window of this product."
          />
          <Row
            label="One idea survives"
            hint="Raw and transformed belong side by side. That moved to Diagnostics, with no commit action attached."
            control={<StatusBadge tone="success">Kept</StatusBadge>}
          />
        </CardRows>
      </Card>

      <Card
        title="The window it would have to live in"
        description="From src-tauri/tauri.conf.json. Taking focus would move the insert target away from the app being dictated into."
      >
        <CardRows>
          <Row label="Size" control={<span className="ws-mono ws-muted">440 × 60</span>} />
          <Row label="Focus" control={<span className="ws-mono ws-muted">false</span>} />
          <Row
            label="Chrome"
            control={
              <span className="ws-mono ws-muted">transparent · alwaysOnTop · no decorations</span>
            }
          />
        </CardRows>
        <CardRows>
          <Row layout="stack">
            <span className="ws-scale-cap">The overlay at actual size</span>
            <div className="ws-scale-box">
              <StatusDot tone="accent" />
              <span className="ws-mono">Okay, let&apos;s ship the settings restructure to…</span>
              <Button variant="primary" icon={<Icon name="check" />}>
                Commit
              </Button>
              <Button variant="ghost">Cancel</Button>
            </div>
            <span className="ws-row-hint">
              That is the whole surface. Everything below this card asks to fit inside it.
            </span>
          </Row>
        </CardRows>
      </Card>

      <Note>
        What ships today is the narrow version: clipboard_only stops, the pill offers commit,
        cancel and edit, and nothing is inspected. Phase 3 wants the wide version in the same
        window. See section 10.3.
      </Note>

      <div className="ws-withdrawn-body">
        <header className="ws-view-head">
          <h1>What was proposed</h1>
          <p>
            Below this line is the withdrawn layout, unchanged, so the argument has something to
            point at.
          </p>
        </header>

        <Card title="Transcript">
          <CardRows>
            <Row
              label="Mode"
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone="accent">Cleanup</StatusBadge>
                  <span className="ws-muted">via Auto</span>
                </span>
              }
            />
            <Row
              label="Delivery"
              control={<span className="ws-mono ws-muted">insert at cursor · xdotool</span>}
            />
          </CardRows>
          <CardRows>
            <Row layout="stack">
              <Diff>
                <DiffPane side="in" title="Raw">
                  um okay so let&apos;s uh ship the settings restructure today and and review the
                  overlay tab yeah
                </DiffPane>
                <DiffPane side="out" title="Cleanup">
                  Okay, let&apos;s ship the settings restructure today and review the{" "}
                  <DiffMark>overlay</DiffMark> tab.
                </DiffPane>
              </Diff>
            </Row>
          </CardRows>
        </Card>

        {/* The rule names are the runtime's own — the same labels Diagnostics
            prints. A preview that invents its own vocabulary teaches a word the
            product does not use. */}
        <Card title="What was applied" description="Every change, named by the rule that made it.">
          <CheckList
            items={[
              { state: "ok", label: "Removed filler words", detail: "“um”, “uh”." },
              { state: "ok", label: "Collapsed a repeated word", detail: "“and and” → “and”." },
              {
                state: "ok",
                label: "Dictionary replacement applied",
                detail: "“overlay”, from the profile vocabulary.",
              },
              { state: "ok", label: "Capitalized sentence start", detail: "One sentence." },
              { state: "ok", label: "AI post-correction applied", detail: "Cleanup, 673 ms." },
              {
                state: "todo",
                label: "Hallucination filtered",
                detail: "Nothing filtered. No content was added.",
              },
            ]}
          />
        </Card>

        <div className="ws-rowflex">
          <Button variant="primary" icon={<Icon name="check" />}>
            Commit
          </Button>
          <Button icon={<Icon name="restore" />}>Retry</Button>
          <Button variant="ghost" icon={<Icon name="copy" />}>
            Copy
          </Button>
          <Button variant="ghost">Cancel</Button>
        </div>
      </div>
    </>
  );
}
