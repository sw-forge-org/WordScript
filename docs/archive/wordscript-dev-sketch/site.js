/* ==========================================================================
   wordscript.dev

   The capsule on this page is not a screenshot. It is the app's own surface
   rebuilt as live DOM against the geometry in src/styles/overlay-pill.css,
   driven by the same levelToBars curve the runtime uses. Everything it does
   here, it does there.

   The demo is three tabs and, inside two of them, a second axis: the seven
   processing modes of the mode contract, and the three intakes of Context.
   Every mode name, every preset and every rule id below is the runtime's own.
   Where a scene states what a mode does to text, the source is
   src-tauri/src/core/config.rs and src/lib/transformRules.ts, not a sentence
   written for this page.
   ========================================================================== */
(() => {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ====================================================================== */
  /* THE PILL                                                               */
  /* ====================================================================== */

  // verbatim from src/components/overlay/OverlayPill.tsx
  const BAR_COUNT = 11, MIN_BAR = 5, MAX_BAR = 30;
  const IDLE_BARS = [5, 7, 9, 12, 15, 17, 15, 12, 9, 7, 5];

  function levelToBars(level) {
    const c = Math.min(1, Math.max(0, level));
    if (c < 0.018) return IDLE_BARS.slice();
    const gain = Math.min(1, c * 2.9);
    const center = (BAR_COUNT - 1) / 2;
    return Array.from({ length: BAR_COUNT }, (_, i) => {
      const distance = Math.abs(i - center) / center;
      const falloff = 1 - distance * 0.42;
      const wobble = 1 - Math.abs(((i * 1.7) % 5) - 2) / 6;
      const energy = Math.min(1, gain * falloff * wobble * 1.25);
      return Math.round(MIN_BAR + (MAX_BAR - MIN_BAR) * energy);
    });
  }

  // Speech is syllables inside words inside breaths. Three sines, three rates.
  const speechLevel = (t) => {
    const syl  = 0.5 + 0.5 * Math.sin(t * 9.2);
    const word = 0.5 + 0.5 * Math.sin(t * 2.6 + 1.1);
    const jit  = 0.5 + 0.5 * Math.sin(t * 23.7 + 0.4);
    return Math.max(0, Math.min(1, 0.30 + 0.46 * syl * word + 0.13 * jit));
  };

  const mm = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s) % 60).padStart(2, '0')}`;

  const svg = (d, extra = '') =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25"
      stroke-linecap="round" stroke-linejoin="round" class="${extra}" aria-hidden="true">${d}</svg>`;
  const ICON = {
    mic:    svg('<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>'),
    load:   svg('<path d="M21 12a9 9 0 1 1-6.219-8.56"/>', 'pill__spin'),
    clip:   svg('<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>'),
    pencil: svg('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>'),
    stop:   svg('<rect x="3" y="3" width="18" height="18" rx="2"/>'),
    enter:  svg('<path d="M20 4v7a4 4 0 0 1-4 4H4"/><path d="m9 10-5 5 5 5"/>'),
    up:     svg('<path d="M12 16V4"/><path d="m6 10 6-6 6 6"/><path d="M4 20h16"/>'),
    link:   svg('<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'),
    check:  svg('<path d="m4 12 5 5L20 6"/>'),
  };

  const bars = () => `<div class="pill__bars" aria-label="Audio level">${
    IDLE_BARS.map(h => `<span class="bar" style="height:${h}px"></span>`).join('')}</div>`;
  const mic  = () => `<span class="pill__mic">${ICON.mic}</span>`;
  const div  = () => `<span class="pill__divider" aria-hidden="true"></span>`;
  const mode_ = (label) => `<span class="pill__mode"><span class="pill__mode-dot"></span><span class="pill__mode-label">${label}</span></span>`;
  const time = (s) => `<span class="pill__timer">${mm(s)}</span>`;
  const act  = (icon, label, primary) =>
    `<span class="pill__act${primary ? ' pill__act--primary' : ''}" role="img" aria-label="${label}">${icon}</span>`;

  /** One live capsule bound to a host element. */
  function mountPill(host) {
    if (!host) return null;
    let raf = null, t0 = 0, base = 0, running = false, kind = null;

    const paint = (html, cls) => {
      host.innerHTML = `<div class="pill ${cls}">${html}</div>`;
    };

    const api = {
      get kind() { return kind; },

      /** state: recording | processing | preview | result */
      set(next, o = {}) {
        kind = next;
        const label = o.mode || 'Cleanup';
        const sec = o.seconds ?? 0;
        base = sec;
        if (next === 'recording') {
          paint(mic() + bars() + div() + mode_(label) + div() + time(sec), 'pill--compact pill--recording');
          api.run(true);
        } else if (next === 'processing') {
          paint(mic() + bars() + div() + mode_(label) + div() + time(sec) + div()
                + `<span class="pill__act" role="img" aria-label="Working">${ICON.load}</span>`,
                'pill--compact pill--processing');
          api.run(true, true);
        } else if (next === 'preview') {
          paint(mic()
                + `<span class="pill__text pill__text--pre">${o.text || ''}</span>`
                + `<span class="pill__group">${act(ICON.enter, 'Insert', true)}${act(ICON.pencil, 'Edit')}${act(ICON.stop, 'Abort')}</span>`
                + div() + time(sec) + div()
                + `<span class="pill__act" role="img" aria-label="Working">${ICON.load}</span>`,
                'pill--preview-actions pill--processing');
          api.run(true, true);
        } else if (next === 'result') {
          paint(`<span class="pill__text">${o.text || ''}</span>`
                + `<span class="pill__group">${act(ICON.clip, 'Copy')}${act(ICON.pencil, 'Edit')}</span>`,
                'pill--result-actions');
          api.run(false);
        }
        return api;
      },

      /** A shutter widening out of the pill's left edge. The runtime grows two
          of these: the learned word (ADR 0035) and, in agent delivery, the
          target that is waiting. Width is animated rather than transform,
          which is load-bearing against a WebKitGTK compositor bug. */
      tab(html, hold = 2600) {
        const pill = $('.pill', host);
        if (!pill || reduced) return api;
        const el = document.createElement('span');
        el.className = 'pill__learn';
        el.innerHTML = `<span class="pill__learn-in">${html}</span>`;
        pill.appendChild(el);
        requestAnimationFrame(() => {
          const w = $('.pill__learn-in', el).offsetWidth;
          el.style.setProperty('--w', `${w}px`);
          el.classList.add('is-on');
        });
        setTimeout(() => el.classList.remove('is-on'), hold);
        setTimeout(() => el.remove(), hold + 500);
        return api;
      },

      learn(word) { return api.tab(`learned <b>${word}</b>`); },

      /** Drive bars + timer. `idle` keeps the timer moving but the bars flat. */
      run(on, idle) {
        cancelAnimationFrame(raf);
        running = on && !reduced;
        if (!running) return api;
        t0 = performance.now();
        const barEls = $$('.bar', host);
        const timer  = $('.pill__timer', host);
        const step = (now) => {
          if (!running) return;
          const t = (now - t0) / 1000;
          if (timer) timer.textContent = mm(base + t);
          if (!idle && barEls.length) {
            const hs = levelToBars(speechLevel(t));
            for (let i = 0; i < barEls.length; i++) barEls[i].style.height = `${hs[i]}px`;
          }
          raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return api;
      },

      stop() { running = false; cancelAnimationFrame(raf); return api; },
      clear() { api.stop(); host.innerHTML = ''; kind = null; return api; },
    };
    return api;
  }

  /* ====================================================================== */
  /* THE QUANTISED LEVEL MATRIX                                             */
  /* The meeting window and the desk's answer strip both draw one, and for   */
  /* the same reason: in 70 px a waveform is a texture and a matrix is still */
  /* a meter. A still one on a surface that claims to be listening is a fake */
  /* state, so this one moves or it is not drawn.                            */
  /* ====================================================================== */
  function mountMatrix(host, cols = 16, rows = 7) {
    if (!host) return null;
    host.innerHTML = Array.from({ length: cols }, () =>
      `<span class="mx__c">${'<i></i>'.repeat(rows)}</span>`).join('');
    const cells = $$('.mx__c', host);
    let raf = null, t0 = 0, on = false, last = 0;
    const api = {
      run() {
        cancelAnimationFrame(raf);
        if (reduced) { cells.forEach((c, i) => { c.dataset.l = String(2 + (i % 3)); }); return api; }
        on = true; t0 = performance.now();
        const step = (now) => {
          if (!on) return;
          if (now - last > 55) {
            last = now;
            const t = (now - t0) / 1000;
            for (let i = 0; i < cells.length; i++) {
              const v = speechLevel(t - i * 0.045);
              cells[i].dataset.l = String(Math.max(1, Math.round(v * rows)));
            }
          }
          raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return api;
      },
      stop() { on = false; cancelAnimationFrame(raf); return api; },
    };
    return api;
  }

  /* ====================================================================== */
  /* A CANCELLABLE STEP RUNNER                                              */
  /* ====================================================================== */
  function runner() {
    let timers = [];
    return {
      clear() { timers.forEach(clearTimeout); timers = []; },
      play(steps) {
        this.clear();
        let t = 0;
        steps.forEach(([d, fn]) => {
          t += reduced ? 0 : d;
          timers.push(setTimeout(fn, t));
        });
      },
    };
  }

  /* ====================================================================== */
  /* TYPING                                                                 */
  /* A raw transcript is a list of [text, isFiller]. The filler spans carry  */
  /* their own colour, so the mode that removes them and the mode that keeps */
  /* them are telling the same story about the same words.                  */
  /* ====================================================================== */
  const lenOf = (raw) => raw.reduce((a, [t]) => a + t.length, 0);
  const rawHTML = (raw, n) => {
    let out = '', seen = 0;
    for (const [text, isFill] of raw) {
      if (seen >= n) break;
      out += `<span class="${isFill ? 'fill' : 'raw'}">${text.slice(0, n - seen)}</span>`;
      seen += text.length;
    }
    return out;
  };
  const rawFull = (raw) => rawHTML(raw, lenOf(raw));

  /* ====================================================================== */
  /* 1 - CURSOR: THE SEVEN PROCESSING MODES                                 */
  /*                                                                        */
  /* The order is the six concrete modes first and Auto last, behind the     */
  /* divider the app's own sub-tab row uses for an entry that is not the     */
  /* same kind of thing as the ones before it. Auto is not a seventh way of  */
  /* writing; it is the decision about which of the six runs.                */
  /* ====================================================================== */
  const MODES = [
    { id: 'cleanup',   label: 'Cleanup' },
    { id: 'verbatim',  label: 'Verbatim' },
    { id: 'rewrite',   label: 'Rewrite' },
    { id: 'translate', label: 'Translate' },
    { id: 'agent',     label: 'Draft' },
    { id: 'enhance',   label: 'Prompt Enhance', pill: 'Enhance' },
    { rule: true },
    { id: 'auto',      label: 'Auto' },
  ];

  const SCENES = {
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

  const modeLabel = (id) => {
    const m = MODES.find(x => x.id === id);
    return m ? (m.pill || m.label) : 'Cleanup';
  };

  const field     = $('[data-field]');
  const rulesBox  = $('[data-rules]');
  const sceneWin  = $('[data-scene-win]');
  const rulesK    = $('[data-rules-k]');
  const sceneNote = $('[data-scene-note]');
  const capPill   = mountPill($('[data-cap-pill]'));
  const stepEl    = $('[data-step]');
  const say = (s) => () => { stepEl.textContent = s; };

  let mode = 'cleanup';

  function paintModes() {
    $('[data-modes]').innerHTML = MODES.map(m => m.rule
      ? '<span class="strip__rule" aria-hidden="true"></span>'
      : `<button class="strip__b" role="tab" data-m="${m.id}" aria-selected="${m.id === mode}">${m.label}</button>`
    ).join('');
  }

  function seqCursor(run) {
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
      capPill.clear();

      if (reduced) {
        rEls.forEach((el, i) => { el.classList.add('is-on'); el.dataset.dest = s.routes[i][1]; });
        ruEls.forEach(el => el.classList.add('is-on'));
        stepEl.textContent = 'Routed';
        return;
      }
      const steps = [[200, () => { capPill.set('recording', { mode: 'Auto' }); }], [0, say('Listening')]];
      s.routes.forEach((r, i) => {
        steps.push([560, () => rEls[i].classList.add('is-on')]);
        steps.push([420, () => { capPill.set('processing', { mode: 'Auto', seconds: 2 + i * 3 }); }]);
        steps.push([0, say('Classifying')]);
        steps.push([520, () => { rEls[i].dataset.dest = r[1]; ruEls[i].classList.add('is-on'); }]);
        steps.push([0, () => { capPill.set('recording', { mode: r[1] === 'Prompt Enhance' ? 'Enhance' : r[1] }); }]);
        steps.push([0, say(`Routed to ${r[1]}`)]);
      });
      steps.push([600, () => { capPill.set('result', { text: SCENES.enhance.short }); }]);
      steps.push([0, say('Routed')]);
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

    if (reduced) {
      field.innerHTML = delivered;
      capPill.set('result', { text: s.short });
      ruleEls.forEach(el => el.classList.add('is-on'));
      stepEl.textContent = 'Delivered';
      return;
    }

    const steps = [
      [300, () => { capPill.set('recording', { mode: modeLabel(mode) }); }],
      [0,   say('Listening')],
    ];
    // a long transcript types faster, so every mode takes about the same time
    const per = Math.max(9, Math.round(1900 / n));
    for (let i = 1; i <= n; i++) {
      steps.push([per, () => { field.innerHTML = rawHTML(raw, i) + '<span class="caret"></span>'; }]);
    }
    steps.push(
      [420, () => { capPill.set('processing', { mode: modeLabel(mode), seconds: 4 }); }],
      [0,   say(s.keep ? 'Nothing to correct' : 'Transforming')],
      [850, () => { capPill.set('preview', { text: s.short, seconds: 5 }); }],
      [0,   say('Preview, not yet delivered')],
    );
    ruleEls.forEach(el => steps.push([170, () => el.classList.add('is-on')]));
    steps.push(
      [350, () => { field.innerHTML = delivered; }],
      [0,   () => { capPill.set('result', { text: s.short }); }],
      [0,   say('Delivered')],
    );
    if (s.learn) steps.push([700, () => { capPill.learn(s.learn); }]);
    run.play(steps);
  }

  /* ====================================================================== */
  /* 2 - CONTEXT: THE THREE INTAKES                                         */
  /*                                                                        */
  /* Write, Record and Import are genuinely three, not one control with      */
  /* three settings: each makes a different object from a different source,  */
  /* and the surfaces under them have nothing in common. What they share is  */
  /* the last step, which is the whole argument of this tab.                 */
  /* ====================================================================== */
  const INTAKES = [
    { id: 'write',  label: 'Write' },
    { id: 'record', label: 'Record' },
    { id: 'import', label: 'Import' },
  ];

  const DISK_PATH = '~/Documents/WordScript/Context/api-refactor/';
  const DISK = [
    ['write',  'notes-after-the-call.md'],
    ['record', 'sprint-planning.md'],
    ['import', 'conference-talk.md'],
    [null,     'draft.md'],
    [null,     'audio/'],
  ];

  const WRITE_TITLE = 'Notes after the call';
  const WRITE_BODY = [
    'Maria wants the migration held until the backfill lands.',
    'Tuesday is the fallback, and she can move the review.',
    'Open: who tells the support team, and when.',
  ];

  const HUD_LINES = [
    ['11:48', 'S2', 'b', 'so the placement bug is still open on the second monitor.'],
    ['11:57', 'S1', 'a', 'right, I will take the Diagnostics sub-tabs this week.'],
    ['12:04', 'S2', 'b', 'can we decide the MCP server question before Friday?'],
  ];
  const HUD_SUM = [
    ['Decisions', ['Migration held until the backfill lands', 'Diagnostics sub-tabs go this week']],
    ['Action items', ['<b>Alex</b> takes the API refactor and the latency numbers', '<b>Sarah</b> tells support before Friday']],
    ['Open questions', ['The MCP server question has no owner yet']],
  ];

  const IMPORT_URL = 'https://www.youtube.com/watch?v=example-talk-id';
  const IMPORT_STEPS = [
    'resolving the media stream',
    '41 min of audio, one track, nothing else kept',
    'transcribing on the local lane',
    'speaker detection separated two voices',
    'landed in Context, api-refactor',
  ];

  const intakeBox = $('[data-intake]');
  const diskBox   = $('[data-disk]');
  const ctxCap    = $('[data-ctx-cap]');
  let intake = 'write';
  let ctxPill = null, hudMx = null;

  function paintIntakes() {
    $('[data-intakes]').innerHTML = INTAKES
      .map(i => `<button class="strip__b" role="tab" data-i="${i.id}" aria-selected="${i.id === intake}">${i.label}</button>`)
      .join('');
  }

  function paintDisk() {
    diskBox.innerHTML = `<div class="disk__row is-on"><span class="p">${DISK_PATH}</span></div>` +
      DISK.map(([owner, name]) =>
        `<div class="disk__row"><span class="f${owner === intake ? ' new' : ''}">${name}</span></div>`).join('');
  }

  function buildWrite() {
    return '<div class="slab">' +
      '<div class="slab__k mono">An empty object, and you talk into it</div>' +
      '<div class="wr">' +
        '<div class="wr__title" data-wr-title></div>' +
        '<div class="wr__body" data-wr-body></div>' +
        '<div class="wr__foot">' +
          `<span class="wr__key">${ICON.mic}<span class="kbd"><kbd>Ctrl</kbd><kbd>Space</kbd></span>to dictate into it</span>` +
          '<span class="wr__sel"><span class="sel">api-refactor</span><span class="sel">General writing</span></span>' +
        '</div>' +
      '</div></div>' +
      '<div class="d1__cap"><div class="ov" data-ctx-pill></div></div>';
  }

  function buildRecord() {
    const tabs = ['Transcript', 'Notes', 'Summary'];
    return '<div class="hud">' +
      '<div class="hud__deco mono">native window decoration, drawn by the OS</div>' +
      '<div class="hud__head">' +
        '<h4>Sprint planning</h4>' +
        '<span class="hud__date mono">Mar 11, 2026 <i>from Google Calendar</i></span>' +
        '<div class="hud__tabs" role="tablist">' + tabs.map((t, i) =>
          `<button role="tab" data-h="${t}" aria-selected="${i === 0}">${t}</button>`).join('') + '</div>' +
        '<div class="hud__state mono">' +
          '<span class="dot dot--rec"></span><span data-hud-el>00:00</span>' +
          '<span class="hud__sep"></span><span data-hud-who>waiting for the room</span>' +
          '<span class="hud__sep"></span><span class="hud__src">mic + system</span>' +
          '<span class="mx" data-hud-mx aria-label="Input level"></span>' +
        '</div>' +
      '</div>' +
      '<div class="hud__scroll" data-hud-body></div>' +
      '<div class="hud__bar"><span class="btn btn--primary">Stop and save</span></div>' +
      '<span class="hud__grip" aria-hidden="true"></span>' +
      '</div>';
  }

  function buildImport() {
    return '<div class="slab">' +
      '<div class="slab__k mono">A file you have, or a link you can reach</div>' +
      '<div class="imp">' +
        `<div class="imp__dz">${ICON.up}<span class="imp__dzt"><b>Drop audio or video, or click to browse</b>` +
        '<span>MP3, WAV, M4A, WebM, OGG, FLAC</span></span></div>' +
        '<div class="imp__or"><span>or</span></div>' +
        `<div class="imp__lab mono">${ICON.link}Paste a link</div>` +
        '<div class="imp__row"><span class="imp__field" data-imp-field></span>' +
        '<span class="btn" data-imp-fetch>Fetch</span></div>' +
        '<p class="imp__hint">YouTube, a podcast episode or a direct audio URL. WordScript resolves the ' +
        'media stream and keeps nothing but the audio it needs and the transcript it produces.</p>' +
        '<div class="imp__steps" data-imp-steps></div>' +
      '</div></div>';
  }

  function seqContext(run) {
    if (ctxPill) ctxPill.clear();
    if (hudMx) hudMx.stop();
    ctxPill = null; hudMx = null;
    paintDisk();
    const dEls = $$('.disk__row', diskBox).slice(1);

    /* ---- Write ---------------------------------------------------------- */
    if (intake === 'write') {
      intakeBox.innerHTML = buildWrite();
      ctxCap.textContent = 'The object exists before the words do. Nothing here is transcribed after the fact, whether you type it or say it.';
      ctxPill = mountPill($('[data-ctx-pill]'));
      const title = $('[data-wr-title]'), body = $('[data-wr-body]');

      if (reduced) {
        title.textContent = WRITE_TITLE;
        body.innerHTML = WRITE_BODY.map(l => `<p class="is-on">${l}</p>`).join('');
        ctxPill.set('result', { text: WRITE_TITLE });
        dEls.forEach(el => el.classList.add('is-on'));
        stepEl.textContent = 'Written';
        return;
      }

      const steps = [[250, say('An empty object')], [0, () => { title.textContent = ''; }]];
      for (let i = 1; i <= WRITE_TITLE.length; i++) {
        steps.push([26, () => { title.innerHTML = WRITE_TITLE.slice(0, i) + '<span class="caret"></span>'; }]);
      }
      steps.push(
        [400, () => { title.textContent = WRITE_TITLE; }],
        [0,   () => { ctxPill.set('recording', { mode: 'Cleanup' }); }],
        [0,   say('Holding the key, talking into it')],
        [0,   () => { body.innerHTML = WRITE_BODY.map(l => `<p>${l}</p>`).join(''); }],
      );
      WRITE_BODY.forEach((_, i) => steps.push([620, () => $$('p', body)[i].classList.add('is-on')]));
      steps.push(
        [400, () => { ctxPill.set('result', { text: WRITE_TITLE }); }],
        [0,   say('One file, in the folder you named')],
      );
      dEls.forEach(el => steps.push([170, () => el.classList.add('is-on')]));
      run.play(steps);
      return;
    }

    /* ---- Record: the meeting window ------------------------------------- */
    if (intake === 'record') {
      intakeBox.innerHTML = buildRecord();
      ctxCap.textContent = '330 by 560, always on top, resizable, and excluded from screen shares. It inserts nothing anywhere, and it ends as a note.';
      const hudBody = $('[data-hud-body]'), el = $('[data-hud-el]'), who = $('[data-hud-who]');
      const hTabs = $$('.hud__tabs button');
      hudMx = mountMatrix($('[data-hud-mx]'), 16, 7);

      const transcript = () => '<div class="ts">' + HUD_LINES.map(([at, sp, tone, text]) =>
        `<div class="ts__l" data-tone="${tone}"><span class="ts__m mono">${at}</span>` +
        `<span class="ts__s mono">${sp}</span><span class="ts__t">${text}</span></div>`).join('') + '</div>';
      const summary = () => '<div class="sum">' + HUD_SUM.map(([h, items]) =>
        `<div class="sum__g"><h5>${h}</h5><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul></div>`).join('') + '</div>';
      const pickTab = (name) => hTabs.forEach(b => b.setAttribute('aria-selected', String(b.dataset.h === name)));

      if (reduced) {
        hudBody.innerHTML = summary();
        $$('.sum__g', hudBody).forEach(g => g.classList.add('is-on'));
        pickTab('Summary'); el.textContent = '24:11'; who.textContent = '2 of 4 speaking';
        hudMx.run();
        dEls.forEach(e => e.classList.add('is-on'));
        stepEl.textContent = 'Recorded';
        return;
      }

      hudBody.innerHTML = transcript();
      const tEls = $$('.ts__l', hudBody);
      const steps = [
        [200, say('A meeting is running')],
        [0,   () => { hudMx.run(); who.textContent = '2 of 4 speaking'; }],
      ];
      // the elapsed clock is a readout, so it is ticked and not animated
      let secs = 11 * 60 + 40;
      for (let i = 0; i < 10; i++) steps.push([420, () => { secs += 3; el.textContent = mm(secs); }]);
      tEls.forEach((e, i) => steps.push([i === 0 ? 0 : 760, () => e.classList.add('is-on')]));
      steps.push(
        [700, say('The same three tabs it has afterwards')],
        [0,   () => { pickTab('Summary'); hudBody.innerHTML = summary(); }],
      );
      HUD_SUM.forEach((_, i) => steps.push([460, () => $$('.sum__g', hudBody)[i].classList.add('is-on')]));
      steps.push([600, say('It ends as a note, in the same folder')]);
      dEls.forEach(e => steps.push([170, () => e.classList.add('is-on')]));
      run.play(steps);
      return;
    }

    /* ---- Import: a file, or a link ------------------------------------- */
    intakeBox.innerHTML = buildImport();
    ctxCap.textContent = 'There is no second queue. A file being transcribed is a context object that does not have its transcript yet.';
    const f = $('[data-imp-field]'), fetchB = $('[data-imp-fetch]'), stepsBox = $('[data-imp-steps]');
    stepsBox.innerHTML = IMPORT_STEPS
      .map(s => `<div class="imp__s"><span class="imp__sd"></span><span>${s}</span></div>`).join('');
    const sEls = $$('.imp__s', stepsBox);

    if (reduced) {
      f.textContent = IMPORT_URL;
      sEls.forEach(e => e.classList.add('is-on', 'is-done'));
      dEls.forEach(e => e.classList.add('is-on'));
      stepEl.textContent = 'Imported';
      return;
    }

    const steps = [[250, say('A pasted link')], [0, () => { f.innerHTML = '<span class="caret"></span>'; }]];
    for (let i = 1; i <= IMPORT_URL.length; i++) {
      steps.push([19, () => { f.innerHTML = IMPORT_URL.slice(0, i) + '<span class="caret"></span>'; }]);
    }
    steps.push(
      [350, () => { f.textContent = IMPORT_URL; fetchB.classList.add('btn--primary'); }],
      [500, () => { fetchB.classList.remove('btn--primary'); }],
      [0,   say('Fetching')],
    );
    sEls.forEach((e, i) => steps.push([680, () => {
      e.classList.add('is-on');
      if (i > 0) sEls[i - 1].classList.add('is-done');
      if (i === sEls.length - 1) { e.classList.add('is-done'); stepEl.textContent = 'The same kind of record'; }
    }]));
    dEls.forEach(e => steps.push([170, () => e.classList.add('is-on')]));
    run.play(steps);
  }

  /* ====================================================================== */
  /* 3 - AGENT: THE DESK                                                    */
  /*                                                                        */
  /* One process, three targets. The rail draws the targets indented under   */
  /* the identity they belong to, because a window that shows three peers is */
  /* arguing against the decision it implements: WordScript talks to one     */
  /* orchestrator, and for the agents that orchestrator starts, IT is the    */
  /* human.                                                                  */
  /* ====================================================================== */
  const TARGETS = [
    ['WordScript',   'work, writes'],
    ['dotfiles',     'inspect, read only'],
    ['sw-forge-org', 'resume, last thread'],
  ];
  const TERM_A = [
    '<span class="acc">you</span>  <span class="dim">"start the api refactor"</span>',
    '<span class="dim">desk</span> target api-refactor, role work',
    '<span class="dim">desk</span> reading ~/Documents/WordScript/Context/api-refactor/',
    '<span class="dim">desk</span> two agents running',
    '<span class="dim">desk</span> <span class="acc">needs a decision</span>',
  ];
  const TERM_B = [
    '<span class="dim">desk</span> answer received',
    '<span class="dim">desk</span> holding the migration, flag stays off',
  ];
  const QUESTION = 'The backfill will not finish tonight. Ship the migration behind the flag, or hold it?';
  const OPTS = ['Behind the flag', 'Hold it'];

  const termBox    = $('[data-term]');
  const threadBox  = $('[data-thread]');
  const answerBox  = $('[data-answer]');
  const targetsBox = $('[data-targets]');
  const agentPill  = mountPill($('[data-agent-pill]'));
  let ansMx = null;

  function seqAgent(run) {
    if (ansMx) { ansMx.stop(); ansMx = null; }
    termBox.innerHTML = [...TERM_A, ...TERM_B].map(l => `<div class="l">${l}</div>`).join('');
    targetsBox.innerHTML = TARGETS.map(([name, role]) =>
      `<div class="tg"><span class="dot"></span><span class="tg__t"><b>${name}</b><span>${role}</span></span>` +
      '<span class="tg__u"></span><span class="tg__s mono"></span></div>').join('');
    threadBox.innerHTML =
      `<div class="msg" data-from="desk"><p>${QUESTION}</p>` +
      `<div class="msg__opts">${OPTS.map(o => `<span class="msg__opt">${o}</span>`).join('')}</div>` +
      '<span class="msg__w mono" data-when></span></div>' +
      '<div class="msg" data-from="you"><p data-said></p><span class="msg__w mono">answered out loud</span></div>' +
      `<div class="msg" data-from="done"><p>${ICON.check}dotfiles finished, 3 files changed</p>` +
      '<span class="msg__w mono">09:41</span></div>';
    answerBox.innerHTML = `${ICON.mic}<span class="mx" data-ans-mx aria-label="Input level"></span>` +
      '<span class="answer__k">Answer window</span><span class="answer__t mono" data-ans-t>0:10</span>';

    const lines = $$('.l', termBox);
    const tgs   = $$('.tg', targetsBox);
    const msgs  = $$('.msg', threadBox);
    const opts  = $$('.msg__opt', threadBox);
    const said  = $('[data-said]', threadBox);
    const when  = $('[data-when]', threadBox);
    const ansT  = $('[data-ans-t]');
    ansMx = mountMatrix($('[data-ans-mx]'), 12, 7);

    const state = (i, s, tone, unread) => {
      $('.tg__s', tgs[i]).textContent = s;
      $('.dot', tgs[i]).className = 'dot' + (tone ? ` dot--${tone}` : '');
      $('.tg__u', tgs[i]).textContent = unread || '';
      tgs[i].dataset.on = i === 0 ? '1' : '0';
    };

    if (reduced) {
      lines.forEach(el => el.classList.add('is-on'));
      tgs.forEach(el => el.classList.add('is-on'));
      state(0, 'Waiting for you', 'acc', '1'); state(1, 'Running', 'ok'); state(2, 'Idle');
      msgs.forEach(m => m.classList.add('is-on'));
      opts[1].classList.add('is-picked');
      said.textContent = 'hold it';
      when.textContent = 'spoken, 0:06 ago';
      answerBox.classList.add('is-on');
      ansMx.run();
      agentPill.set('result', { text: 'Hold it' });
      stepEl.textContent = 'Answered';
      return;
    }

    const steps = [[200, say('Started by voice')]];
    tgs.forEach((el, i) => steps.push([260, () => {
      el.classList.add('is-on');
      state(i, i === 1 ? 'Running' : 'Idle', i === 1 ? 'ok' : null);
    }]));
    TERM_A.forEach((_, i) => steps.push([440, () => lines[i].classList.add('is-on')]));
    steps.push(
      [300, () => { state(0, 'Waiting for you', 'acc', '1'); }],
      [0,   () => { msgs[0].classList.add('is-on'); when.textContent = 'spoken, 0:00 ago'; }],
      [0,   say('It asks out loud, and waits')],
      [500, () => { answerBox.classList.add('is-on'); ansMx.run(); }],
    );
    for (let i = 9; i >= 5; i--) steps.push([400, () => { ansT.textContent = `0:0${i}`; }]);
    steps.push(
      [200, () => { agentPill.set('recording', { mode: 'Agent' }); }],
      [0,   () => { agentPill.tab('<b>WordScript</b> is waiting', 3400); }],
      [1200, () => { opts[1].classList.add('is-picked'); }],
      [0,   () => { agentPill.set('result', { text: 'Hold it' }); }],
      [250, () => { msgs[1].classList.add('is-on'); said.textContent = 'hold it'; }],
      [0,   () => {
        ansMx.stop();
        answerBox.innerHTML = `${ICON.check}<span>answered out loud, inside the window</span>` +
          '<span class="answer__t mono">0:06 of 0:10</span>';
        answerBox.dataset.done = '1';
      }],
      [0,   () => { when.textContent = 'spoken, 0:06 ago'; }],
      [0,   () => { state(0, 'Running', 'ok'); }],
      [0,   say('Answered, and the run carried on')],
    );
    TERM_B.forEach((_, i) => steps.push([460, () => lines[TERM_A.length + i].classList.add('is-on')]));
    steps.push(
      [400, () => { msgs[2].classList.add('is-on'); state(1, 'Idle'); }],
      [0,   () => { state(0, 'Idle'); }],
    );
    run.play(steps);
  }

  /* ====================================================================== */
  /* HERO                                                                   */
  /* ====================================================================== */
  const heroField = $('[data-hero-field]');
  const heroHint  = $('[data-hero-hint]');
  const heroPill  = mountPill($('[data-hero-pill]'));
  const heroRun   = runner();
  const HERO = SCENES.cleanup;

  function playHero() {
    const hint = (s) => () => { heroHint.textContent = s; };
    heroField.innerHTML = '<span class="caret"></span>';

    if (reduced) {
      heroField.innerHTML = `<span class="out">${HERO.out}</span>`;
      heroPill.set('result', { text: HERO.short });
      heroHint.textContent = 'delivered to the focused window';
      return;
    }

    const n = lenOf(HERO.raw);
    const steps = [
      [200,  () => { heroPill.set('recording'); }],
      [0,    hint('hold to talk')],
    ];
    for (let i = 1; i <= n; i++) {
      steps.push([17, () => { heroField.innerHTML = rawHTML(HERO.raw, i) + '<span class="caret"></span>'; }]);
    }
    steps.push(
      [420,  () => { heroPill.set('processing', { seconds: 4 }); }],
      [0,    hint('cleaning up')],
      [900,  () => { heroPill.set('preview', { text: HERO.short, seconds: 5 }); }],
      [0,    hint('preview, not yet delivered')],
      [1300, () => { heroField.innerHTML = `<span class="out">${HERO.out}</span>`; }],
      [0,    () => { heroPill.set('result', { text: HERO.short }); }],
      [0,    hint('delivered to the focused window')],
      [700,  () => { heroPill.learn(HERO.learn); }],
    );
    heroRun.play(steps);
  }

  /* ====================================================================== */
  /* TABS, AND THE TWO STRIPS UNDER THEM                                    */
  /* ====================================================================== */
  const demoRun = runner();
  const SEQ = [seqCursor, seqContext, seqAgent];
  const tabs = $$('.demo__tab');
  const panels = $$('.panel');
  const foot = $('[data-foot]');
  const FOOT = [
    'Constructed example. The capsule is the app\'s own surface, running.',
    'Constructed example. Three intakes, one directory, and the directory is yours.',
    'Constructed example. One orchestrator, and it is the only party WordScript talks to.',
  ];
  let current = 0;

  function stopAll() {
    demoRun.clear();
    capPill.clear(); agentPill.clear();
    if (ctxPill) ctxPill.clear();
    if (hudMx) hudMx.stop();
    if (ansMx) ansMx.stop();
  }

  function select(i, focus) {
    current = i;
    stopAll();
    tabs.forEach((t, n) => t.setAttribute('aria-selected', String(n === i)));
    panels.forEach((p, n) => p.setAttribute('data-on', n === i ? '1' : '0'));
    foot.textContent = FOOT[i];
    if (focus) tabs[i].focus();
    stepEl.textContent = '';
    SEQ[i](demoRun);
  }

  const arrows = (els, i, e, go) => {
    const k = e.key;
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(k)) return;
    e.preventDefault();
    const last = els.length - 1;
    go(k === 'Home' ? 0 : k === 'End' ? last
       : k === 'ArrowRight' ? (i === last ? 0 : i + 1)
       : (i === 0 ? last : i - 1));
  };

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(i, false));
    t.addEventListener('keydown', (e) => arrows(tabs, i, e, (n) => select(n, true)));
  });

  paintModes();
  paintIntakes();

  function wireStrip(host, attr, set) {
    host.addEventListener('click', (e) => {
      const b = e.target.closest('.strip__b');
      if (b) set(b.dataset[attr], false);
    });
    host.addEventListener('keydown', (e) => {
      const b = e.target.closest('.strip__b');
      if (!b) return;
      const els = $$('.strip__b', host);
      arrows(els, els.indexOf(b), e, (n) => set(els[n].dataset[attr], true));
    });
  }

  function setMode(id, focus) {
    mode = id;
    stopAll();
    paintModes();
    if (focus) $(`.strip__b[data-m="${id}"]`).focus();
    stepEl.textContent = '';
    seqCursor(demoRun);
  }
  function setIntake(id, focus) {
    intake = id;
    stopAll();
    paintIntakes();
    if (focus) $(`.strip__b[data-i="${id}"]`).focus();
    stepEl.textContent = '';
    seqContext(demoRun);
  }
  wireStrip($('[data-modes]'), 'm', setMode);
  wireStrip($('[data-intakes]'), 'i', setIntake);

  $('[data-replay]').addEventListener('click', () => select(current, false));

  /* ====================================================================== */
  /* THE FOCUS BAND                                                         */
  /* The hero says the text lands in whatever window has focus, and the page */
  /* never showed it. A logo row reads as an integration list by default,    */
  /* which is the claim the wiring diagram below disproves, so the note in   */
  /* the markup says what these are instead: places a cursor can be.         */
  /* ====================================================================== */
  /* Simple Icons, CC0-1.0. [label, brand hex or null for marks whose own
     colour is black, single path]. */
  const FOCUS_APPS = [
    ['Neovim','#57A143','M2.214 4.954v13.615L7.655 24V10.314L3.312 3.845 2.214 4.954zm4.999 17.98l-4.557-4.548V5.136l.59-.596 3.967 5.908v12.485zm14.573-4.457l-.862.937-4.24-6.376V0l5.068 5.092.034 13.385zM7.431.001l12.998 19.835-3.637 3.637L3.787 3.683 7.43 0z'],
    ['Sublime Text','#FF9800','M20.953.004a.397.397 0 0 0-.18.017L3.225 5.585c-.175.055-.323.214-.402.398a.42.42 0 0 0-.06.22v5.726a.42.42 0 0 0 .06.22c.079.183.227.341.402.397l7.454 2.364-7.454 2.363c-.255.08-.463.374-.463.655v5.688c0 .282.208.444.463.363l17.55-5.565c.237-.075.426-.336.452-.6.003-.022.013-.04.013-.065V12.06c0-.281-.208-.575-.463-.656L13.4 9.065l7.375-2.339c.255-.08.462-.375.462-.656V.384c0-.211-.117-.355-.283-.38z'],
    ['IntelliJ IDEA',null,'M0 0v24h24V0zm3.723 3.111h5v1.834h-1.39v6.277h1.39v1.834h-5v-1.834h1.444V4.945H3.723zm11.055 0H17v6.5c0 .612-.055 1.111-.222 1.556-.167.444-.39.777-.723 1.11-.277.279-.666.557-1.11.668a3.933 3.933 0 0 1-1.445.278c-.778 0-1.444-.167-1.944-.445a4.81 4.81 0 0 1-1.279-1.056l1.39-1.555c.277.334.555.555.833.722.277.167.611.278.945.278.389 0 .721-.111 1-.389.221-.278.333-.667.333-1.278zM2.222 19.5h9V21h-9z'],
    ['Chrome','#4285F4','M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-5.344 9.257c.206.01.413.016.621.016 6.627 0 12-5.373 12-12 0-1.54-.29-3.011-.818-4.364zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728Z'],
    ['Firefox','#FF7139','M20.452 3.445a11.002 11.002 0 00-2.482-1.908C16.944.997 15.098.093 12.477.032c-.734-.017-1.457.03-2.174.144-.72.114-1.398.292-2.118.56-1.017.377-1.996.975-2.574 1.554.583-.349 1.476-.733 2.55-.992a10.083 10.083 0 013.729-.167c2.341.34 4.178 1.381 5.48 2.625a8.066 8.066 0 011.298 1.587c1.468 2.382 1.33 5.376.184 7.142-.85 1.312-2.67 2.544-4.37 2.53-.583-.023-1.438-.152-2.25-.566-2.629-1.343-3.021-4.688-1.118-6.306-.632-.136-1.82.13-2.646 1.363-.742 1.107-.7 2.816-.242 4.028a6.473 6.473 0 01-.59-1.895 7.695 7.695 0 01.416-3.845A8.212 8.212 0 019.45 5.399c.896-1.069 1.908-1.72 2.75-2.005-.54-.471-1.411-.738-2.421-.767C8.31 2.583 6.327 3.061 4.7 4.41a8.148 8.148 0 00-1.976 2.414c-.455.836-.691 1.659-.697 1.678.122-1.445.704-2.994 1.248-4.055-.79.413-1.827 1.668-2.41 3.042C.095 9.37-.2 11.608.14 13.989c.966 5.668 5.9 9.982 11.843 9.982C18.62 23.971 24 18.591 24 11.956a11.93 11.93 0 00-3.548-8.511z'],
    ['Gmail','#EA4335','M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z'],
    ['Thunderbird','#0A84FF','M9.948 4.444h-.005c-1.92.788-2.126 2.55-1.817 3.499v.02C9.236 7.18 10.658 6.76 12 6.76c3.26 0 5.902 2.156 5.902 4.815 0 2.66-2.643 4.816-5.902 4.816l-.083-.002c-.155-.006-.354-.013-.435.118-.096.156.116.397.238.536 1.274 1.441 3.123 1.622 3.608 1.67l.076.008c-4.281.414-9.304-2.32-9.306-7.076 0-1.12.414-2.073 1.075-2.83l-.005-.002h-.003C7.31 6.38 6.376 3.47 4.629 2.898c-.124-.04-.246.054-.262.183-.23 1.924-.727 2.59-1.264 3.31-.805 1.08-1.39 2.328-1.365 3.698a10.99 10.99 0 0 1-.705-1.91c-.024-.09-.17-.365-.333-.272-.13.072-.227.274-.296.485A12.137 12.137 0 0 0 0 11.489c0 6.536 5.475 12 12 12 6.627 0 12-5.372 12-12 0-2.526-.781-4.87-2.115-6.805l.167-.002c.518 0 1.024.045 1.51.129-.734-.816-1.724-1.475-2.877-1.904a8.54 8.54 0 0 1 2.494-.495c-1.426-1.166-3.508-1.9-5.827-1.9-3.355 0-6.648 1.29-7.404 3.93zm.682 9.166c-.87-.905-3.473-3.91-3.473-3.91l.202.01 4.075 3.042c.305.223.74.22 1.043-.004l3.996-3.034.212-.018s-2.518 2.935-3.483 3.9c-.964.968-1.703.919-2.572.014zm2.774-10.083s.055.625-.576.824c-.722.227-1.042-.38-1.042-.38s.09-.417.676-.61c.626-.206.942.166.942.166z'],
    ['Discord','#5865F2','M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z'],
    ['Telegram','#26A5E4','M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z'],
    ['Notion',null,'M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z'],
    ['Obsidian','#7C3AED','M19.355 18.538a68.967 68.959 0 0 0 1.858-2.954.81.81 0 0 0-.062-.9c-.516-.685-1.504-2.075-2.042-3.362-.553-1.321-.636-3.375-.64-4.377a1.707 1.707 0 0 0-.358-1.05l-3.198-4.064a3.744 3.744 0 0 1-.076.543c-.106.503-.307 1.004-.536 1.5-.134.29-.29.6-.446.914l-.31.626c-.516 1.068-.997 2.227-1.132 3.59-.124 1.26.046 2.73.815 4.481.128.011.257.025.386.044a6.363 6.363 0 0 1 3.326 1.505c.916.79 1.744 1.922 2.415 3.5zM8.199 22.569c.073.012.146.02.22.02.78.024 2.095.092 3.16.29.87.16 2.593.64 4.01 1.055 1.083.316 2.198-.548 2.355-1.664.114-.814.33-1.735.725-2.58l-.01.005c-.67-1.87-1.522-3.078-2.416-3.849a5.295 5.295 0 0 0-2.778-1.257c-1.54-.216-2.952.19-3.84.45.532 2.218.368 4.829-1.425 7.531zM5.533 9.938c-.023.1-.056.197-.098.29L2.82 16.059a1.602 1.602 0 0 0 .313 1.772l4.116 4.24c2.103-3.101 1.796-6.02.836-8.3-.728-1.73-1.832-3.081-2.55-3.831zM9.32 14.01c.615-.183 1.606-.465 2.745-.534-.683-1.725-.848-3.233-.716-4.577.154-1.552.7-2.847 1.235-3.95.113-.235.223-.454.328-.664.149-.297.288-.577.419-.86.217-.47.379-.885.46-1.27.08-.38.08-.72-.014-1.043-.095-.325-.297-.675-.68-1.06a1.6 1.6 0 0 0-1.475.36l-4.95 4.452a1.602 1.602 0 0 0-.513.952l-.427 2.83c.672.59 2.328 2.316 3.335 4.711.09.21.175.43.253.653z'],
    ['Google Docs','#4285F4','M14.727 6.727H14V0H4.91c-.905 0-1.637.732-1.637 1.636v20.728c0 .904.732 1.636 1.636 1.636h14.182c.904 0 1.636-.732 1.636-1.636V6.727h-6zm-.545 10.455H7.09v-1.364h7.09v1.364zm2.727-3.273H7.091v-1.364h9.818v1.364zm0-3.273H7.091V9.273h9.818v1.363zM14.727 6h6l-6-6v6z'],
    ['Linear','#5E6AD2','M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z'],
    ['Jira','#0052CC','M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0Z'],
    ['GitHub',null,'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12'],
  ];

  const focusRow = $('[data-focus-row]');
  if (focusRow) {
    const item = ([label, colour, d]) => {
      const li = document.createElement('li');
      if (colour) li.style.setProperty('--c', colour);
      li.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>' +
        '<span>' + label + '</span>';
      return li;
    };
    FOCUS_APPS.forEach(a => focusRow.appendChild(item(a)));
    // The roll translates by exactly -50%, so the row has to be two identical
    // halves or it jumps at the seam. Reduced motion keeps one static half.
    if (!reduced) {
      FOCUS_APPS.forEach(a => {
        const li = item(a);
        li.setAttribute('aria-hidden', 'true');
        focusRow.appendChild(li);
      });
      focusRow.classList.add('is-rolling');
    }
  }

  /* ====================================================================== */
  /* THE WIRING DIAGRAM                                                     */
  /* ADR 0046 is a claim about wiring, so it is drawn as wiring. The two    */
  /* states differ in one quantity a reader can count, and the caption      */
  /* prints that quantity so they do not have to.                          */
  /*                                                                        */
  /* The two captions are one sentence each, deliberately. The paragraph    */
  /* that stood here explained the diagram beside it, which is what a       */
  /* diagram is for: whatever the picture already says, the text must not   */
  /* say again. The drawing carries the argument and the count line lands   */
  /* it; the sentence only names what is being counted.                     */
  /* ====================================================================== */
  const wire = $('[data-wire]');
  if (wire) {
    const sw    = $('[data-wire-sw]', wire);
    const kEl   = $('[data-wire-k]', wire);
    const tEl   = $('[data-wire-t]', wire);
    const swL   = $('[data-wire-sw-l]', wire);
    const capEl = $('[data-wire-cap]', wire);
    const cntEl = $('[data-wire-count]', wire);
    const hubEl = $('[data-wire-hub]', wire);

    const STATES = {
      other: {
        k: 'The usual shape',
        t: 'A connector layer',
        swL: 'Everyone else',
        hub: 'a dictation app',
        countLabel: 'Connections the product has to build and keep working',
        cap: 'Every destination is a connection somebody has to build, authenticate and keep ' +
             'working. Which places your words can go is then their roadmap, not yours.',
        own: 5
      },
      ws: {
        k: 'How WordScript is wired',
        t: 'No connector layer',
        swL: 'WordScript',
        hub: 'WordScript',
        countLabel: 'Connections WordScript has to build and keep working',
        cap: 'One plain file into a folder your agent CLI already opens. Nothing has to be ' +
             'built for the next tool to reach it.',
        own: 1
      }
    };

    const paint = (name) => {
      const st = STATES[name];
      wire.dataset.state = name;
      kEl.textContent = st.k;
      tEl.textContent = st.t;
      swL.textContent = st.swL;
      capEl.textContent = st.cap;
      hubEl.textContent = st.hub;
      cntEl.innerHTML = st.countLabel + ': <b>' + st.own + '</b>';
      sw.setAttribute('aria-checked', name === 'ws' ? 'true' : 'false');
    };

    // SMIL does not honour prefers-reduced-motion the way CSS animations do,
    // so the travelling dots have to be stopped by hand rather than by media
    // query. Pausing the timeline also stops the hidden state's dots, which
    // are only invisible, not idle.
    if (reduced) $('[data-wire-svg]', wire).pauseAnimations();

    // Reduced motion lands on the product's own state and never moves; in
    // normal motion the diagram demonstrates itself once on first sight, the
    // way every other surface on this page does, and stays wherever the
    // reader last put it after that.
    paint(reduced ? 'ws' : 'other');
    sw.addEventListener('click', () => {
      wire.dataset.touched = '1';
      paint(wire.dataset.state === 'ws' ? 'other' : 'ws');
    });

    if (!reduced && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => es.forEach(e => {
        if (!e.isIntersecting) return;
        io.disconnect();
        setTimeout(() => { if (!wire.dataset.touched) paint('ws'); }, 1400);
      }), { threshold: .35 });
      io.observe(wire);
    }
  }

  /* ====================================================================== */
  /* THE ACTIVITY FIELD                                                     */
  /* The fifth figure in the numbers section, and the only one of the five  */
  /* that has to be a shape rather than a number: how often you spoke to it */
  /* is a rhythm, and a rhythm does not fit in a tile.                      */
  /*                                                                        */
  /* The counts below are a constructed example, like the four figures      */
  /* beside them and under the same disclaimer. They are written out as     */
  /* data rather than generated at load, because a field that reshuffles    */
  /* itself on every visit is decoration, and this one is standing in for a */
  /* reading taken off a file.                                              */
  /*                                                                        */
  /* Levels are cut over active days only, so level 1 means a day something */
  /* happened rather than a day slightly below average. A day with nothing  */
  /* on it has to read as empty.                                            */
  /* ====================================================================== */
  const heat = $('[data-heat]');

  // 52 weeks, Monday first, dictations per day
  const HEAT_DAYS = [2, 3, 0, 2, 2, 0, 0, 3, 2, 0, 3, 2, 0, 0, 3, 0, 3, 2, 3, 0, 0, 0, 2, 3, 3, 2, 0, 0, 0, 3, 2, 3, 0, 0, 0, 3, 2, 3, 2, 0, 0, 0, 3, 2, 3, 0, 3, 0, 1, 2, 3, 0, 2, 3, 0, 0, 3, 2, 0, 3, 3, 1, 0, 3, 0, 3, 3, 3, 0, 0, 2, 2, 3, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 0, 1, 0, 4, 3, 4, 0, 3, 0, 1, 3, 4, 2, 2, 4, 1, 1, 3, 3, 0, 4, 3, 1, 0, 4, 0, 3, 4, 4, 0, 0, 3, 0, 4, 3, 4, 0, 1, 0, 4, 4, 5, 0, 0, 1, 3, 4, 4, 4, 0, 1, 0, 5, 4, 5, 0, 4, 0, 1, 4, 5, 3, 0, 5, 0, 1, 4, 5, 0, 5, 4, 1, 0, 5, 0, 4, 5, 5, 0, 0, 4, 0, 5, 4, 6, 0, 0, 0, 5, 5, 5, 4, 0, 1, 3, 6, 0, 0, 0, 0, 0, 6, 5, 6, 0, 4, 1, 1, 6, 5, 5, 0, 6, 0, 1, 5, 6, 0, 6, 5, 1, 0, 6, 4, 4, 6, 5, 1, 0, 6, 0, 7, 5, 7, 0, 0, 0, 6, 6, 6, 5, 0, 1, 0, 0, 0, 0, 0, 0, 0, 7, 6, 7, 4, 5, 1, 1, 8, 6, 6, 0, 8, 0, 1, 6, 8, 0, 6, 7, 1, 0, 7, 5, 4, 8, 6, 1, 0, 7, 0, 8, 7, 8, 0, 0, 4, 6, 8, 7, 7, 0, 1, 0, 9, 7, 9, 0, 0, 0, 8, 8, 8, 6, 5, 1, 0, 10, 7, 8, 0, 9, 0, 2, 8, 9, 5, 7, 9, 1, 0, 8, 7, 0, 10, 8, 2, 0, 9, 0, 9, 9, 10, 0, 0, 6, 6, 11, 8, 9, 0, 2, 0, 11, 9, 11, 5, 0, 2, 9, 11, 9, 8, 5, 2, 0, 13, 9, 11, 0, 10, 0, 2, 10, 10, 7, 7, 12, 0, 2, 9, 10, 0, 12, 9, 2, 0];

  if (heat) {
    const DAYS = 7;
    const weeks = Math.floor(HEAT_DAYS.length / DAYS);

    const active = HEAT_DAYS.filter(n => n > 0).sort((a, b) => a - b);
    const q = (p) => active[Math.floor(active.length * p)];
    const t1 = q(0.25), t2 = q(0.5), t3 = q(0.75);
    const level = (n) => n === 0 ? 0 : n <= t1 ? 1 : n <= t2 ? 2 : n <= t3 ? 3 : 4;

    // Rows are weekdays and columns are weeks, so the grid is filled by row:
    // day 0 of every week, then day 1 of every week, and so on.
    const cells = [];
    for (let d = 0; d < DAYS; d++) {
      for (let w = 0; w < weeks; w++) {
        const n = HEAT_DAYS[w * DAYS + d];
        // --i is the column, so the field fills left to right as one sweep
        // rather than all at once. Newest week last, which is where the eye
        // ends up and where the shape is densest.
        cells.push('<i class="own__c" data-l="' + level(n) + '" style="--i:' + w + '"></i>');
      }
    }
    heat.style.setProperty('--cols', weeks);
    heat.innerHTML = cells.join('');

    const legend = $('[data-heat-legend]');
    if (legend) {
      legend.innerHTML = 'less' +
        [0, 1, 2, 3, 4].map(l => '<i class="own__c" data-l="' + l + '"></i>').join('') +
        'more';
    }
  }

  /* ====================================================================== */
  /* THE ASCII BAND                                                         */
  /* The signal, sampled and printed. The machine has no curve, only glyphs. */
  /* ====================================================================== */
  const band = $('[data-band]');
  const RAMP = [' ', '.', ':', ';', '!', '|', '#'];
  const ROWS = 7, MID = (ROWS - 1) / 2;

  function bandFrame(cols, phase) {
    const out = Array.from({ length: ROWS }, () => []);
    for (let x = 0; x < cols; x++) {
      const u = x / cols;
      const a = Math.abs(
        0.42 * Math.sin(u * 21 + phase) +
        0.30 * Math.sin(u * 47 - phase * 1.7) +
        0.22 * Math.sin(u * 8.5 + phase * 0.6) +
        0.14 * Math.sin(u * 103 + phase * 2.9)
      ) * (0.42 + 0.58 * Math.sin(u * Math.PI));
      const half = a * MID * 1.35;
      for (let r = 0; r < ROWS; r++) {
        const d = Math.abs(r - MID);
        const depth = half - d;
        out[r].push(depth <= 0 ? RAMP[0] : RAMP[Math.min(RAMP.length - 1, 1 + Math.floor(depth * 2.2))]);
      }
    }
    return out.map(r => r.join('')).join('\n');
  }

  let phase = 0, bandTimer = null;
  const bandCols = () => Math.min(300, Math.max(60, Math.floor(band.clientWidth / 6.2)));
  const drawBand = () => { band.textContent = bandFrame(bandCols(), phase); };

  if (band) {
    drawBand();
    addEventListener('resize', drawBand, { passive: true });
    if (!reduced && 'IntersectionObserver' in window) {
      new IntersectionObserver((es) => es.forEach(e => {
        if (e.isIntersecting && !bandTimer) {
          bandTimer = setInterval(() => { phase += 0.09; drawBand(); }, 90);
        } else if (!e.isIntersecting && bandTimer) {
          clearInterval(bandTimer); bandTimer = null;
        }
      }), { threshold: 0 }).observe(band);
    }
  }

  /* ====================================================================== */
  /* COUNTERS                                                               */
  /* A figure that lands already finished is a figure nobody reads. These   */
  /* run to their printed value instead, and they borrow their timing from  */
  /* the bar beside them: the delay is read off the track's own computed    */
  /* transition-delay, so the stylesheet stays the one place that decides   */
  /* the order and this never drifts out of step with it.                   */
  /* ====================================================================== */
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  function countUp(el, dur, delay) {
    const target = parseFloat(el.dataset.n);
    const dec = parseInt(el.dataset.dec || '0', 10);
    if (!isFinite(target)) return;

    let node = el.firstChild;
    if (!node || node.nodeType !== 3) {
      node = el.insertBefore(document.createTextNode(''), el.firstChild);
    }
    if (reduced) { node.nodeValue = target.toFixed(dec); return; }

    node.nodeValue = (0).toFixed(dec);
    const start = () => {
      const t0 = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        node.nodeValue = (target * easeOut(t)).toFixed(dec);
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    delay > 0 ? setTimeout(start, delay) : start();
  }

  // Called once a block has been revealed, so the computed delays are the
  // ones the .is-in rules set rather than the ones they had before it.
  function armCounters(root) {
    $$('[data-n]', root).forEach(el => {
      let d = 0;
      if (el.dataset.delay) {
        d = parseFloat(el.dataset.delay);
      } else {
        const bar = el.parentElement && el.parentElement.querySelector('.tp__track i');
        if (bar) d = parseFloat(getComputedStyle(bar).transitionDelay) * 1000;
      }
      countUp(el, 950, isFinite(d) ? d : 0);
    });
  }

  /* ====================================================================== */
  /* PAGE CHROME                                                            */
  /* ====================================================================== */
  const top = $('#top');
  const onScroll = () => top.classList.toggle('is-stuck', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const rises = $$('.rise');
  if (reduced || !('IntersectionObserver' in window)) {
    rises.forEach(el => { el.classList.add('is-in'); armCounters(el); });
    playHero();
    select(0, false);
  } else {
    const io = new IntersectionObserver((es) => es.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        armCounters(e.target);
        io.unobserve(e.target);
      }
    }), { rootMargin: '0px 0px -12% 0px', threshold: 0.1 });
    rises.forEach(el => io.observe(el));

    // Neither sequence plays into an empty room.
    const armed = new WeakSet();
    const watch = (el, fn) => {
      const o = new IntersectionObserver((es) => es.forEach(e => {
        if (e.isIntersecting && !armed.has(el)) { armed.add(el); fn(); o.disconnect(); }
      }), { threshold: 0.25 });
      o.observe(el);
    };
    watch($('.stage'), playHero);
    watch($('.demo__stage'), () => select(0, false));
  }
})();
