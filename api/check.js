import { generateJson, errorResponse, HttpError, AiUnavailableError } from '../lib/gemini.js';
import { feedbackPrompt, LEVELS } from '../lib/prompts.js';
import { triangleArea, gradeAnswer, validateProblem } from '../lib/math.js';
import { offlineFeedback } from '../lib/fallback.js';

export async function POST(request) {
  try {
    const { level, problem, answer } = await request.json().catch(() => ({}));
    if (!LEVELS[level]) throw new HttpError(400, 'level must be 1, 2 or 3');
    if (validateProblem(problem, level).length) throw new HttpError(400, 'Invalid problem');
    if (typeof answer !== 'string' || !answer.trim()) throw new HttpError(400, 'answer is required');

    // Grading is deterministic; the AI only explains.
    const area = triangleArea(problem.triangle);
    const grade = gradeAnswer(answer.slice(0, 200), area);

    let feedback;
    try {
      ({ feedback } = await generateJson({
        system: feedbackPrompt(level),
        user: JSON.stringify({
          task: problem.context,
          question: problem.question,
          triangle: problem.triangle,
          correct_area: area,
          units: problem.units,
          student_answer: answer.slice(0, 200),
          verdict: grade.verdict,
        }),
      }));
    } catch (err) {
      if (!(err instanceof AiUnavailableError)) throw err;
    }
    if (typeof feedback !== 'string' || !feedback) {
      feedback = offlineFeedback(level, grade.verdict, grade.given, area);
    }

    return Response.json({ verdict: grade.verdict, feedback });
  } catch (err) {
    return errorResponse(err);
  }
}
