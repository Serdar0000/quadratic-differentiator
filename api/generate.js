import { generateJson, errorResponse, HttpError } from '../lib/gemini.js';
import { generationPrompt, LEVELS } from '../lib/prompts.js';
import { triangleArea, validateProblem } from '../lib/math.js';

const MAX_ATTEMPTS = 3;
// Stop retrying after this, so one request (plus a final 2 x 60 s AI call)
// stays under Vercel's 300 s function limit.
const DEADLINE_MS = 150_000;

export async function POST(request) {
  try {
    const { level } = await request.json().catch(() => ({}));
    if (!LEVELS[level]) throw new HttpError(400, 'level must be 1, 2 or 3');

    const started = Date.now();
    let feedback = '';
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && Date.now() - started < DEADLINE_MS; attempt++) {
      const problem = await generateJson({
        system: generationPrompt(level),
        user: `Create one new level ${level} task. Random seed: ${Math.random().toString(36).slice(2, 8)}.${feedback}`,
      });

      const errors = validateProblem(problem, level);
      if (errors.length === 0) {
        problem.answer = triangleArea(problem.triangle); // code's value is authoritative
        return Response.json({ level, problem, attempts: attempt });
      }
      // Tell the model what was wrong and ask again.
      feedback = `\nYour previous attempt was rejected by a verifier: ${errors.join('; ')}. Fix these issues.`;
    }
    throw new HttpError(502, 'Could not generate a mathematically valid task, please try again');
  } catch (err) {
    return errorResponse(err);
  }
}
