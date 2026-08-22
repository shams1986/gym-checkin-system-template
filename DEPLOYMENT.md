# Deployment Workflow

GitHub is the source of truth for this project. The Google Apps Script deployment is a runtime copy of the backend source stored in `apps-script/`.

Do not edit production code directly in the Google Apps Script editor. Make changes in this repository, commit and push them to GitHub, and then deploy the Apps Script copy with `clasp`.

## Before making changes

Check that the working tree is in the expected state:

```sh
git status
```

Review and preserve any existing uncommitted work before continuing.

## Non-deploying template setup

Phase 1 is repository scaffolding only. A maintainer may clone the repository, review `docs/CONFIG.md`, copy `scanner/config.example.js` for a neutral local configuration, and inspect the documented API examples without creating or binding an Apps Script project.

Do not place real client IDs, credentials, member data, or live URLs in example files. Empty deployment-specific values are expected until an installation task provides a development or client target.

Phase 5 admin testing additionally requires a development Sheet, spreadsheet-bound Apps Script project, a protected owner-email allowlist, and separate scanner/admin web-app deployments. The admin deployment must execute as the accessing user; the anonymous scanner deployment remains separate. The existing Phase 8 development resources are approved development targets. The exact resource and manual-test checklist is in `docs/ADMIN_SETUP.md`; never reuse AXIS or client-production identifiers for template testing.

Phase 6 card testing also requires a neutral development Slides template and Drive output folder shared with the web-app execution account. Configure their IDs only in the protected development settings and follow `docs/CARD_TEMPLATE.md`.

## Autonomous development mode

For tasks in this template repository, proceed without additional confirmation for normal file changes, tests, reviewed commits, GitHub pushes, `clasp push` to the bound Phase 8 development Apps Script project, updates to existing Phase 8 development deployments, and use of existing Phase 8 development Google resources. Verify the target before deployment and keep the scanner/admin deployment roles separate.

Stop when Google or another platform requires the user to complete a permission interaction, when a credential/resource is missing, when a product choice is genuinely ambiguous, or before any real client-instance or AXIS production action. Phase 8 development resources are non-production; real client and AXIS resources are not autonomous targets.

## Frontend changes

The frontend consists of the root-level scanner and PWA files. After reviewing and testing a change:

```sh
git status
git add <changed-files>
git commit -m "Describe the frontend change"
git push
git status
```

Pushing to the repository publishes the source used by the frontend hosting workflow.

## Apps Script changes

Apps Script source is stored in `apps-script/`. Commit and push it to GitHub before copying it to the Apps Script runtime:

```sh
git status
git add apps-script/
git commit -m "Describe the Apps Script change"
git push
cd apps-script
clasp push
cd ..
git status
```

When files under `scanner/` change, regenerate the Apps Script scanner shell with `node scripts/build-apps-script-scanner.mjs` before review. The scanner deployment root (`/exec`) serves that generated shell; `?api=config` and `?api=checkin&id=...` remain explicit public API routes.

Confirm that the binding is the Phase 8 development Apps Script project before running `clasp push`; no additional user confirmation is required for that target.

## Deployment rules

- GitHub is the source of truth; Google Apps Script is the runtime copy.
- Never edit production code directly in the Google Apps Script editor.
- Check `git status` before starting and after completing changes.
- Review the diff before committing.
- Commit and push Apps Script changes before running `clasp push`.
- Do not deploy unrelated or uncommitted changes.

## Phase 8 development milestone

- The development scanner deployment is live and remains separate from the live development admin deployment.
- Admin authentication was changed from browser Google Identity Services to a separate Apps Script deployment that executes as the accessing user and checks the protected owner allowlist server-side.
- The current development admin deployment is restricted to **Only myself** (`salahadin35@gmail.com`). This lets the allowed owner open the dashboard while blocking non-owner and incognito access before dashboard access or Google permission consent.
- Development Sheet setup and schema verification passed.
- Phase 8 remains open for physical phone/tablet camera scanning, a real QR-card scan, and a future multi-admin/client access architecture.
- After those Phase 8 acceptance checks pass, the next stage is Phase 9: create the first client instance from the template without converting this repository into a client-specific or multi-tenant product.

## Rollback

For ordinary template source changes, identify the last approved commit and create a normal Git revert commit; do not rewrite shared history or force-push. Review and push the revert through the same Developer/Reviewer workflow.

For an Apps Script deployment, record the intended project, deployment/version identifier, and matching Git commit before deployment. Roll back a Phase 8 development deployment by selecting the previously recorded known-good version, then verify that GitHub still represents the source of truth. Stop before any rollback, redeploy, or `clasp push` involving a real client or AXIS production system.
