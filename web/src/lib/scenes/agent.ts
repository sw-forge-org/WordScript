/* 3 - AGENT: THE DESK

   One process, three targets. The rail draws the targets indented under the
   identity they belong to, because a window that shows three peers is arguing
   against the decision it implements: WordScript talks to one orchestrator,
   and for the agents that orchestrator starts, IT is the human. */
import { $, $$ } from '../dom';
import { type Runner } from '../runner';
import { ICON, mountMatrix, mountPill, type Matrix, type Pill } from '../pill';

const TARGETS: [string, string][] = [
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

export function makeAgent(root: HTMLElement, reduced: boolean, say: (s: string) => void) {
  const termBox = $('[data-term]', root)!;
  const threadBox = $('[data-thread]', root)!;
  const answerBox = $('[data-answer]', root)!;
  const targetsBox = $('[data-targets]', root)!;
  const agentPill: Pill | null = mountPill($('[data-agent-pill]', root), reduced);
  let ansMx: Matrix | null = null;

  return {
    pill: agentPill,
    stop() { ansMx?.stop(); ansMx = null; },

    play(run: Runner) {
      this.stop();
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
      answerBox.classList.remove('is-on');
      delete answerBox.dataset.done;

      const lines = $$('.l', termBox);
      const tgs = $$('.tg', targetsBox);
      const msgs = $$('.msg', threadBox);
      const opts = $$('.msg__opt', threadBox);
      const said = $('[data-said]', threadBox)!;
      const when = $('[data-when]', threadBox)!;
      const ansT = $('[data-ans-t]', answerBox)!;
      ansMx = mountMatrix($('[data-ans-mx]', answerBox), 12, 7, reduced);

      const state = (i: number, s: string, tone?: string | null, unread?: string) => {
        $('.tg__s', tgs[i])!.textContent = s;
        $('.dot', tgs[i])!.className = 'dot' + (tone ? ` dot--${tone}` : '');
        $('.tg__u', tgs[i])!.textContent = unread || '';
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
        ansMx?.run();
        agentPill?.set('result-actions', { text: 'Hold it' });
        say('Answered');
        return;
      }

      const steps: [number, () => void][] = [[200, () => say('Started by voice')]];
      tgs.forEach((el, i) => steps.push([260, () => {
        el.classList.add('is-on');
        state(i, i === 1 ? 'Running' : 'Idle', i === 1 ? 'ok' : null);
      }]));
      TERM_A.forEach((_, i) => steps.push([440, () => lines[i].classList.add('is-on')]));
      steps.push(
        [300, () => { state(0, 'Waiting for you', 'acc', '1'); }],
        [0,   () => { msgs[0].classList.add('is-on'); when.textContent = 'spoken, 0:00 ago'; }],
        [0,   () => say('It asks out loud, and waits')],
        [500, () => { answerBox.classList.add('is-on'); ansMx?.run(); }],
      );
      for (let i = 9; i >= 5; i--) steps.push([400, () => { ansT.textContent = `0:0${i}`; }]);
      steps.push(
        [200, () => { agentPill?.set('recording', { mode: 'Agent' }); }],
        [0,   () => { agentPill?.tab('<b>WordScript</b> is waiting', 3400); }],
        [1200, () => { opts[1].classList.add('is-picked'); }],
        [0,   () => { agentPill?.set('result-actions', { text: 'Hold it' }); }],
        [250, () => { msgs[1].classList.add('is-on'); said.textContent = 'hold it'; }],
        [0,   () => {
          ansMx?.stop();
          answerBox.innerHTML = `${ICON.check}<span>answered out loud, inside the window</span>` +
            '<span class="answer__t mono">0:06 of 0:10</span>';
          answerBox.dataset.done = '1';
        }],
        [0,   () => { when.textContent = 'spoken, 0:06 ago'; }],
        [0,   () => { state(0, 'Running', 'ok'); }],
        [0,   () => say('Answered, and the run carried on')],
      );
      TERM_B.forEach((_, i) => steps.push([460, () => lines[TERM_A.length + i].classList.add('is-on')]));
      steps.push(
        [400, () => { msgs[2].classList.add('is-on'); state(1, 'Idle'); }],
        [0,   () => { state(0, 'Idle'); }],
      );
      run.play(steps);
    },
  };
}
