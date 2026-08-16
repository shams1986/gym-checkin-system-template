# Agent Working Rules

These rules apply to AI agents and Codex when working in this repository.

1. Always inspect the repository before changing files.
2. Always run `git status`, or ask the user to run it when necessary, before starting work.
3. Do not modify production-critical code unless the task explicitly asks for it.
4. Fast Build Mode is allowed in this new, non-production template repository.
5. In Fast Build Mode, Developer Mode must complete a focused change and hand the current diff to Reviewer Mode before committing or pushing.
6. If Reviewer Mode approves the change, Codex may commit and push only the approved files without asking the user again.
7. If Reviewer Mode requests changes, do not commit or push. Developer Mode must address the review comments and hand the updated diff back to Reviewer Mode for another review.
8. Never run `clasp push` or deploy to a live Apps Script or production system without explicit user approval.
9. Read `DEPLOYMENT.md` before any deployment-related task.
10. For frontend changes, avoid changing Apps Script unless required.
11. For Apps Script changes, preserve the existing public API response format unless explicitly asked to change it.
12. Show the diff before committing.
13. Prefer small, focused changes over large refactors.
14. The AXIS repository and production runtime are read-only references and must not be modified from this project.
15. If uncertain, explain the risk instead of making a risky change.
