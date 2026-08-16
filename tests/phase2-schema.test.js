const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const appsScript = path.join(root, "apps-script");
const gsFiles = ["Schema.gs", "SheetRepository.gs", "Setup.gs", "DemoData.gs"];
const source = gsFiles
  .map((file) => fs.readFileSync(path.join(appsScript, file), "utf8"))
  .join("\n");

assert.doesNotThrow(() => new vm.Script(source, { filename: "apps-script-bundle.gs" }));

const context = { Object };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(appsScript, "Schema.gs"), "utf8"), context);

const expectedSheets = {
  Members: ["MemberID", "FirstName", "LastName", "Status", "Category", "JoinedAt", "Notes", "CardURL"],
  Attendance: ["DateTime", "MemberID", "FirstName", "LastName", "TrainingType", "TrainingName", "TrainingStart"],
  Schedule: ["ScheduleID", "Active", "DayOfWeek", "StartTime", "EndTime", "TrainingType", "DisplayName", "Audience"],
  Training_Types: ["TrainingType", "DisplayName", "Active", "SortOrder"],
  Settings: ["Setting", "Value", "Description"],
  Reports: [],
  _Raw_Attendance: ["AttendanceID", "Timestamp", "MemberID", "FirstName", "LastName", "MemberCategory", "TrainingKey", "TrainingType", "TrainingName", "TrainingStart", "MessageID", "Source", "CreatedAt"],
  _State: ["MemberID", "LastCheckin", "LastAttendanceID", "LastTrainingKey", "UpdatedAt"],
  _Messages: ["MessageID", "Active", "Message", "TrainingType", "Category", "Weight"],
  _Card_State: ["MemberID", "CardFileID", "CardURL", "GeneratedAt", "TemplateVersion", "LastError"],
  _Logs: ["Timestamp", "Level", "Action", "MemberID", "Message", "RequestID"],
  _Internal_Config: ["Key", "Value", "UpdatedAt"],
};

const actualSheets = Object.fromEntries(
  context.TEMPLATE_SHEETS.map((sheet) => [sheet.name, Array.from(sheet.headers)]),
);
assert.deepEqual(actualSheets, expectedSheets);
assert.equal(context.TEMPLATE_SCHEMA_VERSION, 1);
assert.deepEqual(Array.from(context.TEMPLATE_ENUMS.memberStatus), ["Active", "Inactive"]);
assert.equal(context.TEMPLATE_SHEETS.filter((sheet) => sheet.visibility === "internal").length, 6);
assert.match(context.ATTENDANCE_PROJECTION_FORMULA, /_Raw_Attendance'!B2:B/);
assert.match(context.ATTENDANCE_PROJECTION_FORMULA, /_Raw_Attendance'!J2:J/);

const manifest = JSON.parse(fs.readFileSync(path.join(appsScript, "appsscript.json"), "utf8"));
assert.deepEqual(manifest, {
  timeZone: "Etc/UTC",
  dependencies: {},
  exceptionLogging: "STACKDRIVER",
  runtimeVersion: "V8",
});

assert.match(source, /function setupTemplate\(options\)/);
assert.match(source, /function loadDemoData\(\)/);
assert.match(source, /setup will not overwrite existing headers or data/);
assert.match(source, /Existing schema version/);
assert.doesNotMatch(source, /function (doGet|doPost|checkIn|generateMemberCard)\(/);

console.log("Phase 2 schema contract checks passed.");
