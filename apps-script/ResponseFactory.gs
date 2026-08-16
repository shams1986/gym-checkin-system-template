var SCANNER_RESPONSE_FIELDS = Object.freeze([
  "result", "reason", "memberId", "firstName", "trainingType", "trainingName",
  "trainingStart", "title", "subtitle", "message", "color", "sound",
]);

function createScannerResponse_(result, reason, context, settings) {
  context = context || {};
  settings = settings || {};
  var presentation = scannerPresentation_(result, context, settings);
  var response = {
    result: result,
    reason: reason,
    memberId: context.memberId || null,
    firstName: context.firstName || null,
    trainingType: context.trainingType || null,
    trainingName: context.trainingName || null,
    trainingStart: context.trainingStart || null,
    title: presentation.title,
    subtitle: presentation.subtitle,
    message: context.message || "",
    color: presentation.color,
    sound: presentation.sound,
  };

  SCANNER_RESPONSE_FIELDS.forEach(function (field) {
    if (!Object.prototype.hasOwnProperty.call(response, field)) {
      throw new Error("Incomplete scanner response: " + field);
    }
  });
  return response;
}

function scannerPresentation_(result, context, settings) {
  var help = String(settings.ScannerHelpText || "Ask a staff member for help.");
  var presentations = {
    success: { title: String(settings.ScannerSuccessTitle || "Check-in complete"), subtitle: formatScannerText_(settings.ScannerSuccessSubtitle || "You're checked in for {trainingName}", context), color: scannerColor_(settings.ScannerSuccessColor, "#15803D"), sound: "success" },
    duplicate: { title: String(settings.ScannerDuplicateTitle || "Already checked in"), subtitle: formatScannerText_(settings.ScannerDuplicateSubtitle || "Your attendance is already recorded", context), color: scannerColor_(settings.ScannerDuplicateColor, "#1D4ED8"), sound: "warning" },
    not_found: { title: String(settings.ScannerNotFoundTitle || "Member not found"), subtitle: help, color: scannerColor_(settings.ScannerErrorColor, "#B91C1C"), sound: "error" },
    inactive: { title: String(settings.ScannerInactiveTitle || "Membership inactive"), subtitle: help, color: scannerColor_(settings.ScannerErrorColor, "#B91C1C"), sound: "error" },
    outside_window: { title: String(settings.ScannerOutsideWindowTitle || "Check-in unavailable"), subtitle: String(settings.ScannerOutsideWindowSubtitle || "There is no eligible session right now."), color: scannerColor_(settings.ScannerErrorColor, "#B91C1C"), sound: "error" },
    error: { title: String(settings.ScannerErrorTitle || "Please try again"), subtitle: help, color: scannerColor_(settings.ScannerErrorColor, "#B91C1C"), sound: "error" },
  };
  return presentations[result] || presentations.error;
}

function formatScannerText_(template, context) {
  return String(template).replace(/\{trainingName\}/g, String(context.trainingName || ""));
}

function scannerColor_(value, fallback) {
  var normalized = String(value || "").trim();
  return /^#[0-9A-Fa-f]{6}$/.test(normalized) ? normalized.toUpperCase() : fallback;
}
