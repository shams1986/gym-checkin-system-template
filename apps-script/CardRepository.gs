function getCardStateByMemberId_(memberId) {
  return findRuntimeRowByKey_("_Card_State", "MemberID", memberId);
}

function listCardStatesByMember_() {
  var states = {};
  readRuntimeRows_("_Card_State").forEach(function (row) {
    states[normalizeMemberId_(row.MemberID)] = row;
  });
  return states;
}

function saveCardGenerationSuccess_(member, card, lockHeld) {
  var lock = lockHeld ? null : LockService.getScriptLock();
  if (lock && !lock.tryLock(10000)) throw adminError_("busy", "Card state is busy. Please try again.");
  try {
    var stateSheet = getRuntimeSheet_("_Card_State");
    var memberSheet = getRuntimeSheet_("Members");
    var previousState = getCardStateByMemberId_(member.memberId);
    var previousStateValues = previousState ? stateSheet.getRange(previousState._rowNumber, 1, 1, 6).getValues()[0] : null;
    var stateValues = [member.memberId, card.fileId, card.url, card.generatedAt, card.templateVersion, ""];
    var stateRow = previousState ? previousState._rowNumber : stateSheet.getLastRow() + 1;
    if (previousState) stateSheet.getRange(stateRow, 1, 1, 6).setValues([stateValues]); else stateSheet.appendRow(stateValues);
    try {
      memberSheet.getRange(member._rowNumber, 8).setValue(card.url);
    } catch (error) {
      if (previousStateValues) stateSheet.getRange(stateRow, 1, 1, 6).setValues([previousStateValues]); else stateSheet.deleteRow(stateRow);
      throw error;
    }
    return serializeCardStateValues_(stateValues);
  } finally {
    if (lock) lock.releaseLock();
  }
}

function saveCardGenerationFailure_(memberId, error, lockHeld) {
  var lock = lockHeld ? null : LockService.getScriptLock();
  if (lock && !lock.tryLock(10000)) return null;
  try {
    var sheet = getRuntimeSheet_("_Card_State");
    var existing = getCardStateByMemberId_(memberId);
    var values = existing ? sheet.getRange(existing._rowNumber, 1, 1, 6).getValues()[0] : [memberId, "", "", "", "", ""];
    values[5] = safeCardGenerationError_(error);
    if (existing) sheet.getRange(existing._rowNumber, 1, 1, 6).setValues([values]); else sheet.appendRow(values);
    return serializeCardStateValues_(values);
  } finally {
    if (lock) lock.releaseLock();
  }
}

function safeCardGenerationError_(error) {
  if (error && error.adminCode) return truncateRuntimeText_(String(error.adminCode) + ": " + String(error.message || "Card generation failed."), 300);
  console.error("Card generation provider failure", error);
  return "card_generation_failed: Card generation failed. Check the card configuration and permissions.";
}

function serializeCardStateValues_(values) {
  return { memberId: String(values[0]), fileId: String(values[1] || ""), url: String(values[2] || ""), generatedAt: values[3] || "", templateVersion: String(values[4] || ""), lastError: String(values[5] || "") };
}

function serializeAdminCard_(row, timezone) {
  if (!row) return { status: "missing", url: "", generatedAt: "", lastError: "" };
  var url = String(row.CardURL || "");
  var rawError = String(row.LastError || "");
  var error = /^(card_[a-z_]+|busy): /.test(rawError) ? rawError : (rawError ? "card_generation_failed: Card generation failed. Check the card configuration and permissions." : "");
  return { status: error ? (url ? "generated_with_error" : "failed") : (url ? "generated" : "missing"), url: url, generatedAt: adminInstantText_(row.GeneratedAt, timezone), lastError: error };
}
