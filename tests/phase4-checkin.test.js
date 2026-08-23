const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const appsScript = path.join(root, "apps-script");
const runtimeFiles = [
  "Schema.gs",
  "SheetRepository.gs",
  "RuntimeRepository.gs",
  "MemberRepository.gs",
  "ScheduleService.gs",
  "AttendanceRepository.gs",
  "ResponseFactory.gs",
  "PersonalMessageService.gs",
  "CheckInService.gs",
  "WebApp.gs",
];

class RangeMock {
  constructor(sheet, row, column, rowCount, columnCount) {
    Object.assign(this, { sheet, row, column, rowCount, columnCount });
  }
  getValues() {
    return Array.from({ length: this.rowCount }, (_, rowOffset) =>
      Array.from({ length: this.columnCount }, (_, columnOffset) =>
        this.sheet.rows[this.row - 1 + rowOffset]?.[this.column - 1 + columnOffset] ?? "",
      ),
    );
  }
  getDisplayValues() {
    return this.getValues().map((row) => row.map((value) => value instanceof Date ? value.toISOString() : String(value)));
  }
  setValues(values) {
    values.forEach((valuesRow, rowOffset) => {
      const targetRow = this.row - 1 + rowOffset;
      this.sheet.rows[targetRow] ||= [];
      valuesRow.forEach((value, columnOffset) => {
        this.sheet.rows[targetRow][this.column - 1 + columnOffset] = value;
      });
    });
    return this;
  }
  setValue(value) { return this.setValues([[value]]); }
  createTextFinder(searchValue) {
    const range = this;
    let entireCell = false;
    return {
      matchEntireCell(value) { entireCell = value; return this; },
      findNext() {
        const values = range.getDisplayValues();
        for (let rowOffset = 0; rowOffset < values.length; rowOffset += 1) {
          for (let columnOffset = 0; columnOffset < values[rowOffset].length; columnOffset += 1) {
            const value = values[rowOffset][columnOffset];
            if ((entireCell && value === String(searchValue)) || (!entireCell && value.includes(String(searchValue)))) {
              return { getRow: () => range.row + rowOffset, getColumn: () => range.column + columnOffset };
            }
          }
        }
        return null;
      },
    };
  }
}

class SheetMock {
  constructor(name, rows) {
    this.name = name;
    this.rows = rows.map((row) => [...row]);
  }
  getName() { return this.name; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return Math.max(0, ...this.rows.map((row) => row.length)); }
  getRange(row, column, rowCount = 1, columnCount = 1) { return new RangeMock(this, row, column, rowCount, columnCount); }
  appendRow(row) { this.rows.push([...row]); }
  deleteRow(row) { this.rows.splice(row - 1, 1); }
  deleteRows(start, count) { this.rows.splice(start - 1, count); }
}

function formatUtc(date, pattern) {
  const pad = (value) => String(value).padStart(2, "0");
  const parts = {
    yyyy: date.getUTCFullYear(),
    MM: pad(date.getUTCMonth() + 1),
    dd: pad(date.getUTCDate()),
    HH: pad(date.getUTCHours()),
    mm: pad(date.getUTCMinutes()),
    ss: pad(date.getUTCSeconds()),
  };
  if (pattern === "yyyy-MM-dd") return `${parts.yyyy}-${parts.MM}-${parts.dd}`;
  if (pattern === "HH:mm") return `${parts.HH}:${parts.mm}`;
  if (pattern === "yyyy-MM-dd-HH-mm") return `${parts.yyyy}-${parts.MM}-${parts.dd}-${parts.HH}-${parts.mm}`;
  if (pattern === "yyyy-MM-dd'T'HH:mm:ssZ") return `${parts.yyyy}-${parts.MM}-${parts.dd}T${parts.HH}:${parts.mm}:${parts.ss}+0000`;
  throw new Error(`Unsupported test format: ${pattern}`);
}

function createHarness() {
  const tables = {
    Members: [
      ["MemberID", "FirstName", "LastName", "Status", "Category", "JoinedAt", "Notes", "CardURL"],
      ["GYM-0001", "Ada", "Lovelace", "Active", "Adult", "", "", ""],
      ["GYM-0002", "Linus", "Torvalds", "Active", "Adult", "", "", ""],
      ["GYM-0003", "Grace", "Hopper", "Inactive", "Adult", "", "", ""],
      ["GYM-0004", "Sam", "Young", "Active", "Junior", "", "", ""],
    ],
    Schedule: [
      ["ScheduleID", "Active", "DayOfWeek", "StartTime", "EndTime", "TrainingType", "DisplayName", "Audience"],
      ["MON-10", true, "MONDAY", "10:00", "11:00", "GROUP", "Morning training", "ALL"],
      ["TUE-10", true, "TUESDAY", "10:00", "11:00", "GROUP", "Adult training", "Adult"],
    ],
    Settings: [
      ["Setting", "Value", "Description"],
      ["Timezone", "Etc/UTC", ""],
      ["CheckinMinutesBeforeStart", "20", ""],
      ["CheckinMinutesAfterStart", "30", ""],
    ],
    _Raw_Attendance: [["AttendanceID", "Timestamp", "MemberID", "FirstName", "LastName", "MemberCategory", "TrainingKey", "TrainingType", "TrainingName", "TrainingStart", "MessageID", "Source", "CreatedAt"]],
    _State: [["MemberID", "LastCheckin", "LastAttendanceID", "LastTrainingKey", "UpdatedAt"]],
    _Messages: [
      ["MessageID", "Active", "Message", "TrainingType", "Category", "Weight"],
      ["WELCOME", true, "Great work!", "GROUP", "Adult", 1],
    ],
    _Personal_Messages: [["MessageID", "MemberID", "Active", "Message", "CreatedAt", "UsedAt", "UpdatedAt"]],
    _Logs: [["Timestamp", "Level", "Action", "MemberID", "Message", "RequestID"]],
  };
  const sheets = Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, new SheetMock(name, rows)]));
  const spreadsheet = {
    getSheetByName: (name) => sheets[name] || null,
    getSpreadsheetTimeZone: () => "Etc/UTC",
  };
  let uuid = 0;
  const context = {
    Object,
    Math,
    Date,
    JSON,
    isFinite,
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
    Utilities: {
      formatDate: (date, timezone, pattern) => {
        assert.equal(timezone, "Etc/UTC");
        return formatUtc(date, pattern);
      },
      getUuid: () => `attendance-${++uuid}`,
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    getPublicScannerConfig_: () => ({
      schemaVersion: 1,
      identity: { name: "Demo Gym" },
      branding: { logoUrl: "./assets/logo.svg", iconUrl: "./assets/icon.svg" },
      integration: { checkInEndpoint: "https://example.invalid/exec" },
    }),
    ContentService: {
      MimeType: { JSON: "json", JAVASCRIPT: "javascript" },
      createTextOutput: (text) => ({ text, setMimeType(mimeType) { this.mimeType = mimeType; return this; } }),
    },
    HtmlService: {
      XFrameOptionsMode: { DEFAULT: "default" },
      createTemplateFromFile: (name) => ({
        getRawContent: () => `<${name}>`,
        evaluate() {
          return {
            kind: "html",
            template: name,
            config: this.scannerConfigJson,
            setTitle() { return this; },
            setXFrameOptionsMode() { return this; },
            addMetaTag() { return this; },
          };
        },
      }),
    },
  };
  vm.createContext(context);
  runtimeFiles.forEach((file) => vm.runInContext(fs.readFileSync(path.join(appsScript, file), "utf8"), context, { filename: file }));
  return { context, sheets };
}

const { context, sheets } = createHarness();
const expectedFields = ["result", "reason", "memberId", "firstName", "trainingType", "trainingName", "trainingStart", "title", "subtitle", "message", "color", "sound"];

const success = context.checkIn_(" gym-0001 ", { now: new Date("2026-08-17T09:40:00Z"), source: "test" });
assert.deepEqual(Object.keys(success), expectedFields);
assert.equal(success.result, "success");
assert.equal(success.reason, "attendance_recorded");
assert.equal(success.trainingStart, "2026-08-17T10:00:00+00:00");
assert.equal(success.message, "Great work!");
assert.equal(sheets._Raw_Attendance.rows.length, 2);
assert.equal(sheets._State.rows.length, 2);

const duplicate = context.checkIn_("GYM-0001", { now: new Date("2026-08-17T10:30:00Z") });
assert.equal(duplicate.result, "duplicate");
assert.equal(duplicate.reason, "already_checked_in");
assert.equal(sheets._Raw_Attendance.rows.length, 2, "duplicate must not append attendance");

const closingBoundary = context.checkIn_("GYM-0002", { now: new Date("2026-08-17T10:30:00Z") });
assert.equal(closingBoundary.result, "success", "closing boundary is inclusive");
assert.equal(sheets._Raw_Attendance.rows.length, 3);

const outside = context.checkIn_("GYM-0002", { now: new Date("2026-08-17T09:39:59Z") });
assert.equal(outside.result, "outside_window");
assert.equal(outside.reason, "no_open_training");

const unknown = context.checkIn_("GYM-9999", { now: new Date("2026-08-17T10:00:00Z") });
assert.equal(unknown.result, "not_found");
assert.equal(unknown.reason, "member_not_found");

const inactive = context.checkIn_("GYM-0003", { now: new Date("2026-08-17T10:00:00Z") });
assert.equal(inactive.result, "inactive");
assert.equal(inactive.reason, "member_inactive");

const categoryMismatch = context.checkIn_("GYM-0004", { now: new Date("2026-08-18T10:00:00Z") });
assert.equal(categoryMismatch.result, "outside_window");
assert.equal(categoryMismatch.reason, "category_not_eligible");

const invalid = context.checkIn_("<script>", { now: new Date("2026-08-17T10:00:00Z") });
assert.equal(invalid.result, "error");
assert.equal(invalid.reason, "invalid_payload");
assert.equal(sheets._Raw_Attendance.rows.length, 3, "rejected results must not write attendance");

assert.equal(context.isSafeJsonpCallback_("scannerCallback_1"), true);
assert.equal(context.isSafeJsonpCallback_("alert(1)"), false);
const backendDescriptor = context.doGet({ parameter: {} });
assert.equal(backendDescriptor.mimeType, "json");
assert.equal(JSON.parse(backendDescriptor.text).service, "gym-checkin-backend");
assert.match(JSON.parse(backendDescriptor.text).scannerUrl, /^https:\/\//);
const publicConfig = context.doGet({ parameter: { api: "config" } });
assert.equal(publicConfig.mimeType, "json");
assert.equal(JSON.parse(publicConfig.text).schemaVersion, 1);
const demoApi = context.doGet({ parameter: { api: "checkin", id: "DEMO0001" } });
assert.equal(demoApi.mimeType, "json");
assert.equal(JSON.parse(demoApi.text).result, "not_found");
const jsonp = context.doGet({ parameter: { api: "checkin", id: "GYM-9999", callback: "scannerCallback" } });
assert.equal(jsonp.mimeType, "javascript");
assert.match(jsonp.text, /^scannerCallback\(\{/);
const unsafeJsonp = context.doGet({ parameter: { api: "checkin", id: "GYM-9999", callback: "x;alert(1)" } });
assert.equal(unsafeJsonp.mimeType, "json");
assert.doesNotMatch(unsafeJsonp.text, /alert/);

delete sheets.Members;
const backendError = context.checkIn_("GYM-0001", { now: new Date("2026-08-17T10:00:00Z"), requestId: "request-1" });
assert.equal(backendError.result, "error");
assert.equal(backendError.reason, "backend_error");
assert.equal(sheets._Logs.rows.length, 2);
assert.equal(sheets._Logs.rows[1][5], "request-1");

const interleaved = createHarness();
let nestedResult = null;
let enteringNestedCall = false;
interleaved.context.LockService.getScriptLock = () => ({
  tryLock() {
    if (!enteringNestedCall) {
      enteringNestedCall = true;
      nestedResult = interleaved.context.checkIn_("GYM-0001", { now: new Date("2026-08-17T10:00:00Z") });
      enteringNestedCall = false;
    }
    return true;
  },
  releaseLock() {},
});
const outerResult = interleaved.context.checkIn_("GYM-0001", { now: new Date("2026-08-17T10:00:00Z") });
assert.deepEqual([outerResult.result, nestedResult.result].sort(), ["duplicate", "success"]);
assert.equal(interleaved.sheets._Raw_Attendance.rows.length, 2, "interleaved requests create one event");

const stateFailure = createHarness();
const originalStateAppend = stateFailure.sheets._State.appendRow.bind(stateFailure.sheets._State);
stateFailure.sheets._State.appendRow = () => { throw new Error("injected state failure"); };
const failedWrite = stateFailure.context.checkIn_("GYM-0001", { now: new Date("2026-08-17T10:00:00Z") });
assert.equal(failedWrite.result, "error");
assert.equal(stateFailure.sheets._Raw_Attendance.rows.length, 1, "state failure rolls back raw attendance");
stateFailure.sheets._State.appendRow = originalStateAppend;
const retryAfterRollback = stateFailure.context.checkIn_("GYM-0001", { now: new Date("2026-08-17T10:00:00Z") });
assert.equal(retryAfterRollback.result, "success");
assert.equal(stateFailure.sheets._Raw_Attendance.rows.length, 2, "retry records exactly one attendance event");

const personal = createHarness();
personal.sheets._Personal_Messages.appendRow(["PM-ONE", "GYM-0001", true, "Welcome back, Ada!", new Date("2026-08-16T10:00:00Z"), "", new Date("2026-08-16T10:00:00Z")]);
const personalSuccess = personal.context.checkIn_("GYM-0001", { now: new Date("2026-08-17T10:00:00Z") });
assert.equal(personalSuccess.message, "Welcome back, Ada!", "active personal message overrides the general pool once");
assert.equal(personal.sheets._Personal_Messages.rows[1][2], false, "personal message becomes inactive after successful check-in");
assert.equal(personal.sheets._Personal_Messages.rows[1][5].toISOString(), "2026-08-17T10:00:00.000Z", "personal message records UsedAt");
const laterSession = personal.context.checkIn_("GYM-0001", { now: new Date("2026-08-24T10:00:00Z") });
assert.equal(laterSession.message, "Great work!", "used personal message is not shown again");

const customizedPresentation = context.createScannerResponse_("success", "attendance_recorded", { trainingName: "Yoga" }, {
  ScannerSuccessSubtitle: "Ready for {trainingName}",
  ScannerSuccessColor: "#a1b2c3",
});
assert.equal(customizedPresentation.subtitle, "Ready for Yoga");
assert.equal(customizedPresentation.color, "#A1B2C3");
const invalidColor = context.createScannerResponse_("error", "backend_error", {}, { ScannerErrorColor: "red" });
assert.equal(invalidColor.color, "#B91C1C");

console.log("Phase 4 check-in contract checks passed.");
