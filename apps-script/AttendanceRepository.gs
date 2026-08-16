function findAttendanceForTraining_(memberId, trainingKey) {
  var sheet = getRuntimeSheet_("_State");
  ensureExactHeaders_(sheet, getTemplateSheetDefinition_("_State").headers);
  if (sheet.getLastRow() < 2) {
    return "";
  }

  var match = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(memberId)
    .matchEntireCell(true)
    .findNext();
  if (!match) {
    return "";
  }

  var state = sheet.getRange(match.getRow(), 1, 1, 5).getValues()[0];
  return String(state[3]) === trainingKey ? state[2] || "existing" : "";
}

function appendAttendance_(attendance) {
  var sheet = getRuntimeSheet_("_Raw_Attendance");
  sheet.appendRow([
    attendance.attendanceId,
    attendance.timestamp,
    attendance.memberId,
    attendance.firstName,
    attendance.lastName,
    attendance.memberCategory,
    attendance.trainingKey,
    attendance.trainingType,
    attendance.trainingName,
    attendance.trainingStart,
    attendance.messageId,
    attendance.source,
    attendance.createdAt,
  ]);
  return sheet.getLastRow();
}

function rollbackAttendance_(rowNumber, attendanceId) {
  var sheet = getRuntimeSheet_("_Raw_Attendance");
  if (rowNumber < 2 || rowNumber > sheet.getLastRow()) {
    throw new Error("Cannot roll back attendance row outside the data range");
  }
  var storedId = String(sheet.getRange(rowNumber, 1).getDisplayValues()[0][0]);
  if (storedId !== String(attendanceId)) {
    throw new Error("Cannot roll back attendance row with a different ID");
  }
  sheet.deleteRow(rowNumber);
}

function upsertCheckinState_(attendance) {
  var sheet = getRuntimeSheet_("_State");
  var rowNumber = findRowByValue_(sheet, 1, attendance.memberId);
  var values = [[attendance.memberId, attendance.timestamp, attendance.attendanceId, attendance.trainingKey, attendance.createdAt]];
  if (rowNumber) {
    sheet.getRange(rowNumber, 1, 1, 5).setValues(values);
  } else {
    sheet.appendRow(values[0]);
  }
}

function selectCheckinMessage_(trainingType, memberCategory) {
  var candidates = readRuntimeRows_("_Messages").filter(function (row) {
    var trainingMatches = !row.TrainingType || String(row.TrainingType).toUpperCase() === String(trainingType).toUpperCase();
    var categoryMatches = !row.Category || String(row.Category).toUpperCase() === String(memberCategory).toUpperCase();
    return isRuntimeActive_(row.Active) && row.Message && trainingMatches && categoryMatches;
  });
  if (candidates.length === 0) {
    return { id: "", text: "" };
  }

  var weighted = [];
  candidates.forEach(function (row) {
    var weight = boundedInteger_(row.Weight, 1, 1, 100);
    for (var count = 0; count < weight; count += 1) {
      weighted.push(row);
    }
  });
  var selected = weighted[Math.floor(Math.random() * weighted.length)];
  return { id: String(selected.MessageID), text: String(selected.Message) };
}

function logCheckinFailure_(action, memberId, error, requestId) {
  try {
    var sheet = getRuntimeSheet_("_Logs");
    sheet.appendRow([
      new Date(),
      "ERROR",
      truncateRuntimeText_(action, 60),
      truncateRuntimeText_(memberId, 64),
      truncateRuntimeText_(error && error.message ? error.message : error, 300),
      truncateRuntimeText_(requestId, 80),
    ]);

    var maximumDataRows = 500;
    var excess = sheet.getLastRow() - 1 - maximumDataRows;
    if (excess > 0) {
      sheet.deleteRows(2, excess);
    }
  } catch (ignored) {
    // Logging must never replace the safe scanner response.
  }
}
