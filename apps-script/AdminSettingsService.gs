var ADMIN_SETTING_KEYS = Object.freeze([
  "GymName", "ShortName", "Locale", "Timezone", "LogoURL", "IconURL", "PrimaryColor", "AccentColor", "BackgroundColor", "SurfaceColor",
  "MemberIdPrefix", "MemberIdNumberWidth", "CheckinMinutesBeforeStart", "CheckinMinutesAfterStart",
  "ScannerSuccessResetMs", "ScannerDuplicateResetMs", "ScannerErrorResetMs", "ScannerOutsideWindowResetMs",
  "ScannerSuccessTitle", "ScannerDuplicateTitle", "ScannerNotFoundTitle", "ScannerInactiveTitle", "ScannerOutsideWindowTitle", "ScannerErrorTitle",
  "ScannerHelpText", "ScannerSuccessSubtitle", "ScannerDuplicateSubtitle", "ScannerOutsideWindowSubtitle",
  "ScannerReadyTitle", "ScannerReadyInstruction", "ScannerLoadingTitle", "ScannerLoadingInstruction", "ScannerInvalidInstruction", "ScannerErrorInstruction",
  "ScannerTimeoutTitle", "ScannerTimeoutInstruction", "ScannerCameraStartingText", "ScannerCameraActiveText", "ScannerCameraErrorInstruction", "ScannerSoundHint", "ScannerRetryButton",
  "PreferredCamera", "ScannerSound", "ScannerVibration", "ScannerURL", "CardTemplateID", "CardOutputFolderID",
  "CardGymNamePlaceholder", "CardFirstNamePlaceholder", "CardLastNamePlaceholder", "CardMemberIdPlaceholder", "CardQrPlaceholder",
  "CardMembershipPlaceholder", "CardCategoryPlaceholder", "CardQrValueFormat", "CardFileNameFormat", "CardQrImageEndpoint",
]);

function getAdminSettings_() {
  var values = getRuntimeSettings_();
  var result = {};
  ADMIN_SETTING_KEYS.forEach(function (key) { result[key] = values[key] == null ? "" : String(values[key]); });
  result.memberIdFormatLocked = readRuntimeRows_("Members").length > 0;
  return result;
}

function updateAdminSettings_(data) {
  data = data || {};
  var validated = {};
  Object.keys(data).forEach(function (key) {
    if (ADMIN_SETTING_KEYS.indexOf(key) === -1) throw adminError_("validation_error", "Unsupported setting: " + key);
    validated[key] = validateAdminSetting_(key, data[key]);
  });
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw adminError_("busy", "Settings are busy. Please try again.");
  try {
    var current = getAdminSettings_();
    if (current.memberIdFormatLocked && ((validated.MemberIdPrefix != null && validated.MemberIdPrefix !== current.MemberIdPrefix) || (validated.MemberIdNumberWidth != null && validated.MemberIdNumberWidth !== current.MemberIdNumberWidth))) {
      throw adminError_("member_id_format_locked", "Member ID format cannot change after the first member is created.");
    }
    var sheet = getRuntimeSheet_("Settings");
    var targets = Object.keys(validated).map(function (key) {
      var rowNumber = findRowByValue_(sheet, 1, key);
      if (!rowNumber) throw new Error("Required setting is missing: " + key);
      return { key: key, rowNumber: rowNumber, previousValue: sheet.getRange(rowNumber, 2).getValue(), nextValue: validated[key] };
    });
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var previousTimezone = spreadsheet.getSpreadsheetTimeZone();
    var applied = [];
    try {
      targets.forEach(function (target) {
        sheet.getRange(target.rowNumber, 2).setValue(target.nextValue);
        applied.push(target);
      });
      if (validated.Timezone && previousTimezone !== validated.Timezone) spreadsheet.setSpreadsheetTimeZone(validated.Timezone);
    } catch (error) {
      for (var index = applied.length - 1; index >= 0; index -= 1) {
        sheet.getRange(applied[index].rowNumber, 2).setValue(applied[index].previousValue);
      }
      if (spreadsheet.getSpreadsheetTimeZone() !== previousTimezone) spreadsheet.setSpreadsheetTimeZone(previousTimezone);
      throw error;
    }
    Object.keys(validated).forEach(function (key) { current[key] = String(validated[key]); });
    return current;
  } finally {
    lock.releaseLock();
  }
}

function testCardConfiguration_() {
  var config = getCardConfiguration_();
  var template = DriveApp.getFileById(config.templateId);
  var folder = DriveApp.getFolderById(config.outputFolderId);
  var presentation = SlidesApp.openById(config.templateId);
  var qrFound = presentation.getSlides().some(function (slide) {
    return slide.getPageElements().some(function (element) {
      return element.getPageElementType() === SlidesApp.PageElementType.SHAPE && element.asShape().getText().asString().trim() === config.qrPlaceholder;
    });
  });
  if (!qrFound) throw adminError_("card_template_invalid", "The dedicated QR placeholder shape was not found.");
  return { ready: true, missing: [], templateName: template.getName(), outputFolderName: folder.getName(), message: "Card template and output folder are accessible." };
}

function listBasicMessages_() {
  return readRuntimeRows_("_Messages").map(function (row) {
    return { messageId: String(row.MessageID), active: isRuntimeActive_(row.Active), message: String(row.Message || ""), trainingType: String(row.TrainingType || ""), category: String(row.Category || ""), weight: boundedInteger_(row.Weight, 1, 1, 100) };
  });
}

function saveBasicMessage_(payload) {
  payload = payload || {};
  var messageId = adminString_(payload.messageId, 80);
  var message = adminString_(payload.message, 240);
  if (!message) throw adminError_("validation_error", "Message text is required.", { message: "Required" });
  var values = [messageId || "MSG-" + Utilities.getUuid().replace(/-/g, "").slice(0, 12).toUpperCase(), adminBoolean_(payload.active, true), message, adminString_(payload.trainingType, 80).toUpperCase(), adminString_(payload.category, 80), boundedInteger_(payload.weight, 1, 1, 100)];
  var existing = messageId ? findRuntimeRowByKey_("_Messages", "MessageID", messageId) : null;
  if (messageId && !existing) throw adminError_("message_not_found", "Message not found.");
  if (existing) replaceRuntimeRow_("_Messages", existing._rowNumber, values); else getRuntimeSheet_("_Messages").appendRow(values);
  return { messageId: values[0], active: values[1], message: values[2], trainingType: values[3], category: values[4], weight: values[5] };
}

function deleteBasicMessage_(payload) {
  var messageId = adminString_(payload.messageId, 80);
  var existing = findRuntimeRowByKey_("_Messages", "MessageID", messageId);
  if (!existing) throw adminError_("message_not_found", "Message not found.");
  deleteRuntimeRow_("_Messages", existing._rowNumber);
  return { messageId: messageId };
}

function getPublicScannerConfig_() {
  var settings = getRuntimeSettings_();
  return {
    schemaVersion: 1,
    identity: { name: String(settings.GymName || "Demo Gym"), shortName: String(settings.ShortName || "Demo"), locale: String(settings.Locale || "en-GB"), timezone: settings.Timezone },
    branding: { logoUrl: String(settings.LogoURL || ""), iconUrl: String(settings.IconURL || ""), colors: { primary: scannerColor_(settings.PrimaryColor, "#174A5B"), accent: scannerColor_(settings.AccentColor, "#F2B84B"), background: scannerColor_(settings.BackgroundColor, "#0E2028"), surface: scannerColor_(settings.SurfaceColor, "#FFFFFF") } },
    scanner: {
      texts: { readyTitle: String(settings.ScannerReadyTitle || "Scan your member card"), readyInstruction: String(settings.ScannerReadyInstruction || "Hold the QR code inside the frame"), loadingTitle: String(settings.ScannerLoadingTitle || "Checking you in"), loadingInstruction: String(settings.ScannerLoadingInstruction || "Please wait"), successTitle: String(settings.ScannerSuccessTitle || "Check-in complete"), duplicateTitle: String(settings.ScannerDuplicateTitle || "Already checked in"), notFoundTitle: String(settings.ScannerNotFoundTitle || "Member not found"), inactiveTitle: String(settings.ScannerInactiveTitle || "Membership inactive"), outsideWindowTitle: String(settings.ScannerOutsideWindowTitle || "Check-in unavailable"), errorTitle: String(settings.ScannerErrorTitle || "Please try again"), invalidInstruction: String(settings.ScannerInvalidInstruction || "Please scan a valid member card"), errorInstruction: String(settings.ScannerErrorInstruction || "Please try again"), timeoutTitle: String(settings.ScannerTimeoutTitle || "Connection timed out"), timeoutInstruction: String(settings.ScannerTimeoutInstruction || "Please try again"), cameraStartingText: String(settings.ScannerCameraStartingText || "Starting camera"), cameraActiveText: String(settings.ScannerCameraActiveText || "Camera active"), cameraErrorInstruction: String(settings.ScannerCameraErrorInstruction || "Allow camera access, then retry"), soundHint: String(settings.ScannerSoundHint || "Tap once to enable sound"), retryButton: String(settings.ScannerRetryButton || "Retry camera") },
      resetMs: { success: boundedInteger_(settings.ScannerSuccessResetMs, 15000, 1000, 60000), duplicate: boundedInteger_(settings.ScannerDuplicateResetMs, 3500, 1000, 60000), error: boundedInteger_(settings.ScannerErrorResetMs, 5000, 1000, 60000), outsideWindow: boundedInteger_(settings.ScannerOutsideWindowResetMs, 5000, 1000, 60000) },
      behavior: { sound: adminBoolean_(settings.ScannerSound, true), vibration: adminBoolean_(settings.ScannerVibration, true), preferredCamera: settings.PreferredCamera === "user" ? "user" : "environment" },
    },
    integration: { checkInEndpoint: ScriptApp.getService().getUrl() || "", scannerUrl: String(settings.ScannerURL || "") },
  };
}

function validateAdminSetting_(key, value) {
  var text = adminString_(value, 1000);
  if (["GymName", "ShortName", "Locale"].indexOf(key) !== -1 && !text) throw adminError_("validation_error", key + " is required.", makeAdminFieldError_(key));
  if (/Color$/.test(key)) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(text)) throw adminError_("validation_error", "Use a six-digit CSS color.", makeAdminFieldError_(key));
    return text.toUpperCase();
  }
  if (key === "Timezone") {
    try { Utilities.formatDate(new Date(), text, "yyyy-MM-dd"); } catch (error) { throw adminError_("validation_error", "Choose a valid IANA timezone.", makeAdminFieldError_(key)); }
  }
  if (key === "MemberIdPrefix") return validateMemberPrefix_(text);
  if (key === "MemberIdNumberWidth") return String(boundedInteger_(text, 4, 1, 10));
  if (["CheckinMinutesBeforeStart", "CheckinMinutesAfterStart"].indexOf(key) !== -1) return String(boundedInteger_(text, 20, 0, 720));
  if (/ResetMs$/.test(key)) return String(boundedInteger_(text, 5000, 1000, 60000));
  if (key === "PreferredCamera") {
    if (["environment", "user"].indexOf(text) === -1) throw adminError_("validation_error", "Choose a valid camera.", makeAdminFieldError_(key));
    return text;
  }
  if (key === "ScannerSound" || key === "ScannerVibration") return String(adminBoolean_(value, false));
  if ((key === "LogoURL" || key === "IconURL" || key === "ScannerURL") && text && !/^(https:\/\/|\.\.\/|\.\/|\/)/.test(text)) throw adminError_("validation_error", "Use an HTTPS URL or relative public path.", makeAdminFieldError_(key));
  if ((key === "CardTemplateID" || key === "CardOutputFolderID") && text && !/^[A-Za-z0-9_-]{10,200}$/.test(text)) throw adminError_("validation_error", "Use a valid Google file or folder ID.", makeAdminFieldError_(key));
  if (/^Card.*Placeholder$/.test(key) && text.length > 80) throw adminError_("validation_error", "Card placeholders must be 80 characters or fewer.", makeAdminFieldError_(key));
  if ((key === "CardQrValueFormat" || key === "CardFileNameFormat") && text) validateCardFormat_(text, key === "CardQrValueFormat");
  if (key === "CardQrImageEndpoint" && text && (!/^https:\/\//.test(text) || text.indexOf("{value}") === -1)) throw adminError_("validation_error", "Use an HTTPS QR endpoint containing {value}.", makeAdminFieldError_(key));
  return text;
}

function makeAdminFieldError_(key) { var fields = {}; fields[key] = "Invalid value."; return fields; }
