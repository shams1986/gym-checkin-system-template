# Attendance and reports

Phase 7 exposes canonical attendance events through protected admin views. The Attendance screen and member history show only `DateTime`, `MemberID`, `FirstName`, `LastName`, `TrainingType`, `TrainingName`, and `TrainingStart`; internal event, state, message, and source fields remain hidden.

Date filtering uses the configured gym timezone and includes both selected boundary dates. Names and training labels are historical snapshots from the check-in event, so later profile or schedule renames do not rewrite history. Results are newest first and paginated at 25, 50, or 100 rows.

The Reports screen provides monthly check-in totals, unique attendees, top attendees, and an optional low-attendance list for currently active members. It deliberately excludes forecasting, cohorts, and editable attendance.

`Export page CSV` downloads only the visible filtered page with the same seven columns. Cells beginning with spreadsheet formula characters are escaped. Use pagination to export another page; the canonical `_Raw_Attendance` sheet is never modified.

Live verification requires an explicitly approved disposable development Sheet and Apps Script deployment. No `clasp push` or deployment is implied by these instructions.
