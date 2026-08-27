/* 2 - CONTEXT: THE THREE INTAKES

   Write, Record and Import are genuinely three, not one control with three
   settings: each makes a different object from a different source, and the
   surfaces under them have nothing in common. What they share is the last
   step, which is the whole argument of this tab. */
import { $, $$ } from '../dom';
import { type Runner } from '../runner';
import { ICON, mm, mountMatrix, mountPill, type Matrix, type Pill } from '../pill';

export const INTAKES = [
  { id: 'write',  label: 'Write' },
  { id: 'record', label: 'Record' },
  { id: 'import', label: 'Import' },
];

const DISK_PATH = '~/Documents/WordScript/Context/api-refactor/';
const DISK: [string | null, string][] = [
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

const HUD_LINES: [string, string, string, string][] = [
  ['11:48', 'S2', 'b', 'so the placement bug is still open on the second monitor.'],
  ['11:57', 'S1', 'a', 'right, I will take the Diagnostics sub-tabs this week.'],
  ['12:04', 'S2', 'b', 'can we decide the MCP server question before Friday?'],
];
const HUD_SUM: [string, string[]][] = [
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

export function makeContext(root: HTMLElement, reduced: boolean, say: (s: string) => void) {
  const intakeBox = $('[data-intake]', root)!;
  const diskBox = $('[data-disk]', root)!;
  const ctxCap = $('[data-ctx-cap]', root)!;
  let ctxPill: Pill | null = null;
  let hudMx: Matrix | null = null;

  const paintDisk = (intake: string) => {
    diskBox.innerHTML = `<div class="disk__row is-on"><span class="p">${DISK_PATH}</span></div>` +
      DISK.map(([owner, name]) =>
        `<div class="disk__row"><span class="f${owner === intake ? ' new' : ''}">${name}</span></div>`).join('');
  };

  return {
    stop() {
      ctxPill?.clear();
      hudMx?.stop();
      ctxPill = null; hudMx = null;
    },

    play(run: Runner, intake: string) {
      this.stop();
      paintDisk(intake);
      const dEls = $$('.disk__row', diskBox).slice(1);

      /* ---- Write ---------------------------------------------------------- */
      if (intake === 'write') {
        intakeBox.innerHTML = buildWrite();
        ctxCap.textContent = 'The object exists before the words do. Nothing here is transcribed after the fact, whether you type it or say it.';
        ctxPill = mountPill($('[data-ctx-pill]', intakeBox), reduced);
        const title = $('[data-wr-title]', intakeBox)!;
        const body = $('[data-wr-body]', intakeBox)!;

        if (reduced) {
          title.textContent = WRITE_TITLE;
          body.innerHTML = WRITE_BODY.map(l => `<p class="is-on">${l}</p>`).join('');
          ctxPill?.set('result-actions', { text: WRITE_TITLE });
          dEls.forEach(el => el.classList.add('is-on'));
          say('Written');
          return;
        }

        const steps: [number, () => void][] = [
          [250, () => say('An empty object')],
          [0, () => { title.textContent = ''; }],
        ];
        for (let i = 1; i <= WRITE_TITLE.length; i++) {
          steps.push([26, () => { title.innerHTML = WRITE_TITLE.slice(0, i) + '<span class="caret"></span>'; }]);
        }
        steps.push(
          [400, () => { title.textContent = WRITE_TITLE; }],
          [0,   () => { ctxPill?.set('recording', { mode: 'Cleanup' }); }],
          [0,   () => say('Holding the key, talking into it')],
          [0,   () => { body.innerHTML = WRITE_BODY.map(l => `<p>${l}</p>`).join(''); }],
        );
        WRITE_BODY.forEach((_, i) => steps.push([620, () => $$('p', body)[i].classList.add('is-on')]));
        steps.push(
          [400, () => { ctxPill?.set('result-actions', { text: WRITE_TITLE }); }],
          [0,   () => say('One file, in the folder you named')],
        );
        dEls.forEach(el => steps.push([170, () => el.classList.add('is-on')]));
        run.play(steps);
        return;
      }

      /* ---- Record: the meeting window ------------------------------------- */
      if (intake === 'record') {
        intakeBox.innerHTML = buildRecord();
        ctxCap.textContent = '330 by 560, always on top, resizable, and excluded from screen shares. It inserts nothing anywhere, and it ends as a note.';
        const hudBody = $('[data-hud-body]', intakeBox)!;
        const el = $('[data-hud-el]', intakeBox)!;
        const who = $('[data-hud-who]', intakeBox)!;
        const hTabs = $$('.hud__tabs button', intakeBox);
        hudMx = mountMatrix($('[data-hud-mx]', intakeBox), 16, 7, reduced);

        const transcript = () => '<div class="ts">' + HUD_LINES.map(([at, sp, tone, text]) =>
          `<div class="ts__l" data-tone="${tone}"><span class="ts__m mono">${at}</span>` +
          `<span class="ts__s mono">${sp}</span><span class="ts__t">${text}</span></div>`).join('') + '</div>';
        const summary = () => '<div class="sum">' + HUD_SUM.map(([h, items]) =>
          `<div class="sum__g"><h5>${h}</h5><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul></div>`).join('') + '</div>';
        const pickTab = (name: string) =>
          hTabs.forEach(b => b.setAttribute('aria-selected', String(b.dataset.h === name)));

        if (reduced) {
          hudBody.innerHTML = summary();
          $$('.sum__g', hudBody).forEach(g => g.classList.add('is-on'));
          pickTab('Summary'); el.textContent = '24:11'; who.textContent = '2 of 4 speaking';
          hudMx?.run();
          dEls.forEach(e => e.classList.add('is-on'));
          say('Recorded');
          return;
        }

        hudBody.innerHTML = transcript();
        const tEls = $$('.ts__l', hudBody);
        const steps: [number, () => void][] = [
          [200, () => say('A meeting is running')],
          [0,   () => { hudMx?.run(); who.textContent = '2 of 4 speaking'; }],
        ];
        // the elapsed clock is a readout, so it is ticked and not animated
        let secs = 11 * 60 + 40;
        for (let i = 0; i < 10; i++) steps.push([420, () => { secs += 3; el.textContent = mm(secs); }]);
        tEls.forEach((e, i) => steps.push([i === 0 ? 0 : 760, () => e.classList.add('is-on')]));
        steps.push(
          [700, () => say('The same three tabs it has afterwards')],
          [0,   () => { pickTab('Summary'); hudBody.innerHTML = summary(); }],
        );
        HUD_SUM.forEach((_, i) => steps.push([460, () => $$('.sum__g', hudBody)[i].classList.add('is-on')]));
        steps.push([600, () => say('It ends as a note, in the same folder')]);
        dEls.forEach(e => steps.push([170, () => e.classList.add('is-on')]));
        run.play(steps);
        return;
      }

      /* ---- Import: a file, or a link ------------------------------------- */
      intakeBox.innerHTML = buildImport();
      ctxCap.textContent = 'There is no second queue. A file being transcribed is a context object that does not have its transcript yet.';
      const f = $('[data-imp-field]', intakeBox)!;
      const fetchB = $('[data-imp-fetch]', intakeBox)!;
      const stepsBox = $('[data-imp-steps]', intakeBox)!;
      stepsBox.innerHTML = IMPORT_STEPS
        .map(s => `<div class="imp__s"><span class="imp__sd"></span><span>${s}</span></div>`).join('');
      const sEls = $$('.imp__s', stepsBox);

      if (reduced) {
        f.textContent = IMPORT_URL;
        sEls.forEach(e => e.classList.add('is-on', 'is-done'));
        dEls.forEach(e => e.classList.add('is-on'));
        say('Imported');
        return;
      }

      const steps: [number, () => void][] = [
        [250, () => say('A pasted link')],
        [0, () => { f.innerHTML = '<span class="caret"></span>'; }],
      ];
      for (let i = 1; i <= IMPORT_URL.length; i++) {
        steps.push([19, () => { f.innerHTML = IMPORT_URL.slice(0, i) + '<span class="caret"></span>'; }]);
      }
      steps.push(
        [350, () => { f.textContent = IMPORT_URL; fetchB.classList.add('btn--primary'); }],
        [500, () => { fetchB.classList.remove('btn--primary'); }],
        [0,   () => say('Fetching')],
      );
      sEls.forEach((e, i) => steps.push([680, () => {
        e.classList.add('is-on');
        if (i > 0) sEls[i - 1].classList.add('is-done');
        if (i === sEls.length - 1) { e.classList.add('is-done'); say('The same kind of record'); }
      }]));
      dEls.forEach(e => steps.push([170, () => e.classList.add('is-on')]));
      run.play(steps);
    },
  };
}
