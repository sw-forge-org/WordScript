import { Fragment, type ReactNode } from "react";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";

/**
 * THE ONBOARDING RAIL, ITS STEP HEADING AND ITS FOOT — `demo.js`'s `rail()`,
 * the `obstep` block and `foot()`.
 *
 * THE RAIL IS A CONTROL, NOT A DECORATION. A progress indicator you cannot
 * click is a promise that the flow is linear, and this one is not: every step
 * before the current one is a decision you may want to revisit after seeing
 * what it caused. Steps ahead stay unreachable, because claiming you can jump
 * to a step whose prerequisites are unmet is the same lie in the other
 * direction — so a step behind is a `<button>` and a step ahead is a `<span>`.
 */

export type OnboardingStep = { id: string; label: string; icon: IconName };

export function OnboardingRail({
  steps,
  index,
  onJump,
}: {
  steps: OnboardingStep[];
  index: number;
  onJump?: (index: number) => void;
}) {
  return (
    <div className="ws-obrail">
      {steps.map((step, ix) => {
        const state = ix < index ? "done" : ix === index ? "now" : "todo";
        const inner = (
          <>
            <span className="ws-obrail-dot">
              <Icon name={state === "done" ? "check" : step.icon} />
            </span>
            <span className="ws-obrail-label">{step.label}</span>
          </>
        );
        return (
          <Fragment key={step.id}>
            {ix <= index ? (
              <button
                type="button"
                className="ws-obrail-step"
                data-state={state}
                onClick={() => onJump?.(ix)}
              >
                {inner}
              </button>
            ) : (
              <span className="ws-obrail-step" data-state={state}>
                {inner}
              </span>
            )}
            {ix < steps.length - 1 && (
              <span className="ws-obrail-bar" data-state={ix < index ? "done" : "todo"} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

export function OnboardingStepHead({ n, total, title }: { n: number; total: number; title: string }) {
  return (
    <div className="ws-obstep">
      <span className="ws-obstep-n">{`Step ${n} of ${total}`}</span>
      <h2>{title}</h2>
    </div>
  );
}

/**
 * Back on the left, forward on the right, and the gap between them is the
 * point: they are opposite actions and must never be adjacent. The empty span
 * on step one holds the left slot so the forward button does not slide across.
 */
export function OnboardingFoot({
  onBack,
  onNext,
  nextLabel = "Continue",
  skip,
  onSkip,
  blocked,
  last,
  onRestart,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: ReactNode;
  skip?: ReactNode;
  onSkip?: () => void;
  blocked?: boolean;
  last?: boolean;
  onRestart?: () => void;
}) {
  return (
    <div className="ws-obfoot">
      {onBack ? (
        <Button variant="ghost" icon={<Icon name="arrow-left" />} onClick={onBack}>
          Back
        </Button>
      ) : (
        <span />
      )}
      <div className="ws-rowflex">
        {skip && (
          <Button variant="ghost" onClick={onSkip}>
            {skip}
          </Button>
        )}
        {last ? (
          <Button variant="primary" onClick={onRestart}>
            Start over
          </Button>
        ) : (
          <Button variant="primary" disabled={blocked} onClick={onNext}>
            {nextLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
