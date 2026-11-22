Project: btop-style system monitor, runs only in the terminal (no browser).
Stack: Node.js + TypeScript, Ink (React) for UI, systeminformation for sensors,
ps-list + pidusage for processes, firebase (Auth) for sign-up/login.
Rules:
- Logic must be in classes (OOP). React components may be functional.
- One library must NOT cover UI, process data and sensors together.
- Keep code simple, readable, plainly named. No over-abstraction.
- Every service must handle missing data (temps/GPU) by returning null, not crashing.
- Never commit .env. Keep .env.example updated.
- Make small changes. After each task, tell me which files changed and how to run it.
