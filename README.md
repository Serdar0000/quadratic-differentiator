# Quadratic Differentiator

An AI-powered web app that takes one core maths task, **solving a quadratic equation
$ax^2 + bx + c = 0$**, and adapts it into three levels of difficulty, with hints,
worked solutions and instant feedback tailored to each level.

**Live demo:** _https://YOUR-PROJECT.vercel.app_ (add after deploying)

| Level | What the learner gets |
|---|---|
| 1 · Foundation | Factorable equation ($a = 1$, integer roots), step-by-step scaffold, direct hints |
| 2 · Standard | Grade-level equation ($a \ne 1$, fractional or irrational roots), short checkpoints, method hints |
| 3 · Advanced | Real-world word problem the learner must model; only one root is valid in context |

## How it works

```
Browser (public/)  ──POST /api/generate {level}──▶  Vercel function ──▶ Gemini API
                   ◀── problem JSON (verified) ───        │
                                                         lib/math.js checks the maths,
                                                         asks the model to retry if wrong
Browser            ──POST /api/check {answer}───▶  graded by code, explained by Gemini
```

- **AI generation** (`api/generate.js`, prompts in `lib/prompts.js`): a shared base prompt fixes
  the JSON format; each level prompt changes the numbers, scaffolding and hint style.
- **Verification** (`lib/math.js`): roots are computed deterministically. A generated task is
  rejected and regenerated (up to 3 attempts) if it breaks its level's rules, e.g. no real roots,
  non-integer roots at level 1, or a level 3 answer that is not actually a root.
- **Feedback** (`api/check.js`): the student's answer is graded by code. Gemini only writes
  the explanation, in a style that depends on the level, and is told not to reveal the answer.
- **Security:** the API key lives only in a server-side environment variable.

## Tech stack

Plain HTML/CSS/JS, KaTeX for formulas, Vercel serverless functions (Node.js), Google Gemini API.
No build step and no npm dependencies.

## Run locally

Requires Node.js 20+ and a free Gemini API key from https://aistudio.google.com/apikey.

```bash
cp .env.example .env      # then paste your key into .env
npm run dev               # http://localhost:3000
npm test                  # unit tests for the maths verifier
```

## Deploy to Vercel

1. Push this repository to GitHub.
2. On vercel.com, choose **Add New → Project** and import the repository (no framework preset needed).
3. Under **Environment Variables**, add `GEMINI_API_KEY`.
4. Deploy. Every later push to `main` redeploys automatically.

## Project structure

```
api/generate.js   generate a task for a level (with verification and retry)
api/check.js      grade an answer and return AI feedback
lib/prompts.js    system prompts, the core of the differentiation
lib/math.js       quadratic solver, validator, answer parser and grader
lib/gemini.js     minimal Gemini REST client
public/           front-end (index.html, app.js, style.css)
dev-server.js     local server that mimics Vercel
test/             unit tests
```
