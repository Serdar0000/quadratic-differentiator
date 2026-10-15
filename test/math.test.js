import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveQuadratic, validateProblem, expectedAnswers, parseAnswer, gradeAnswer } from '../lib/math.js';

const base = { hints: ['h'], solution: ['s'] };

test('solveQuadratic: two, one and zero real roots', () => {
  assert.deepEqual(solveQuadratic(1, -5, 6).roots, [2, 3]);
  assert.deepEqual(solveQuadratic(1, -4, 4).roots, [2]);
  assert.deepEqual(solveQuadratic(1, 0, 1).roots, []);
  assert.deepEqual(solveQuadratic(2, -3, -2).roots, [-0.5, 2]);
});

test('solveQuadratic rejects a = 0', () => {
  assert.throws(() => solveQuadratic(0, 2, 1));
});

test('validateProblem enforces level rules', () => {
  assert.deepEqual(validateProblem({ ...base, equation: { a: 1, b: -5, c: 6 } }, 1), []);
  assert.ok(validateProblem({ ...base, equation: { a: 2, b: -3, c: -2 } }, 1).length > 0); // a != 1
  assert.ok(validateProblem({ ...base, equation: { a: 1, b: 0, c: -2 } }, 1).length > 0); // irrational roots
  assert.ok(validateProblem({ ...base, equation: { a: 1, b: 0, c: 1 } }, 2).length > 0); // no real roots
  assert.deepEqual(validateProblem({ ...base, equation: { a: 1, b: 0, c: -2 } }, 2), []);
});

test('validateProblem checks level 3 target_answer is a root', () => {
  // -5t^2 + 20t + 25 = 0 -> t = -1, 5
  const p = { ...base, equation: { a: -5, b: 20, c: 25 } };
  assert.deepEqual(validateProblem({ ...p, target_answer: 5 }, 3), []);
  assert.ok(validateProblem({ ...p, target_answer: 4 }, 3).length > 0);
  assert.deepEqual(expectedAnswers({ ...p, target_answer: 5 }, 3), [5]);
});

test('parseAnswer handles common formats', () => {
  assert.deepEqual(parseAnswer('x = 2, x = -3'), [2, -3]);
  assert.deepEqual(parseAnswer('-3/2 and 1.5'), [-1.5, 1.5]);
  assert.deepEqual(parseAnswer('no idea'), []);
});

test('gradeAnswer verdicts', () => {
  assert.equal(gradeAnswer('3, 2', [2, 3]).verdict, 'correct');
  assert.equal(gradeAnswer('2', [2, 3]).verdict, 'partial');
  assert.equal(gradeAnswer('2, 3, 4', [2, 3]).verdict, 'partial');
  assert.equal(gradeAnswer('5', [2, 3]).verdict, 'incorrect');
  assert.equal(gradeAnswer('1.41, -1.41', [-1.414214, 1.414214]).verdict, 'correct');
  assert.equal(gradeAnswer('', [2]).verdict, 'empty');
});
