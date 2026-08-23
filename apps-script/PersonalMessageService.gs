var PERSONAL_MESSAGE_SHEET = "_Personal_Messages";
var PERSONAL_MESSAGE_HEADERS = Object.freeze(["MessageID", "MemberID", "Active", "Message", "CreatedAt", "UsedAt", "UpdatedAt"]);

function listPersonalMessages_(payload) {
  payload = payload || {};
  var status = adminString_(payload.status || "ACTIVE", 20).toUpperCase();
  var members = {};
  readRuntimeRows_("Members").forEach(function (member) {
    members[normalizeMemberId_(member.MemberID)] = String(member.FirstName || "") + " " + String(member.LastName || "");
  });
  var rows = readPersonalMessageRows_(true).filter(function (row) {
    return status === "ALL" || (isRuntimeActive_(row.Active) ? "ACTIVE" : "INACTIVE") === status;
  }).sort(function (left, right) {
    return Number(isRuntimeActive_(right.Active)) - Number(isRuntimeActive_(left.Active)) || new Date(right.UpdatedAt || right.CreatedAt).getTime() - new Date(left.UpdatedAt || left.CreatedAt).getTime();
  });
  return { items: rows.map(function (row) { return serializePersonalMessage_(row, members); }), status: status };
}

function searchMembersForMessage_(payload) {
  var query = adminString_(payload && payload.query, 100).toUpperCase();
  if (!query) return { items: [] };
  var items = readRuntimeRows_("Members").filter(function (member) {
    var text = [member.MemberID, member.FirstName, member.LastName, String(member.FirstName || "") + " " + String(member.LastName || "")].join(" ").toUpperCase();
    return text.indexOf(query) !== -1;
  }).slice(0, 10).map(function (member) {
    var memberId = normalizeMemberId_(member.MemberID);
    return { memberId: memberId, firstName: String(member.FirstName || ""), lastName: String(member.LastName || ""), label: memberId + " — " + String(member.FirstName || "") + " " + String(member.LastName || "") };
  });
  return { items: items };
}

function savePersonalMessage_(payload) {
  payload = payload || {};
  var messageId = adminString_(payload.messageId, 80);
  var memberId = normalizeMemberId_(payload.memberId);
  var message = adminString_(payload.message, 240);
  var active = adminBoolean_(payload.active, true);
  var fields = {};
  if (!memberId || !findMemberById_(memberId)) fields.memberId = "Choose a member from the search results.";
  if (!message) fields.message = "Message text is required.";
  if (Object.keys(fields).length) throw adminError_("validation_error", "Check the highlighted fields.", fields);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw adminError_("busy", "Personal messages are busy. Please try again.");
  try {
    var sheet = getPersonalMessagesSheet_(true);
    var existing = messageId ? findPersonalMessageById_(messageId) : null;
    if (messageId && !existing) throw adminError_("personal_message_not_found", "Personal message not found.");
    var now = new Date();
    var usedAt = existing && !active ? existing.UsedAt : "";
    var values = [messageId || "PM-" + Utilities.getUuid().replace(/-/g, "").slice(0, 12).toUpperCase(), memberId, active, message, existing ? existing.CreatedAt : now, usedAt, now];
    if (existing) sheet.getRange(existing._rowNumber, 1, 1, values.length).setValues([values]); else sheet.appendRow(values);
    return serializePersonalMessage_({ MessageID: values[0], MemberID: memberId, Active: active, Message: message, CreatedAt: values[4], UsedAt: usedAt, UpdatedAt: now }, (function () { var names = {}; var member = findMemberById_(memberId); names[memberId] = String(member.FirstName || "") + " " + String(member.LastName || ""); return names; })());
  } finally { lock.releaseLock(); }
}

function deactivatePersonalMessage_(payload) {
  var messageId = adminString_(payload && payload.messageId, 80);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw adminError_("busy", "Personal messages are busy. Please try again.");
  try {
    var existing = findPersonalMessageById_(messageId);
    if (!existing) throw adminError_("personal_message_not_found", "Personal message not found.");
    var sheet = getPersonalMessagesSheet_(false);
    sheet.getRange(existing._rowNumber, 3).setValue(false);
    sheet.getRange(existing._rowNumber, 7).setValue(new Date());
    return { messageId: messageId, active: false };
  } finally { lock.releaseLock(); }
}

function findActivePersonalMessage_(memberId) {
  var normalizedId = normalizeMemberId_(memberId);
  var rows = readPersonalMessageRows_(false);
  for (var index = 0; index < rows.length; index += 1) {
    if (normalizeMemberId_(rows[index].MemberID) === normalizedId && isRuntimeActive_(rows[index].Active)) return rows[index];
  }
  return null;
}

function consumePersonalMessage_(message, usedAt) {
  if (!message) return;
  var sheet = getPersonalMessagesSheet_(false);
  sheet.getRange(message._rowNumber, 3).setValue(false);
  sheet.getRange(message._rowNumber, 6).setValue(usedAt);
  sheet.getRange(message._rowNumber, 7).setValue(usedAt);
}

function restorePersonalMessage_(message) {
  if (!message) return;
  var sheet = getPersonalMessagesSheet_(false);
  sheet.getRange(message._rowNumber, 3).setValue(true);
  sheet.getRange(message._rowNumber, 6).setValue(message.UsedAt || "");
  sheet.getRange(message._rowNumber, 7).setValue(message.UpdatedAt || message.CreatedAt || "");
}

function readPersonalMessageRows_(create) {
  var sheet = getPersonalMessagesSheet_(create);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, PERSONAL_MESSAGE_HEADERS.length).getValues().map(function (values, index) {
    var row = { _rowNumber: index + 2 };
    PERSONAL_MESSAGE_HEADERS.forEach(function (header, column) { row[header] = values[column]; });
    return row;
  }).filter(function (row) { return String(row.MessageID || "").trim(); });
}

function findPersonalMessageById_(messageId) {
  var rows = readPersonalMessageRows_(false);
  for (var index = 0; index < rows.length; index += 1) if (String(rows[index].MessageID) === String(messageId)) return rows[index];
  return null;
}

function getPersonalMessagesSheet_(create) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(PERSONAL_MESSAGE_SHEET);
  if (!sheet && create) {
    sheet = spreadsheet.insertSheet(PERSONAL_MESSAGE_SHEET);
    sheet.getRange(1, 1, 1, PERSONAL_MESSAGE_HEADERS.length).setValues([PERSONAL_MESSAGE_HEADERS.slice()]).setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.hideSheet();
  }
  if (!sheet) return null;
  var headers = sheet.getRange(1, 1, 1, PERSONAL_MESSAGE_HEADERS.length).getDisplayValues()[0];
  if (headers.join("|") !== PERSONAL_MESSAGE_HEADERS.join("|")) throw new Error("Personal message sheet schema mismatch.");
  return sheet;
}

function serializePersonalMessage_(row, memberNames) {
  var timezone = getRuntimeSettings_().Timezone;
  var memberId = normalizeMemberId_(row.MemberID);
  return { messageId: String(row.MessageID), memberId: memberId, memberName: String(memberNames[memberId] || ""), message: String(row.Message || ""), active: isRuntimeActive_(row.Active), usedAt: adminInstantText_(row.UsedAt, timezone) };
}
