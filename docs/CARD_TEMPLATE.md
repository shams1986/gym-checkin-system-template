# Google Slides member-card template

Phase 6 generates one PDF file per member from a reusable, editable Google Slides template. The repository does not contain or require a client-specific card design.

## Create the neutral template

1. In the development gym's Google Drive, create a new Google Slides presentation.
2. Set a suitable card page size and create one neutral card slide. Keep the design readable and avoid client names, real member data, or AXIS assets.
3. Add normal text boxes containing the configured text placeholders.
4. Add one dedicated text box containing only the QR placeholder. Size and position this box exactly where the QR image should appear.
5. Share the template and output folder with the Google account that executes the Apps Script web app.
6. Put the template file ID and output folder ID into the protected admin Settings screen.
7. Use `Test card configuration` before generating a card.

Do not use a real member as placeholder content. The default neutral vertical template contains only these visible placeholders:

```text
{{FIRST_NAME}}
{{LAST_NAME}}
{{QR_CODE}}
```

## Placeholder settings

All placeholders are configurable. Only first name, last name, and QR are required and must be unique. Gym name, visible member ID, membership, and category placeholders are optional and may be blank. The member ID remains available to the QR value and output filename even when it is not printed on the card.

| Setting | Neutral default | Replacement |
|---|---|---|
| `CardGymNamePlaceholder` | blank | Configured gym name; optional |
| `CardFirstNamePlaceholder` | `{{FIRST_NAME}}` | Member first name |
| `CardLastNamePlaceholder` | `{{LAST_NAME}}` | Member last name |
| `CardMemberIdPlaceholder` | blank | Immutable generated member ID; optional visible text |
| `CardQrPlaceholder` | `{{QR_CODE}}` | QR image; must be the only text in its text box |
| `CardMembershipPlaceholder` | `{{MEMBERSHIP}}` | Current `Active`/`Inactive` status; optional |
| `CardCategoryPlaceholder` | `{{CATEGORY}}` | Member category; optional |

Text replacement supports names and categories with spaces, punctuation, and non-ASCII characters. The QR placeholder is replaced by an image using the placeholder box's exact position and dimensions.

## QR value and filename formats

`CardQrValueFormat` controls the value encoded in the QR. It must contain `{memberId}`. `CardFileNameFormat` controls the generated PDF filename; `.pdf` is appended when omitted. Both support:

- `{memberId}`
- `{firstName}`
- `{lastName}`
- `{category}`
- `{membership}`
- `{gymName}`
- `{scannerUrl}`

The neutral QR value is `{memberId}`. A URL-based installation can use a value such as `{scannerUrl}?id={memberId}`. QR values are encoded exactly after token replacement; filenames additionally remove filesystem-unsafe characters.

## QR image endpoint

`CardQrImageEndpoint` is a protected HTTPS URL template and must contain `{value}`, which receives the URL-encoded QR value. The neutral default uses QuickChart's QR endpoint:

```text
https://quickchart.io/qr?size=600&text={value}
```

This sends the formatted QR value to that external service. A gym with stricter privacy or availability requirements should configure an approved compatible HTTPS endpoint. Keeping the default QR value to the opaque member ID avoids sending names or membership details.

## Generation behavior

- `Generate` refuses to overwrite an existing card; `Regenerate` explicitly creates a replacement.
- Generation copies the Slides template temporarily, replaces text and QR placeholders, saves it, exports the result as PDF into `CardOutputFolderID`, and trashes the temporary Slides copy.
- Like the AXIS card-output pattern, the finalized slide is rasterized before PDF creation. The one-page PDF uses a fixed 54 × 96 mm portrait media box matching the template's 9:16 aspect ratio, so the editable template keeps its existing dimensions while the delivered file opens at card/phone scale.
- `_Card_State`, `Members.CardURL`, and admin **Open / download** links point to the generated PDF, never the editable temporary Slides copy.
- The new PDF and `_Card_State` metadata are completed before an old regenerated output file is moved to trash.
- A failed regeneration keeps the previous card link and records `generated_with_error` status.
- Batch generation requires confirmation, defaults to active members, processes at most 25 cards per call, and continues after individual failures.
- `_Card_State` stores the output file ID/link, generation timestamp, source template version, and last error. `Members.CardURL` mirrors the current link.
- Card work does not use the scanner's script lock. Drive/Slides failures cannot change attendance or scanner response behavior.

## Manual acceptance checks

- Generate and open a card for an active synthetic member.
- Scan the QR and confirm its value matches `CardQrValueFormat`.
- Test special characters in names and an empty optional category.
- Regenerate and confirm metadata/link update only after success.
- Remove template or folder permission and confirm the previous card remains available with an error status.
- Run a confirmed active/missing batch containing one intentionally failing member and confirm later members still run.
- Confirm inactive members are excluded from the default batch.

These checks require a new disposable Sheet, Apps Script project, Slides template, and Drive folder. They do not authorize `clasp push` or deployment and must never use AXIS production resources.
