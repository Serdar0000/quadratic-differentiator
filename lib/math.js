// Deterministic math helpers. The AI writes the problem text, hints and
// explanations, but every number that decides "correct / incorrect" is
// computed here, never taken on trust from the model.

const EPS = 1e-9;
const NICE_ANGLES = [30, 45, 60, 90, 120, 135, 150];

// Accept answers within 0.5% (at least 0.01), so rounding to 2 decimals
// or to a whole number on large real-world areas is fine.
export const tolerance = (expected) => Math.max(0.01, Math.abs(expected) * 0.005);

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const isPos = (x) => isNum(x) && x > 0;
const isInt = (x) => Math.abs(x - Math.round(x)) < 1e-6;

// Area of a triangle described in one of four canonical ways.
// Throws if the description is invalid or the triangle is degenerate.
export function triangleArea(t) {
  let area;
  switch (t?.method) {
    case 'base_height':
      if (!isPos(t.base) || !isPos(t.height)) throw new Error('base and height must be positive');
      area = 0.5 * t.base * t.height;
      break;

    case 'two_sides_angle': {
      if (!isPos(t.a) || !isPos(t.b)) throw new Error('sides must be positive');
      if (!isNum(t.angle_deg) || t.angle_deg <= 0 || t.angle_deg >= 180) {
        throw new Error('angle_deg must be between 0 and 180');
      }
      area = 0.5 * t.a * t.b * Math.sin((t.angle_deg * Math.PI) / 180);
      break;
    }

    case 'three_sides': {
      const { a, b, c } = t;
      if (![a, b, c].every(isPos)) throw new Error('sides must be positive');
      if (a + b <= c || a + c <= b || b + c <= a) throw new Error('sides violate the triangle inequality');
      const s = (a + b + c) / 2;
      area = Math.sqrt(s * (s - a) * (s - b) * (s - c)); // Heron's formula
      break;
    }

    case 'coordinates': {
      const p = t.points;
      if (!Array.isArray(p) || p.length !== 3 || !p.every((q) => Array.isArray(q) && q.length === 2 && q.every(isNum))) {
        throw new Error('points must be three [x, y] pairs');
      }
      const [[x1, y1], [x2, y2], [x3, y3]] = p;
      area = Math.abs(x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)) / 2; // shoelace
      break;
    }

    default:
      throw new Error('unknown method');
  }
  if (!(area > EPS)) throw new Error('triangle is degenerate (area 0)');
  return Number(area.toFixed(6));
}

// Checks that a generated problem is mathematically valid and fits its level.
// Returns a list of problems (empty = valid) so the API can ask the model again.
export function validateProblem(problem, level) {
  const t = problem?.triangle;
  let area;
  try {
    area = triangleArea(t);
  } catch (err) {
    return [`triangle: ${err.message}`];
  }

  const errors = [];
  if (!isNum(problem.answer)) {
    errors.push('answer must be a number');
  } else if (Math.abs(problem.answer - area) > tolerance(area)) {
    errors.push(`answer ${problem.answer} does not match the triangle data (area is ${area})`);
  }

  if (level === 1) {
    if (t.method !== 'base_height') errors.push('level 1 must use method "base_height"');
    else if (!isInt(t.base) || !isInt(t.height) || t.base > 30 || t.height > 30) {
      errors.push('level 1 needs whole-number base and height up to 30');
    }
  }
  if (level === 2) {
    if (t.method === 'two_sides_angle' && !NICE_ANGLES.includes(t.angle_deg)) {
      errors.push(`level 2 angle must be one of ${NICE_ANGLES.join(', ')}`);
    }
    if (t.method === 'three_sides' && !isInt(area)) errors.push('level 2 Heron triangles need a whole-number area');
    if (!['two_sides_angle', 'three_sides'].includes(t.method)) {
      errors.push('level 2 must use "two_sides_angle" or "three_sides"');
    }
  }

  if (!Array.isArray(problem.hints) || problem.hints.length === 0) errors.push('hints missing');
  if (!Array.isArray(problem.solution) || problem.solution.length === 0) errors.push('solution missing');
  return errors;
}

// Pulls numbers out of free text: "24", "S = 10.83 cm²", "25/2", "6√3", "25*sqrt(3)/4".
export function parseAnswer(text) {
  const s = String(text).replace(/,(?=\d)/g, '.').replace(/sqrt/gi, '√');
  const re = /(-?\d+(?:\.\d+)?)?\s*\*?\s*(?:√\s*\(?\s*(\d+(?:\.\d+)?)\s*\)?)?(?:\s*\/\s*(\d+(?:\.\d+)?))?/g;
  const out = [];
  for (const m of s.matchAll(re)) {
    const [, coef, root, den] = m;
    if (coef === undefined && root === undefined) continue;
    let v = coef === undefined ? 1 : Number(coef);
    if (root !== undefined) v *= Math.sqrt(Number(root));
    if (den !== undefined) v /= Number(den);
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}

// 'correct' | 'incorrect' | 'empty'. The first number in the answer counts,
// so units such as "cm^2" after it are ignored.
export function gradeAnswer(studentText, expected) {
  const given = parseAnswer(studentText);
  if (given.length === 0) return { verdict: 'empty', given };
  const ok = Math.abs(given[0] - expected) <= tolerance(expected);
  return { verdict: ok ? 'correct' : 'incorrect', given };
}
