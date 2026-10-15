import { generateJson, errorResponse, HttpError } from '../lib/gemini.js';
import { generationPrompt, LEVELS } from '../lib/prompts.js';
import { validateProblem } from '../lib/math.js';

const MAX_ATTEMPTS = 3;

export async function POST(request) {
  try {
    const { level } = await request.json().catch(() => ({}));
    if (!LEVELS[level]) throw new HttpError(400, 'level must be 1, 2 or 3');

    let feedback = '';
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const problem = await generateJson({
        system: generationPrompt(level),
        user: `Create one new level ${level} task. Random seed: ${Math.random().toString(36).slice(2, 8)}.${feedback}`,
      });

      const errors = validateProblem(problem, level);
      if (errors.length === 0) {
        if (level !== 3) problem.target_answer = null;
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
