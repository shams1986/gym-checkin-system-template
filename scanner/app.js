import {
  JSONP_TIMEOUT_MS,
  createLocalState,
  extractMemberId,
  getResetDelay,
  isBackendResult,
  normalizeBackendState,
  normalizeScannerState,
  requestCheckInJsonp,
  resolvePublicConfig,
} from "./core.mjs";

const QR_SCANNER_MODULE_URL = "https://cdn.jsdelivr.net/npm/qr-scanner@1.4.2/qr-scanner.min.js";

const config = resolvePublicConfig(window.GYM_PUBLIC_CONFIG);
const elements = {};
let qrScanner = null;
let scanLocked = false;
let resetTimer = null;
let audioContext = null;

window.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  cacheElements();
  applyConfiguration();
  bindEvents();
  renderState(createLocalState("ready", "camera_ready", config));

  const previewState = await loadLocalFixturePreview();
  if (previewState) {
    scanLocked = true;
    renderState(previewState);
    elements.cameraStatus.textContent = "Fixture preview";
    elements.soundHint.hidden = true;
    return;
  }

  elements.cameraStatus.textContent = config.scanner.texts.cameraStartingText;
  startScanner();
  registerServiceWorker();
}

function cacheElements() {
  elements.video = document.querySelector("#camera");
  elements.screen = document.querySelector("#screen");
  elements.logo = document.querySelector("#gym-logo");
  elements.gymName = document.querySelector("#gym-name");
  elements.title = document.querySelector("#title");
  elements.memberName = document.querySelector("#member-name");
  elements.training = document.querySelector("#training-name");
  elements.subtitle = document.querySelector("#subtitle");
  elements.message = document.querySelector("#message");
  elements.cameraStatus = document.querySelector("#camera-status");
  elements.soundHint = document.querySelector("#sound-hint");
  elements.retryButton = document.querySelector("#retry-camera");
}

function applyConfiguration() {
  document.documentElement.lang = config.identity.locale;
  document.title = `${config.identity.name} — Check-in`;
  document.querySelector('meta[name="theme-color"]').content = config.branding.colors.background;
  document.documentElement.style.setProperty("--color-primary", config.branding.colors.primary);
  document.documentElement.style.setProperty("--color-accent", config.branding.colors.accent);
  document.documentElement.style.setProperty("--color-background", config.branding.colors.background);
  document.documentElement.style.setProperty("--color-surface", config.branding.colors.surface);
  elements.logo.src = config.branding.logoUrl;
  elements.logo.alt = `${config.identity.name} logo`;
  elements.gymName.textContent = config.identity.name;
  elements.soundHint.textContent = config.scanner.texts.soundHint;
  elements.soundHint.hidden = !config.scanner.behavior.sound;
  elements.retryButton.textContent = config.scanner.texts.retryButton;
}

function bindEvents() {
  document.addEventListener("pointerdown", unlockSound, { passive: true });
  document.addEventListener("keydown", unlockSound, { passive: true });
  elements.retryButton.addEventListener("click", startScanner);
}

async function startScanner() {
  elements.retryButton.hidden = true;
  elements.cameraStatus.textContent = config.scanner.texts.cameraStartingText;
  scanLocked = true;

  try {
    if (qrScanner) {
      await qrScanner.stop();
      qrScanner.destroy();
    }

    const module = await import(QR_SCANNER_MODULE_URL);
    const QrScanner = module.default;
    qrScanner = new QrScanner(elements.video, handleScan, {
      preferredCamera: config.scanner.behavior.preferredCamera,
      maxScansPerSecond: 15,
      returnDetailedScanResult: true,
      highlightScanRegion: false,
      highlightCodeOutline: false,
    });
    await qrScanner.start();
    resetToReady("camera_ready");
  } catch (_error) {
    scanLocked = true;
    const cameraError = createLocalState("error", "transport_error", config, {
      title: config.scanner.texts.errorTitle,
      subtitle: config.scanner.texts.cameraErrorInstruction,
      sound: "error",
    });
    renderState(cameraError);
    elements.cameraStatus.textContent = "";
    elements.retryButton.hidden = false;
  }
}

async function handleScan(scanResult) {
  if (scanLocked) return;
  scanLocked = true;

  const memberId = extractMemberId(scanResult);
  if (!memberId) {
    showOutcome(createLocalState("error", "invalid_payload", config, {
      subtitle: config.scanner.texts.invalidInstruction,
    }));
    return;
  }

  renderState(createLocalState("loading", "request_started", config, { memberId }));

  if (!config.integration.checkInEndpoint) {
    showOutcome(createLocalState("error", "backend_error", config, {
      memberId,
      subtitle: config.scanner.texts.errorInstruction,
    }));
    return;
  }

  const outcome = await requestCheckInJsonp({
    endpoint: config.integration.checkInEndpoint,
    memberId,
    timeoutMs: JSONP_TIMEOUT_MS,
  });

  if (outcome.kind === "timeout") {
    showOutcome(createLocalState("timeout", "callback_timeout", config, { memberId }));
    return;
  }
  if (outcome.kind === "error") {
    showOutcome(createLocalState("error", "transport_error", config, { memberId }));
    return;
  }

  const state = normalizeBackendState(outcome.data, config);
  showOutcome(isBackendResult(state.result) ? state : normalizeScannerState(null, config));
}

function showOutcome(state) {
  renderState(state);
  playFeedback(state.sound);
  scheduleReset(state.result);
}

function renderState(state) {
  document.body.dataset.state = state.result;
  elements.screen.dataset.state = state.result;
  elements.screen.style.setProperty("--result-color", state.color);
  elements.title.textContent = state.title;
  elements.subtitle.textContent = state.subtitle;
  elements.memberName.textContent = state.firstName || "";
  elements.memberName.hidden = !state.firstName;
  elements.training.textContent = state.trainingName || "";
  elements.training.hidden = !state.trainingName;
  elements.message.textContent = state.result === "success" ? state.message : "";
  elements.message.hidden = state.result !== "success" || !state.message;

  if (state.result === "ready") {
    elements.cameraStatus.textContent = config.scanner.texts.cameraActiveText;
  } else if (state.result !== "loading") {
    elements.cameraStatus.textContent = "";
  }
}

function scheduleReset(result) {
  if (resetTimer !== null) window.clearTimeout(resetTimer);
  const delay = getResetDelay(result, config);
  if (delay === null) return;
  resetTimer = window.setTimeout(() => resetToReady("reset_complete"), delay);
}

function resetToReady(reason) {
  if (resetTimer !== null) {
    window.clearTimeout(resetTimer);
    resetTimer = null;
  }
  scanLocked = false;
  renderState(createLocalState("ready", reason, config));
}

function unlockSound() {
  if (!config.scanner.behavior.sound) return;
  try {
    if (!audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioContext = new AudioContext();
    }
    audioContext.resume();
    elements.soundHint.hidden = true;
  } catch (_error) {
    // Sound is optional; scanning continues without it.
  }
}

function playFeedback(sound) {
  if (config.scanner.behavior.sound) playSound(sound);
  if (config.scanner.behavior.vibration) vibrate(sound);
}

function playSound(sound) {
  if (!audioContext || sound === "none") return;
  const now = audioContext.currentTime;
  if (sound === "success") {
    playTone(660, now, 0.16);
    playTone(880, now + 0.13, 0.18);
  } else if (sound === "warning") {
    playTone(420, now, 0.18);
    playTone(420, now + 0.24, 0.18);
  } else {
    playTone(220, now, 0.32);
  }
}

function playTone(frequency, start, duration) {
  try {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.32, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  } catch (_error) {
    // Feedback failure must not block the scanner.
  }
}

function vibrate(sound) {
  if (!navigator.vibrate || sound === "none") return;
  if (sound === "success") navigator.vibrate(80);
  else if (sound === "warning") navigator.vibrate([60, 60, 60]);
  else navigator.vibrate(180);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
}

async function loadLocalFixturePreview() {
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const fixtureName = new URLSearchParams(window.location.search).get("fixture");
  if (!localHosts.has(window.location.hostname) || !fixtureName) return null;

  try {
    const response = await fetch("../tests/fixtures/scanner-states.json", { cache: "no-store" });
    if (!response.ok) return normalizeScannerState(null, config);
    const fixtures = await response.json();
    const fixture = fixtures.find((item) => item.result === fixtureName);
    return fixture ? normalizeScannerState(fixture, config) : normalizeScannerState(null, config);
  } catch (_error) {
    return normalizeScannerState(null, config);
  }
}
