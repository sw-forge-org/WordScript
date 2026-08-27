/* 1 - CURSOR: THE SEVEN PROCESSING MODES

   The order is the six concrete modes first and Auto last, behind the divider
   the app's own sub-tab row uses for an entry that is not the same kind of
   thing as the ones before it. Auto is not a seventh way of writing; it is the
   decision about which of the six runs.

   Every mode name, every preset and every rule id below is the runtime's own.
   Where a scene states what a mode does to text, the source is
   src-tauri/src/core/config.rs and src/lib/transformRules.ts, not a sentence
   written for this page. */
import { $, $$ } from '../dom';
import { lenOf, rawHTML, rawFull, type Raw, type Runner } from '../runner';
import { mountPill, type Pill } from '../pill';

export type Mode = { id: string; label: string; key: string; pill?: string; rule?: false }
                 | { rule: true; id?: undefined; label?: undefined; key?: undefined; pill?: undefined };

/* THE KEY IS THE ANSWER TO THE QUESTION THE MODE LIST RAISES.
   A row of seven names invites exactly one question -- how do I get to one of
   them -- and a page that lists the modes without answering it has described a
   feature nobody can reach. The runtime answers three ways: a direct key per
   mode, the picker on Alt+S, and the chip on the capsule, which is a button.
   All three are on this page now.

   Every value below is the shipped default from default_mode_*_hotkey in
   src-tauri/src/core/config.rs. They are configurable, which is why the page
   says "out of the box" beside them rather than stating them as fixed. */
export const MODES: Mode[] = [
  { id: 'cleanup',   label: 'Cleanup',        key: 'Alt+3' },
  { id: 'verbatim',  label: 'Verbatim',       key: 'Alt+2' },
  { id: 'rewrite',   label: 'Rewrite',        key: 'Alt+4' },
  { id: 'translate', label: 'Translate',      key: 'Alt+5' },
  { id: 'agent',     label: 'Draft',          key: 'Alt+6' },
  { id: 'enhance',   label: 'Prompt Enhance', key: 'Alt+7', pill: 'Enhance' },
  { rule: true },
  { id: 'auto',      label: 'Auto',           key: 'Alt+1' },
];

/** The capture trigger and the two session keys, as the runtime ships them
 *  (default_hotkey / default_pause_hotkey / default_abort_hotkey). */
export const KEYS = {
  capture: 'Ctrl+Super',
  pause:   'Ctrl+Space',
  abort:   'Ctrl+Alt',
  picker:  'Alt+S',
};

/** ADR 0011a: a profile has one of these, and it decides which single decision
 *  surface the overlay shows. There is no third path and no path with both. */
export type Delivery = 'auto_paste' | 'clipboard_only';

export type TextScene = {
  kind?: undefined;
  win: string;
  raw: Raw;
  out?: string;
  keep?: boolean;
  short: string;
  learn?: string;
  rules: [string, string][];
  rulesK?: string;
  note: string;
};

export type RouteScene = {
  kind: 'route';
  win: string;
  rulesK: string;
  routes: [string, string, string][];
  note: string;
};

export type Scene = TextScene | RouteScene;

export const SCENES: Record<string, Scene> = {
  cleanup: {
    win: 'A message to your team',
    raw: [
      ['so i think we should ', 0], ['um', 1], [' ship ', 0], ['the the', 1],
      [' migration on friday but only if the ', 0], ['uh', 1], [' backfill finishes', 0],
    ],
    out: 'So I think we should ship the migration on Friday, but only if the backfill finishes.',
    short: 'So I think we should ship the migration',
    learn: 'backfill',
    rules: [
      ['removed_fillers', 'took out "um" and "uh"'],
      ['word_repetition_collapsed', '"the the" became "the"'],
      ['capitalized_sentence_start', 'opened the sentence'],
      ['post_corrected', 'the correction model ran and cleared the guardrails'],
      ['added_terminal_punctuation', 'closed it with a period'],
    ],
    note: 'Post-processing on, filler filter on, professionalise off. Cleanup repairs what you said. It does not change how you sound.',
  },

  verbatim: {
    win: 'A transcript you are keeping',
    raw: [
      ['she said, and i wrote it down, ', 0], ['um', 1],
      [', we left before eleven, and then ', 0], ['the the', 1], [' tape stops', 0],
    ],
    keep: true,
    short: 'she said, and i wrote it down, um,',
    rules: [
      ['post_process_disabled', 'the correction stage never ran'],
      ['trimmed_edges', 'leading and trailing space, and nothing else'],
    ],
    note: 'Post-processing off, filler filter off, professionalise off. Auto cannot select Verbatim: a mode that removes nothing has to be a decision you made.',
  },

  rewrite: {
    win: 'A mail to a client',
    raw: [
      ['hey, ', 0], ['um', 1],
      [', friday is not going to work, the backfill is not done, sorry about that, tuesday would be fine though', 0],
    ],
    out: 'Friday will not work on our side: the backfill has not finished. Tuesday would suit us, if that works for you.',
    short: 'Friday will not work on our side:',
    rules: [
      ['removed_fillers', 'took out "um"'],
      ['capitalized_sentence_start', 'opened the sentence'],
      ['post_corrected', 'the correction model raised the register and kept the facts'],
      ['added_terminal_punctuation', 'closed it'],
    ],
    note: 'The only mode that turns professionalise on, and the second of the two Auto will not pick. Changing how you sound is a choice, not a repair.',
  },

  translate: {
    win: 'A chat window, and you are answering in English',
    raw: [['können wir den termin für den wordscript rollout auf nächste woche dienstag verschieben', 0]],
    out: 'Could we move the WordScript rollout to next Tuesday?',
    short: 'Could we move the WordScript rollout',
    rules: [
      ['own_prompt', 'Translate writes its own prompt, so the correction stage does not run'],
      ['words_and_names', '"WordScript" is in your profile, so it came through untouched'],
      ['address_form', 'the German was formal, so the English is'],
    ],
    note: 'Auto never selects a language. Two people at one table is the same capability through a different door: a window, where nothing is inserted anywhere.',
  },

  agent: {
    win: 'A reply, in your mail client',
    raw: [
      ['answer maria, ', 0], ['uh', 1],
      [' the migration is on hold until the backfill lands, and offer her tuesday', 0],
    ],
    out: 'Hi Maria, we are holding the migration until the backfill has landed, so Friday is out. Tuesday would work on our side. Let me know whether that suits you.',
    short: 'Hi Maria, we are holding the migration',
    rules: [
      ['own_prompt', 'the assistant writes it, so the correction stage does not run'],
      ['citation', 'what it read is named on the record'],
      ['no_reach', 'it writes text and reaches nothing'],
    ],
    note: 'Draft is the assistant, inside a dictation. It is not the desk: it writes text and reaches nothing. Crossing that line is the third tab, and it is keyed.',
  },

  enhance: {
    win: 'The prompt field of your coding agent',
    raw: [['make the overlay stop jumping when the second monitor wakes up', 0]],
    out: 'Fix the overlay placement when a second monitor wakes: it must return to its remembered position instead of re-centring. Constraint: only a real user drag may change that position.',
    short: 'Fix the overlay placement when a second',
    rules: [
      ['own_prompt', 'Enhance writes its own prompt, so the correction stage does not run'],
      ['workspace_context', 'one bounded line about what you have open, and it may not take content from it'],
      ['imperative_kept', 'an instruction stays an instruction'],
    ],
    note: 'This is what Auto reaches for when you dictate an imperative and an editor has focus. The window you are in is the signal.',
  },

  auto: {
    kind: 'route',
    win: 'Three dictations, one after another',
    rulesK: 'Where each one went, and why',
    routes: [
      ['push the standup to nine thirty, from tomorrow', 'Cleanup',
       'no name and no imperative, so it fell through to the default'],
      ['wordscript, write the mail from the tuesday meeting', 'Draft',
       'addressed by name, then a task, and certain enough to route without asking a model'],
      ['stop the overlay jumping when the second monitor wakes', 'Prompt Enhance',
       'an imperative, and an editor has focus'],
    ],
    note: 'Auto is the only place intent is classified, and a concrete mode is never re-decided after it. It cannot return Verbatim, Rewrite or Translate. Those three stay your call.',
  },
};

export const modeLabel = (id: string) => {
  const m = MODES.find(x => x.id === id);
  return m && m.label ? (m.pill || m.label) : 'Cleanup';
};

export function makeCursor(root: HTMLElement, reduced: boolean, say: (s: string) => void) {
  const field = $('[data-field]', root)!;
  const rulesBox = $('[data-rules]', root)!;
  const sceneWin = $('[data-scene-win]', root)!;
  const rulesK = $('[data-rules-k]', root)!;
  const sceneNote = $('[data-scene-note]', root)!;
  const clipNote = $('[data-clip-note]', root);
  const capHost = $('[data-cap-pill]', root);
  const capPill: Pill | null = mountPill(capHost, reduced);

  /* THE END OF A SEQUENCE IS A PARKED CAPSULE, NOT A DISMISSED ONE.

     The result surface closes itself in the app (autoCloseSec) and the overlay
     parks; `clipboard_only` closes it on the commit and the next capture opens
     it again. Either way the reader is left looking at a capsule with a mode
     chip on it, and this page needs that state for a second reason: the chip
     is now the only mode control in the section, so a sequence that stopped on
     result-actions -- which carries no chip, here or in the app -- would end by
     removing the one thing the panel asks the reader to press. */
  const park = (label: string, lang?: string) => {
    capHost?.classList.remove('ov--gone');
    capPill?.set('mode-picker', { mode: label, lang });
  };

  return {
    pill: capPill,

    play(run: Runner, mode: string, delivery: Delivery = 'auto_paste') {
      const clip = delivery === 'clipboard_only';
      capHost?.classList.remove('ov--gone');
      if (clipNote) clipNote.textContent = '';
      const s = SCENES[mode];
      sceneWin.textContent = s.win;
      rulesK.textContent = s.rulesK || 'What it changed';
      sceneNote.textContent = s.note;

      /* ---- Auto: the router, not an eighth way of writing ---------------- */
      if (s.kind === 'route') {
        field.innerHTML = s.routes
          .map(([said]) => `<div class="route"><span class="route__q">${said}</span></div>`).join('');
        rulesBox.innerHTML = s.routes
          .map(([, dest, why]) => `<div class="rule"><span class="n">${dest}</span><span class="v">${why}</span></div>`).join('');
        const rEls = $$('.route', field), ruEls = $$('.rule', rulesBox);
        capPill?.clear();

        if (reduced) {
          rEls.forEach((el, i) => { el.classList.add('is-on'); el.dataset.dest = s.routes[i][1]; });
          ruEls.forEach(el => el.classList.add('is-on'));
          say('Routed');
          return;
        }
        const steps: [number, () => void][] = [
          [200, () => { capPill?.set('recording', { mode: 'Auto' }); }],
          [0, () => say('Listening')],
        ];
        s.routes.forEach((r, i) => {
          steps.push([560, () => rEls[i].classList.add('is-on')]);
          steps.push([420, () => { capPill?.set('processing', { mode: 'Auto', seconds: 2 + i * 3 }); }]);
          steps.push([0, () => say('Classifying')]);
          steps.push([520, () => { rEls[i].dataset.dest = r[1]; ruEls[i].classList.add('is-on'); }]);
          steps.push([0, () => { capPill?.set('recording', { mode: r[1] === 'Prompt Enhance' ? 'Enhance' : r[1] }); }]);
          steps.push([0, () => say(`Routed to ${r[1]}`)]);
        });
        steps.push([600, () => { capPill?.set('result-actions', { text: (SCENES.enhance as TextScene).short }); }]);
        steps.push([0, () => say('Routed')]);
        steps.push([2600, () => park('Auto')]);
        run.play(steps);
        return;
      }

      /* ---- the six concrete modes --------------------------------------- */
      const raw = s.raw, n = lenOf(raw);
      const delivered = s.keep
        ? `<span class="kept">${rawFull(raw)}</span>`
        : `<span class="out">${s.out}</span>`;

      field.innerHTML = '<span class="caret"></span>';
      rulesBox.innerHTML = s.rules
        .map(([id, v]) => `<div class="rule"><span class="n">${id}</span><span class="v">${v}</span></div>`).join('');
      const ruleEls = $$('.rule', rulesBox);

      /* THE SETTLED READING IS ALSO TWO READINGS, because the two delivery
         modes do not end in the same place. Under reduced motion the reader
         gets the end state, and the end state of clipboard_only is an empty
         window and a full clipboard. */
      if (reduced) {
        field.innerHTML = clip ? '<span class="caret"></span>' : delivered;
        if (clip) {
          capPill?.set('processing', { preview: s.short, seconds: 5, clipboardOnly: true });
          if (clipNote) clipNote.textContent = 'On your clipboard. Paste it where you want it.';
          say('Waiting for your decision');
        } else {
          capPill?.set('result-actions', { text: s.short });
          say('Delivered, and the surface is still up');
        }
        ruleEls.forEach(el => el.classList.add('is-on'));
        return;
      }

      const steps: [number, () => void][] = [
        [300, () => { capPill?.set('recording', { mode: modeLabel(mode), lang: mode === 'translate' ? 'de' : undefined }); }],
        [0,   () => say('Listening')],
      ];
      // a long transcript types faster, so every mode takes about the same time
      const per = Math.max(9, Math.round(1900 / n));
      for (let i = 1; i <= n; i++) {
        steps.push([per, () => { field.innerHTML = rawHTML(raw, i) + '<span class="caret"></span>'; }]);
      }
      steps.push(
        [420, () => { capPill?.set('processing', { mode: modeLabel(mode), seconds: 4, lang: mode === 'translate' ? 'de' : undefined }); }],
        [0,   () => say(s.keep ? 'Nothing to correct' : 'Transforming')],
      );
      ruleEls.forEach(el => steps.push([170, () => el.classList.add('is-on')]));

      if (clip) {
        /* clipboard_only: the overlay stops on a real preview and the window
           never receives anything. Commit puts the text on the clipboard and
           CLOSES the overlay -- this mode has no result surface (ADR 0011a). */
        steps.push(
          [350, () => { capPill?.set('processing', { preview: s.short, seconds: 5, clipboardOnly: true }); }],
          [0,   () => say('Waiting for your decision')],
          [1500, () => { capHost?.classList.add('ov--gone'); }],
          [0,   () => say('Committed, and the overlay is gone')],
          [0,   () => { if (clipNote) clipNote.textContent = 'On your clipboard. Paste it where you want it.'; }],
          [2000, () => park(modeLabel(mode), mode === 'translate' ? 'de' : undefined)],
        );
      } else {
        /* auto_paste: the text is at the cursor first and the surface comes
           after it. Nothing here can abort, because there is nothing left to
           abort -- which is why this surface offers Copy, Edit and Dismiss. */
        steps.push(
          [350, () => { field.innerHTML = delivered; }],
          [0,   () => { capPill?.set('result-actions', { text: s.short }); }],
          [0,   () => say('Delivered, and the surface is still up')],
        );
        if (s.learn) {
          /* The runtime holds the tab for four seconds
             (LEARNED_NUDGE_DURATION_MS), so the park waits for it rather than
             drawing a retraction the app never draws. */
          steps.push([700, () => { capPill?.learn(s.learn!); }]);
          steps.push([4300, () => park(modeLabel(mode), mode === 'translate' ? 'de' : undefined)]);
        } else {
          steps.push([2700, () => park(modeLabel(mode), mode === 'translate' ? 'de' : undefined)]);
        }
      }
      run.play(steps);
    },
  };
}
