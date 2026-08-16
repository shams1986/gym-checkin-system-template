function getRuntimeSheet_(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("Required sheet is missing: " + sheetName);
  }
  return sheet;
}

function readRuntimeRows_(sheetName) {
  var definition = getTemplateSheetDefinition_(sheetName);
  var sheet = getRuntimeSheet_(sheetName);
  var headers = definition.headers;
  var lastRow = sheet.getLastRow();

  ensureExactHeaders_(sheet, headers);
  if (lastRow < 2 || headers.length === 0) {
    return [];
  }

  return sheet.getRange(2, 1, lastRow - 1, headers.length).getValues().map(function (values, index) {
    var row = { _rowNumber: index + 2 };
    headers.forEach(function (header, column) {
      row[header] = values[column];
    });
    return row;
  });
}

function normalizeMemberId_(value) {
  var normalized = String(value == null ? "" : value).trim().toUpperCase();
  return /^[A-Z0-9_-]{1,64}$/.test(normalized) ? normalized : "";
}

function isRuntimeActive_(value) {
  return value === true || String(value).trim().toUpperCase() === "TRUE" || String(value).trim().toUpperCase() === "ACTIVE";
}

function getRuntimeSettings_() {
  var settings = {};
  readRuntimeRows_("Settings").forEach(function (row) {
    settings[String(row.Setting)] = row.Value;
  });

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  settings.Timezone = String(settings.Timezone || spreadsheet.getSpreadsheetTimeZone() || "Etc/UTC");
  settings.CheckinMinutesBeforeStart = boundedInteger_(settings.CheckinMinutesBeforeStart, 20, 0, 720);
  settings.CheckinMinutesAfterStart = boundedInteger_(settings.CheckinMinutesAfterStart, 30, 0, 720);
  return settings;
}

function boundedInteger_(value, fallback, minimum, maximum) {
  var parsed = Number(value);
  if (!isFinite(parsed)) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

function truncateRuntimeText_(value, maximumLength) {
  return String(value == null ? "" : value).replace(/[\r\n]+/g, " ").slice(0, maximumLength);
}
