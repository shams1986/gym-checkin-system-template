var ADMIN_CLIENT_ID_PROPERTY = "ADMIN_GOOGLE_CLIENT_ID";
var ADMIN_EMAILS_PROPERTY = "ADMIN_ALLOWED_EMAILS";

function authorizeAdmin_(identityToken) {
  var token = String(identityToken || "").trim();
  if (!token || token.length > 4096) {
    throw adminError_("unauthorized", "Sign in with an authorized Google account.");
  }

  var properties = PropertiesService.getScriptProperties();
  var clientId = getConfiguredAdminClientId_();
  var allowedEmails = parseAdminEmails_(properties.getProperty(ADMIN_EMAILS_PROPERTY));
  if (!clientId || allowedEmails.length === 0) {
    throw adminError_("admin_not_configured", "Admin access has not been configured.");
  }

  var cache = CacheService.getScriptCache();
  var cacheKey = "admin-token-" + digestAdminToken_(token);
  var cachedEmail = cache.get(cacheKey);
  if (cachedEmail && allowedEmails.indexOf(cachedEmail) !== -1) {
    return { email: cachedEmail };
  }

  var response = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token), {
    method: "get",
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) {
    throw adminError_("unauthorized", "Your sign-in could not be verified.");
  }

  var claims;
  try {
    claims = JSON.parse(response.getContentText());
  } catch (error) {
    throw adminError_("unauthorized", "Your sign-in could not be verified.");
  }

  var email = String(claims.email || "").trim().toLowerCase();
  var verified = claims.email_verified === true || String(claims.email_verified).toLowerCase() === "true";
  var expiresAt = Number(claims.exp || 0);
  var issuer = String(claims.iss || "");
  if ((issuer !== "accounts.google.com" && issuer !== "https://accounts.google.com") || String(claims.aud || "") !== clientId || !verified || expiresAt * 1000 <= Date.now() || allowedEmails.indexOf(email) === -1) {
    throw adminError_("forbidden", "This Google account is not authorized for the admin panel.");
  }

  cache.put(cacheKey, email, Math.max(1, Math.min(300, Math.floor(expiresAt - Date.now() / 1000))));
  return { email: email };
}

function getConfiguredAdminClientId_() {
  var clientId = String(PropertiesService.getScriptProperties().getProperty(ADMIN_CLIENT_ID_PROPERTY) || "").trim();
  return /^[A-Za-z0-9._-]{10,240}\.apps\.googleusercontent\.com$/.test(clientId) ? clientId : "";
}

function parseAdminEmails_(value) {
  var raw = String(value || "").trim();
  if (!raw) {
    return [];
  }
  var values;
  try {
    values = JSON.parse(raw);
  } catch (error) {
    values = raw.split(",");
  }
  if (!Array.isArray(values)) {
    return [];
  }
  return values.map(function (email) {
    return String(email).trim().toLowerCase();
  }).filter(function (email, index, all) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && all.indexOf(email) === index;
  });
}

function digestAdminToken_(token) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)
    .map(function (value) { return (value + 256).toString(16).slice(-2); })
    .join("");
}

function adminError_(code, message, fields) {
  var error = new Error(message);
  error.adminCode = code;
  error.adminFields = fields || null;
  return error;
}
