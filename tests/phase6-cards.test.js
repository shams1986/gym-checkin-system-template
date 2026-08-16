const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const appsScript = path.join(root, "apps-script");
const source = fs.readFileSync(path.join(appsScript, "CardService.gs"), "utf8");
assert.doesNotThrow(() => new vm.Script(source, { filename: "CardService.gs" }));

const replacements = [];
const insertedImages = [];
const copiedFiles = [];
const failures = [];
const oldFile = { trashed: false, setTrashed(value) { this.trashed = value; } };
let responseCode = 200;
let existingState = null;
let fileNumber = 0;
let lastQrUrl = "";
let lockAvailable = true;
const scriptProperties = new Map();
let uuidNumber = 0;

function createPresentation() {
  const qrElement = {
    removed: false,
    getPageElementType: () => "SHAPE",
    asShape: () => ({ getText: () => ({ asString: () => "{{QR_CODE}}" }) }),
    getLeft: () => 10,
    getTop: () => 20,
    getWidth: () => 120,
    getHeight: () => 120,
    remove() { this.removed = true; },
  };
  const slide = {
    getPageElements: () => [qrElement],
    insertImage: (blob, left, top, width, height) => insertedImages.push({ blob, left, top, width, height }),
  };
  return {
    replaceAllText: (placeholder, value) => { replacements.push([placeholder, value]); return 1; },
    getSlides: () => [slide],
    saveAndClose() {},
  };
}

const context = {
  Object,
  Array,
  String,
  Number,
  Boolean,
  Math,
  Date,
  RegExp,
  JSON,
  encodeURIComponent,
  isFinite,
  LockService: { getDocumentLock: () => null, getScriptLock: () => ({ tryLock: () => lockAvailable, releaseLock() {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => scriptProperties.get(key) || null, setProperty: (key, value) => scriptProperties.set(key, value), deleteProperty: (key) => scriptProperties.delete(key) }) },
  Utilities: { getUuid: () => `lease-${++uuidNumber}` },
  adminString_: (value, length) => String(value == null ? "" : value).trim().slice(0, length),
  adminPage_: (value, fallback) => Number(value) || fallback,
  adminPageSize_: (value, fallback) => Number(value) || fallback,
  boundedInteger_: (value, fallback, minimum, maximum) => { const parsed = Number(value); return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, Math.round(parsed))) : fallback; },
  normalizeMemberId_: (value) => String(value || "").trim().toUpperCase(),
  isRuntimeActive_: (value) => value === true || String(value).toUpperCase() === "ACTIVE",
  adminError_: (code, message) => { const error = new Error(message); error.adminCode = code; return error; },
  getRuntimeSettings_: () => ({
    Timezone: "Etc/UTC",
    GymName: "Demo Gym",
    ScannerURL: "https://scanner.example.invalid/checkin",
    CardTemplateID: "template_12345",
    CardOutputFolderID: "folder_1234567",
    CardGymNamePlaceholder: "{{GYM_NAME}}",
    CardFirstNamePlaceholder: "{{FIRST_NAME}}",
    CardLastNamePlaceholder: "{{LAST_NAME}}",
    CardMemberIdPlaceholder: "{{MEMBER_ID}}",
    CardQrPlaceholder: "{{QR_CODE}}",
    CardMembershipPlaceholder: "{{MEMBERSHIP}}",
    CardCategoryPlaceholder: "{{CATEGORY}}",
    CardQrValueFormat: "{scannerUrl}?id={memberId}",
    CardFileNameFormat: "{memberId}-{firstName}-{lastName}",
    CardQrImageEndpoint: "https://qr.example.invalid/image?value={value}",
  }),
  findMemberById_: (memberId) => memberId === "GYM0001" ? { _rowNumber: 2, MemberID: memberId, FirstName: "Zoë / Demo", LastName: "O'Example", Status: "Active", Category: "Adult" } : null,
  getCardStateByMemberId_: () => existingState,
  DriveApp: {
    getFileById(id) {
      if (id === "old-file") return oldFile;
      if (id !== "template_12345") throw new Error("Unexpected file ID");
      return {
        getLastUpdated: () => new Date("2026-08-17T10:00:00Z"),
        makeCopy(name) {
          const file = { id: `new-file-${++fileNumber}`, name, trashed: false, getId() { return this.id; }, getUrl() { return `https://drive.example.invalid/${this.id}`; }, setTrashed(value) { this.trashed = value; } };
          copiedFiles.push(file);
          return file;
        },
      };
    },
    getFolderById: (id) => ({ id }),
  },
  SlidesApp: { PageElementType: { SHAPE: "SHAPE" }, openById: () => createPresentation() },
  UrlFetchApp: { fetch: (url) => { lastQrUrl = url; return { getResponseCode: () => responseCode, getBlob: () => ({ getContentType: () => "image/png" }) }; } },
  saveCardGenerationSuccess_: (_member, card) => ({ url: card.url }),
  saveCardGenerationFailure_: (memberId, error) => failures.push({ memberId, message: error.message }),
  formatRuntimeInstant_: (date) => date.toISOString().replace(".000Z", "+00:00"),
  listCardStatesByMember_: () => ({}),
  readRuntimeRows_: () => [],
};
vm.createContext(context);
vm.runInContext(source, context);

assert.equal(context.formatCardTokens_("{scannerUrl}?id={memberId}", { scannerUrl: "https://scanner.invalid/", memberId: "GYM0001" }), "https://scanner.invalid/?id=GYM0001");
assert.equal(context.formatCardFileName_("{memberId}-{firstName}", { memberId: "GYM0001", firstName: "A/B" }), "GYM0001-A-B");
assert.throws(() => context.validateCardFormat_("{unknown}", false), (error) => error.adminCode === "card_not_configured");

const generated = JSON.parse(JSON.stringify(context.generateMemberCard_({ memberId: "gym0001" })));
assert.equal(generated.status, "generated");
assert.equal(copiedFiles[0].name, "GYM0001-Zoë - Demo-O'Example");
assert.match(lastQrUrl, /https%3A%2F%2Fscanner\.example\.invalid%2Fcheckin%3Fid%3DGYM0001/);
assert.equal(insertedImages.length, 1);
assert.ok(replacements.some(([placeholder, value]) => placeholder === "{{CATEGORY}}" && value === "Adult"));
assert.equal(scriptProperties.size, 0, "the per-member lease is released after generation");
const heldLease = context.acquireCardGenerationLease_("GYM0001");
assert.throws(() => context.acquireCardGenerationLease_("GYM0001"), (error) => error.adminCode === "busy");
context.releaseCardGenerationLease_("GYM0001", "wrong-token");
assert.equal(scriptProperties.size, 1, "a stale worker cannot release a newer lease");
context.releaseCardGenerationLease_("GYM0001", heldLease);
assert.equal(scriptProperties.size, 0);
scriptProperties.set("card_generation_lease_GYM0001", JSON.stringify({ token: "abandoned", expiresAt: 1 }));
const recoveredLease = context.acquireCardGenerationLease_("GYM0001");
assert.notEqual(recoveredLease, "abandoned", "an expired lease is recoverable after an interrupted execution");
context.releaseCardGenerationLease_("GYM0001", recoveredLease);

existingState = { CardFileID: "old-file", CardURL: "https://drive.example.invalid/old-file" };
const failureCountBeforeExists = failures.length;
assert.throws(() => context.generateMemberCard_({ memberId: "GYM0001" }), (error) => error.adminCode === "card_exists");
assert.equal(failures.length, failureCountBeforeExists, "an existing-card control response is not recorded as a generation failure");
const copiesBeforeBusy = copiedFiles.length;
lockAvailable = false;
assert.throws(() => context.regenerateMemberCard_({ memberId: "GYM0001" }), (error) => error.adminCode === "busy");
assert.equal(copiedFiles.length, copiesBeforeBusy, "a competing request cannot create a second copy before acquiring the generation lock");
lockAvailable = true;

const regenerated = context.regenerateMemberCard_({ memberId: "GYM0001" });
assert.equal(regenerated.status, "generated");
assert.equal(oldFile.trashed, true, "old card is trashed only after replacement succeeds");

responseCode = 503;
assert.throws(() => context.regenerateMemberCard_({ memberId: "GYM0001" }), (error) => error.adminCode === "card_generation_failed");
assert.equal(copiedFiles.at(-1).trashed, true, "failed copied file is cleaned up");
assert.equal(failures.at(-1).memberId, "GYM0001");

const batchMembers = [
  { MemberID: "GYM0001", Status: "Active" },
  { MemberID: "GYM0002", Status: "Active" },
  { MemberID: "GYM0003", Status: "Inactive" },
];
context.readRuntimeRows_ = (sheet) => sheet === "Members" ? batchMembers : [];
context.generateMemberCardById_ = (memberId) => { if (memberId === "GYM0001") throw context.adminError_("card_generation_failed", "Injected failure"); return { memberId, status: "generated" }; };
const batch = JSON.parse(JSON.stringify(context.generateMissingMemberCards_({ confirm: true })));
assert.equal(batch.total, 2);
assert.equal(batch.succeeded, 1);
assert.equal(batch.failed, 1);
assert.equal(batch.results[1].memberId, "GYM0002", "batch continues after a member failure");
assert.throws(() => context.generateMissingMemberCards_({}), (error) => error.adminCode === "confirmation_required");

const repositorySource = fs.readFileSync(path.join(appsScript, "CardRepository.gs"), "utf8");
const stateRows = [["MemberID", "CardFileID", "CardURL", "GeneratedAt", "TemplateVersion", "LastError"]];
const memberRows = [["MemberID", "FirstName", "LastName", "Email", "Phone", "Category", "Status", "CardURL"], ["GYM0001", "Demo", "Member", "", "", "Adult", "Active", "https://drive.example.invalid/old"]];
let failMemberWrite = false;
function sheetFor(rows, isMember) {
  return {
    getLastRow: () => rows.length,
    appendRow: (values) => rows.push(values.slice()),
    deleteRow: (row) => rows.splice(row - 1, 1),
    getRange(row, column, height, width) {
      return {
        getValues: () => rows.slice(row - 1, row - 1 + (height || 1)).map((values) => values.slice(column - 1, column - 1 + (width || 1))),
        setValues(values) { values.forEach((incoming, offset) => incoming.forEach((value, index) => { rows[row - 1 + offset][column - 1 + index] = value; })); },
        setValue(value) { if (isMember && failMemberWrite) throw new Error("injected member write provider detail"); rows[row - 1][column - 1] = value; },
      };
    },
  };
}
const repositoryContext = {
  String,
  console: { error() {} },
  LockService: { getDocumentLock: () => null, getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  adminError_: context.adminError_,
  normalizeMemberId_: context.normalizeMemberId_,
  truncateRuntimeText_: (value, maximum) => String(value).slice(0, maximum),
  adminInstantText_: (value) => value ? String(value) : "",
  getRuntimeSheet_: (name) => sheetFor(name === "Members" ? memberRows : stateRows, name === "Members"),
  readRuntimeRows_: () => stateRows.slice(1).map((row, index) => ({ MemberID: row[0], CardFileID: row[1], CardURL: row[2], GeneratedAt: row[3], TemplateVersion: row[4], LastError: row[5], _rowNumber: index + 2 })),
  findRuntimeRowByKey_: (_sheet, _key, memberId) => {
    const index = stateRows.findIndex((row, rowIndex) => rowIndex > 0 && row[0] === memberId);
    return index < 0 ? null : { MemberID: stateRows[index][0], CardFileID: stateRows[index][1], CardURL: stateRows[index][2], GeneratedAt: stateRows[index][3], TemplateVersion: stateRows[index][4], LastError: stateRows[index][5], _rowNumber: index + 1 };
  },
};
vm.createContext(repositoryContext);
vm.runInContext(repositorySource, repositoryContext);
repositoryContext.saveCardGenerationSuccess_({ memberId: "GYM0001", _rowNumber: 2 }, { fileId: "file-1", url: "https://drive.example.invalid/file-1", generatedAt: "now", templateVersion: "v1" });
assert.equal(stateRows[1][2], "https://drive.example.invalid/file-1");
assert.equal(memberRows[1][7], "https://drive.example.invalid/file-1");
repositoryContext.saveCardGenerationFailure_("GYM0001", new Error("secret provider file id 123"));
assert.equal(stateRows[1][2], "https://drive.example.invalid/file-1", "a regeneration failure preserves the last valid link");
assert.doesNotMatch(stateRows[1][5], /secret|123/, "raw provider errors are not persisted");
const previousState = stateRows[1].slice();
failMemberWrite = true;
assert.throws(() => repositoryContext.saveCardGenerationSuccess_({ memberId: "GYM0001", _rowNumber: 2 }, { fileId: "file-2", url: "https://drive.example.invalid/file-2", generatedAt: "later", templateVersion: "v2" }));
assert.deepEqual(stateRows[1], previousState, "state rolls back when the member link cannot be updated");
assert.doesNotMatch(repositoryContext.serializeAdminCard_({ CardURL: "", LastError: "legacy raw provider secret", GeneratedAt: "" }, "Etc/UTC").lastError, /legacy|secret/);

const adminClient = fs.readFileSync(path.join(appsScript, "Admin.js.html"), "utf8");
const adminHtml = fs.readFileSync(path.join(appsScript, "Admin.html"), "utf8");
const cardDocs = fs.readFileSync(path.join(root, "docs", "CARD_TEMPLATE.md"), "utf8");
for (const expected of ["QR Cards", "generateMemberCard", "regenerateMemberCard", "generateMissingMemberCards", "Save and generate card", "Open / download"]) assert.match(`${adminHtml}\n${adminClient}`, new RegExp(expected));
for (const placeholder of ["{{GYM_NAME}}", "{{FIRST_NAME}}", "{{LAST_NAME}}", "{{MEMBER_ID}}", "{{QR_CODE}}", "{{MEMBERSHIP}}", "{{CATEGORY}}"]) assert.ok(cardDocs.includes(placeholder));

console.log("Phase 6 card generation, regeneration, batch isolation, and admin contract checks passed.");
