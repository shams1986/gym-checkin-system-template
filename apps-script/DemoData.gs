// Manual editor entry point. The active-spreadsheet guard keeps this unavailable
// to web-app and Apps Script API execution, which have no active bound container.
function runTemplateSetup() {
  if (!SpreadsheetApp.getActiveSpreadsheet()) {
    throw new Error("runTemplateSetup() must run manually from this spreadsheet-bound Apps Script editor.");
  }
  return loadDemoData_();
}

function loadDemoData_() {
  setupTemplate_();

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var trainingTypes = spreadsheet.getSheetByName("Training_Types");
  var members = spreadsheet.getSheetByName("Members");
  var schedule = spreadsheet.getSheetByName("Schedule");
  var messages = spreadsheet.getSheetByName("_Messages");

  appendDemoRowIfMissing_(trainingTypes, 1, "DEMO_STRENGTH", ["DEMO_STRENGTH", "Demo Strength", true, 10]);
  appendDemoRowIfMissing_(members, 1, "DEMO0001", ["DEMO0001", "Jamie", "Example", "Active", "ALL", new Date("2026-01-01T00:00:00Z"), "Synthetic demo member", ""]);
  appendDemoRowIfMissing_(schedule, 1, "DEMO_MON_1800", ["DEMO_MON_1800", true, "MONDAY", timeOfDay_(18, 0), timeOfDay_(19, 0), "DEMO_STRENGTH", "Demo Evening Strength", "ALL"]);
  appendDemoRowIfMissing_(messages, 1, "DEMO_WELCOME", ["DEMO_WELCOME", true, "Have a great demo session!", "DEMO_STRENGTH", "", 1]);

  return {
    memberId: "DEMO0001",
    scheduleId: "DEMO_MON_1800",
    trainingType: "DEMO_STRENGTH",
    syntheticDataOnly: true,
  };
}

function appendDemoRowIfMissing_(sheet, keyColumn, key, row) {
  var existingRow = findRowByValue_(sheet, keyColumn, key);
  var targetRow = 0;
  var candidateCount = Math.max(0, sheet.getMaxRows() - 1);
  var candidateRange = candidateCount ? sheet.getRange(2, 1, candidateCount, row.length) : null;
  var candidates = candidateRange ? candidateRange.getValues() : [];
  var candidateFormulas = candidateRange ? candidateRange.getFormulas() : [];
  for (var candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
    var values = candidates[candidateIndex];
    var safe = values.every(function (value, index) {
      return !candidateFormulas[candidateIndex][index] &&
        (value === "" || value === null || (value === false && typeof row[index] === "boolean"));
    });
    if (safe) { targetRow = candidateIndex + 2; break; }
  }
  if (existingRow && (!targetRow || existingRow <= targetRow)) return;
  if (!targetRow) { sheet.appendRow(row); return; }
  sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
  if (existingRow && existingRow !== targetRow) {
    sheet.getRange(existingRow, 1, 1, row.length).setValues([row.map(function () { return ""; })]);
  }
}

function timeOfDay_(hours, minutes) {
  return new Date(1899, 11, 30, hours, minutes, 0, 0);
}
