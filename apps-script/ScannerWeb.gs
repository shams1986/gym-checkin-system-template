var NEUTRAL_SCANNER_LOGO_DATA_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160'%3E%3Crect width='160' height='160' rx='32' fill='%23F2B84B'/%3E%3Ctext x='80' y='101' text-anchor='middle' font-family='Arial,sans-serif' font-size='64' font-weight='700' fill='%23172126'%3EGC%3C/text%3E%3C/svg%3E";

function renderScannerApp_() {
  var config = getPublicScannerConfig_();
  config.branding.logoUrl = resolveScannerImageUrl_(config.branding.logoUrl);
  config.branding.iconUrl = resolveScannerImageUrl_(config.branding.iconUrl);
  var template = HtmlService.createTemplateFromFile("Scanner");
  template.scannerConfigJson = JSON.stringify(config).replace(/</g, "\\u003c");
  return template.evaluate()
    .setTitle(String(config.identity.name || "Gym Check-in") + " — Check-in")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag("viewport", "width=device-width, initial-scale=1, viewport-fit=cover");
}

function resolveScannerImageUrl_(value) {
  var url = String(value || "").trim();
  return /^https:\/\//i.test(url) || /^data:image\//i.test(url) ? url : NEUTRAL_SCANNER_LOGO_DATA_URL;
}

function includeScannerFile_(filename) {
  return HtmlService.createTemplateFromFile(filename).getRawContent();
}

function includeScannerScript_(filename) {
  return includeScannerFile_(filename).replace(/<\//g, "<\\/");
}
