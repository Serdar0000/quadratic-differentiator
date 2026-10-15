// Offline task generator and feedback, used only when every AI model is out of
// quota or unavailable, so the site keeps working. Tasks are built from
// templates with random numbers; the area is always computed by lib/math.js.

import { triangleArea } from './math.js';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const fmt = (x) => String(Number(x.toFixed(2)));

function finish(problem) {
  problem.answer = Number(triangleArea(problem.triangle).toFixed(2));
  problem.source = 'offline';
  return problem;
}

function level1() {
  const base = randInt(3, 20);
  const height = randInt(2, 16);
  const unit = pick(['cm', 'm', 'mm']);
  const product = base * height;
  return finish({
    title: 'Area from base and height',
    context: `A triangle has a base of $${base}\\text{ ${unit}}$ and a height of $${height}\\text{ ${unit}}$ drawn to that base.`,
    question: 'Find the area of the triangle.',
    triangle: { method: 'base_height', base, height },
    units: `${unit}²`,
    steps: [
      'Which length is the base, and which is the height?',
      'Write the formula: $S = \\frac{1}{2} \\cdot a \\cdot h$.',
      `Multiply the base by the height: $${base} \\cdot ${height} = \\,?$`,
      'Divide your result by $2$.',
    ],
    hints: [
      'The area of a triangle is half the area of a rectangle with the same base and height.',
      `First multiply $${base}$ by $${height}$.`,
      `$${base} \\cdot ${height} = ${product}$. Now take half of it.`,
    ],
    solution: [
      '$S = \\frac{1}{2} \\cdot a \\cdot h$',
      `$S = \\frac{1}{2} \\cdot ${base} \\cdot ${height} = \\frac{${product}}{2}$`,
      `$S = ${fmt(product / 2)}\\text{ ${unit}}^2$`,
    ],
  });
}

// Heron triangles with whole-number areas: [a, b, c]
const HERON = [[13, 14, 15], [5, 5, 6], [5, 5, 8], [10, 17, 21], [9, 10, 17], [10, 10, 12], [13, 20, 21], [17, 25, 28]];

function level2() {
  if (Math.random() < 0.5) {
    const [a, b, c] = pick(HERON);
    const s = (a + b + c) / 2;
    return finish({
      title: 'Three sides known',
      context: `The sides of a triangle are $${a}\\text{ cm}$, $${b}\\text{ cm}$ and $${c}\\text{ cm}$. No height or angle is given.`,
      question: 'Find the area of the triangle.',
      triangle: { method: 'three_sides', a, b, c },
      units: 'cm²',
      steps: ['Which formula uses only the three sides?', 'Compute the semi-perimeter $p$.', 'Substitute into the formula.'],
      hints: [
        "When only the sides are known, use Heron's formula.",
        '$S = \\sqrt{p(p-a)(p-b)(p-c)}$, where $p = \\frac{a+b+c}{2}$.',
      ],
      solution: [
        `$p = \\frac{${a}+${b}+${c}}{2} = ${s}$`,
        `$S = \\sqrt{${s}(${s}-${a})(${s}-${b})(${s}-${c})} = \\sqrt{${s * (s - a) * (s - b) * (s - c)}}$`,
        `$S = ${fmt(triangleArea({ method: 'three_sides', a, b, c }))}\\text{ cm}^2$`,
      ],
    });
  }

  const [angle, sinTex] = pick([[30, '\\frac{1}{2}'], [150, '\\frac{1}{2}'], [60, '\\frac{\\sqrt{3}}{2}'], [45, '\\frac{\\sqrt{2}}{2}'], [120, '\\frac{\\sqrt{3}}{2}']]);
  const a = randInt(4, 16);
  const b = randInt(4, 16);
  const area = triangleArea({ method: 'two_sides_angle', a, b, angle_deg: angle });
  return finish({
    title: 'Two sides and the angle between them',
    context: `Two sides of a triangle are $${a}\\text{ m}$ and $${b}\\text{ m}$, and the angle between them is $${angle}^\\circ$.`,
    question: 'Find the area of the triangle (round to 2 decimal places if needed).',
    triangle: { method: 'two_sides_angle', a, b, angle_deg: angle },
    units: 'm²',
    steps: ['Which formula uses two sides and the included angle?', `What is $\\sin ${angle}^\\circ$?`, 'Substitute and calculate.'],
    hints: [
      'There is no height here, so use the formula with the sine of the angle.',
      `$S = \\frac{1}{2}ab\\sin C$, and $\\sin ${angle}^\\circ = ${sinTex}$.`,
    ],
    solution: [
      '$S = \\frac{1}{2}ab\\sin C$',
      `$S = \\frac{1}{2} \\cdot ${a} \\cdot ${b} \\cdot \\sin ${angle}^\\circ = \\frac{1}{2} \\cdot ${a * b} \\cdot ${sinTex}$`,
      `$S \\approx ${fmt(area)}\\text{ m}^2$`,
    ],
  });
}

// Pythagorean triples [half-base, height, slant]
const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [6, 8, 10], [9, 12, 15], [7, 24, 25]];

function level3() {
  if (Math.random() < 0.5) {
    const k = pick([0.5, 1]);
    const [p, h, s] = pick(TRIPLES).map((x) => x * k);
    const price = pick([12, 15, 18, 20]);
    return finish({
      title: 'Insulating a roof gable',
      context: `The gable end of a house is an isosceles triangle. Its horizontal base is $${fmt(2 * p)}\\text{ m}$ wide and each sloping edge is $${fmt(s)}\\text{ m}$ long. Insulation costs $${price}$ dollars per square metre, but first the builder needs the area.`,
      question: 'What is the area of the gable wall?',
      triangle: { method: 'base_height', base: 2 * p, height: h },
      units: 'm²',
      steps: [],
      hints: [
        'The height of an isosceles triangle splits the base into two equal parts.',
        'Use the Pythagorean theorem on one half to find the height.',
      ],
      solution: [
        `Half of the base: $${fmt(2 * p)} / 2 = ${fmt(p)}\\text{ m}$`,
        `Height: $h = \\sqrt{${fmt(s)}^2 - ${fmt(p)}^2} = ${fmt(h)}\\text{ m}$`,
        `$S = \\frac{1}{2} \\cdot ${fmt(2 * p)} \\cdot ${fmt(h)} = ${fmt(p * h)}\\text{ m}^2$`,
        `(The insulation would cost $${fmt(p * h * price)}$ dollars.)`,
      ],
    });
  }

  // Land plot on a map grid: 1 grid unit = 10 m
  let pts;
  do {
    pts = [[randInt(0, 3), randInt(0, 3)], [randInt(5, 9), randInt(0, 4)], [randInt(1, 8), randInt(6, 9)]];
  } while (triangleArea({ method: 'coordinates', points: pts }) < 8);
  const real = pts.map(([x, y]) => [x * 10, y * 10]);
  const gridArea = triangleArea({ method: 'coordinates', points: pts });
  const label = pts.map(([x, y], i) => `${'ABC'[i]}(${x}, ${y})`).join(', ');
  return finish({
    title: 'A triangular land plot on a map',
    context: `On a site map, a triangular plot has corners at $${label}$. One grid unit on the map equals $10\\text{ m}$ on the ground.`,
    question: 'What is the real area of the plot in square metres?',
    triangle: { method: 'coordinates', points: real },
    units: 'm²',
    steps: [],
    hints: [
      'You can find the area on the map first, then convert it to the real area.',
      'Area scales with the square of the scale factor: $1$ square unit $= 10 \\cdot 10 = 100\\text{ m}^2$.',
      'For the map area, use the shoelace formula or subtract corner triangles from the bounding rectangle.',
    ],
    solution: [
      `Map area by the shoelace formula: $S_{map} = \\frac{1}{2}\\left|x_1(y_2-y_3) + x_2(y_3-y_1) + x_3(y_1-y_2)\\right| = ${fmt(gridArea)}$ square units`,
      'Each square unit is $10\\text{ m} \\times 10\\text{ m} = 100\\text{ m}^2$.',
      `$S = ${fmt(gridArea)} \\cdot 100 = ${fmt(gridArea * 100)}\\text{ m}^2$`,
    ],
  });
}

export function offlineProblem(level) {
  return { 1: level1, 2: level2, 3: level3 }[level]();
}

export function offlineFeedback(level, verdict, given, area) {
  if (verdict === 'correct') return 'Well done, your area is right!';
  if (verdict === 'empty') return 'Type your answer as a number, for example $24$ or $10.83$.';
  const g = given[0];
  if (Math.abs(g - 2 * area) <= area * 0.01) return 'Your result is exactly double the area. Did you forget the $\\frac{1}{2}$?';
  if (Math.abs(g - area / 2) <= area * 0.01) return 'Your result is exactly half the area. Check whether you halved twice.';
  return {
    1: 'Check each step: multiply the base by the height, then divide by $2$.',
    2: 'Check that you chose the right formula for the given data and recheck the arithmetic.',
    3: 'Which length did you need to find first? Check that step and the units.',
  }[level];
}
