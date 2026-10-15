const state = { level: 1, problem: null, hintsShown: 0 };

const $ = (id) => document.getElementById(id);

function renderMath(el) {
  if (window.renderMathInElement) {
    renderMathInElement(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
      ],
      throwOnError: false,
    });
  }
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

function fillList(ol, items) {
  ol.replaceChildren(
    ...items.map((t) => {
      const li = document.createElement('li');
      setText(li, t);
      return li;
    }),
  );
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

function setStatus(msg, isError = false) {
  $('status').textContent = msg;
  $('status').classList.toggle('error', isError);
}

// Level toggle
document.querySelectorAll('.level').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.level = Number(btn.dataset.level);
    document.querySelectorAll('.level').forEach((b) => {
      const on = b === btn;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', String(on));
    });
    generate();
  });
});

$('generate').addEventListener('click', generate);

async function generate() {
  $('generate').disabled = true;
  setStatus('Generating a task… this can take up to a minute.');
  try {
    const { problem } = await api('/api/generate', { level: state.level });
    state.problem = problem;
    state.hintsShown = 0;
    showProblem(problem);
    setStatus('');
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    $('generate').disabled = false;
  }
}

function showProblem(p) {
  setText($('title'), p.title);
  setText($('context'), p.context);
  setText($('question'), p.question);
  $('units').textContent = p.units ? `(${p.units})` : '';

  $('steps-box').hidden = !p.steps?.length;
  fillList($('steps'), p.steps ?? []);

  fillList($('hints'), []);
  $('hint-btn').disabled = false;
  $('hint-btn').textContent = `Show hint (${p.hints.length} left)`;

  fillList($('solution'), p.solution);
  $('solution-box').hidden = true;

  $('answer').value = '';
  $('feedback').hidden = true;
  $('task').hidden = false;
}

$('hint-btn').addEventListener('click', () => {
  const { hints } = state.problem;
  if (state.hintsShown >= hints.length) return;
  const li = document.createElement('li');
  setText(li, hints[state.hintsShown++]);
  $('hints').append(li);
  const left = hints.length - state.hintsShown;
  $('hint-btn').textContent = left ? `Show hint (${left} left)` : 'No more hints';
  $('hint-btn').disabled = left === 0;
});

$('solution-btn').addEventListener('click', () => {
  $('solution-box').hidden = !$('solution-box').hidden;
});

$('answer-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const answer = $('answer').value.trim();
  if (!answer || !state.problem) return;

  const box = $('feedback');
  box.hidden = false;
  box.className = 'feedback';
  box.textContent = 'Checking your answer…';
  try {
    const { verdict, feedback } = await api('/api/check', {
      level: state.level,
      problem: state.problem,
      answer,
    });
    box.classList.add(verdict);
    const label = { correct: 'Correct!', incorrect: 'Not quite', empty: 'No number found' }[verdict];
    setText(box, `${label} ${feedback}`);
  } catch (err) {
    box.classList.add('incorrect');
    box.textContent = err.message;
  }
});

renderMath(document.querySelector('header'));
