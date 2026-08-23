const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const appsScript = path.join(root, "apps-script");
const manifest = JSON.parse(fs.readFileSync(path.join(appsScript, "appsscript.json"), "utf8"));
assert.deepEqual(manifest.webapp, { executeAs: "USER_ACCESSING", access: "MYSELF" }, "admin deployment must remain owner-only and execute as the accessing user");
const gsFiles = fs.readdirSync(appsScript).filter((file) => file.endsWith(".gs")).sort();
const bundle = gsFiles.map((file) => fs.readFileSync(path.join(appsScript, file), "utf8")).join("\n");
assert.doesNotThrow(() => new vm.Script(bundle, { filename: "phase5-apps-script-bundle.gs" }));

const client = fs.readFileSync(path.join(appsScript, "Admin.js.html"), "utf8");
const html = fs.readFileSync(path.join(appsScript, "Admin.html"), "utf8");
const css = fs.readFileSync(path.join(appsScript, "Admin.css.html"), "utf8");
const authDocs = ["README.md", "apps-script/README.md", "docs/ADMIN_SETUP.md", "docs/CONFIG.md"].map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
assert.doesNotThrow(() => new vm.Script(client, { filename: "Admin.js" }));
for (const screen of ["Dashboard", "Members", "Add member", "Edit member", "Schedule", "Settings"]) {
  assert.match(`${html}\n${client}`, new RegExp(screen, "i"));
}
assert.doesNotMatch(html, /accounts\.google\.com\/gsi\/client|ADMIN_OAUTH_CLIENT_ID|google-signin/);
assert.match(html, /includeAdminScript_\("Admin\.js"\)/);
assert.match(client, /google\.script\.run/);
assert.match(`${client}\n${bundle}`, /Member ID will be generated automatically/);
assert.match(client, /Advanced settings are for setup and support only\./);
assert.match(client, /<details class="advanced-settings">/);
assert.match(client, /setBusy\(button, "Saving\.\.\."\)/);
assert.match(client, /Generating PDF\.\.\./);
assert.match(client, /Generate missing active cards/);
assert.doesNotMatch(client, /Regenerate active cards/);
assert.doesNotMatch(client, /<th>Generated<\/th>|<th>Last error<\/th>/);
assert.match(client, /filters = filters \|\| \{ status: "ACTIVE" \}/);
assert.match(client, /Applying\.\.\.|Refreshing\.\.\.|Exporting\.\.\./);
assert.doesNotMatch(client, /querySelector\('button\[type="submit"\]\'\)/);
assert.match(client, /save\.textContent = "Save"; secondaryAction\.textContent = "Save and generate card"/);
assert.match(client, /errorPanel\("Schedule could not be loaded", function \(\) \{ renderSchedule\(filters\); \}\)/);
assert.doesNotMatch(html, /sheet id|cache key|deployment id|callback name/i);
assert.match(css, /@media\(max-width:600px\)/);
assert.match(bundle, /function adminApi\(action, payload\)/);
assert.match(bundle, /Session\.getActiveUser\(\)\.getEmail\(\)/);
assert.match(bundle, /allowedEmails\.indexOf\(email\)/);
assert.doesNotMatch(bundle, /oauth2\.googleapis\.com\/tokeninfo|ADMIN_GOOGLE_CLIENT_ID/);
assert.doesNotMatch(authDocs, /ADMIN_GOOGLE_CLIENT_ID|Google (?:ID-)?token (?:verification|authorization)|Google-token authorization/i);
assert.match(authDocs, /Session\.getActiveUser\(\)\.getEmail\(\)/);
assert.match(bundle, /LockService\.getScriptLock\(\)/);
assert.match(bundle, /member_id_format_locked/);
assert.match(bundle, /schedule_overlap/);
const includeContext = {
  HtmlService: { createTemplateFromFile: () => ({ getRawContent: () => "return '<div></div>';" }) },
};
vm.createContext(includeContext);
vm.runInContext(fs.readFileSync(path.join(appsScript, "AdminWeb.gs"), "utf8"), includeContext);
assert.equal(includeContext.includeAdminScript_("Admin.js"), "return '<div><\\/div>';", "embedded admin JavaScript must not expose raw closing tags to HtmlService");
const browserCallableFunctions = Array.from(bundle.matchAll(/^function ([A-Za-z0-9]+)\(/gm), (match) => match[1]).sort();
assert.deepEqual(browserCallableFunctions, ["adminApi", "doGet", "runTemplateSetup"], "only authenticated/safe routes and the bound-editor-only setup wrapper may be browser-callable");
assert.match(bundle, /function runTemplateSetup\(\)[\s\S]*if \(!SpreadsheetApp\.getActiveSpreadsheet\(\)\)[\s\S]*return loadDemoData_\(\)/, "manual setup wrapper must reject web-app/API contexts before mutation");

const properties = {
  ADMIN_ALLOWED_EMAILS: '["owner@example.invalid"]',
};
let handlerCalls = 0;
let activeEmail = "";
const actionNames = ["getAdminSession_", "getDashboardData_", "listMembers_", "getMember_", "getMemberAttendance_", "getAttendance_", "getReportData_", "getMemberFormOptions_", "createMember_", "updateMember_", "setMemberStatus_", "listSchedule_", "createScheduleEntry_", "updateScheduleEntry_", "setScheduleStatus_", "deleteScheduleEntry_", "saveScheduleOrder_", "createTrainingType_", "updateTrainingType_", "deleteTrainingType_", "getAdminSettings_", "updateAdminSettings_", "testCardConfiguration_", "listBasicMessages_", "saveBasicMessage_", "deleteBasicMessage_", "listMemberCards_", "generateMemberCard_", "regenerateMemberCard_", "generateMissingMemberCards_"];
const context = {
  Object,
  Array,
  JSON,
  Date,
  Error,
  encodeURIComponent,
  PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => properties[key] || "" }) },
  Session: { getActiveUser: () => ({ getEmail: () => activeEmail }) },
  Utilities: { DigestAlgorithm: { SHA_256: "sha256" }, computeDigest: (_algorithm, token) => Array.from(String(token)).map((character) => character.charCodeAt(0)), getUuid: () => "request-id" },
  truncateRuntimeText_: (value, length) => String(value || "").slice(0, length),
  logCheckinFailure_: () => {},
};
actionNames.forEach((name) => { context[name] = (payload, admin) => { handlerCalls += 1; return { action: name, payload, email: admin.email }; }; });
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(appsScript, "AdminAuth.gs"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(appsScript, "AdminApi.gs"), "utf8"), context);

const anonymous = JSON.parse(JSON.stringify(context.adminApi("getDashboardData", {})));
assert.equal(anonymous.ok, false);
assert.equal(anonymous.error.code, "unauthorized");
assert.equal(handlerCalls, 0, "unauthorized calls must not reach handlers");

activeEmail = "other@example.invalid";
const outsider = JSON.parse(JSON.stringify(context.adminApi("getDashboardData", {})));
assert.equal(outsider.ok, false);
assert.equal(outsider.error.code, "forbidden");
assert.equal(handlerCalls, 0);

activeEmail = "Owner@Example.invalid";
const session = JSON.parse(JSON.stringify(context.adminApi("getAdminSession", {})));
assert.equal(session.ok, true);
assert.equal(session.data.email, "owner@example.invalid");
const authorized = JSON.parse(JSON.stringify(context.adminApi("getDashboardData", { date: "2026-08-17" })));
assert.equal(authorized.ok, true);
assert.equal(authorized.data.email, "owner@example.invalid");
assert.equal(handlerCalls, 1);
assert.equal(context.adminApi("listMembers", {}).ok, true);

const unsupported = JSON.parse(JSON.stringify(context.adminApi("internalHelper", {})));
assert.equal(unsupported.ok, false);
assert.equal(unsupported.error.code, "unsupported_action");
assert.equal(handlerCalls, 2, "unsupported actions must not reach handlers");

const serviceContext = {
  Object,
  Array,
  Date,
  String,
  Number,
  Math,
  isFinite,
  truncateRuntimeText_: (value, length) => String(value == null ? "" : value).replace(/[\r\n]+/g, " ").slice(0, length),
  boundedInteger_: (value, fallback, minimum, maximum) => { const parsed = Number(value); return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, Math.round(parsed))) : fallback; },
  parseScheduleTime_: (value) => { const match = /^(\d{1,2}):(\d{2})$/.exec(String(value)); if (!match) return null; const minutes = Number(match[1]) * 60 + Number(match[2]); return Number(match[1]) < 24 && Number(match[2]) < 60 ? minutes : null; },
  isRuntimeActive_: (value) => value === true || String(value).toUpperCase() === "ACTIVE" || String(value).toUpperCase() === "TRUE",
  padRuntimeNumber_: (value) => String(value).padStart(2, "0"),
  TEMPLATE_ENUMS: { dayOfWeek: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] },
  findRuntimeRowByKey_: (sheet, column, key) => sheet === "Training_Types" && column === "TrainingType" && key === "YOGA" ? { TrainingType: "YOGA" } : null,
  readRuntimeRows_: (sheet) => sheet === "Schedule" ? [{ ScheduleID: "EXISTING", Active: true, DayOfWeek: "MONDAY", StartTime: "10:00", EndTime: "11:00", TrainingType: "YOGA", DisplayName: "Yoga", Audience: "ALL", _rowNumber: 2 }, { ScheduleID: "TARGET", Active: false, DayOfWeek: "MONDAY", StartTime: "10:30", EndTime: "11:30", TrainingType: "YOGA", DisplayName: "Yoga later", Audience: "ALL", _rowNumber: 3 }] : sheet === "Training_Types" ? [{ TrainingType: "YOGA", DisplayName: "Yoga", Active: true, SortOrder: 1 }] : [],
  Utilities: { formatDate: () => "2026-08-17", getUuid: () => "uuid" },
  getRuntimeSettings_: () => ({ Timezone: "Etc/UTC" }),
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
};
vm.createContext(serviceContext);
vm.runInContext(fs.readFileSync(path.join(appsScript, "AdminAuth.gs"), "utf8"), serviceContext);
vm.runInContext(fs.readFileSync(path.join(appsScript, "AdminRepository.gs"), "utf8"), serviceContext);
vm.runInContext(fs.readFileSync(path.join(appsScript, "AdminMemberService.gs"), "utf8"), serviceContext);
vm.runInContext(fs.readFileSync(path.join(appsScript, "AdminScheduleService.gs"), "utf8"), serviceContext);
vm.runInContext(fs.readFileSync(path.join(appsScript, "AdminSettingsService.gs"), "utf8"), serviceContext);

assert.throws(() => serviceContext.validateMemberInput_({ firstName: "", lastName: "" }), (error) => Boolean(error.adminCode === "validation_error" && error.adminFields.firstName && error.adminFields.lastName));
const memberInput = JSON.parse(JSON.stringify(serviceContext.validateMemberInput_({ firstName: " Ada ", lastName: " Lovelace ", active: true, joinedAt: "2026-08-17" })));
assert.equal(memberInput.firstName, "Ada");
assert.equal(memberInput.status, "Active");
assert.throws(() => serviceContext.validateScheduleInput_({ dayOfWeek: "MONDAY", startTime: "10:30", endTime: "11:30", trainingType: "YOGA", displayName: "Yoga", audience: "ALL", active: true }) && serviceContext.assertNoScheduleOverlap_(serviceContext.validateScheduleInput_({ dayOfWeek: "MONDAY", startTime: "10:30", endTime: "11:30", trainingType: "YOGA", displayName: "Yoga", audience: "ALL", active: true }), ""), (error) => error.adminCode === "schedule_overlap");
assert.throws(() => serviceContext.setScheduleStatus_({ scheduleId: "TARGET", active: true }), (error) => error.adminCode === "schedule_overlap", "activation must recheck overlaps under lock");
assert.equal(serviceContext.validateAdminSetting_("PrimaryColor", "#a1b2c3"), "#A1B2C3");
assert.throws(() => serviceContext.validateAdminSetting_("PrimaryColor", "red"), (error) => error.adminCode === "validation_error");
assert.throws(() => serviceContext.validateAdminSetting_("ScannerURL", "javascript:alert(1)"), (error) => error.adminCode === "validation_error");

const settingValues = { 2: "Old gym", 3: "Old short" };
const settingsSheet = { getRange: (row) => ({ getValue: () => settingValues[row], setValue: (value) => { if (row === 3 && value === "Fail") throw new Error("injected write failure"); settingValues[row] = value; } }) };
const settingContext = {
  Object, Array, String, Date,
  ADMIN_SETTING_KEYS: ["GymName", "ShortName"],
  adminError_: serviceContext.adminError_,
  validateAdminSetting_: (_key, value) => value,
  getAdminSettings_: () => ({ GymName: settingValues[2], ShortName: settingValues[3], memberIdFormatLocked: false }),
  getRuntimeSheet_: () => settingsSheet,
  findRowByValue_: (_sheet, _column, key) => key === "GymName" ? 2 : key === "ShortName" ? 3 : 0,
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSpreadsheetTimeZone: () => "Etc/UTC", setSpreadsheetTimeZone: () => {} }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
};
vm.createContext(settingContext);
const settingsSource = fs.readFileSync(path.join(appsScript, "AdminSettingsService.gs"), "utf8");
vm.runInContext(settingsSource.slice(settingsSource.indexOf("function updateAdminSettings_"), settingsSource.indexOf("function testCardConfiguration_")), settingContext);
assert.throws(() => settingContext.updateAdminSettings_({ GymName: "New gym", ShortName: "Fail" }), /injected write failure/);
assert.equal(settingValues[2], "Old gym", "failed multi-setting save must roll back earlier values");

console.log("Phase 5 admin authentication, surface, and UI contract checks passed.");
