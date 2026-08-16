function ensureTemplateSheet_(spreadsheet, definition) {
  var sheet = spreadsheet.getSheetByName(definition.name);
  var created = false;

  if (!sheet) {
    sheet = spreadsheet.insertSheet(definition.name);
    created = true;
  }

  ensureSheetCapacity_(sheet, Math.max(definition.headers.length, 1));
  ensureExactHeaders_(sheet, definition.headers);

  if (definition.headers.length > 0) {
    formatHeader_(sheet, definition.headers.length);
  }

  return { sheet: sheet, created: created };
}

function ensureSheetCapacity_(sheet, requiredColumns) {
  if (sheet.getMaxColumns() < requiredColumns) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), requiredColumns - sheet.getMaxColumns());
  }
}

function ensureExactHeaders_(sheet, expectedHeaders) {
  if (expectedHeaders.length === 0) {
    return;
  }

  var width = Math.max(expectedHeaders.length, sheet.getLastColumn());
  var currentHeaders = sheet.getRange(1, 1, 1, width).getDisplayValues()[0];
  var hasHeaderValues = currentHeaders.some(function (value) {
    return value !== "";
  });

  if (!hasHeaderValues) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    return;
  }

  var normalizedHeaders = currentHeaders.slice(0, expectedHeaders.length);
  var unexpectedExtraHeader = currentHeaders.slice(expectedHeaders.length).some(function (value) {
    return value !== "";
  });
  var mismatch = unexpectedExtraHeader || normalizedHeaders.length !== expectedHeaders.length;

  for (var index = 0; index < expectedHeaders.length && !mismatch; index += 1) {
    mismatch = normalizedHeaders[index] !== expectedHeaders[index];
  }

  if (mismatch) {
    throw new Error("Schema mismatch in sheet '" + sheet.getName() + "'. Run a documented migration; setup will not overwrite existing headers or data.");
  }
}

function formatHeader_(sheet, columnCount) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, columnCount)
    .setFontWeight("bold")
    .setBackground("#E8EEF2")
    .setWrap(true);
}

function setColumnValidation_(sheet, columnNumber, rule) {
  var rowCount = Math.max(sheet.getMaxRows() - 1, 1);
  sheet.getRange(2, columnNumber, rowCount, 1).setDataValidation(rule);
}

function setColumnNumberFormat_(sheet, columnNumber, format) {
  var rowCount = Math.max(sheet.getMaxRows() - 1, 1);
  sheet.getRange(2, columnNumber, rowCount, 1).setNumberFormat(format);
}

function ensureManagedProtection_(sheet, description) {
  var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  var protection = null;

  for (var index = 0; index < protections.length; index += 1) {
    if (protections[index].getDescription() === description) {
      protection = protections[index];
      break;
    }
  }

  if (!protection) {
    protection = sheet.protect().setDescription(description);
  }

  protection.setWarningOnly(false);
  var ownerEmail = Session.getEffectiveUser().getEmail();

  if (ownerEmail) {
    protection.addEditor(ownerEmail);
    var otherEditors = protection.getEditors().filter(function (editor) {
      return editor.getEmail() !== ownerEmail;
    });
    if (otherEditors.length > 0) {
      protection.removeEditors(otherEditors);
    }
  }
  if (protection.canDomainEdit()) {
    protection.setDomainEdit(false);
  }
}

function upsertKeyValueRows_(sheet, rows, keyColumn) {
  if (rows.length === 0) {
    return;
  }

  var lastRow = sheet.getLastRow();
  var width = rows[0].length;
  var existing = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, width).getValues() : [];
  var rowByKey = {};

  existing.forEach(function (row, index) {
    if (row[keyColumn] !== "") {
      rowByKey[String(row[keyColumn])] = index + 2;
    }
  });

  rows.forEach(function (row) {
    var key = String(row[keyColumn]);
    if (!Object.prototype.hasOwnProperty.call(rowByKey, key)) {
      sheet.appendRow(row);
      rowByKey[key] = sheet.getLastRow();
    }
  });
}

function upsertInternalConfig_(sheet, key, value, now) {
  var lastRow = sheet.getLastRow();
  var values = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 3).getValues() : [];

  for (var index = 0; index < values.length; index += 1) {
    if (values[index][0] === key) {
      if (String(values[index][1]) !== String(value)) {
        sheet.getRange(index + 2, 2, 1, 2).setValues([[value, now]]);
      }
      return values[index][1];
    }
  }

  sheet.appendRow([key, value, now]);
  return value;
}

function findRowByValue_(sheet, columnNumber, value) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 0;
  }

  var values = sheet.getRange(2, columnNumber, lastRow - 1, 1).getDisplayValues();
  for (var index = 0; index < values.length; index += 1) {
    if (values[index][0] === String(value)) {
      return index + 2;
    }
  }
  return 0;
}
