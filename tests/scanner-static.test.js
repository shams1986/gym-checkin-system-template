const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("scanner/index.html");
const app = read("scanner/app.js");
const core = read("scanner/core.mjs");
const css = read("scanner/styles.css");
const manifest = JSON.parse(read("scanner/manifest.json"));
const scannerWeb = read("apps-script/ScannerWeb.gs");
const webApp = read("apps-script/WebApp.gs");
const generatedScannerJs = read("apps-script/Scanner.js.html");

["camera", "screen", "gym-logo", "gym-name", "title", "member-name", "training-name", "subtitle", "message", "camera-status", "sound-hint", "retry-camera"].forEach((id) => {
  assert.match(html, new RegExp(`id=["']${id}["']`));
});
assert.match(html, /type="module" src="\.\/app\.js"/);
assert.match(html, /src="\.\/config\.js"/);
assert.equal(manifest.orientation, "landscape");
assert.equal(manifest.display, "standalone");
assert.match(css, /max-height:\s*620px/);
assert.match(css, /orientation:\s*landscape/);
assert.match(css, /prefers-reduced-motion/);

assert.doesNotMatch(app, /title[^\n]*indexOf|includes\([^\n]*title/i);
assert.doesNotMatch(`${app}\n${core}`, /CHECKIN_REMINDER|Training_Schedule|MONDAY|TUESDAY|WEDNESDAY/);
assert.doesNotMatch(`${html}\n${app}\n${core}`, /AXIS|AJJ|script\.google\.com/i);
assert.match(core, /JSONP_TIMEOUT_MS = 20000/);
assert.match(core, /function normalizeBackendState/);
assert.match(app, /preferredCamera: config\.scanner\.behavior\.preferredCamera/);
assert.match(app, /new Set\(\["localhost", "127\.0\.0\.1", "::1"\]\)/);
assert.match(app, /\.\.\/tests\/fixtures\/scanner-states\.json/);

function loadConfig(file) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(read(file), context);
  return JSON.parse(JSON.stringify(context.window.GYM_PUBLIC_CONFIG));
}

function shape(value) {
  if (Array.isArray(value)) return value.length ? [shape(value[0])] : [];
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, shape(value[key])]));
  }
  return typeof value;
}

assert.deepEqual(shape(loadConfig("scanner/config.js")), shape(loadConfig("scanner/config.example.js")));
assert.equal(loadConfig("scanner/config.js").integration.checkInEndpoint, "");
assert.doesNotThrow(() => new vm.Script(generatedScannerJs, { filename: "Scanner.js" }));
assert.match(webApp, /if \(!api && !callback\) \{\s*return renderScannerApp_\(\)/);
assert.match(scannerWeb, /getPublicScannerConfig_\(\)/);
assert.match(scannerWeb, /function includeScannerScript_/);
assert.ok(scannerWeb.includes('replace(/<\\//g, "<\\\\/")'));

console.log("Scanner static, responsive, and config-shape checks passed.");
