const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class MockRange {
  constructor(sheet, row, column, rowCount = 1, columnCount = 1) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.rowCount = rowCount;
    this.columnCount = columnCount;
  }

  getDisplayValues() {
    return this.getValues().map((row) => row.map((value) => value == null ? "" : String(value)));
  }

  getValues() {
    return Array.from({ length: this.rowCount }, (_, rowOffset) =>
      Array.from({ length: this.columnCount }, (_, columnOffset) =>
        this.sheet.getCell(this.row + rowOffset, this.column + columnOffset).value,
      ),
    );
  }

  getFormulas() {
    return Array.from({ length: this.rowCount }, (_, rowOffset) =>
      Array.from({ length: this.columnCount }, (_, columnOffset) =>
        this.sheet.getCell(this.row + rowOffset, this.column + columnOffset).formula,
      ),
    );
  }

  setValues(values) {
    values.forEach((row, rowOffset) => row.forEach((value, columnOffset) => {
      this.sheet.getCell(this.row + rowOffset, this.column + columnOffset).value = value;
    }));
    return this;
  }

  getValue() { return this.sheet.getCell(this.row, this.column).value; }
  setValue(value) { this.sheet.getCell(this.row, this.column).value = value; return this; }
  getDisplayValue() { const value = this.getValue(); return value == null ? "" : String(value); }
  getFormula() { return this.sheet.getCell(this.row, this.column).formula; }
  setFormula(formula) { this.sheet.getCell(this.row, this.column).formula = formula; return this; }
  setFontWeight() { return this; }
  setBackground() { return this; }
  setWrap() { return this; }
  setDataValidation(rule) { this.validation = rule; return this; }
  setNumberFormat(format) { this.numberFormat = format; return this; }
}

class MockProtection {
  constructor() {
    this.description = "";
    this.editors = [];
    this.domainEdit = true;
  }

  setDescription(value) { this.description = value; return this; }
  getDescription() { return this.description; }
  setWarningOnly() { return this; }
  addEditor(email) {
    if (!this.editors.some((editor) => editor.getEmail() === email)) {
      this.editors.push({ getEmail: () => email });
    }
    return this;
  }
  getEditors() { return this.editors.slice(); }
  removeEditors(editors) { this.editors = this.editors.filter((editor) => !editors.includes(editor)); }
  canDomainEdit() { return this.domainEdit; }
  setDomainEdit(value) { this.domainEdit = value; return this; }
}

class MockSheet {
  constructor(name, id) {
    this.name = name;
    this.id = id;
    this.cells = new Map();
    this.maxRows = 1000;
    this.maxColumns = 26;
    this.hidden = false;
    this.protections = [];
  }

  key(row, column) { return `${row},${column}`; }
  getCell(row, column) {
    const key = this.key(row, column);
    if (!this.cells.has(key)) this.cells.set(key, { value: "", formula: "" });
    return this.cells.get(key);
  }
  getName() { return this.name; }
  getSheetId() { return this.id; }
  getMaxRows() { return this.maxRows; }
  getMaxColumns() { return this.maxColumns; }
  insertColumnsAfter(after, count) { this.maxColumns = Math.max(this.maxColumns, after + count); }
  getLastRow() {
    let last = 0;
    for (const [key, cell] of this.cells) {
      if (cell.value !== "" || cell.formula !== "") last = Math.max(last, Number(key.split(",")[0]));
    }
    return last;
  }
  getLastColumn() {
    let last = 0;
    for (const [key, cell] of this.cells) {
      if (cell.value !== "" || cell.formula !== "") last = Math.max(last, Number(key.split(",")[1]));
    }
    return last;
  }
  getRange(rowOrA1, column, rowCount, columnCount) {
    if (typeof rowOrA1 === "string") {
      const match = /^([A-Z]+)(\d+)(?::[A-Z]+)?$/.exec(rowOrA1);
      if (!match) throw new Error(`Unsupported mock range: ${rowOrA1}`);
      const parsedColumn = match[1].split("").reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0);
      const parsedRow = Number(match[2]);
      return new MockRange(this, parsedRow, parsedColumn, rowOrA1.includes(":") ? this.maxRows - parsedRow + 1 : 1, 1);
    }
    return new MockRange(this, rowOrA1, column, rowCount || 1, columnCount || 1);
  }
  appendRow(row) { this.getRange(this.getLastRow() + 1, 1, 1, row.length).setValues([row]); }
  setFrozenRows() { return this; }
  getProtections() { return this.protections.slice(); }
  protect() { const protection = new MockProtection(); this.protections.push(protection); return protection; }
  hideSheet() { this.hidden = true; }
  showSheet() { this.hidden = false; }
}

class MockSpreadsheet {
  constructor(timezone = "Europe/Vienna") {
    this.timezone = timezone;
    this.sheets = new Map();
  }
  getSheetByName(name) { return this.sheets.get(name) || null; }
  insertSheet(name) { const sheet = new MockSheet(name, this.sheets.size); this.sheets.set(name, sheet); return sheet; }
  getSheets() { return Array.from(this.sheets.values()); }
  deleteSheet(sheet) { this.sheets.delete(sheet.getName()); }
  getSpreadsheetTimeZone() { return this.timezone; }
  setSpreadsheetTimeZone(value) { this.timezone = value; }
}

class MockValidationBuilder {
  requireValueInList() { return this; }
  requireCheckbox() { return this; }
  requireValueInRange() { return this; }
  requireNumberGreaterThanOrEqualTo() { return this; }
  requireNumberGreaterThan() { return this; }
  setAllowInvalid() { return this; }
  build() { return {}; }
}

function createContext(spreadsheet) {
  const lock = { waitLock() {}, releaseLock() {} };
  return {
    console,
    Date,
    Object,
    Boolean,
    SpreadsheetApp: {
      ProtectionType: { SHEET: "SHEET" },
      getActiveSpreadsheet: () => spreadsheet,
      newDataValidation: () => new MockValidationBuilder(),
    },
    LockService: { getDocumentLock: () => lock },
    Session: { getEffectiveUser: () => ({ getEmail: () => "owner@example.invalid" }) },
    Utilities: {
      getUuid: () => "00000000-0000-4000-8000-000000000001",
      formatDate: (_date, timezone) => new Intl.DateTimeFormat("en", { timeZone: timezone }).format(_date),
    },
  };
}

const root = path.resolve(__dirname, "..");
const source = ["Schema.gs", "SheetRepository.gs", "Setup.gs", "DemoData.gs"]
  .map((file) => fs.readFileSync(path.join(root, "apps-script", file), "utf8"))
  .join("\n");

const spreadsheet = new MockSpreadsheet();
const context = createContext(spreadsheet);
vm.createContext(context);
vm.runInContext(source, context);

const first = context.setupTemplate_();
assert.equal(first.createdSheets.length, 12);
assert.equal(first.attendanceProjection, "protected_array_formula");
const installationId = spreadsheet.getSheetByName("_Internal_Config").getRange(3, 2).getValue();

const second = context.setupTemplate_();
assert.equal(second.createdSheets.length, 0);
assert.equal(spreadsheet.getSheetByName("_Internal_Config").getRange(3, 2).getValue(), installationId);
assert.match(spreadsheet.getSheetByName("Attendance").getRange("A2").getFormula(), /ARRAYFORMULA/);
assert.equal(spreadsheet.getSheetByName("_Raw_Attendance").hidden, true);
assert.equal(spreadsheet.getSheetByName("Members").protections.length, 1);

spreadsheet.getSheetByName("Schedule").getRange(2, 2, 999, 1).setValues(Array.from({ length: 999 }, () => [false]));
spreadsheet.getSheetByName("Training_Types").getRange(2, 3, 999, 1).setValues(Array.from({ length: 999 }, () => [false]));
spreadsheet.getSheetByName("_Messages").getRange(2, 2, 999, 1).setValues(Array.from({ length: 999 }, () => [false]));
spreadsheet.getSheetByName("Schedule").getRange(2, 7).setValue("Owner note without a schedule ID");
spreadsheet.getSheetByName("Schedule").getRange(3, 7).setFormula('=""');
spreadsheet.getSheetByName("Schedule").maxRows = 1001;
spreadsheet.getSheetByName("Training_Types").maxRows = 1001;
spreadsheet.getSheetByName("_Messages").maxRows = 1001;
spreadsheet.getSheetByName("Schedule").getRange(1001, 1, 1, 8).setValues([["DEMO_MON_1800", true, "MONDAY", "18:00", "19:00", "DEMO_STRENGTH", "Demo Evening Strength", "ALL"]]);
spreadsheet.getSheetByName("Training_Types").getRange(1001, 1, 1, 4).setValues([["DEMO_STRENGTH", "Demo Strength", true, 10]]);
spreadsheet.getSheetByName("_Messages").getRange(1001, 1, 1, 6).setValues([["DEMO_WELCOME", true, "Have a great demo session!", "DEMO_STRENGTH", "", 1]]);

context.loadDemoData_();
context.loadDemoData_();
assert.equal(spreadsheet.getSheetByName("Members").getLastRow(), 2);
assert.equal(spreadsheet.getSheetByName("Schedule").getRange(2, 7).getValue(), "Owner note without a schedule ID");
assert.equal(spreadsheet.getSheetByName("Schedule").getRange(3, 7).getFormula(), '=""');
assert.equal(spreadsheet.getSheetByName("Schedule").getRange(4, 1).getValue(), "DEMO_MON_1800");
assert.equal(spreadsheet.getSheetByName("Training_Types").getRange(2, 1).getValue(), "DEMO_STRENGTH");
assert.equal(spreadsheet.getSheetByName("_Messages").getRange(2, 1).getValue(), "DEMO_WELCOME");
assert.equal(spreadsheet.getSheetByName("Schedule").getRange(1001, 1).getValue(), "");
assert.equal(spreadsheet.getSheetByName("Training_Types").getRange(1001, 1).getValue(), "");
assert.equal(spreadsheet.getSheetByName("_Messages").getRange(1001, 1).getValue(), "");
assert.equal(context.runTemplateSetup().syntheticDataOnly, true);

spreadsheet.getSheetByName("Attendance").getRange("A2").setFormula(context.LEGACY_ATTENDANCE_PROJECTION_FORMULA);
context.setupTemplate_();
assert.equal(spreadsheet.getSheetByName("Attendance").getRange("A2").getFormula(), context.ATTENDANCE_PROJECTION_FORMULA);

const defaultSpreadsheet = new MockSpreadsheet();
defaultSpreadsheet.insertSheet("Tabellenblatt1");
const defaultContext = createContext(defaultSpreadsheet);
vm.createContext(defaultContext);
vm.runInContext(source, defaultContext);
assert.equal(defaultContext.setupTemplate_().removedDefaultSheet, "Tabellenblatt1");
assert.equal(defaultSpreadsheet.getSheetByName("Tabellenblatt1"), null);

const webContext = createContext(null);
vm.createContext(webContext);
vm.runInContext(source, webContext);
assert.throws(() => webContext.runTemplateSetup(), /must run manually from this spreadsheet-bound Apps Script editor/);

spreadsheet.getSheetByName("Members").getRange(1, 4).setValue("WrongStatusHeader");
assert.throws(() => context.setupTemplate_(), /Schema mismatch/);
assert.equal(spreadsheet.getSheetByName("Members").getRange(1, 4).getValue(), "WrongStatusHeader");

const invalidSpreadsheet = new MockSpreadsheet();
const invalidContext = createContext(invalidSpreadsheet);
vm.createContext(invalidContext);
vm.runInContext(source, invalidContext);
assert.throws(() => invalidContext.setupTemplate_({ timezone: "Not/A_Timezone" }), /Invalid IANA timezone/);
assert.equal(invalidSpreadsheet.sheets.size, 0);

console.log("Phase 2 setup idempotence checks passed.");
