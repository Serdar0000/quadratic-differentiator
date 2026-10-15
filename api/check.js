import { generateJson, errorResponse, HttpError } from '../lib/gemini.js';
import { feedbackPrompt, LEVELS } from '../lib/prompts.js';
import { expectedAnswers, gradeAnswer, validateProblem } from '../lib/math.js';

export async function POST(request) {
  try {
    const { level, problem, answer } = await request.json().catch(() => ({}));
    if (!LEVELS[level]) throw new HttpError(400, 'level must be 1, 2 or 3');
    if (validateProblem(problem, level).length) throw new HttpError(400, 'Invalid problem');
    if (typeof answer !== 'string' || !answer.trim()) throw new HttpError(400, 'answer is required');

    // Grading is deterministic; the AI only explains.
    const expected = expectedAnswers(problem, level);
    const grade = gradeAnswer(answer.slice(0, 200), expected);

    const { feedback } = await generateJson({
      system: feedbackPrompt(level),
      temperature: 0.4,
      user: JSON.stringify({
        task: problem.context,
        question: problem.question,
        equation: problem.equation,
        correct_answers: expected,
        student_answer: answer.slice(0, 200),
        verdict: grade.verdict,
      }),
    });

    return Response.json({ verdict: grade.verdict, feedback });
  } catch (err) {
    return errorResponse(err);
  }
}
