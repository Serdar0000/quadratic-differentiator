import { generateJson, errorResponse, HttpError, AiUnavailableError } from '../lib/gemini.js';
import { generationPrompt, LEVELS } from '../lib/prompts.js';
import { triangleArea, validateProblem } from '../lib/math.js';
import { offlineProblem } from '../lib/fallback.js';

const MAX_ATTEMPTS = 3;
// No new attempt starts after this. One attempt can walk the whole model list
// (4 x 45 s worst case), so the request stays under Vercel's 300 s limit.
const DEADLINE_MS = 60_000;

export async function POST(request) {
  try {
    const { level } = await request.json().catch(() => ({}));
    if (!LEVELS[level]) throw new HttpError(400, 'level must be 1, 2 or 3');

    const started = Date.now();
    let feedback = '';
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && Date.now() - started < DEADLINE_MS; attempt++) {
      let problem;
      try {
        problem = await generateJson({
          system: generationPrompt(level),
          user: `Create one new level ${level} task. Random seed: ${Math.random().toString(36).slice(2, 8)}.${feedback}`,
        });
      } catch (err) {
        if (err instanceof AiUnavailableError) break; // no model left, use the offline generator
        throw err;
      }

      const errors = validateProblem(problem, level);
      if (errors.length === 0) {
        problem.answer = triangleArea(problem.triangle); // code's value is authoritative
        problem.source = 'ai';
        return Response.json({ level, problem, attempts: attempt });
      }
      // Tell the model what was wrong and ask again.
      feedback = `\nYour previous attempt was rejected by a verifier: ${errors.join('; ')}. Fix these issues.`;
    }

    // Every model is out of quota, or none produced a valid task in time.
    return Response.json({ level, problem: offlineProblem(level), attempts: 0 });
  } catch (err) {
    return errorResponse(err);
  }
}
