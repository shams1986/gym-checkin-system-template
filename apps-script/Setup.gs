function setupTemplate_(options) {
  var setupOptions = options || {};
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) {
      throw new Error("setupTemplate_() must run from a spreadsheet-bound Apps Script project.");
    }

    var timezone = resolveTemplateTimezone_(spreadsheet, setupOptions.timezone);
    var now = new Date();
    var createdSheets = [];

    TEMPLATE_SHEETS.forEach(function (definition) {
      var result = ensureTemplateSheet_(spreadsheet, definition);
      if (result.created) {
        createdSheets.push(definition.name);
      }
    });
    var removedDefaultSheet = removeBlankDefaultSheet_(spreadsheet);

    applyTemplateValidations_(spreadsheet);
    applyTemplateFormats_(spreadsheet);
    ensureDefaultSettings_(spreadsheet, timezone);
    ensureAttendanceProjection_(spreadsheet);
    ensureInternalMetadata_(spreadsheet, now);
    applyTemplateVisibilityAndProtection_(spreadsheet);
    applyTemplateTimezone_(spreadsheet, timezone, Boolean(setupOptions.timezone));

    return {
      schemaVersion: TEMPLATE_SCHEMA_VERSION,
      createdSheets: createdSheets,
      verifiedSheets: TEMPLATE_SHEETS.map(function (definition) { return definition.name; }),
      attendanceProjection: "protected_array_formula",
      removedDefaultSheet: removedDefaultSheet,
    };
  } finally {
    lock.releaseLock();
  }
}

function applyTemplateValidations_(spreadsheet) {
  var validation = SpreadsheetApp.newDataValidation();
  var members = spreadsheet.getSheetByName("Members");
  var schedule = spreadsheet.getSheetByName("Schedule");
  var trainingTypes = spreadsheet.getSheetByName("Training_Types");
  var messages = spreadsheet.getSheetByName("_Messages");

  setColumnValidation_(members, 4, validation.requireValueInList(TEMPLATE_ENUMS.memberStatus, true).setAllowInvalid(false).build());
  setColumnValidation_(schedule, 2, SpreadsheetApp.newDataValidation().requireCheckbox().setAllowInvalid(false).build());
  setColumnValidation_(schedule, 3, SpreadsheetApp.newDataValidation().requireValueInList(TEMPLATE_ENUMS.dayOfWeek, true).setAllowInvalid(false).build());
  setColumnValidation_(schedule, 6, SpreadsheetApp.newDataValidation().requireValueInRange(trainingTypes.getRange("A2:A"), true).setAllowInvalid(false).build());
  setColumnValidation_(trainingTypes, 3, SpreadsheetApp.newDataValidation().requireCheckbox().setAllowInvalid(false).build());
  setColumnValidation_(trainingTypes, 4, SpreadsheetApp.newDataValidation().requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(false).build());
  setColumnValidation_(messages, 2, SpreadsheetApp.newDataValidation().requireCheckbox().setAllowInvalid(false).build());
  setColumnValidation_(messages, 6, SpreadsheetApp.newDataValidation().requireNumberGreaterThan(0).setAllowInvalid(false).build());
}

function applyTemplateFormats_(spreadsheet) {
  setColumnNumberFormat_(spreadsheet.getSheetByName("Members"), 6, "yyyy-mm-dd");
  setColumnNumberFormat_(spreadsheet.getSheetByName("Attendance"), 1, "yyyy-mm-dd hh:mm:ss");
  setColumnNumberFormat_(spreadsheet.getSheetByName("Attendance"), 7, "yyyy-mm-dd hh:mm");
  setColumnNumberFormat_(spreadsheet.getSheetByName("Schedule"), 4, "hh:mm");
  setColumnNumberFormat_(spreadsheet.getSheetByName("Schedule"), 5, "hh:mm");
  setColumnNumberFormat_(spreadsheet.getSheetByName("_Raw_Attendance"), 2, "yyyy-mm-dd hh:mm:ss");
  setColumnNumberFormat_(spreadsheet.getSheetByName("_Raw_Attendance"), 10, "yyyy-mm-dd hh:mm");
  setColumnNumberFormat_(spreadsheet.getSheetByName("_Raw_Attendance"), 13, "yyyy-mm-dd hh:mm:ss");
  setColumnNumberFormat_(spreadsheet.getSheetByName("_State"), 2, "yyyy-mm-dd hh:mm:ss");
  setColumnNumberFormat_(spreadsheet.getSheetByName("_State"), 5, "yyyy-mm-dd hh:mm:ss");
  setColumnNumberFormat_(spreadsheet.getSheetByName("_Card_State"), 4, "yyyy-mm-dd hh:mm:ss");
  setColumnNumberFormat_(spreadsheet.getSheetByName("_Logs"), 1, "yyyy-mm-dd hh:mm:ss");
  setColumnNumberFormat_(spreadsheet.getSheetByName("_Internal_Config"), 3, "yyyy-mm-dd hh:mm:ss");
}

function ensureDefaultSettings_(spreadsheet, timezone) {
  var settings = TEMPLATE_DEFAULT_SETTINGS.map(function (row) {
    return row[0] === "Timezone" ? [row[0], timezone, row[2]] : row.slice();
  });
  upsertKeyValueRows_(spreadsheet.getSheetByName("Settings"), settings, 0);
}

function ensureAttendanceProjection_(spreadsheet) {
  var attendance = spreadsheet.getSheetByName("Attendance");
  var projectionRange = attendance.getRange(2, 1, 1, ATTENDANCE_PROJECTION_FORMULAS.length);
  var existingFormulas = projectionRange.getFormulas()[0];
  var existingValues = projectionRange.getDisplayValues()[0];
  var existingFormula = existingFormulas[0];
  var isKnownSingleFormula = existingFormula === LEGACY_ATTENDANCE_PROJECTION_FORMULA || existingFormula === LOCALE_SENSITIVE_ATTENDANCE_PROJECTION_FORMULA;
  var isCurrentProjection = ATTENDANCE_PROJECTION_FORMULAS.every(function (formula, index) { return existingFormulas[index] === formula; });

  if (isKnownSingleFormula && existingFormulas.slice(1).every(function (formula) { return !formula; })) {
    setAttendanceProjectionFormulas_(attendance);
    return;
  }
  if (existingFormulas.some(Boolean) && !isCurrentProjection) {
    throw new Error("Attendance projection formula differs from schema version " + TEMPLATE_SCHEMA_VERSION + ". Run a documented migration.");
  }
  if (!existingFormulas.some(Boolean) && existingValues.some(function (value) { return value !== ""; })) {
    throw new Error("Attendance contains manual data. Setup will not overwrite it; migrate it before continuing.");
  }
  if (!isCurrentProjection) {
    setAttendanceProjectionFormulas_(attendance);
  }
}

function setAttendanceProjectionFormulas_(attendance) {
  ATTENDANCE_PROJECTION_FORMULAS.forEach(function (formula, index) {
    attendance.getRange(2, index + 1).setFormula(formula);
  });
}

function removeBlankDefaultSheet_(spreadsheet) {
  var templateNames = TEMPLATE_SHEETS.map(function (definition) { return definition.name; });
  var defaultSheet = spreadsheet.getSheets().filter(function (sheet) {
    return sheet.getSheetId() === 0 && templateNames.indexOf(sheet.getName()) === -1 && sheet.getLastRow() === 0 && sheet.getLastColumn() === 0;
  })[0];
  if (!defaultSheet) return "";
  var name = defaultSheet.getName();
  spreadsheet.deleteSheet(defaultSheet);
  return name;
}

function ensureInternalMetadata_(spreadsheet, now) {
  var internalConfig = spreadsheet.getSheetByName("_Internal_Config");
  var schemaRow = findRowByValue_(internalConfig, 1, "SchemaVersion");

  if (schemaRow) {
    var existingVersion = Number(internalConfig.getRange(schemaRow, 2).getValue());
    if (existingVersion !== TEMPLATE_SCHEMA_VERSION) {
      throw new Error("Existing schema version " + existingVersion + " requires a documented migration to version " + TEMPLATE_SCHEMA_VERSION + ".");
    }
  }

  upsertInternalConfig_(internalConfig, "SchemaVersion", TEMPLATE_SCHEMA_VERSION, now);
  if (!findRowByValue_(internalConfig, 1, "InstallationID")) {
    upsertInternalConfig_(internalConfig, "InstallationID", Utilities.getUuid(), now);
  }
  if (!findRowByValue_(internalConfig, 1, "SetupCompletedAt")) {
    upsertInternalConfig_(internalConfig, "SetupCompletedAt", now, now);
  }
  if (!findRowByValue_(internalConfig, 1, "NextMemberNumber")) {
    upsertInternalConfig_(internalConfig, "NextMemberNumber", 1, now);
  }
}

function applyTemplateVisibilityAndProtection_(spreadsheet) {
  TEMPLATE_SHEETS.forEach(function (definition) {
    var sheet = spreadsheet.getSheetByName(definition.name);

    if (definition.visibility === "internal") {
      ensureManagedProtection_(sheet, "Gym Template internal sheet: " + definition.name);
      sheet.hideSheet();
    } else {
      sheet.showSheet();
      if (definition.protection === "read_only") {
        ensureManagedProtection_(sheet, "Gym Template generated sheet: " + definition.name);
      } else if (definition.protection === "system_managed") {
        ensureManagedProtection_(sheet, "Gym Template system-managed sheet: " + definition.name);
      }
    }
  });
}

function resolveTemplateTimezone_(spreadsheet, requestedTimezone) {
  var timezone = requestedTimezone || spreadsheet.getSpreadsheetTimeZone() || "Etc/UTC";
  if (typeof timezone !== "string" || timezone.trim() === "") {
    throw new Error("Timezone must be a non-empty IANA timezone string.");
  }
  try {
    Utilities.formatDate(new Date(), timezone, "yyyy-MM-dd HH:mm:ss");
  } catch (error) {
    throw new Error("Invalid IANA timezone: " + timezone);
  }
  return timezone;
}

function applyTemplateTimezone_(spreadsheet, timezone, shouldApply) {
  if (shouldApply && spreadsheet.getSpreadsheetTimeZone() !== timezone) {
    spreadsheet.setSpreadsheetTimeZone(timezone);
  }

  var settings = spreadsheet.getSheetByName("Settings");
  var timezoneRow = findRowByValue_(settings, 1, "Timezone");
  if (timezoneRow && shouldApply) {
    settings.getRange(timezoneRow, 2).setValue(timezone);
  }
}
