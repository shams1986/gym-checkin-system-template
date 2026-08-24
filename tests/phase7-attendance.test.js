const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, ".."), apps = path.join(root, "apps-script");
const attendanceSource = fs.readFileSync(path.join(apps, "AttendanceService.gs"), "utf8"), reportSource = fs.readFileSync(path.join(apps, "ReportService.gs"), "utf8");
assert.doesNotThrow(() => new vm.Script(attendanceSource)); assert.doesNotThrow(() => new vm.Script(reportSource));
const attendanceRows = [
  { Timestamp: new Date("2026-08-31T21:30:00Z"), MemberID: "GYM0001", FirstName: "Old", LastName: "Snapshot", TrainingType: "YOGA", TrainingName: "Evening Flow", TrainingStart: "2026-08-31T23:00:00+02:00" },
  { Timestamp: new Date("2026-08-31T22:30:00Z"), MemberID: "GYM0001", FirstName: "Old", LastName: "Snapshot", TrainingType: "YOGA", TrainingName: "Late Flow", TrainingStart: "2026-09-01T00:00:00+02:00" },
  { Timestamp: new Date("2026-09-02T08:00:00Z"), MemberID: "GYM0002", FirstName: "Demo", LastName: "Two", TrainingType: "BOX", TrainingName: "Basics", TrainingStart: "2026-09-02T10:00:00+02:00" },
];
const members = [{ MemberID: "GYM0001", FirstName: "Renamed", LastName: "Current", Status: "Active" }, { MemberID: "GYM0002", FirstName: "Demo", LastName: "Two", Status: "Active" }, { MemberID: "GYM0003", FirstName: "No", LastName: "Visits", Status: "Active" }, { MemberID: "GYM0004", FirstName: "Inactive", LastName: "Member", Status: "Inactive" }];
function formatDate(date, timezone, pattern) { const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timezone === "Etc/UTC" ? "UTC" : timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).map((part) => [part.type, part.value])); return pattern === "yyyy-MM" ? `${parts.year}-${parts.month}` : `${parts.year}-${parts.month}-${parts.day}`; }
const context = { Date, String, Number, Object, Array, Math, JSON, RegExp, isNaN, Utilities: { formatDate }, getRuntimeSettings_: () => ({ Timezone: "Europe/Vienna" }), readRuntimeRows_: (sheet) => sheet === "Members" ? members : sheet === "Training_Types" ? [{ TrainingType: "YOGA", DisplayName: "Yoga" }, { TrainingType: "BOX", DisplayName: "Boxing" }] : attendanceRows, findMemberById_: (id) => members.find((member) => member.MemberID === id) || null, normalizeMemberId_: (value) => String(value || "").trim().toUpperCase(), isRuntimeActive_: (value) => String(value).toUpperCase() === "ACTIVE", adminString_: (value, maximum) => String(value == null ? "" : value).trim().slice(0, maximum), adminPage_: (value, fallback) => Math.max(1, Number(value) || fallback), adminPageSize_: (value, fallback) => [25, 50, 100].includes(Number(value)) ? Number(value) : fallback, boundedInteger_: (value, fallback, minimum, maximum) => Number.isFinite(Number(value)) ? Math.min(maximum, Math.max(minimum, Math.round(Number(value)))) : fallback, adminInstantText_: (value) => new Date(value).toISOString(), adminError_: (code, message, fields) => { const error = new Error(message); error.adminCode = code; error.adminFields = fields; return error; }, attendanceDateFilter_: (value) => value, serializeAttendance_: (row) => ({ timestamp: new Date(row.Timestamp).toISOString(), memberId: row.MemberID, firstName: row.FirstName, lastName: row.LastName, trainingType: row.TrainingType, trainingName: row.TrainingName, trainingStart: row.TrainingStart }) };
vm.createContext(context); vm.runInContext(attendanceSource, context); vm.runInContext(reportSource, context);
const august = JSON.parse(JSON.stringify(context.getAttendance_({ from: "2026-08-31", to: "2026-08-31", pageSize: 25 })));
assert.equal(august.total, 1); assert.deepEqual(Object.keys(august.items[0]), ["timestamp", "memberId", "firstName", "lastName", "trainingType", "trainingName", "trainingStart"]);
assert.equal(context.getAttendance_({ from: "2026-09-01", to: "2026-09-30", trainingType: "YOGA", query: "old snap", pageSize: 25 }).total, 1);
assert.throws(() => context.getAttendance_({ from: "2026-09-31", to: "2026-10-01" }), (error) => error.adminCode === "validation_error");
const history = JSON.parse(JSON.stringify(context.getMemberAttendance_({ memberId: "GYM0001", filters: { from: "2026-08-01", to: "2026-09-30", pageSize: 25 } })));
assert.deepEqual(history.items, JSON.parse(JSON.stringify(context.getAttendance_({ from: "2026-08-01", to: "2026-09-30", query: "GYM0001", pageSize: 25 }).items)));
const report = JSON.parse(JSON.stringify(context.getReportData_({ from: "2026-09-01", to: "2026-09-30" })));
assert.equal(report.totalCheckins, 2); assert.equal(report.uniqueAttendees, 2); assert.equal(report.topAttendees[0].firstName, "Old"); assert.deepEqual(report.trainingTypes.map((item) => item.value), ["BOX", "YOGA"]); assert.equal(report.lowAttendance, undefined);
const client = fs.readFileSync(path.join(apps, "Admin.js.html"), "utf8"), html = fs.readFileSync(path.join(apps, "Admin.html"), "utf8");
for (const expected of ["Attendance", "Reports", "Apply filters", "Clear", "Refresh", "Export page CSV", "Top attendance", "All training types", "member-attendance-next", "formatOwnerDate", "formatOwnerTime"]) assert.ok(`${html}\n${client}`.includes(expected));
for (const label of ["From", "To", "Training type", "Member", "Check-ins per page"]) assert.ok(client.includes(`<span>${label}</span>`));
assert.match(client, /class="filters attendance-filters"/);
assert.ok(!client.includes("zero or fewer check-ins"));
assert.match(client, /\^\[=\+\\-@\]/);
console.log("Phase 7 attendance timezone, projection, pagination, reports, and UI contract checks passed.");
