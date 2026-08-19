var ADMIN_EMAILS_PROPERTY = "ADMIN_ALLOWED_EMAILS";

function authorizeAdmin_() {
  var properties = PropertiesService.getScriptProperties();
  var allowedEmails = parseAdminEmails_(properties.getProperty(ADMIN_EMAILS_PROPERTY));
  if (allowedEmails.length === 0) {
    throw adminError_("admin_not_configured", "Admin access has not been configured.");
  }

  var email = String(Session.getActiveUser().getEmail() || "").trim().toLowerCase();
  if (!email) {
    throw adminError_("unauthorized", "Open the admin deployment while signed in with an authorized Google account.");
  }
  if (allowedEmails.indexOf(email) === -1) {
    throw adminError_("forbidden", "This Google account is not authorized for the admin panel.");
  }
  return { email: email };
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

function adminError_(code, message, fields) {
  var error = new Error(message);
  error.adminCode = code;
  error.adminFields = fields || null;
  return error;
}
