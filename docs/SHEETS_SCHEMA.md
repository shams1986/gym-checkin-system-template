# Google Sheets Schema

## Phase 2 scope

`setupTemplate_(options?)` creates or verifies the template workbook without deleting rows or overwriting existing headers. The trailing underscore keeps this maintainer routine private from HtmlService browser clients. It is safe to rerun against a workbook already created by the same schema version. A mismatched header, schema version, attendance formula, or manually populated attendance projection stops setup with a migration error.

`loadDemoData_()` is separate and never runs during production setup. Both setup functions are run only by a maintainer from the Apps Script editor.

On a new bound spreadsheet, setup removes only the untouched blank default sheet (`gid=0`). It never deletes a populated or additional owner sheet. The demo loader writes its known synthetic rows into the first safe row: all fields must be blank, except that a fixture's boolean fields may contain validation-generated `FALSE`. Blank-key rows containing other owner data are preserved.

## Setup entry points

- `setupTemplate_()` creates/verifies the schema and preserves the spreadsheet's existing timezone.
- `setupTemplate_({ timezone: "Europe/Vienna" })` validates and applies an explicit IANA timezone and updates the visible `Timezone` setting.
- `loadDemoData_()` calls setup, then idempotently adds one synthetic member, training type, schedule row, and message. It does not add attendance.

`setupTemplate_()` returns the schema version, sheets created on that run, all verified sheet names, and `attendanceProjection: "protected_array_formula"`.

## Owner-readable sheets

| Sheet | Exact columns | Setup behavior |
|---|---|---|
| `Members` | `MemberID`, `FirstName`, `LastName`, `Status`, `Category`, `JoinedAt`, `Notes`, `CardURL` | Status rejects values outside `Active`/`Inactive`; date formatting applied |
| `Attendance` | `DateTime`, `MemberID`, `FirstName`, `LastName`, `TrainingType`, `TrainingName`, `TrainingStart` | Protected formula projection; no manual writes |
| `Schedule` | `ScheduleID`, `Active`, `DayOfWeek`, `StartTime`, `EndTime`, `TrainingType`, `DisplayName`, `Audience` | Checkbox, weekday, and training-type validation; time formatting applied |
| `Training_Types` | `TrainingType`, `DisplayName`, `Active`, `SortOrder` | Checkbox and non-negative sort-order validation |
| `Settings` | `Setting`, `Value`, `Description` | Neutral defaults inserted only when their key is absent |
| `Reports` | No canonical columns | Protected empty generated area for later phases |

Owner-readable storage remains protected and system-managed through the future admin UI. The effective setup owner remains a protection editor for maintenance; other workbook editors cannot directly change these sheets. Direct edits are unsupported except during a documented maintainer recovery or migration.

## Hidden/internal sheets

| Sheet | Exact columns |
|---|---|
| `_Raw_Attendance` | `AttendanceID`, `Timestamp`, `MemberID`, `FirstName`, `LastName`, `MemberCategory`, `TrainingKey`, `TrainingType`, `TrainingName`, `TrainingStart`, `MessageID`, `Source`, `CreatedAt` |
| `_State` | `MemberID`, `LastCheckin`, `LastAttendanceID`, `LastTrainingKey`, `UpdatedAt` |
| `_Messages` | `MessageID`, `Active`, `Message`, `TrainingType`, `Category`, `Weight` |
| `_Card_State` | `MemberID`, `CardFileID`, `CardURL`, `GeneratedAt`, `TemplateVersion`, `LastError` |
| `_Logs` | `Timestamp`, `Level`, `Action`, `MemberID`, `Message`, `RequestID` |
| `_Internal_Config` | `Key`, `Value`, `UpdatedAt` |

Every internal sheet is hidden and protected. The setup runner remains an editor so later backend functions can operate. Domain-wide protection editing is disabled. `_Message_State` is intentionally omitted from the MVP schema because the basic random-message model does not require non-repetition state; adding it later requires a schema migration.

## Internal metadata

`_Internal_Config` records exactly the required initial keys:

- `SchemaVersion`: currently `1`; a different value requires migration.
- `InstallationID`: generated once with `Utilities.getUuid()`.
- `SetupCompletedAt`: recorded once and preserved on reruns.
- `NextMemberNumber`: initialized to `1` and reserved for the locked member-ID workflow in Phase 6.

Deployment IDs and credentials are not stored in owner-readable sheets.

## Attendance projection decision

`Attendance!A2` contains one protected `ARRAYFORMULA` using `FILTER` to select timestamp, member snapshot, training type/name, and training start from canonical `_Raw_Attendance` columns. The projection is read-only and updates automatically as Phase 4 appends canonical events. Setup migrates the one known pre-Phase-8 projection formula to this corrected formula and rejects any other unexpected formula.

Owners can filter through a filter view without changing canonical order. Direct range sorting/editing is blocked by protection. Reporting and admin queries in later phases must read `_Raw_Attendance`, not depend on the visual order of `Attendance`.

## Validation and formatting

- Invalid member status, weekday, schedule training type, checkbox, weight, and sort-order values are rejected.
- Schedule training types must exist in `Training_Types`.
- Stored timestamps use Date values; display formatting is `yyyy-mm-dd hh:mm:ss` in the spreadsheet timezone.
- Schedule times use Date values with `hh:mm` display formatting.
- Setup validates an explicitly requested timezone before changing the workbook.

## Manual verification on a development workbook

These tests require a new, disposable Google Sheet and a spreadsheet-bound development Apps Script project. They have not been run merely by committing this source.

1. Create a blank development spreadsheet containing no real member data.
2. Bind a development Apps Script project to it and copy the reviewed `apps-script/` source only after explicit approval for that non-production target.
3. Reload the Apps Script editor after `clasp push`, select the public zero-argument `runTemplateSetup` function, and run it twice. It delegates to the private idempotent schema setup and neutral demo loader. Trailing-underscore functions are intentionally private and do not appear in the editor function picker.
4. Confirm the first run creates every listed sheet and demo rows; the second creates no duplicate sheets or demo rows and preserves values.
5. Confirm internal sheets are hidden/protected and every owner-readable sheet has the expected managed protection.
6. Confirm invalid member status, weekday, and unknown training type are rejected.
7. Confirm only one demo member/session/type/message exists after the two `runTemplateSetup` executions.
8. Append one synthetic `_Raw_Attendance` row as the setup owner and confirm the seven projected fields appear in `Attendance` with Vienna formatting.
9. Confirm an ordinary sheet editor cannot manually modify `_Raw_Attendance` or `Attendance`.

Do not use AXIS, a client workbook, real data, or a live Apps Script deployment for these tests. Creating a development Sheet/project does not authorize `clasp push`; explain and confirm the target first.
