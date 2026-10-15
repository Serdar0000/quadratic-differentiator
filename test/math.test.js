import { test } from 'node:test';
import assert from 'node:assert/strict';
import { triangleArea, validateProblem, parseAnswer, gradeAnswer } from '../lib/math.js';

const base = { hints: ['h'], solution: ['s'] };

test('triangleArea: all four methods', () => {
  assert.equal(triangleArea({ method: 'base_height', base: 8, height: 5 }), 20);
  assert.equal(triangleArea({ method: 'two_sides_angle', a: 6, b: 10, angle_deg: 30 }), 15);
  assert.equal(triangleArea({ method: 'two_sides_angle', a: 4, b: 5, angle_deg: 90 }), 10);
  assert.equal(triangleArea({ method: 'three_sides', a: 13, b: 14, c: 15 }), 84);
  assert.equal(triangleArea({ method: 'coordinates', points: [[0, 0], [4, 0], [0, 3]] }), 6);
});

test('triangleArea rejects invalid triangles', () => {
  assert.throws(() => triangleArea({ method: 'three_sides', a: 1, b: 2, c: 3 })); // degenerate
  assert.throws(() => triangleArea({ method: 'three_sides', a: 1, b: 2, c: 10 })); // inequality
  assert.throws(() => triangleArea({ method: 'coordinates', points: [[0, 0], [1, 1], [2, 2]] })); // collinear
  assert.throws(() => triangleArea({ method: 'base_height', base: -2, height: 3 }));
  assert.throws(() => triangleArea({ method: 'two_sides_angle', a: 2, b: 3, angle_deg: 180 }));
  assert.throws(() => triangleArea({ method: 'magic' }));
});

test('validateProblem catches a wrong AI answer', () => {
  const tri = { method: 'base_height', base: 8, height: 5 };
  assert.deepEqual(validateProblem({ ...base, triangle: tri, answer: 20 }, 1), []);
  assert.ok(validateProblem({ ...base, triangle: tri, answer: 40 }, 1).length > 0); // forgot the 1/2
});

test('validateProblem enforces level rules', () => {
  const heron = { method: 'three_sides', a: 13, b: 14, c: 15 };
  assert.ok(validateProblem({ ...base, triangle: heron, answer: 84 }, 1).length > 0); // level 1 = base_height only
  assert.deepEqual(validateProblem({ ...base, triangle: heron, answer: 84 }, 2), []);
  const odd = { method: 'two_sides_angle', a: 5, b: 7, angle_deg: 37 };
  assert.ok(validateProblem({ ...base, triangle: odd, answer: triangleArea(odd) }, 2).length > 0);
  assert.deepEqual(validateProblem({ ...base, triangle: odd, answer: triangleArea(odd) }, 3), []);
});

test('parseAnswer handles common formats', () => {
  assert.deepEqual(parseAnswer('24'), [24]);
  assert.deepEqual(parseAnswer('S = 10.83 cm²'), [10.83]);
  assert.deepEqual(parseAnswer('10,5'), [10.5]);
  assert.deepEqual(parseAnswer('25/2'), [12.5]);
  assert.ok(Math.abs(parseAnswer('6√3')[0] - 6 * Math.sqrt(3)) < 1e-9);
  assert.ok(Math.abs(parseAnswer('25*sqrt(3)/4')[0] - (25 * Math.sqrt(3)) / 4) < 1e-9);
  assert.deepEqual(parseAnswer('no idea'), []);
});

test('gradeAnswer verdicts', () => {
  const exact = (25 * Math.sqrt(3)) / 4; // 10.825...
  assert.equal(gradeAnswer('10.83', exact).verdict, 'correct');
  assert.equal(gradeAnswer('25√3/4 cm^2', exact).verdict, 'correct');
  assert.equal(gradeAnswer('21.65', exact).verdict, 'incorrect');
  assert.equal(gradeAnswer('1500 m²', 1497.6).verdict, 'correct'); // rounding a large area
  assert.equal(gradeAnswer('', 5).verdict, 'empty');
});

test('offline generator always produces valid tasks', async () => {
  const { offlineProblem, offlineFeedback } = await import('../lib/fallback.js');
  for (const level of [1, 2, 3]) {
    for (let i = 0; i < 200; i++) {
      const p = offlineProblem(level);
      assert.deepEqual(validateProblem(p, level), [], `level ${level}: ${JSON.stringify(p.triangle)}`);
    }
  }
  assert.match(offlineFeedback(1, 'incorrect', [40], 20), /double/);
});
