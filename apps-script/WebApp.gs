function doGet(event) {
  var parameters = event && event.parameter ? event.parameter : {};
  var callback = String(parameters.callback || "");
  var response;

  if (callback && !isSafeJsonpCallback_(callback)) {
    response = createScannerResponse_("error", "invalid_payload", {}, {});
    return createPublicOutput_(response, "");
  }

  if (String(parameters.api || "") !== "checkin") {
    response = createScannerResponse_("error", "invalid_payload", {}, {});
  } else {
    response = checkIn(parameters.id, {
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
