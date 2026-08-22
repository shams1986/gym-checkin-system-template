function doGet(event) {
  var parameters = event && event.parameter ? event.parameter : {};
  var api = String(parameters.api || "");
  if (api === "admin") {
    return renderAdminApp_();
  }
  var callback = String(parameters.callback || "");
  var response;

  if (!api && !callback) return createPublicOutput_({
    service: "gym-checkin-backend",
    scannerUrl: "https://shams1986.github.io/gym-checkin-system-template/",
    routes: { config: "?api=config", checkin: "?api=checkin&id=<member-id>" },
  }, "");

  if (callback && !isSafeJsonpCallback_(callback)) {
    response = createScannerResponse_("error", "invalid_payload", {}, {});
    return createPublicOutput_(response, "");
  }

  if (api === "config") {
    try {
      response = getPublicScannerConfig_();
    } catch (error) {
      response = { schemaVersion: 1, error: "configuration_unavailable" };
    }
  } else if (api !== "checkin") {
    response = createScannerResponse_("error", "invalid_payload", {}, {});
  } else {
    response = checkIn_(parameters.id, {
      requestId: parameters.requestId,
      source: "scanner_jsonp",
    });
  }
  return createPublicOutput_(response, callback);
}

function isSafeJsonpCallback_(callback) {
  return /^[A-Za-z_$][A-Za-z0-9_$]{0,127}$/.test(String(callback || ""));
}

function createPublicOutput_(response, callback) {
  var json = JSON.stringify(response);
  if (callback) {
    return ContentService.createTextOutput(callback + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
