export const JSONP_TIMEOUT_MS = 20000;

export const SCANNER_STATES = Object.freeze([
  "ready",
  "loading",
  "success",
  "duplicate",
  "not_found",
  "inactive",
  "outside_window",
  "error",
  "timeout",
]);

export const BACKEND_RESULT_STATES = Object.freeze([
  "success",
  "duplicate",
  "not_found",
  "inactive",
  "outside_window",
  "error",
]);

const SOUND_VALUES = new Set(["success", "warning", "error", "none"]);
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const MEMBER_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

export const DEFAULT_PUBLIC_CONFIG = deepFreeze({
  schemaVersion: 1,
  identity: {
    name: "Gym Check-in",
    shortName: "Check-in",
    locale: "en-GB",
    timezone: "Etc/UTC",
  },
  branding: {
    logoUrl: "./assets/logo.svg",
    iconUrl: "./assets/icon.svg",
    colors: {
      primary: "#174A5B",
      accent: "#F2B84B",
      background: "#07161C",
      surface: "#FFFFFF",
    },
  },
  scanner: {
    texts: {
      readyTitle: "Scan your member card",
      readyInstruction: "Hold the QR code inside the frame",
      loadingTitle: "Checking you in",
      loadingInstruction: "Please wait",
      successTitle: "Welcome",
      duplicateTitle: "Already checked in",
      notFoundTitle: "Member not found",
      inactiveTitle: "Membership inactive",
      outsideWindowTitle: "Check-in is closed",
      errorTitle: "Unable to check in",
      invalidInstruction: "Please scan a valid member card",
      errorInstruction: "Please try again",
      timeoutTitle: "Connection timed out",
      timeoutInstruction: "Please try again",
      cameraStartingText: "Starting camera",
      cameraActiveText: "Camera active",
      cameraErrorInstruction: "Allow camera access, then retry",
      soundHint: "Tap once to enable sound",
      retryButton: "Retry camera",
    },
    resetMs: {
      success: 15000,
      duplicate: 3500,
      error: 5000,
      outsideWindow: 5000,
    },
    behavior: {
      sound: true,
      vibration: true,
      preferredCamera: "environment",
    },
  },
  integration: {
    checkInEndpoint: "",
    scannerUrl: "",
  },
});

const TEXT_KEYS = Object.keys(DEFAULT_PUBLIC_CONFIG.scanner.texts);

export function resolvePublicConfig(candidate) {
  const input = candidate && typeof candidate === "object" ? candidate : {};
  const identity = input.identity && typeof input.identity === "object" ? input.identity : {};
  const branding = input.branding && typeof input.branding === "object" ? input.branding : {};
  const colors = branding.colors && typeof branding.colors === "object" ? branding.colors : {};
  const scanner = input.scanner && typeof input.scanner === "object" ? input.scanner : {};
  const texts = scanner.texts && typeof scanner.texts === "object" ? scanner.texts : {};
  const resetMs = scanner.resetMs && typeof scanner.resetMs === "object" ? scanner.resetMs : {};
  const behavior = scanner.behavior && typeof scanner.behavior === "object" ? scanner.behavior : {};
  const integration = input.integration && typeof input.integration === "object" ? input.integration : {};
  const resolvedTexts = {};

  TEXT_KEYS.forEach((key) => {
    resolvedTexts[key] = safeString(texts[key], DEFAULT_PUBLIC_CONFIG.scanner.texts[key]);
  });

  return deepFreeze({
    schemaVersion: input.schemaVersion === 1 ? 1 : DEFAULT_PUBLIC_CONFIG.schemaVersion,
    identity: {
      name: safeString(identity.name, DEFAULT_PUBLIC_CONFIG.identity.name),
      shortName: safeString(identity.shortName, DEFAULT_PUBLIC_CONFIG.identity.shortName),
      locale: safeString(identity.locale, DEFAULT_PUBLIC_CONFIG.identity.locale),
      timezone: safeString(identity.timezone, DEFAULT_PUBLIC_CONFIG.identity.timezone),
    },
    branding: {
      logoUrl: safeString(branding.logoUrl, DEFAULT_PUBLIC_CONFIG.branding.logoUrl),
      iconUrl: safeString(branding.iconUrl, DEFAULT_PUBLIC_CONFIG.branding.iconUrl),
      colors: {
        primary: safeColor(colors.primary, DEFAULT_PUBLIC_CONFIG.branding.colors.primary),
        accent: safeColor(colors.accent, DEFAULT_PUBLIC_CONFIG.branding.colors.accent),
        background: safeColor(colors.background, DEFAULT_PUBLIC_CONFIG.branding.colors.background),
        surface: safeColor(colors.surface, DEFAULT_PUBLIC_CONFIG.branding.colors.surface),
      },
    },
    scanner: {
      texts: resolvedTexts,
      resetMs: {
        success: safeDelay(resetMs.success, DEFAULT_PUBLIC_CONFIG.scanner.resetMs.success),
        duplicate: safeDelay(resetMs.duplicate, DEFAULT_PUBLIC_CONFIG.scanner.resetMs.duplicate),
        error: safeDelay(resetMs.error, DEFAULT_PUBLIC_CONFIG.scanner.resetMs.error),
        outsideWindow: safeDelay(resetMs.outsideWindow, DEFAULT_PUBLIC_CONFIG.scanner.resetMs.outsideWindow),
      },
      behavior: {
        sound: safeBoolean(behavior.sound, DEFAULT_PUBLIC_CONFIG.scanner.behavior.sound),
        vibration: safeBoolean(behavior.vibration, DEFAULT_PUBLIC_CONFIG.scanner.behavior.vibration),
        preferredCamera: behavior.preferredCamera === "user" ? "user" : "environment",
      },
    },
    integration: {
      checkInEndpoint: safePublicUrl(integration.checkInEndpoint),
      scannerUrl: safePublicUrl(integration.scannerUrl),
    },
  });
}

export function extractMemberId(scannedValue) {
  const text = String(scannedValue && scannedValue.data ? scannedValue.data : scannedValue || "").trim();
  if (!text) return null;

  try {
    const url = new URL(text, "https://scanner.invalid/");
    const isRelative = url.origin === "https://scanner.invalid";
    if (isRelative || url.protocol === "https:" || url.protocol === "http:") {
      const candidate = url.searchParams.get("id") || url.searchParams.get("memberId");
      if (candidate) return normalizeMemberId(candidate);
    }
  } catch (_error) {
    // Raw member IDs are handled below.
  }

  return normalizeMemberId(text);
}

export function normalizeMemberId(value) {
  const candidate = String(value || "").trim();
  if (!MEMBER_ID_PATTERN.test(candidate)) return null;
  return candidate.toUpperCase();
}

export function createLocalState(result, reason, config, overrides = {}) {
  return normalizeScannerState({ result, reason, ...overrides }, config);
}

export function normalizeScannerState(input, config = DEFAULT_PUBLIC_CONFIG) {
  const resolvedConfig = resolvePublicConfig(config);
  if (!input || typeof input !== "object" || !SCANNER_STATES.includes(input.result) || !isMachineValue(input.reason)) {
    return invalidResponseState(resolvedConfig);
  }

  const result = input.result;
  const defaults = stateDefaults(result, resolvedConfig);
  return {
    result,
    reason: input.reason,
    memberId: nullableString(input.memberId),
    firstName: nullableString(input.firstName),
    trainingType: nullableString(input.trainingType),
    trainingName: nullableString(input.trainingName),
    trainingStart: nullableString(input.trainingStart),
    title: safeString(input.title, defaults.title),
    subtitle: safeString(input.subtitle, defaults.subtitle, true),
    message: safeString(input.message, "", true),
    color: safeColor(input.color, defaults.color),
    sound: SOUND_VALUES.has(input.sound) ? input.sound : defaults.sound,
  };
}

export function normalizeBackendState(input, config = DEFAULT_PUBLIC_CONFIG) {
  const requiredFields = ["result", "reason", "memberId", "firstName", "trainingType", "trainingName", "trainingStart", "title", "subtitle", "message", "color", "sound"];
  const nullableFields = ["memberId", "firstName", "trainingType", "trainingName", "trainingStart"];
  const complete = input && typeof input === "object"
    && requiredFields.every((field) => Object.prototype.hasOwnProperty.call(input, field))
    && nullableFields.every((field) => input[field] === null || typeof input[field] === "string")
    && ["title", "subtitle", "message", "color", "sound"].every((field) => typeof input[field] === "string")
    && COLOR_PATTERN.test(input.color)
    && SOUND_VALUES.has(input.sound);

  return complete ? normalizeScannerState(input, config) : invalidResponseState(resolvePublicConfig(config));
}

export function isBackendResult(result) {
  return BACKEND_RESULT_STATES.includes(result);
}

export function getResetDelay(result, config = DEFAULT_PUBLIC_CONFIG) {
  const resolved = resolvePublicConfig(config);
  if (result === "ready" || result === "loading") return null;
  if (result === "success") return resolved.scanner.resetMs.success;
  if (result === "duplicate") return resolved.scanner.resetMs.duplicate;
  if (result === "outside_window") return resolved.scanner.resetMs.outsideWindow;
  return resolved.scanner.resetMs.error;
}

export function requestCheckInJsonp({
  endpoint,
  memberId,
  timeoutMs = JSONP_TIMEOUT_MS,
  globalObject = globalThis,
  documentObject = globalThis.document,
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout,
  now = Date.now,
  random = Math.random,
}) {
  return new Promise((resolve) => {
    const callbackName = `gymCheckinCallback_${now()}_${Math.floor(random() * 100000)}`;
    const script = documentObject.createElement("script");
    let finished = false;
    let timeoutId = null;

    const cleanup = () => {
      if (timeoutId !== null) {
        clearTimer(timeoutId);
        timeoutId = null;
      }
      delete globalObject[callbackName];
      script.onerror = null;
      script.remove();
    };

    const finish = (outcome) => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(outcome);
    };

    globalObject[callbackName] = (data) => finish({ kind: "response", data });
    script.onerror = () => finish({ kind: "error" });
    timeoutId = setTimer(() => finish({ kind: "timeout" }), timeoutMs);

    try {
      const url = new URL(endpoint, globalObject.location && globalObject.location.href ? globalObject.location.href : "https://scanner.invalid/");
      url.searchParams.set("api", "checkin");
      url.searchParams.set("id", memberId);
      url.searchParams.set("callback", callbackName);
      url.searchParams.set("t", String(now()));
      script.src = url.toString();
      documentObject.body.appendChild(script);
    } catch (_error) {
      finish({ kind: "error" });
    }
  });
}

function invalidResponseState(config) {
  return {
    result: "error",
    reason: "invalid_response",
    memberId: null,
    firstName: null,
    trainingType: null,
    trainingName: null,
    trainingStart: null,
    title: config.scanner.texts.errorTitle,
    subtitle: config.scanner.texts.errorInstruction,
    message: "",
    color: "#C62828",
    sound: "error",
  };
}

function stateDefaults(result, config) {
  const texts = config.scanner.texts;
  const values = {
    ready: [texts.readyTitle, texts.readyInstruction, config.branding.colors.accent, "none"],
    loading: [texts.loadingTitle, texts.loadingInstruction, config.branding.colors.primary, "none"],
    success: [texts.successTitle, "", "#2E7D32", "success"],
    duplicate: [texts.duplicateTitle, "", "#ED9B27", "warning"],
    not_found: [texts.notFoundTitle, texts.errorInstruction, "#C62828", "error"],
    inactive: [texts.inactiveTitle, texts.errorInstruction, "#C62828", "error"],
    outside_window: [texts.outsideWindowTitle, texts.errorInstruction, "#C62828", "error"],
    error: [texts.errorTitle, texts.errorInstruction, "#C62828", "error"],
    timeout: [texts.timeoutTitle, texts.timeoutInstruction, "#C62828", "error"],
  };
  return { title: values[result][0], subtitle: values[result][1], color: values[result][2], sound: values[result][3] };
}

function safeString(value, fallback, allowEmpty = false) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  return normalized || (allowEmpty ? "" : fallback);
}

function nullableString(value) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function safeColor(value, fallback) {
  return typeof value === "string" && COLOR_PATTERN.test(value) ? value.toUpperCase() : fallback;
}

function safeDelay(value, fallback) {
  return Number.isFinite(value) && value > 0 && value <= 60000 ? Math.round(value) : fallback;
}

function safeBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function safePublicUrl(value) {
  if (typeof value !== "string" || value.trim() === "") return "";
  try {
    const url = new URL(value);
    const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    return url.protocol === "https:" || localHttp ? url.toString() : "";
  } catch (_error) {
    return "";
  }
}

function isMachineValue(value) {
  return typeof value === "string" && /^[a-z][a-z0-9_]*$/.test(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
