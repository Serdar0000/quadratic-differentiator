# Triangle Area Differentiator

An AI-powered web app that takes one core maths task, **finding the area of a triangle**,
and adapts it into three levels of difficulty, with hints, worked solutions and instant
feedback tailored to each level.

**Live demo:** _https://YOUR-PROJECT.vercel.app_ (add after deploying)

| Level | What the learner gets |
|---|---|
| 1 · Foundation | Base and height given as whole numbers, $S = \frac{1}{2}ah$, step-by-step scaffold, direct hints |
| 2 · Standard | Two sides and the included angle ($S = \frac{1}{2}ab\sin C$) or three sides (Heron's formula); the learner picks the formula |
| 3 · Advanced | Real-world multi-step problem (roof gable, land plot, coordinates…) where a missing length must be found first |

## How it works

```
Browser (public/)  ──POST /api/generate {level}──▶  Vercel function ──▶ Gemini API
                   ◀── problem JSON (verified) ───        │
                                                         lib/math.js recomputes the area,
                                                         asks the model to retry if wrong
Browser            ──POST /api/check {answer}───▶  graded by code, explained by Gemini
```

- **AI generation** (`api/generate.js`, prompts in `lib/prompts.js`): a shared base prompt fixes
  the JSON format; each level prompt changes the numbers, the formula involved, scaffolding and hint style.
- **Verification** (`lib/math.js`): the model must describe the triangle in a structured form
  (base/height, two sides and angle, three sides, or coordinates). The code computes the area
  itself and rejects and regenerates the task (up to 3 attempts) if the model's answer does not
  match, the triangle is impossible (e.g. it breaks the triangle inequality), or the task breaks
  its level's rules.
- **Feedback** (`api/check.js`): the student's answer is graded by code (0.5% tolerance, accepts
  `10.83`, `25/2`, `6√3`, `25*sqrt(3)/4`). Gemini only writes the explanation, in a style that
  depends on the level, and is told not to reveal the answer.
- **Never stuck on rate limits** (`lib/gemini.js`, `lib/fallback.js`): free-tier quotas are per model,
  so requests walk down a model list (`gemini-3.5-flash-lite` → `gemini-3.1-flash-lite` →
  `gemini-3.7-flash` → `gemini-3.8-flash`). A model that returns 429/503 or times out is skipped for a while.
  If every model is unavailable, a built-in template generator creates the task and code-written
  feedback is shown, so the site keeps working.
- **Security:** the API key lives only in a server-side environment variable.

## Tech stack

Plain HTML/CSS/JS with canvas animations (no libraries), KaTeX for formulas, Vercel serverless functions (Node.js), Google Gemini API
(Interactions API, several Gemini Flash / Flash-Lite models). No build step and no npm dependencies.

## Run locally

Requires Node.js 20+ and a free Gemini API key from https://aistudio.google.com/apikey.

```bash
cp .env.example .env      # then paste your key into .env
npm run dev               # http://localhost:3000
npm test                  # unit tests for the maths verifier
```

## Deploy to Vercel

1. Push this repository to GitHub.
2. On vercel.com, choose **Add New → Project** and import the repository (Framework Preset: Other).
3. Under **Environment Variables**, add `GEMINI_API_KEY`.
4. Deploy. Every later push to `main` redeploys automatically.

## Project structure

```
api/generate.js   generate a task for a level (with verification and retry)
api/check.js      grade an answer and return AI feedback
lib/prompts.js    system prompts, the core of the differentiation
lib/math.js       triangle area (4 methods), validator, answer parser and grader
lib/gemini.js     Gemini Interactions API client with model fallback chain
lib/fallback.js   offline task generator and feedback (used when AI is unavailable)
public/           front-end: index.html, style.css, app.js (UI and API calls),
                  prism.js (3D prism in the header), sketch.js (animated diagram of each task)
dev-server.js     local server that mimics Vercel
test/             unit tests
```
