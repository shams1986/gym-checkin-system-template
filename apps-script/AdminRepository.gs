function adminPage_(value, fallback) {
  return boundedInteger_(value, fallback, 1, 1000000);
}

function adminPageSize_(value, fallback) {
  return boundedInteger_(value, fallback, 5, 100);
}

function adminString_(value, maximumLength) {
  return truncateRuntimeText_(value, maximumLength).trim();
}

function adminDateText_(value, timezone) {
  if (!value) {
    return "";
  }
  if (value instanceof Date) {
    return Utilities.formatDate(value, timezone, "yyyy-MM-dd");
  }
  var text = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function adminInstantText_(value, timezone) {
  if (!value) {
    return "";
  }
  var date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? "" : formatRuntimeInstant_(date, timezone);
}

function adminTimeText_(value, timezone) {
  var minutes = parseScheduleTime_(value, timezone);
  return minutes === null ? "" : padRuntimeNumber_(Math.floor(minutes / 60)) + ":" + padRuntimeNumber_(minutes % 60);
}

function adminBoolean_(value, fallback) {
  if (value === true || String(value).toLowerCase() === "true") {
    return true;
  }
  if (value === false || String(value).toLowerCase() === "false") {
    return false;
  }
  return fallback;
}

function findRuntimeRowByKey_(sheetName, keyColumn, key) {
  var rows = readRuntimeRows_(sheetName);
  for (var index = 0; index < rows.length; index += 1) {
    if (String(rows[index][keyColumn]) === String(key)) {
      return rows[index];
    }
  }
  return null;
}

function replaceRuntimeRow_(sheetName, rowNumber, values) {
  getRuntimeSheet_(sheetName).getRange(rowNumber, 1, 1, values.length).setValues([values]);
}

function deleteRuntimeRow_(sheetName, rowNumber) {
  getRuntimeSheet_(sheetName).deleteRow(rowNumber);
}
