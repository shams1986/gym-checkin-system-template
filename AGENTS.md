# Agent Working Rules

These rules apply to AI agents and Codex when working in this repository.

1. Execute the user's current prompt directly and autonomously as far as possible.
2. Inspect the repository and run `git status` before changing files. Preserve unrelated user work.
3. Fast Build Mode is the default in this non-production template repository.
4. Developer Mode must complete a focused change, run proportionate checks, and hand the diff to read-only Reviewer Mode before committing.
5. If Reviewer Mode requests changes, fix them and review again. Do not commit an unapproved diff.
6. After Reviewer Mode approves, commit and push the approved files without asking again. For Apps Script changes, also run `clasp push` and update the appropriate existing Phase 8 development deployment when the task requires it.
7. Normal development actions do not require confirmation: creating/editing files, tests, commits, GitHub pushes, Phase 8 development `clasp push`, existing Phase 8 development deployment updates, and use of existing Phase 8 development Google resources.
8. Fix ordinary mistakes forward with a new reviewed commit, or use a reviewed `git revert` when appropriate. Do not rewrite shared history or force-push.
9. Stop only when the platform requires a permission click, a required credential/resource is missing, the product decision is genuinely ambiguous, or the task would create/modify a real client instance or affect AXIS production.
10. Read `DEPLOYMENT.md` before deployment work and confirm the target is a Phase 8 development resource before acting autonomously.
11. For frontend changes, avoid changing Apps Script unless required.
12. For Apps Script changes, preserve the existing public API response format unless explicitly asked to change it.
13. Prefer small, focused changes over large refactors.
14. Phase 8 development resources are authorized non-production targets. AXIS and all real client production resources remain outside autonomous mode; AXIS is read-only and must never be modified from this project.
