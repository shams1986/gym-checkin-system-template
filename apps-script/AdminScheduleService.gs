function listSchedule_(filters) {
  filters = filters || {};
  var settings = getRuntimeSettings_();
  var timezone = settings.Timezone;
  var day = adminString_(filters.day, 20).toUpperCase();
  var status = adminString_(filters.status || "ALL", 20).toUpperCase();
  var type = adminString_(filters.trainingType, 80).toUpperCase();
  var items = readRuntimeRows_("Schedule").filter(function (row) {
    return (!day || String(row.DayOfWeek).toUpperCase() === day) && (status === "ALL" || (isRuntimeActive_(row.Active) ? "ACTIVE" : "INACTIVE") === status) && (!type || String(row.TrainingType).toUpperCase() === type);
  }).map(function (row) { return serializeAdminSchedule_(row, timezone); });
  return {
    items: items,
    allScheduleIds: readRuntimeRows_("Schedule").map(function (row) { return String(row.ScheduleID); }),
    trainingTypes: readRuntimeRows_("Training_Types").map(serializeTrainingType_).sort(function (a, b) { return a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName); }),
    days: TEMPLATE_ENUMS.dayOfWeek.slice(),
    checkinMinutesBeforeStart: settings.CheckinMinutesBeforeStart,
    checkinMinutesAfterStart: settings.CheckinMinutesAfterStart,
  };
}

function createScheduleEntry_(data) {
  return withScheduleLock_(function () {
    var input = validateScheduleInput_(data);
    assertNoScheduleOverlap_(input, "");
    var scheduleId = "SCH-" + Utilities.getUuid().replace(/-/g, "").slice(0, 12).toUpperCase();
    var timezone = getRuntimeSettings_().Timezone;
    getRuntimeSheet_("Schedule").appendRow(scheduleValues_(scheduleId, input));
    return serializeAdminSchedule_({ ScheduleID: scheduleId, Active: input.active, DayOfWeek: input.dayOfWeek, StartTime: input.startTime, EndTime: input.endTime, TrainingType: input.trainingType, DisplayName: input.displayName, Audience: input.audience }, timezone);
  });
}

function updateScheduleEntry_(payload) {
  var scheduleId = adminString_(payload.scheduleId, 80);
  return withScheduleLock_(function () {
    var input = validateScheduleInput_(payload.data || payload);
    var existing = findRuntimeRowByKey_("Schedule", "ScheduleID", scheduleId);
    if (!existing) throw adminError_("schedule_not_found", "Schedule entry not found.");
    assertNoScheduleOverlap_(input, scheduleId);
    var timezone = getRuntimeSettings_().Timezone;
    replaceRuntimeRow_("Schedule", existing._rowNumber, scheduleValues_(scheduleId, input));
    return serializeAdminSchedule_({ ScheduleID: scheduleId, Active: input.active, DayOfWeek: input.dayOfWeek, StartTime: input.startTime, EndTime: input.endTime, TrainingType: input.trainingType, DisplayName: input.displayName, Audience: input.audience }, timezone);
  });
}

function setScheduleStatus_(payload) {
  var scheduleId = adminString_(payload.scheduleId, 80);
  var active = adminBoolean_(payload.active, null);
  if (active === null) throw adminError_("validation_error", "Choose a valid schedule status.");
  return withScheduleLock_(function () {
    var existing = findRuntimeRowByKey_("Schedule", "ScheduleID", scheduleId);
    if (!existing) throw adminError_("schedule_not_found", "Schedule entry not found.");
    if (active) {
      var input = validateScheduleInput_({ active: true, dayOfWeek: existing.DayOfWeek, startTime: adminTimeText_(existing.StartTime, getRuntimeSettings_().Timezone), endTime: adminTimeText_(existing.EndTime, getRuntimeSettings_().Timezone), trainingType: existing.TrainingType, displayName: existing.DisplayName, audience: existing.Audience });
      assertNoScheduleOverlap_(input, scheduleId);
    }
    getRuntimeSheet_("Schedule").getRange(existing._rowNumber, 2).setValue(active);
    return { scheduleId: scheduleId, active: active };
  });
}

function saveScheduleOrder_(payload) {
  var ids = Array.isArray(payload.scheduleIds) ? payload.scheduleIds.map(function (id) { return adminString_(id, 80); }) : [];
  return withScheduleLock_(function () {
    var rows = readRuntimeRows_("Schedule");
    var byId = {};
    rows.forEach(function (row) { byId[String(row.ScheduleID)] = row; });
    if (ids.length !== rows.length || ids.some(function (id, index) { return !byId[id] || ids.indexOf(id) !== index; })) throw adminError_("validation_error", "Schedule order is out of date. Refresh and try again.");
    var values = ids.map(function (id) { var row = byId[id]; return [row.ScheduleID, row.Active, row.DayOfWeek, row.StartTime, row.EndTime, row.TrainingType, row.DisplayName, row.Audience]; });
    if (values.length) getRuntimeSheet_("Schedule").getRange(2, 1, values.length, 8).setValues(values);
    return { scheduleIds: ids };
  });
}

function deleteScheduleEntry_(payload) {
  var scheduleId = adminString_(payload.scheduleId, 80);
  return withScheduleLock_(function () {
    var existing = findRuntimeRowByKey_("Schedule", "ScheduleID", scheduleId);
    if (!existing) throw adminError_("schedule_not_found", "Schedule entry not found.");
    var used = readRuntimeRows_("_Raw_Attendance").some(function (row) { return String(row.TrainingKey).slice(-scheduleId.length - 1) === "|" + scheduleId; });
    if (used) throw adminError_("in_use", "This session has attendance history and cannot be deleted. Deactivate it instead.");
    deleteRuntimeRow_("Schedule", existing._rowNumber);
    return { scheduleId: scheduleId };
  });
}

function createTrainingType_(data) {
  var input = validateTrainingType_(data);
  return withScheduleLock_(function () {
    if (findRuntimeRowByKey_("Training_Types", "TrainingType", input.trainingType)) throw adminError_("duplicate", "That training type already exists.");
    getRuntimeSheet_("Training_Types").appendRow([input.trainingType, input.displayName, input.active, input.sortOrder]);
    return input;
  });
}

function updateTrainingType_(payload) {
  var key = adminString_(payload.trainingType, 80).toUpperCase();
  var input = validateTrainingType_(payload.data || payload);
  if (input.trainingType !== key) throw adminError_("validation_error", "Training type keys cannot be changed.");
  return withScheduleLock_(function () {
    var existing = findRuntimeRowByKey_("Training_Types", "TrainingType", key);
    if (!existing) throw adminError_("training_type_not_found", "Training type not found.");
    replaceRuntimeRow_("Training_Types", existing._rowNumber, [key, input.displayName, input.active, input.sortOrder]);
    return input;
  });
}

function deleteTrainingType_(payload) {
  var key = adminString_(payload.trainingType, 80).toUpperCase();
  return withScheduleLock_(function () {
    var existing = findRuntimeRowByKey_("Training_Types", "TrainingType", key);
    if (!existing) throw adminError_("training_type_not_found", "Training type not found.");
    if (readRuntimeRows_("Schedule").some(function (row) { return String(row.TrainingType).toUpperCase() === key; })) throw adminError_("in_use", "This training type is used by the schedule and cannot be deleted.");
    deleteRuntimeRow_("Training_Types", existing._rowNumber);
    return { trainingType: key };
  });
}

function withScheduleLock_(operation) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw adminError_("busy", "Schedule changes are busy. Please try again.");
  try { return operation(); } finally { lock.releaseLock(); }
}

function validateScheduleInput_(data) {
  data = data || {};
  var fields = {};
  var day = adminString_(data.dayOfWeek, 20).toUpperCase();
  var startTime = adminString_(data.startTime, 8);
  var endTime = adminString_(data.endTime, 8);
  var trainingType = adminString_(data.trainingType, 80).toUpperCase();
  var displayName = adminString_(data.displayName, 120);
  if (TEMPLATE_ENUMS.dayOfWeek.indexOf(day) === -1) fields.dayOfWeek = "Choose a day.";
  if (parseScheduleTime_(startTime, "Etc/UTC") === null) fields.startTime = "Choose a valid time.";
  if (parseScheduleTime_(endTime, "Etc/UTC") === null) fields.endTime = "Choose a valid time.";
  if (!trainingType || !findRuntimeRowByKey_("Training_Types", "TrainingType", trainingType)) fields.trainingType = "Choose an existing training type.";
  if (!displayName) fields.displayName = "Display name is required.";
  if (Object.keys(fields).length) throw adminError_("validation_error", "Check the highlighted fields.", fields);
  return { active: adminBoolean_(data.active, true), dayOfWeek: day, startTime: startTime, endTime: endTime, trainingType: trainingType, displayName: displayName, audience: adminString_(data.audience || "ALL", 80) };
}

function assertNoScheduleOverlap_(input, ignoredId) {
  var start = parseScheduleTime_(input.startTime, "Etc/UTC");
  var end = parseScheduleTime_(input.endTime, "Etc/UTC");
  if (end <= start) throw adminError_("validation_error", "End time must be after start time.", { endTime: "Must be after start time." });
  var overlap = readRuntimeRows_("Schedule").some(function (row) {
    if (String(row.ScheduleID) === ignoredId || !isRuntimeActive_(row.Active) || !input.active || String(row.DayOfWeek).toUpperCase() !== input.dayOfWeek) return false;
    var audienceA = String(row.Audience || "ALL").toUpperCase();
    var audienceB = String(input.audience || "ALL").toUpperCase();
    if (audienceA !== "ALL" && audienceB !== "ALL" && audienceA !== audienceB) return false;
    var rowStart = parseScheduleTime_(row.StartTime, "Etc/UTC");
    var rowEnd = parseScheduleTime_(row.EndTime, "Etc/UTC");
    return rowStart < end && start < rowEnd;
  });
  if (overlap) throw adminError_("schedule_overlap", "This session overlaps another active session for the same audience.");
}

function scheduleValues_(scheduleId, input) { return [scheduleId, input.active, input.dayOfWeek, input.startTime, input.endTime, input.trainingType, input.displayName, input.audience]; }
function serializeAdminSchedule_(row, timezone) { return { scheduleId: String(row.ScheduleID), active: isRuntimeActive_(row.Active), dayOfWeek: String(row.DayOfWeek), startTime: adminTimeText_(row.StartTime, timezone), endTime: adminTimeText_(row.EndTime, timezone), trainingType: String(row.TrainingType), displayName: String(row.DisplayName), audience: String(row.Audience || "ALL") }; }
function serializeTrainingType_(row) { return { trainingType: String(row.TrainingType), displayName: String(row.DisplayName), active: isRuntimeActive_(row.Active), sortOrder: Number(row.SortOrder) || 0 }; }
function validateTrainingType_(data) { var key = adminString_(data.trainingType, 80).toUpperCase(); var name = adminString_(data.displayName, 120); if (!/^[A-Z0-9_-]{1,80}$/.test(key) || !name) throw adminError_("validation_error", "Training type and display name are required."); return { trainingType: key, displayName: name, active: adminBoolean_(data.active, true), sortOrder: boundedInteger_(data.sortOrder, 0, 0, 10000) }; }
