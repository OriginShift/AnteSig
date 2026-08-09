import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const FIXTURE_REQUEST = {
  contractVersion: "0.1",
  mode: "FIXTURE",
  scenario: "manual-review-success",
};
const ACCOUNT = "0x47833B74E85e2847125e5c3F20B59f6eD063985A";
const OUTPUT_TOKEN = "0xFcd0DA3726376D618d88B4999Ca6030B18aA62aC";
const LIVE_INTENT = {
  account: ACCOUNT,
  inputAsset: { kind: "NATIVE" },
  outputAsset: { kind: "ERC20", address: OUTPUT_TOKEN },
  inputAmount: "1000000000000000000",
  maxSlippageBps: 50,
  allowedProtocols: ["pancakeswap-v2"],
};
const PREFLIGHT_REQUEST_LIMIT = 65_536;
const PREFLIGHT_RESPONSE_LIMIT = 2_097_152;
const VERIFY_REQUEST_LIMIT = 2_097_152;
const SAMPLE_COUNT = 10;
const LIVE_ATTEMPT_COUNT = 5;
const LARGE_RAW_BYTES = 1_500_000;
const THRESHOLDS = {
  fixtureResponseMs: { target: 300, hard: 1_000 },
  firstInteractiveMs: { target: 2_000, hard: 4_000 },
  credentialVerifyMs: { target: 100, hard: 500 },
  exportJsonBytes: { target: 2_000_000, hard: 5_000_000 },
  largeRawRenderMs: { target: 2_000, hard: 4_000 },
};

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function availablePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  const port = address.port;
  server.close();
  await once(server, "close");
  return port;
}

async function terminate(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (child.pid === undefined) throw new Error("Production process has no pid");
  if (process.platform === "win32") child.kill("SIGTERM");
  else process.kill(-child.pid, "SIGTERM");
  const exited = await Promise.race([
    once(child, "exit").then(() => true),
    sleep(5_000).then(() => false),
  ]);
  if (!exited) {
    if (process.platform === "win32") child.kill("SIGKILL");
    else process.kill(-child.pid, "SIGKILL");
    await once(child, "exit");
    throw new Error("Production process required forced cleanup");
  }
}

async function postJson(baseUrl, path, value) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`, {
    body: JSON.stringify(value),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const text = await response.text();
  const elapsed = performance.now() - started;
  return {
    bytes: new TextEncoder().encode(text).byteLength,
    elapsed,
    json: JSON.parse(text),
    status: response.status,
  };
}

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
  ];
}

function summarize(values, thresholds) {
  const rounded = values.map((value) => Number(value.toFixed(2)));
  const p95 = percentile(values, 0.95);
  return {
    samples: rounded,
    min: Number(Math.min(...values).toFixed(2)),
    median: Number(percentile(values, 0.5).toFixed(2)),
    p95: Number(p95.toFixed(2)),
    max: Number(Math.max(...values).toFixed(2)),
    target: thresholds.target,
    hardFail: thresholds.hard,
    status:
      p95 < thresholds.target
        ? "PASS"
        : p95 <= thresholds.hard
          ? "TARGET_MISS"
          : "HARD_FAIL",
  };
}

function summarizeBytes(values, thresholds) {
  return summarize(values, thresholds);
}

function healthUrl(baseUrl) {
  return `${baseUrl}/api/health`;
}

async function waitForServer(baseUrl, child, logs) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Production server exited early.\n${logs()}`);
    }
    try {
      const response = await fetch(healthUrl(baseUrl));
      if (response.status === 200) return;
    } catch {
      // The server may still be binding its loopback port.
    }
    await sleep(200);
  }
  throw new Error(`Health endpoint did not become ready.\n${logs()}`);
}

function liveError(value) {
  assert.equal(value.code, "LIVE_UNAVAILABLE");
  assert.match(value.message, /unavailable/i);
}

function metricStatus(metric) {
  return metric.status === "HARD_FAIL" ? "HARD_FAIL" : metric.status;
}

async function activateFixture(page) {
  const fixture = page.getByRole("button", { name: "Fixture" });
  const deadline = Date.now() + THRESHOLDS.firstInteractiveMs.hard;
  while (Date.now() < deadline) {
    await fixture.click();
    if ((await fixture.getAttribute("aria-pressed")) === "true") {
      return page.evaluate(() => performance.now());
    }
    await page.waitForTimeout(25);
  }
  throw new Error(
    "Fixture control did not become interactive within 4 seconds",
  );
}

const port = await availablePort();
const baseUrl = `http://127.0.0.1:${port}`;
const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const child = spawn(command, ["start"], {
  cwd: ROOT,
  detached: process.platform !== "win32",
  env: {
    ...process.env,
    CLEAR402_ENABLED: "true",
    HOSTNAME: "127.0.0.1",
    NEXT_TELEMETRY_DISABLED: "1",
    PORT: String(port),
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
const appendLogs = (chunk) => {
  logs = `${logs}${chunk.toString()}`.slice(-16_384);
};
child.stdout.on("data", appendLogs);
child.stderr.on("data", appendLogs);

const browser = await chromium.launch({ headless: true });
const failures = [];
let result;

try {
  await waitForServer(baseUrl, child, () => logs);
  const health = await fetch(healthUrl(baseUrl));
  assert.equal(health.status, 200);
  const healthJson = await health.json();
  assert.equal(healthJson.clear402.enabled, true);
  assert.equal(healthJson.network.configured, false);

  await postJson(baseUrl, "/api/preflight", FIXTURE_REQUEST);
  const fixtureTimes = [];
  const fixtureBytes = [];
  let fixtureResponse;
  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    const measured = await postJson(baseUrl, "/api/preflight", FIXTURE_REQUEST);
    assert.equal(measured.status, 200);
    assert.equal(measured.json.ok, true);
    assert.equal(measured.json.mode, "FIXTURE");
    assert.equal(measured.json.clear402.status, "AVAILABLE");
    fixtureTimes.push(measured.elapsed);
    fixtureBytes.push(measured.bytes);
    fixtureResponse = measured.json;
  }

  const liveTimes = [];
  const liveBytes = [];
  const liveRunIds = new Set();
  for (let index = 0; index < LIVE_ATTEMPT_COUNT; index += 1) {
    const measured = await postJson(baseUrl, "/api/preflight", {
      contractVersion: "0.1",
      mode: "LIVE",
      intent: LIVE_INTENT,
    });
    assert.equal(measured.status, 503);
    assert.equal(measured.json.ok, false);
    liveError(measured.json.error);
    assert.match(measured.json.runId, /^run_[0-9a-f-]{36}$/);
    liveRunIds.add(measured.json.runId);
    liveTimes.push(measured.elapsed);
    liveBytes.push(measured.bytes);
  }
  assert.equal(liveRunIds.size, LIVE_ATTEMPT_COUNT);

  assert(fixtureResponse);
  const credential = fixtureResponse.clear402.credential;
  const exported = `${JSON.stringify(credential, null, 2)}\n`;
  const exportBytes = new TextEncoder().encode(exported).byteLength;
  assert(exportBytes < 2_000_000);
  const verifyTimes = [];
  const verifyBytes = [];
  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    const measured = await postJson(baseUrl, "/api/verify", credential);
    assert.equal(measured.status, 200);
    assert.deepEqual(measured.json, { ok: true, integrity: "VALID" });
    verifyTimes.push(measured.elapsed);
    verifyBytes.push(measured.bytes);
  }

  const preflightOverflow = await postJson(baseUrl, "/api/preflight", {
    padding: "x".repeat(PREFLIGHT_REQUEST_LIMIT),
  });
  assert.equal(preflightOverflow.status, 413);
  assert.equal(preflightOverflow.json.error.code, "REQUEST_TOO_LARGE");
  const verifyOverflow = await postJson(baseUrl, "/api/verify", {
    padding: "x".repeat(VERIFY_REQUEST_LIMIT),
  });
  assert.equal(verifyOverflow.status, 413);
  assert.equal(verifyOverflow.json.error.code, "REQUEST_TOO_LARGE");

  const firstInteractiveTimes = [];
  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    firstInteractiveTimes.push(await activateFixture(page));
    await context.close();
  }

  const largeRawResponse = structuredClone(fixtureResponse);
  delete largeRawResponse.clear402;
  largeRawResponse.report.capability.raw = {
    synthetic: "x".repeat(LARGE_RAW_BYTES),
  };
  const largeRawText = JSON.stringify(largeRawResponse);
  assert(
    new TextEncoder().encode(largeRawText).byteLength <
      PREFLIGHT_RESPONSE_LIMIT,
  );
  const largeContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const largePage = await largeContext.newPage();
  await largePage.goto(baseUrl, { waitUntil: "networkidle" });
  await activateFixture(largePage);
  await largePage.getByRole("button", { name: "Happy path" }).click();
  await largePage.route(
    "**/api/preflight",
    (route) =>
      route.fulfill({
        body: largeRawText,
        headers: {
          "cache-control": "no-store",
          "content-type": "application/json; charset=utf-8",
        },
        status: 200,
      }),
    { times: 1 },
  );
  const largeStarted = performance.now();
  await largePage.getByRole("button", { name: "Run preflight" }).click();
  await largePage
    .getByRole("heading", { name: "Three-way comparison" })
    .waitFor();
  const largeRawRenderMs = performance.now() - largeStarted;
  const drawerStarted = performance.now();
  await largePage
    .locator(".capability-inspector")
    .getByRole("button", { name: "View raw JSON" })
    .click();
  const rawDialog = largePage.getByRole("dialog", {
    name: "Capability evidence",
  });
  await rawDialog.waitFor();
  const largeDrawerMs = performance.now() - drawerStarted;
  const rawJsonLength = (
    await rawDialog.getByLabel("Capability evidence raw JSON").inputValue()
  ).length;
  assert(rawJsonLength >= LARGE_RAW_BYTES);
  await largeContext.close();

  const timeoutContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const timeoutPage = await timeoutContext.newPage();
  await timeoutPage.goto(baseUrl, { waitUntil: "networkidle" });
  await timeoutPage.getByLabel("Account").fill(ACCOUNT);
  await timeoutPage.getByLabel("Output token address").fill(OUTPUT_TOKEN);
  await timeoutPage.getByLabel("Amount in").fill(LIVE_INTENT.inputAmount);
  await timeoutPage.route(
    "**/api/preflight",
    (route) =>
      route.fulfill({
        body: JSON.stringify({
          contractVersion: "0.1",
          ok: false,
          runId: "run_00000000-0000-4000-8000-000000000001",
          error: {
            code: "PREFLIGHT_TIMEOUT",
            message: "The preflight request exceeded its hard deadline.",
          },
        }),
        headers: { "content-type": "application/json; charset=utf-8" },
        status: 504,
      }),
    { times: 1 },
  );
  const timeoutStarted = performance.now();
  await timeoutPage.getByRole("button", { name: "Run preflight" }).click();
  await timeoutPage.locator(".error-state").waitFor();
  assert.match(
    await timeoutPage.locator(".error-state").textContent(),
    /PREFLIGHT_TIMEOUT/,
  );
  assert.match(
    await timeoutPage.locator(".error-state").textContent(),
    /hard deadline/,
  );
  const timeoutVisibleMs = performance.now() - timeoutStarted;
  await timeoutContext.close();

  result = {
    schemaVersion: "0.1",
    subjectSha: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim(),
    environment: {
      node: process.version,
      pnpm: execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim(),
      platform: `${process.platform}/${process.arch}`,
      browser: "Playwright Chromium",
      clear402Enabled: true,
      networkConfigured: false,
    },
    thresholds: THRESHOLDS,
    fixtureResponseMs: summarize(fixtureTimes, THRESHOLDS.fixtureResponseMs),
    fixtureResponseBytes: summarizeBytes(fixtureBytes, {
      target: 2_000_000,
      hard: 5_000_000,
    }),
    liveAttempts: {
      count: LIVE_ATTEMPT_COUNT,
      status: "LIVE_UNAVAILABLE",
      responseMs: {
        ...summarize(liveTimes, { target: 8_000, hard: 12_000 }),
        status: "OBSERVED_ONLY",
      },
      responseBytes: {
        ...summarizeBytes(liveBytes, {
          target: 2_000_000,
          hard: 5_000_000,
        }),
        status: "OBSERVED_ONLY",
      },
    },
    liveQuoteMs: {
      status: "NOT_MEASURED",
      reason:
        "MOSS_RPC_URL is not configured and the Web route has no live session.",
    },
    livePreflightMs: {
      status: "NOT_MEASURED",
      reason:
        "MOSS_RPC_URL is not configured and the Web route has no live session.",
    },
    firstInteractiveMs: summarize(
      firstInteractiveTimes,
      THRESHOLDS.firstInteractiveMs,
    ),
    credentialVerifyMs: summarize(verifyTimes, THRESHOLDS.credentialVerifyMs),
    credentialVerifyResponseBytes: summarizeBytes(verifyBytes, {
      target: 16_384,
      hard: 5_000_000,
    }),
    exportJsonBytes: {
      bytes: exportBytes,
      target: 2_000_000,
      hardFail: 5_000_000,
      status:
        exportBytes < 2_000_000
          ? "PASS"
          : exportBytes <= 5_000_000
            ? "TARGET_MISS"
            : "HARD_FAIL",
    },
    largeRawEvidence: {
      injectedBytes: LARGE_RAW_BYTES,
      responseBytes: new TextEncoder().encode(largeRawText).byteLength,
      renderMs: Number(largeRawRenderMs.toFixed(2)),
      drawerMs: Number(largeDrawerMs.toFixed(2)),
      status:
        largeRawRenderMs <= THRESHOLDS.largeRawRenderMs.hard &&
        largeDrawerMs <= 1_000
          ? "PASS"
          : "HARD_FAIL",
    },
    timeoutVisibility: {
      visibleMs: Number(timeoutVisibleMs.toFixed(2)),
      status: timeoutVisibleMs <= 4_000 ? "PASS" : "HARD_FAIL",
    },
    sizeGuards: {
      preflightRequest413: true,
      verifyRequest413: true,
      preflightResponseLimitBytes: PREFLIGHT_RESPONSE_LIMIT,
      verifyRequestLimitBytes: VERIFY_REQUEST_LIMIT,
    },
    verdict: "PASS_WITH_LIVE_SCOPE_CUT",
  };

  const metrics = [
    result.fixtureResponseMs,
    result.firstInteractiveMs,
    result.credentialVerifyMs,
    result.exportJsonBytes,
    result.largeRawEvidence,
    result.timeoutVisibility,
  ];
  for (const metric of metrics) {
    if (metricStatus(metric) === "HARD_FAIL") failures.push(metric);
  }
  if (failures.length > 0) result.verdict = "NO-GO";
  console.log(JSON.stringify(result, null, 2));
  if (failures.length > 0) process.exitCode = 1;
} finally {
  await browser.close();
  await terminate(child);
}
