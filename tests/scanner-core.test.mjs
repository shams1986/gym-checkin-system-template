import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_PUBLIC_CONFIG,
  JSONP_TIMEOUT_MS,
  SCANNER_STATES,
  extractMemberId,
  getResetDelay,
  normalizeBackendState,
  normalizeScannerState,
  requestCheckInJsonp,
  resolvePublicConfig,
} from "../scanner/core.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(fs.readFileSync(path.join(directory, "fixtures", "scanner-states.json"), "utf8"));

assert.deepEqual(fixtures.map((fixture) => fixture.result), Array.from(SCANNER_STATES));
fixtures.forEach((fixture) => {
  assert.deepEqual(normalizeScannerState(fixture, DEFAULT_PUBLIC_CONFIG), fixture);
});

assert.equal(extractMemberId(" gym-0042 "), "GYM-0042");
assert.equal(extractMemberId("https://demo.invalid/check-in?id=gym_0042"), "GYM_0042");
assert.equal(extractMemberId("/scan?memberId=club77"), "CLUB77");
assert.equal(extractMemberId({ data: "raw123" }), "RAW123");
assert.equal(extractMemberId("ftp://demo.invalid/scan?id=club77"), null);
assert.equal(extractMemberId("contains spaces"), null);
assert.equal(extractMemberId("https://demo.invalid/no-id"), null);
assert.equal(extractMemberId("!bad"), null);

const alternate = resolvePublicConfig({
  identity: { name: "Second Gym", shortName: "Second", locale: "de-AT", timezone: "Europe/Vienna" },
  branding: { logoUrl: "./second.svg", colors: { primary: "#112233", accent: "#445566", background: "invalid" } },
  scanner: {
    texts: { readyTitle: "Andere Karte scannen" },
    resetMs: { success: 9000, duplicate: -1 },
    behavior: { sound: false, vibration: false, preferredCamera: "user" },
  },
});
assert.equal(alternate.identity.name, "Second Gym");
assert.equal(alternate.scanner.texts.readyTitle, "Andere Karte scannen");
assert.equal(alternate.branding.colors.background, DEFAULT_PUBLIC_CONFIG.branding.colors.background);
assert.equal(alternate.scanner.resetMs.success, 9000);
assert.equal(alternate.scanner.resetMs.duplicate, DEFAULT_PUBLIC_CONFIG.scanner.resetMs.duplicate);
assert.equal(alternate.scanner.behavior.preferredCamera, "user");
assert.equal(getResetDelay("outside_window", alternate), alternate.scanner.resetMs.outsideWindow);
assert.equal(getResetDelay("timeout", alternate), alternate.scanner.resetMs.error);

const invalidResponse = normalizeScannerState({ result: "success", title: "Translated title" }, alternate);
assert.equal(invalidResponse.result, "error");
assert.equal(invalidResponse.reason, "invalid_response");
assert.equal(invalidResponse.title, alternate.scanner.texts.errorTitle);
assert.equal(normalizeBackendState({ result: "success", reason: "attendance_recorded" }, alternate).reason, "invalid_response");
assert.equal(normalizeBackendState({ ...fixtures[2], color: "green" }, alternate).reason, "invalid_response");
assert.equal(normalizeBackendState(fixtures[2], alternate).result, "success");

const unsafeIntegration = resolvePublicConfig({ integration: { checkInEndpoint: "javascript:alert(1)", scannerUrl: "http://example.invalid/" } });
assert.equal(unsafeIntegration.integration.checkInEndpoint, "");
assert.equal(unsafeIntegration.integration.scannerUrl, "");
assert.match(resolvePublicConfig({ integration: { checkInEndpoint: "http://localhost:8080/check-in" } }).integration.checkInEndpoint, /^http:\/\/localhost:8080/);

function makeJsonpHarness() {
  let timeoutCallback;
  let timeoutDelay;
  let removed = false;
  let cleared = false;
  let appendedScript;
  const globalObject = { location: { href: "https://scanner.invalid/" } };
  const documentObject = {
    body: { appendChild(script) { appendedScript = script; } },
    createElement(type) {
      assert.equal(type, "script");
      return { src: "", onerror: null, remove() { removed = true; } };
    },
  };
  return {
    globalObject,
    documentObject,
    setTimer(callback, delay) { timeoutCallback = callback; timeoutDelay = delay; return 7; },
    clearTimer(id) { assert.equal(id, 7); cleared = true; },
    get timeoutCallback() { return timeoutCallback; },
    get timeoutDelay() { return timeoutDelay; },
    get removed() { return removed; },
    get cleared() { return cleared; },
    get script() { return appendedScript; },
  };
}

const successHarness = makeJsonpHarness();
const responsePromise = requestCheckInJsonp({
  endpoint: "https://api.invalid/exec?existing=1",
  memberId: "GYM0042",
  globalObject: successHarness.globalObject,
  documentObject: successHarness.documentObject,
  setTimer: successHarness.setTimer,
  clearTimer: successHarness.clearTimer,
  now: () => 12345,
  random: () => 0.25,
});
const callbackName = Object.keys(successHarness.globalObject).find((key) => key.startsWith("gymCheckinCallback_"));
const lateCallbackReference = successHarness.globalObject[callbackName];
const requestUrl = new URL(successHarness.script.src);
assert.equal(requestUrl.searchParams.get("api"), "checkin");
assert.equal(requestUrl.searchParams.get("id"), "GYM0042");
assert.equal(requestUrl.searchParams.get("existing"), "1");
assert.equal(successHarness.timeoutDelay, JSONP_TIMEOUT_MS);
successHarness.globalObject[callbackName]({ result: "success" });
assert.deepEqual(await responsePromise, { kind: "response", data: { result: "success" } });
assert.equal(successHarness.globalObject[callbackName], undefined);
assert.equal(successHarness.removed, true);
assert.equal(successHarness.cleared, true);
lateCallbackReference({ result: "duplicate" });

const timeoutHarness = makeJsonpHarness();
const timeoutPromise = requestCheckInJsonp({
  endpoint: "https://api.invalid/exec",
  memberId: "GYM0042",
  globalObject: timeoutHarness.globalObject,
  documentObject: timeoutHarness.documentObject,
  setTimer: timeoutHarness.setTimer,
  clearTimer: timeoutHarness.clearTimer,
  now: () => 99,
  random: () => 0,
});
timeoutHarness.timeoutCallback();
assert.deepEqual(await timeoutPromise, { kind: "timeout" });
assert.equal(timeoutHarness.removed, true);

const errorHarness = makeJsonpHarness();
const errorPromise = requestCheckInJsonp({
  endpoint: "https://api.invalid/exec",
  memberId: "GYM0042",
  globalObject: errorHarness.globalObject,
  documentObject: errorHarness.documentObject,
  setTimer: errorHarness.setTimer,
  clearTimer: errorHarness.clearTimer,
  now: () => 100,
  random: () => 0,
});
errorHarness.script.onerror();
assert.deepEqual(await errorPromise, { kind: "error" });

console.log("Scanner core and JSONP lifecycle checks passed.");
