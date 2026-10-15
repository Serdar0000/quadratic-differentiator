// Minimal Gemini REST client. The API key only ever lives on the server
// (Vercel environment variable), never in the browser.

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export async function generateJson({ system, user, temperature = 0.8 }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new HttpError(500, 'GEMINI_API_KEY is not set on the server');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const res = await fetch(`${API_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature, responseMimeType: 'application/json' },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new HttpError(502, `Gemini request failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
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
