// Deterministic math helpers. The AI writes the problem text, hints and
// explanations, but every number that decides "correct / incorrect" is
// computed here, never taken on trust from the model.

const EPS = 1e-9;
export const ANSWER_TOLERANCE = 0.01;

// Real roots of a*x^2 + b*x + c = 0, sorted ascending, duplicates merged.
export function solveQuadratic(a, b, c) {
  if (![a, b, c].every(Number.isFinite)) throw new Error('Coefficients must be numbers');
  if (Math.abs(a) < EPS) throw new Error('Coefficient a must not be 0');

  const d = b * b - 4 * a * c;
  if (d < -EPS) return { discriminant: d, roots: [] };
  if (Math.abs(d) <= EPS) return { discriminant: 0, roots: [round(-b / (2 * a))] };

  const s = Math.sqrt(d);
  const roots = [(-b - s) / (2 * a), (-b + s) / (2 * a)].map((x) => round(x)).sort((x, y) => x - y);
  return { discriminant: d, roots };
}

function round(x, digits = 6) {
  const r = Number(x.toFixed(digits));
  return Object.is(r, -0) ? 0 : r;
}

const isInt = (x) => Math.abs(x - Math.round(x)) < 1e-6;

// Checks that a generated problem satisfies its level's rules. Returns a list
// of problems (empty = valid) so the API can ask the model to try again.
export function validateProblem(problem, level) {
  const errors = [];
  const eq = problem?.equation;
  if (!eq || ![eq.a, eq.b, eq.c].every(Number.isFinite)) {
    return ['equation.a, equation.b and equation.c must be numbers'];
  }
  if (eq.a === 0) return ['a must not be 0'];

  const { roots } = solveQuadratic(eq.a, eq.b, eq.c);
  if (roots.length === 0) errors.push('equation has no real roots');

  if (level === 1) {
    if (eq.a !== 1) errors.push('level 1 requires a = 1');
    if (!roots.every(isInt)) errors.push('level 1 requires integer roots');
  }
  if (level === 2) {
    if (![eq.a, eq.b, eq.c].every(isInt)) errors.push('level 2 requires integer coefficients');
  }
  if (level === 3) {
    const t = problem.target_answer;
    if (!Number.isFinite(t)) {
      errors.push('level 3 requires a numeric target_answer');
    } else if (!roots.some((r) => Math.abs(r - t) < ANSWER_TOLERANCE)) {
      errors.push(`target_answer ${t} is not a root of the equation (roots: ${roots.join(', ')})`);
    }
  }

  if (!Array.isArray(problem.hints) || problem.hints.length === 0) errors.push('hints missing');
  if (!Array.isArray(problem.solution) || problem.solution.length === 0) errors.push('solution missing');
  return errors;
}

// The answers a student must give: all real roots for levels 1-2, the single
// context-valid root for level 3 (e.g. the positive time).
export function expectedAnswers(problem, level) {
  const { a, b, c } = problem.equation;
  const { roots } = solveQuadratic(a, b, c);
  if (level === 3) return roots.filter((r) => Math.abs(r - problem.target_answer) < ANSWER_TOLERANCE);
  return roots;
}

// Pulls numbers out of free text like "x = 2, x = -3/2" or "1.41 and -1.41".
export function parseAnswer(text) {
  const matches = String(text).match(/-?\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?/g) ?? [];
  return matches
    .map((m) => {
      const [num, den] = m.split('/').map(Number);
      return den === undefined ? num : num / den;
    })
    .filter(Number.isFinite);
}

// 'correct' | 'partial' | 'incorrect' | 'empty'
export function gradeAnswer(studentText, expected) {
  const given = parseAnswer(studentText);
  if (given.length === 0) return { verdict: 'empty', given, matched: 0 };

  const remaining = [...given];
  let matched = 0;
  for (const e of expected) {
    const i = remaining.findIndex((g) => Math.abs(g - e) < ANSWER_TOLERANCE);
    if (i !== -1) {
      matched++;
      remaining.splice(i, 1);
    }
  }
  const extra = remaining.length;
  let verdict = 'incorrect';
  if (matched === expected.length && extra === 0) verdict = 'correct';
  else if (matched > 0) verdict = 'partial';
  return { verdict, given, matched, extra };
}
