var TEMPLATE_SCHEMA_VERSION = 1;

var TEMPLATE_SHEETS = Object.freeze([
  {
    name: "Members",
    headers: ["MemberID", "FirstName", "LastName", "Status", "Category", "JoinedAt", "Notes", "CardURL"],
    visibility: "owner",
    protection: "system_managed",
  },
  {
    name: "Attendance",
    headers: ["DateTime", "MemberID", "FirstName", "LastName", "TrainingType", "TrainingName", "TrainingStart"],
    visibility: "owner",
    protection: "read_only",
  },
  {
    name: "Schedule",
    headers: ["ScheduleID", "Active", "DayOfWeek", "StartTime", "EndTime", "TrainingType", "DisplayName", "Audience"],
    visibility: "owner",
    protection: "system_managed",
  },
  {
    name: "Training_Types",
    headers: ["TrainingType", "DisplayName", "Active", "SortOrder"],
    visibility: "owner",
    protection: "system_managed",
  },
  {
    name: "Settings",
    headers: ["Setting", "Value", "Description"],
    visibility: "owner",
    protection: "system_managed",
  },
  {
    name: "Reports",
    headers: [],
    visibility: "owner",
    protection: "read_only",
  },
  {
    name: "_Raw_Attendance",
    headers: ["AttendanceID", "Timestamp", "MemberID", "FirstName", "LastName", "MemberCategory", "TrainingKey", "TrainingType", "TrainingName", "TrainingStart", "MessageID", "Source", "CreatedAt"],
    visibility: "internal",
    protection: "internal",
  },
  {
    name: "_State",
    headers: ["MemberID", "LastCheckin", "LastAttendanceID", "LastTrainingKey", "UpdatedAt"],
    visibility: "internal",
    protection: "internal",
  },
  {
    name: "_Messages",
    headers: ["MessageID", "Active", "Message", "TrainingType", "Category", "Weight"],
    visibility: "internal",
    protection: "internal",
  },
  {
    name: "_Card_State",
    headers: ["MemberID", "CardFileID", "CardURL", "GeneratedAt", "TemplateVersion", "LastError"],
    visibility: "internal",
    protection: "internal",
  },
  {
    name: "_Logs",
    headers: ["Timestamp", "Level", "Action", "MemberID", "Message", "RequestID"],
    visibility: "internal",
    protection: "internal",
  },
  {
    name: "_Internal_Config",
    headers: ["Key", "Value", "UpdatedAt"],
    visibility: "internal",
    protection: "internal",
  },
]);

var TEMPLATE_ENUMS = Object.freeze({
  memberStatus: ["Active", "Inactive"],
  dayOfWeek: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
});

var TEMPLATE_DEFAULT_SETTINGS = Object.freeze([
  ["GymName", "Demo Gym", "Public gym display name"],
  ["ShortName", "Demo", "Short scanner and PWA label"],
  ["Locale", "en-GB", "BCP 47 display locale"],
  ["Timezone", "Etc/UTC", "IANA timezone used for all gym dates"],
  ["MemberIdPrefix", "GYM", "Immutable after the first member is created"],
  ["MemberIdNumberWidth", "4", "Zero-padded numeric member ID width"],
  ["CheckinMinutesBeforeStart", "20", "Default check-in window before a session"],
  ["CheckinMinutesAfterStart", "30", "Default check-in window after a session starts"],
  ["DuplicatePolicy", "per_training_session", "Duplicate scope for the check-in backend"],
  ["ScannerSuccessTitle", "Check-in complete", "Success result title"],
  ["ScannerDuplicateTitle", "Already checked in", "Duplicate result title"],
  ["ScannerNotFoundTitle", "Member not found", "Unknown member result title"],
  ["ScannerInactiveTitle", "Membership inactive", "Inactive member result title"],
  ["ScannerOutsideWindowTitle", "Check-in unavailable", "Outside-window result title"],
  ["ScannerErrorTitle", "Please try again", "Safe backend error title"],
  ["ScannerHelpText", "Ask a staff member for help.", "Fallback scanner guidance"],
  ["ScannerSuccessSubtitle", "You're checked in for {trainingName}", "Success result subtitle; supports {trainingName}"],
  ["ScannerDuplicateSubtitle", "Your attendance is already recorded", "Duplicate result subtitle"],
  ["ScannerOutsideWindowSubtitle", "There is no eligible session right now.", "Outside-window result subtitle"],
  ["ScannerSuccessColor", "#15803D", "Success result color"],
  ["ScannerDuplicateColor", "#1D4ED8", "Duplicate result color"],
  ["ScannerErrorColor", "#B91C1C", "Error result color"],
]);

var ATTENDANCE_PROJECTION_FORMULA = "=ARRAYFORMULA(IF('_Raw_Attendance'!B2:B=\"\",\"\",{'_Raw_Attendance'!B2:B,'_Raw_Attendance'!C2:C,'_Raw_Attendance'!D2:D,'_Raw_Attendance'!E2:E,'_Raw_Attendance'!H2:H,'_Raw_Attendance'!I2:I,'_Raw_Attendance'!J2:J}))";

function getTemplateSheetDefinition_(sheetName) {
  for (var index = 0; index < TEMPLATE_SHEETS.length; index += 1) {
    if (TEMPLATE_SHEETS[index].name === sheetName) {
      return TEMPLATE_SHEETS[index];
    }
  }
  throw new Error("Unknown template sheet: " + sheetName);
}
