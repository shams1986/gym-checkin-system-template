var CARD_FORMAT_TOKENS = Object.freeze(["memberId", "firstName", "lastName", "category", "membership", "gymName", "scannerUrl"]);

function listMemberCards_(filters) {
  filters = filters || {};
  var settings = getRuntimeSettings_();
  var timezone = settings.Timezone;
  var query = adminString_(filters.query, 100).toUpperCase();
  var memberStatus = adminString_(filters.memberStatus || "Active", 20).toUpperCase();
  var cardStatus = adminString_(filters.cardStatus || "All", 40).toLowerCase();
  var states = listCardStatesByMember_();
  var items = readRuntimeRows_("Members").map(function (member) {
    var memberId = normalizeMemberId_(member.MemberID);
    var card = serializeAdminCard_(states[memberId], timezone);
    return { memberId: memberId, firstName: String(member.FirstName || ""), lastName: String(member.LastName || ""), memberStatus: String(member.Status || ""), category: String(member.Category || ""), card: card };
  }).filter(function (item) {
    var textMatches = !query || [item.memberId, item.firstName, item.lastName].join(" ").toUpperCase().indexOf(query) !== -1;
    var memberMatches = memberStatus === "ALL" || item.memberStatus.toUpperCase() === memberStatus;
    var cardMatches = cardStatus === "all" || item.card.status === cardStatus || (cardStatus === "generated" && item.card.status === "generated_with_error");
    return textMatches && memberMatches && cardMatches;
  });
  items.sort(function (left, right) { return (left.lastName + left.firstName + left.memberId).localeCompare(right.lastName + right.firstName + right.memberId); });
  var page = adminPage_(filters.page, 1);
  var pageSize = adminPageSize_(filters.pageSize, 25);
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page: page, pageSize: pageSize };
}

function generateMemberCard_(payload) {
  return generateMemberCardById_(payload.memberId, false);
}

function regenerateMemberCard_(payload) {
  return generateMemberCardById_(payload.memberId, true);
}

function generateMissingMemberCards_(options) {
  options = options || {};
  if (options.confirm !== true) throw adminError_("confirmation_required", "Confirm batch card generation before continuing.");
  var includeInactive = options.includeInactive === true;
  var regenerateExisting = options.regenerateExisting === true;
  var maximum = boundedInteger_(options.maximum, 25, 1, 50);
  var states = listCardStatesByMember_();
  var members = readRuntimeRows_("Members").filter(function (member) {
    if (!includeInactive && !isRuntimeActive_(member.Status)) return false;
    var state = states[normalizeMemberId_(member.MemberID)];
    return regenerateExisting || !state || !state.CardURL;
  });
  var remaining = Math.max(0, members.length - maximum);
  var results = members.slice(0, maximum).map(function (member) {
    var memberId = normalizeMemberId_(member.MemberID);
    try {
      var card = generateMemberCardById_(memberId, Boolean(states[memberId] && states[memberId].CardURL));
      return { memberId: memberId, ok: true, card: card, error: null };
    } catch (error) {
      return { memberId: memberId, ok: false, card: null, error: { code: error.adminCode || "card_generation_failed", message: error.adminCode ? error.message : "Card generation failed." } };
    }
  });
  return { total: results.length, succeeded: results.filter(function (result) { return result.ok; }).length, failed: results.filter(function (result) { return !result.ok; }).length, remaining: remaining, results: results };
}

function generateMemberCardById_(memberIdValue, regenerate) {
  var memberId = normalizeMemberId_(memberIdValue);
  var member = findMemberById_(memberId);
  if (!member) throw adminError_("member_not_found", "Member not found.");
  var leaseToken = acquireCardGenerationLease_(memberId);
  try {
    var config = getCardConfiguration_();
    var existing = getCardStateByMemberId_(memberId);
    if (!regenerate && existing && existing.CardURL) throw adminError_("card_exists", "A card already exists. Use regenerate instead.");
    return createMemberCard_(member, config, existing, regenerate);
  } finally {
    releaseCardGenerationLease_(memberId, leaseToken);
  }
}

function acquireCardGenerationLease_(memberId) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw adminError_("busy", "Card generation is busy. Please try again.");
  try {
    var properties = PropertiesService.getScriptProperties();
    var key = "card_generation_lease_" + memberId;
    var now = Date.now();
    var current = properties.getProperty(key);
    if (current) {
      try {
        var parsed = JSON.parse(current);
        if (Number(parsed.expiresAt) > now) throw adminError_("busy", "A card operation is already running for this member.");
      } catch (error) {
        if (error.adminCode) throw error;
      }
    }
    var token = Utilities.getUuid();
    properties.setProperty(key, JSON.stringify({ token: token, expiresAt: now + (7 * 60 * 1000) }));
    return token;
  } finally {
    lock.releaseLock();
  }
}

function releaseCardGenerationLease_(memberId, token) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    var properties = PropertiesService.getScriptProperties();
    var key = "card_generation_lease_" + memberId;
    var current = properties.getProperty(key);
    if (!current) return;
    try {
      if (JSON.parse(current).token === token) properties.deleteProperty(key);
    } catch (ignored) { /* A malformed or newer lease is left for expiry recovery. */ }
  } finally {
    lock.releaseLock();
  }
}

function createMemberCard_(member, config, existing, regenerate) {
  var memberId = normalizeMemberId_(member.MemberID);
  var copiedFile = null;
  try {
    var values = cardTemplateValues_(member, config);
    var templateFile = DriveApp.getFileById(config.templateId);
    var outputFolder = DriveApp.getFolderById(config.outputFolderId);
    copiedFile = templateFile.makeCopy(formatCardFileName_(config.fileNameFormat, values), outputFolder);
    var presentation = SlidesApp.openById(copiedFile.getId());
    replaceCardText_(presentation, config, values);
    replaceCardQrPlaceholder_(presentation, config.qrPlaceholder, fetchCardQrBlob_(config.qrImageEndpoint, formatCardTokens_(config.qrValueFormat, values)));
    presentation.saveAndClose();
    var generatedAt = new Date();
    var generatedAtText = formatRuntimeInstant_(generatedAt, config.timezone);
    var card = saveCardGenerationSuccess_({ memberId: memberId, _rowNumber: member._rowNumber }, { fileId: copiedFile.getId(), url: copiedFile.getUrl(), generatedAt: generatedAt, templateVersion: config.templateId + "@" + templateFile.getLastUpdated().toISOString() }, true);
    if (regenerate && existing && existing.CardFileID && String(existing.CardFileID) !== copiedFile.getId()) {
      try { DriveApp.getFileById(String(existing.CardFileID)).setTrashed(true); } catch (ignored) { /* New card remains valid if old-file cleanup is unavailable. */ }
    }
    return { memberId: memberId, status: "generated", url: card.url, generatedAt: generatedAtText, lastError: "" };
  } catch (error) {
    if (copiedFile) {
      try { copiedFile.setTrashed(true); } catch (ignoredCleanup) { /* Preserve the original failure. */ }
    }
    try { saveCardGenerationFailure_(memberId, error, true); } catch (ignoredState) { /* Admin API logs the original failure. */ }
    if (error.adminCode) throw error;
    throw adminError_("card_generation_failed", "Card generation failed. Check the template, output folder, placeholders, and permissions.");
  }
}

function getCardConfiguration_() {
  var settings = getRuntimeSettings_();
  var config = {
    templateId: adminString_(settings.CardTemplateID, 200), outputFolderId: adminString_(settings.CardOutputFolderID, 200), timezone: settings.Timezone,
    gymNamePlaceholder: adminString_(settings.CardGymNamePlaceholder || "{{GYM_NAME}}", 80), firstNamePlaceholder: adminString_(settings.CardFirstNamePlaceholder || "{{FIRST_NAME}}", 80), lastNamePlaceholder: adminString_(settings.CardLastNamePlaceholder || "{{LAST_NAME}}", 80), memberIdPlaceholder: adminString_(settings.CardMemberIdPlaceholder || "{{MEMBER_ID}}", 80), qrPlaceholder: adminString_(settings.CardQrPlaceholder || "{{QR_CODE}}", 80),
    membershipPlaceholder: adminString_(settings.CardMembershipPlaceholder, 80), categoryPlaceholder: adminString_(settings.CardCategoryPlaceholder, 80), qrValueFormat: adminString_(settings.CardQrValueFormat || "{memberId}", 500), fileNameFormat: adminString_(settings.CardFileNameFormat || "{memberId}-{firstName}-{lastName}", 200), qrImageEndpoint: adminString_(settings.CardQrImageEndpoint || "", 1000),
    gymName: String(settings.GymName || "Demo Gym"), scannerUrl: String(settings.ScannerURL || ""),
  };
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(config.templateId) || !/^[A-Za-z0-9_-]{10,200}$/.test(config.outputFolderId)) throw adminError_("card_not_configured", "Configure a valid Slides template ID and Drive output folder ID first.");
  var requiredPlaceholders = [config.gymNamePlaceholder, config.firstNamePlaceholder, config.lastNamePlaceholder, config.memberIdPlaceholder, config.qrPlaceholder];
  if (requiredPlaceholders.some(function (value) { return !value; }) || requiredPlaceholders.some(function (value, index) { return requiredPlaceholders.indexOf(value) !== index; })) throw adminError_("card_not_configured", "Required card placeholders must be present and unique.");
  var allPlaceholders = requiredPlaceholders.concat([config.membershipPlaceholder, config.categoryPlaceholder]).filter(Boolean);
  if (allPlaceholders.some(function (value, index) { return allPlaceholders.indexOf(value) !== index; })) throw adminError_("card_not_configured", "Card placeholders must be unique.");
  validateCardFormat_(config.qrValueFormat, true);
  validateCardFormat_(config.fileNameFormat, false);
  if (!/^https:\/\//.test(config.qrImageEndpoint) || config.qrImageEndpoint.indexOf("{value}") === -1) throw adminError_("card_not_configured", "Configure an HTTPS QR image endpoint containing {value}.");
  return config;
}

function cardTemplateValues_(member, config) {
  return { memberId: normalizeMemberId_(member.MemberID), firstName: String(member.FirstName || ""), lastName: String(member.LastName || ""), category: String(member.Category || ""), membership: String(member.Status || ""), gymName: config.gymName, scannerUrl: config.scannerUrl };
}

function replaceCardText_(presentation, config, values) {
  [[config.gymNamePlaceholder, values.gymName], [config.firstNamePlaceholder, values.firstName], [config.lastNamePlaceholder, values.lastName], [config.memberIdPlaceholder, values.memberId], [config.membershipPlaceholder, values.membership], [config.categoryPlaceholder, values.category]].forEach(function (replacement) {
    if (replacement[0] && presentation.replaceAllText(replacement[0], replacement[1]) === 0) throw new Error("Card text placeholder was not found: " + replacement[0]);
  });
}

function replaceCardQrPlaceholder_(presentation, placeholder, blob) {
  var replacements = 0;
  presentation.getSlides().forEach(function (slide) {
    slide.getPageElements().slice().forEach(function (element) {
      if (element.getPageElementType() !== SlidesApp.PageElementType.SHAPE) return;
      var shape = element.asShape();
      if (shape.getText().asString().trim() !== placeholder) return;
      var left = element.getLeft(), top = element.getTop(), width = element.getWidth(), height = element.getHeight();
      element.remove();
      slide.insertImage(blob, left, top, width, height);
      replacements += 1;
    });
  });
  if (replacements === 0) throw new Error("QR placeholder shape was not found in the Slides template");
}

function fetchCardQrBlob_(endpoint, value) {
  var response = UrlFetchApp.fetch(endpoint.replace("{value}", encodeURIComponent(value)), { method: "get", muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error("QR image service returned HTTP " + response.getResponseCode());
  var blob = response.getBlob();
  if (String(blob.getContentType() || "").indexOf("image/") !== 0) throw new Error("QR image service did not return an image");
  return blob;
}

function validateCardFormat_(format, requireMemberId) {
  var unknown = String(format).match(/\{([A-Za-z0-9_]+)\}/g) || [];
  unknown.forEach(function (token) { if (CARD_FORMAT_TOKENS.indexOf(token.slice(1, -1)) === -1) throw adminError_("card_not_configured", "Unsupported card format token: " + token); });
  if (requireMemberId && String(format).indexOf("{memberId}") === -1) throw adminError_("card_not_configured", "QR value format must contain {memberId}.");
}

function formatCardTokens_(format, values) {
  var result = String(format);
  CARD_FORMAT_TOKENS.forEach(function (token) { result = result.replace(new RegExp("\\{" + token + "\\}", "g"), String(values[token] || "")); });
  return result;
}

function formatCardFileName_(format, values) {
  return formatCardTokens_(format, values).replace(/[\\/:*?"<>|\u0000-\u001F]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 180) || values.memberId;
}
