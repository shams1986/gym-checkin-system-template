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
  constructor(name) {
    this.name = name;
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
  insertSheet(name) { const sheet = new MockSheet(name); this.sheets.set(name, sheet); return sheet; }
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

const first = context.setupTemplate();
assert.equal(first.createdSheets.length, 12);
assert.equal(first.attendanceProjection, "protected_array_formula");
const installationId = spreadsheet.getSheetByName("_Internal_Config").getRange(3, 2).getValue();

const second = context.setupTemplate();
assert.equal(second.createdSheets.length, 0);
assert.equal(spreadsheet.getSheetByName("_Internal_Config").getRange(3, 2).getValue(), installationId);
assert.match(spreadsheet.getSheetByName("Attendance").getRange("A2").getFormula(), /ARRAYFORMULA/);
assert.equal(spreadsheet.getSheetByName("_Raw_Attendance").hidden, true);
assert.equal(spreadsheet.getSheetByName("Members").protections.length, 1);

context.loadDemoData();
context.loadDemoData();
assert.equal(spreadsheet.getSheetByName("Members").getLastRow(), 2);
assert.equal(spreadsheet.getSheetByName("Schedule").getLastRow(), 2);
assert.equal(spreadsheet.getSheetByName("Training_Types").getLastRow(), 2);
assert.equal(spreadsheet.getSheetByName("_Messages").getLastRow(), 2);

spreadsheet.getSheetByName("Members").getRange(1, 4).setValue("WrongStatusHeader");
assert.throws(() => context.setupTemplate(), /Schema mismatch/);
assert.equal(spreadsheet.getSheetByName("Members").getRange(1, 4).getValue(), "WrongStatusHeader");

const invalidSpreadsheet = new MockSpreadsheet();
const invalidContext = createContext(invalidSpreadsheet);
vm.createContext(invalidContext);
vm.runInContext(source, invalidContext);
assert.throws(() => invalidContext.setupTemplate({ timezone: "Not/A_Timezone" }), /Invalid IANA timezone/);
assert.equal(invalidSpreadsheet.sheets.size, 0);

console.log("Phase 2 setup idempotence checks passed.");
