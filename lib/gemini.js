// Minimal Gemini client for the Interactions API. The API key only ever lives
// on the server (Vercel environment variable), never in the browser.

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const RETRIES = 1; // one extra attempt on 503 "high demand" or a timeout
const TIMEOUT_MS = 60_000;

export async function generateJson({ system, user }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new HttpError(500, 'GEMINI_API_KEY is not set on the server');
  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

  const body = JSON.stringify({
    model,
    system_instruction: system,
    input: user,
    response_format: { type: 'text', mime_type: 'application/json' },
    generation_config: { thinking_level: 'low' },
  });

  let res;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      if (err.name !== 'TimeoutError') throw err;
      if (attempt === RETRIES) throw new HttpError(504, 'The AI model is busy right now, please try again');
      continue;
    }
    if (res.status !== 503) break;
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (!res.ok) {
    const detail = await res.text();
    throw new HttpError(502, `Gemini request failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  // The answer is in the "model_output" step; "thought" steps are skipped.
  const data = await res.json();
  const text = (data.steps ?? [])
    .filter((s) => s.type === 'model_output')
    .flatMap((s) => s.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(502, 'Model returned invalid JSON');
  }
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function errorResponse(err) {
  const status = err instanceof HttpError ? err.status : 500;
  console.error(err);
  return Response.json({ error: err.message || 'Server error' }, { status });
}
