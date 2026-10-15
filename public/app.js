import { startPrism } from './prism.js';
import { createSketch } from './sketch.js';

const LEVELS = {
  1: {
    name: 'Foundation', desc: 'Base and height given, whole numbers, step by step.', support: 3, supportLabel: 'Full support',
    stepsLabel: 'Step by step',
    facts: [['Given', 'Base and height'], ['Formula', 'S = ½ · a · h'], ['Scaffold', '3–5 guided steps'], ['Hints', 'Direct'], ['Feedback', 'Points to the step']],
  },
  2: {
    name: 'Standard', desc: 'Two sides and an angle, or three sides. Pick the formula.', support: 2, supportLabel: 'Checkpoints',
    stepsLabel: 'Checkpoints',
    facts: [['Given', 'Sides and an angle'], ['Formula', '½ab·sin C or Heron'], ['Scaffold', '2–3 checkpoints'], ['Hints', 'Method, not numbers'], ['Feedback', 'Names the likely error']],
  },
  3: {
    name: 'Advanced', desc: 'A real situation. Find what is missing, then the area.', support: 1, supportLabel: 'On your own',
    stepsLabel: 'Scaffold',
    facts: [['Given', 'A real situation'], ['Formula', 'Your choice'], ['Scaffold', 'None'], ['Hints', 'Conceptual'], ['Feedback', 'A guiding question']],
  },
};

const VERDICT = {
  correct: { label: 'Correct!', mark: '✓' },
  incorrect: { label: 'Not quite', mark: '✗' },
  empty: { label: 'No number?', mark: '?' },
};

const state = { level: 1, problem: null, hintsShown: 0, solved: false, taskNo: 0, request: 0 };
const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sketch = createSketch($('sketch'), { reduceMotion });

function renderMath(el) {
  window.renderMathInElement?.(el, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false },
    ],
    throwOnError: false,
  });
}

// The model occasionally forgets a closing "$"; close it so KaTeX still renders.
function fixDollars(text) {
  const singles = String(text ?? '').replace(/\$\$/g, '').match(/(?<!\\)\$/g)?.length ?? 0;
  return singles % 2 ? `${text}$` : String(text ?? '');
}

function setText(el, text) {
  el.textContent = fixDollars(text);
  renderMath(el);
}

async function api(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ---------- Levels ---------- */

function renderLevels() {
  $('levels').replaceChildren(...Object.entries(LEVELS).map(([n, L]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'level';
    b.dataset.level = n;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(+n === state.level));
    b.innerHTML = `
      <span class="lv-num">Level ${n}</span>
      <span class="lv-name">${L.name}</span>
      <span class="support" aria-label="Support: ${L.supportLabel}">
        <span class="bars">${[1, 2, 3].map((i) => `<i class="${i <= L.support ? 'on' : ''}"></i>`).join('')}</span>
        <small>${L.supportLabel}</small>
      </span>
      <span class="lv-desc">${L.desc}</span>`;
    b.addEventListener('click', () => {
      state.level = +n;
      generate();
    });
    return b;
  }));
}

function applyLevel() {
  const L = LEVELS[state.level];
  document.body.dataset.level = state.level;
  renderLevels();
  $('eyebrow').textContent = `Level ${state.level} · ${L.name}`;
  $('facts').replaceChildren(...L.facts.map(([k, v]) => {
    const li = document.createElement('li');
    li.innerHTML = '<span></span><span></span>';
    li.children[0].textContent = k;
    li.children[1].textContent = v;
    return li;
  }));
}

/* ---------- Task ---------- */

function setView(view) {
  $('loading').hidden = view !== 'loading';
  $('error').hidden = view !== 'error';
  $('task').hidden = view !== 'task';
  $('sheet').setAttribute('aria-busy', String(view === 'loading'));
  $('new-task').disabled = view === 'loading';
}

async function generate() {
  const id = ++state.request; // a newer click wins over an older, slower request
  applyLevel();
  state.taskNo++;
  $('task-no').textContent = `№ ${state.taskNo}`;
  $('mark').textContent = '';
  $('mark').className = 'mark';
  $('offline').hidden = true;
  $('loading-text').textContent = `Writing a level ${state.level} task…`;
  setView('loading');
  $('sketch-lock').hidden = true;
  $('sketch-sub').textContent = 'The AI is writing your task.';
  sketch.loading();

  try {
    const { problem } = await api('/api/generate', { level: state.level });
    if (id !== state.request) return;
    showProblem(problem);
  } catch (err) {
    if (id !== state.request) return;
    $('error-text').textContent = `Could not get a task: ${err.message}. Check your connection and try again.`;
    setView('error');
    sketch.lock();
  }
}

function showProblem(p) {
  Object.assign(state, { problem: p, hintsShown: 0, solved: false });
  const L = LEVELS[state.level];

  setText($('title'), p.title);
  setText($('context'), p.context);
  setText($('question'), p.question);
  $('units').textContent = p.units ? `(${p.units})` : '';
  $('offline').hidden = p.source !== 'offline';

  const steps = p.steps ?? [];
  $('steps-label').textContent = L.stepsLabel;
  $('steps-count').textContent = steps.length ? `${steps.length} steps` : '';
  $('steps').hidden = !steps.length;
  $('no-scaffold').hidden = steps.length > 0;
  $('steps').replaceChildren(...steps.map((s, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<label><input type="checkbox" id="step-${i}"><span class="txt"></span></label>`;
    setText(li.querySelector('.txt'), s);
    return li;
  }));

  $('answer').value = '';
  $('check').disabled = false;
  $('feedback').hidden = true;
  $('hints').replaceChildren();
  renderHintButton();

  $('solution').replaceChildren(...p.solution.map((s) => {
    const li = document.createElement('li');
    setText(li, s);
    return li;
  }));
  setSolution(false);

  setView('task');

  // At level 3 the drawing would give the modelling away, so it waits.
  if (state.level === 3) {
    $('sketch-lock').hidden = false;
    $('sketch-sub').textContent = 'Appears after you answer.';
    sketch.lock();
  } else {
    $('sketch-sub').textContent = 'What you know, and the area you need.';
    sketch.show(p);
  }
}

function unlockSketch() {
  if ($('sketch-lock').hidden) return;
  $('sketch-lock').hidden = true;
  $('sketch-sub').textContent = 'The triangle hidden in the story.';
  sketch.show(state.problem);
}

/* ---------- Hints & solution ---------- */

function renderHintButton() {
  const total = state.problem.hints.length, left = total - state.hintsShown;
  $('hint-label').textContent = left ? (state.hintsShown ? 'Next hint' : 'Show a hint') : 'No hints left';
  $('pips').innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i < state.hintsShown ? 'used' : ''}"></i>`).join('');
  $('hint-btn').disabled = !left;
}

$('hint-btn').addEventListener('click', () => {
  const { hints } = state.problem;
  if (state.hintsShown >= hints.length) return;
  const li = document.createElement('li');
  li.innerHTML = `<span>Hint ${state.hintsShown + 1}</span><div></div>`;
  setText(li.lastElementChild, hints[state.hintsShown++]);
  $('hints').append(li);
  renderHintButton();
});

function setSolution(open) {
  $('solution').hidden = !open;
  $('sol-btn').textContent = open ? 'Hide worked solution' : 'Show worked solution';
  $('sol-btn').setAttribute('aria-expanded', String(open));
}

$('sol-btn').addEventListener('click', () => {
  const open = $('solution').hidden;
  setSolution(open);
  if (open) unlockSketch();
});

/* ---------- Answer ---------- */

$('answer-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const answer = $('answer').value.trim();
  if (!answer || !state.problem) return;

  const id = state.request;
  const box = $('feedback');
  box.hidden = false;
  box.className = 'feedback checking';
  $('verdict').textContent = 'Checking…';
  $('fb-text').textContent = '';
  $('check').disabled = true;

  try {
    const { verdict, feedback } = await api('/api/check', { level: state.level, problem: state.problem, answer });
    if (id !== state.request) return;
    const v = VERDICT[verdict] ?? VERDICT.incorrect;
    box.className = `feedback ${verdict}`;
    $('verdict').textContent = v.label;
    setText($('fb-text'), feedback);
    $('mark').textContent = v.mark;
    $('mark').className = `mark ${verdict}`;
    if (verdict === 'correct') {
      state.solved = true;
      unlockSketch();
      sketch.reveal();
    }
  } catch (err) {
    if (id !== state.request) return;
    box.className = 'feedback incorrect';
    $('verdict').textContent = 'Error';
    $('fb-text').textContent = `${err.message}. Try checking again.`;
  } finally {
    $('check').disabled = false;
  }
});

$('new-task').addEventListener('click', generate);
$('retry').addEventListener('click', generate);
$('replay').addEventListener('click', () => sketch.replay());

startPrism($('prism'), $('prism-box'), { reduceMotion });
generate();
