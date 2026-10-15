// Minimal Gemini client for the Interactions API. The API key only ever lives
// on the server (Vercel environment variable), never in the browser.
//
// Free-tier limits are per model, so requests walk down a list of models:
// when one is rate-limited, overloaded or slow, the next one is tried.

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const TIMEOUT_MS = 45_000;
const DEFAULT_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-3.8-flash'];

// model -> timestamp until which it is skipped (kept while the server instance is warm)
const cooldownUntil = new Map();

function models() {
  const fromEnv = (process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_MODELS;
}

export async function generateJson({ system, user }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AiUnavailableError('GEMINI_API_KEY is not set on the server');

  const failures = [];
  const now = Date.now();
  const available = models().filter((m) => (cooldownUntil.get(m) ?? 0) <= now);

  for (const model of available) {
    try {
      const result = await callModel(key, model, system, user);
      return result;
    } catch (err) {
      failures.push(`${model}: ${err.message}`);
      if (err.cooldownMs) cooldownUntil.set(model, Date.now() + err.cooldownMs);
    }
  }
  console.warn('All Gemini models failed:', failures);
  throw new AiUnavailableError(failures.length ? 'All AI models are busy or out of quota' : 'All AI models are cooling down');
}

async function callModel(key, model, system, user) {
  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        model,
        system_instruction: system,
        input: user,
        response_format: { type: 'text', mime_type: 'application/json' },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw modelError(err.name === 'TimeoutError' ? 'timeout' : err.message, 60_000);
  }

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    // 429 = quota used up (often for the whole day), 404 = model not offered, 503 = overloaded
    const cooldown = { 429: 30 * 60_000, 404: 24 * 3600_000, 503: 60_000 }[res.status];
    throw modelError(`HTTP ${res.status} ${detail}`, cooldown);
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
    throw modelError('invalid JSON');
  }
}

function modelError(message, cooldownMs) {
  const err = new Error(message);
  err.cooldownMs = cooldownMs;
  return err;
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// No model could answer; callers fall back to the offline generator.
export class AiUnavailableError extends Error {}

export function errorResponse(err) {
  const status = err instanceof HttpError ? err.status : 500;
  console.error(err);
  return Response.json({ error: err.message || 'Server error' }, { status });
}
