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

Do not place real client IDs, credentials, member data, or live URLs in example files. Empty deployment-specific values are expected until a later, explicitly authorized installation task. Walking through these steps does not authorize `clasp push`, Apps Script deployment, or publication to production hosting.

Phase 5 admin testing additionally requires a new development Sheet, spreadsheet-bound Apps Script project, OAuth web client, and protected script properties. The exact resource and manual-test checklist is in `docs/ADMIN_SETUP.md`. Create and confirm those resources before any `clasp push`; never reuse AXIS or client-production identifiers for template testing.

Phase 6 card testing also requires a neutral development Slides template and Drive output folder shared with the web-app execution account. Configure their IDs only in the protected development settings and follow `docs/CARD_TEMPLATE.md`. Creating those resources still does not authorize `clasp push` or deployment.

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

Confirm the intended Apps Script project and deployment configuration before running `clasp push`.

## Deployment rules

- GitHub is the source of truth; Google Apps Script is the runtime copy.
- Never edit production code directly in the Google Apps Script editor.
- Check `git status` before starting and after completing changes.
- Review the diff before committing.
- Commit and push Apps Script changes before running `clasp push`.
- Do not deploy unrelated or uncommitted changes.

## Rollback

For ordinary template source changes, identify the last approved commit and create a normal Git revert commit; do not rewrite shared history or force-push. Review and push the revert through the same Developer/Reviewer workflow.

For a future Apps Script deployment, record the intended project, deployment/version identifier, and matching Git commit before deployment. Roll back by selecting the previously recorded known-good Apps Script version, then verify that GitHub still represents the source of truth. Never perform a live rollback, redeploy, or `clasp push` without explicit user approval for that specific system.
