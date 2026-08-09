import { expect, test } from "@playwright/test";

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
const EXPECTED_LIVE_UNAVAILABLE_DIAGNOSTIC =
  /^Failed to load resource: the server responded with a status of 503 \((?:Service Unavailable)?\)$/;
const EXPECTED_NETWORK_FAILURE_DIAGNOSTIC =
  /^Failed to load resource: net::ERR_(?:CONNECTION_FAILED|FAILED)$/;
const EXPECTED_TIMEOUT_DIAGNOSTIC =
  /^Failed to load resource: the server responded with a status of 504 \(Gateway Timeout\)$/;

const pageErrors = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !EXPECTED_LIVE_UNAVAILABLE_DIAGNOSTIC.test(message.text()) &&
      !EXPECTED_NETWORK_FAILURE_DIAGNOSTIC.test(message.text()) &&
      !EXPECTED_TIMEOUT_DIAGNOSTIC.test(message.text())
    ) {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

async function openWorkbench(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", { name: "Exact-input Swap preflight" }),
  ).toBeVisible();
}

async function fillLiveIntent(page) {
  await page
    .getByLabel("Account")
    .fill("0x47833B74E85e2847125e5c3F20B59f6eD063985A");
  await page
    .getByLabel("Output token address")
    .fill("0xFcd0DA3726376D618d88B4999Ca6030B18aA62aC");
  await page.getByLabel("Amount in").fill("1000000000000000000");
}

async function runFixture(page, name) {
  await page.getByRole("button", { name: "Fixture" }).click();
  await page.getByRole("button", { name }).click();
  await page.getByRole("button", { name: "Run preflight" }).click();
  await page.getByRole("heading", { name: "Three-way comparison" }).waitFor();
}

async function assertNoHorizontalOverflow(page) {
  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
}

async function assertJudgeComprehension(page, decision) {
  const headings = page.locator(".comparison-column h4");
  await expect(headings).toHaveText([
    "User request",
    "Agent prepared",
    "Simulation occurred",
  ]);
  await expect(page.locator(".decision-banner")).toContainText(decision);
  if (decision === "MANUAL_REVIEW") {
    await expect(page.locator(".decision-banner")).toContainText(
      "not an approval or authorization",
    );
  } else {
    await expect(page.locator(".stop-details")).toContainText(
      "CRITICAL_ALIGNMENT_FAIL",
    );
  }
}

test("false mode health and browser surface exclude Credential features", async ({
  page,
  request,
}) => {
  const healthResponse = await request.get("/api/health");
  expect(healthResponse.ok()).toBe(true);
  await expect(healthResponse.json()).resolves.toMatchObject({
    status: "ok",
    clear402: { enabled: false },
  });

  await openWorkbench(page, DESKTOP);
  await expect(page.locator("body")).not.toContainText(/clear402|credential/i);
  const resources = await page.evaluate(() =>
    performance.getEntriesByType("resource").map((entry) => entry.name),
  );
  expect(resources.filter((url) => /clear402|credential/i.test(url))).toEqual(
    [],
  );
  await assertNoHorizontalOverflow(page);
});

for (const [viewportName, viewport] of [
  ["desktop", DESKTOP],
  ["mobile", MOBILE],
]) {
  for (const [fixture, decision] of [
    ["Happy path", "MANUAL_REVIEW"],
    ["Amount mismatch", "STOP"],
  ]) {
    test(`${viewportName} ${fixture} preserves the complete evidence story`, async ({
      page,
    }) => {
      await openWorkbench(page, viewport);
      await runFixture(page, fixture);
      await assertJudgeComprehension(page, decision);
      await assertNoHorizontalOverflow(page);

      if (viewportName === "desktop" && fixture === "Happy path") {
        const trigger = page
          .locator(".capability-inspector")
          .getByRole("button", { name: "View raw JSON" });
        await trigger.focus();
        await page.keyboard.press("Enter");
        await expect(
          page.getByRole("dialog", { name: "Capability evidence" }),
        ).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(trigger).toBeFocused();
      }
    });
  }
}

test("Live failure remains fail-closed until explicit Fixture recovery with isolated provenance", async ({
  page,
}) => {
  const payloads = [];
  page.on("request", (request) => {
    if (
      request.url().endsWith("/api/preflight") &&
      request.method() === "POST"
    ) {
      payloads.push(request.postDataJSON());
    }
  });

  await openWorkbench(page, DESKTOP);
  await fillLiveIntent(page);
  const liveResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/preflight") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Run preflight" }).click();

  expect((await liveResponse).status()).toBe(503);
  await expect(page.locator(".error-state")).toContainText("LIVE_UNAVAILABLE");
  await expect(page.getByRole("button", { name: "Live" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".fixture-picker, .result-content")).toHaveCount(0);
  expect(payloads).toHaveLength(1);
  expect(payloads[0]).toMatchObject({ mode: "LIVE" });
  const liveRunId = await page
    .locator(".error-run-facts > div")
    .filter({ hasText: "Failed run ID" })
    .locator("dd")
    .textContent();
  expect(liveRunId).toMatch(/^run_[0-9a-f-]{36}$/);

  const recoveryStartedAt = Date.now();
  await page.getByRole("button", { name: "Recover with Fixture" }).click();
  await expect(page.locator(".recovery-audit")).toContainText(liveRunId ?? "");
  expect(payloads).toHaveLength(1);
  await page.getByRole("button", { name: "Happy path" }).click();
  await page.getByRole("button", { name: "Run preflight" }).click();
  await page.getByRole("heading", { name: "Three-way comparison" }).waitFor();
  expect(Date.now() - recoveryStartedAt).toBeLessThanOrEqual(15_000);

  const fixtureRunId = await page
    .locator(".result-facts > div")
    .filter({ hasText: "Run ID" })
    .locator("dd")
    .textContent();
  expect(fixtureRunId).toMatch(/^run_[0-9a-f-]{36}$/);
  expect(fixtureRunId).not.toBe(liveRunId);
  expect(payloads.map(({ mode }) => mode)).toEqual(["LIVE", "FIXTURE"]);
  await expect(page.locator(".provenance-value")).toHaveText("FIXTURE");
  const recovery = page.locator(".recovery-audit");
  await expect(recovery).toContainText(fixtureRunId ?? "");
  await expect(recovery).toContainText("Evidence reuseNONE");
  await page
    .locator(".capability-inspector")
    .getByRole("button", { name: "View raw JSON" })
    .click();
  const rawDialog = page.getByRole("dialog", { name: "Capability evidence" });
  await expect(rawDialog.locator(".raw-drawer-provenance")).toHaveText(
    "Source: FIXTURE",
  );
  await expect(
    rawDialog.getByLabel("Capability evidence raw JSON"),
  ).toHaveValue(/"provenance": "FIXTURE"/);
  await page.keyboard.press("Escape");
  await assertNoHorizontalOverflow(page);
});

test("network failure UI remains Live and never silently falls back", async ({
  page,
}) => {
  let requestCount = 0;
  await page.route(
    "**/api/preflight",
    async (route) => {
      requestCount += 1;
      await route.abort("connectionfailed");
    },
    { times: 1 },
  );

  await openWorkbench(page, DESKTOP);
  await fillLiveIntent(page);
  await page.getByRole("button", { name: "Run preflight" }).click();

  const error = page.locator(".error-state");
  await expect(error).toContainText("NETWORK");
  await expect(error).toContainText(
    "The preflight service could not be reached.",
  );
  await expect(error).toContainText("not returned by the server");
  await expect(
    error.getByRole("button", { name: "Recover with Fixture" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Live" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".fixture-picker, .result-content")).toHaveCount(0);
  expect(requestCount).toBe(1);
  await assertNoHorizontalOverflow(page);
});

test("API timeout UI preserves the strict error contract without a Decision", async ({
  page,
}) => {
  const timeoutRunId = "run_018f4ca2-7a44-4b81-9d7d-a6d4508cf21e";
  const payloads = [];
  page.on("request", (request) => {
    if (
      request.url().endsWith("/api/preflight") &&
      request.method() === "POST"
    ) {
      payloads.push(request.postDataJSON());
    }
  });
  await page.route(
    "**/api/preflight",
    (route) =>
      route.fulfill({
        status: 504,
        contentType: "application/json",
        body: JSON.stringify({
          contractVersion: "0.1",
          ok: false,
          runId: timeoutRunId,
          error: {
            code: "PREFLIGHT_TIMEOUT",
            message: "The preflight request exceeded its hard deadline.",
          },
        }),
      }),
    { times: 1 },
  );

  await openWorkbench(page, MOBILE);
  await fillLiveIntent(page);
  await page.getByRole("button", { name: "Run preflight" }).click();

  const error = page.locator(".error-state");
  await expect(error).toContainText("PREFLIGHT_TIMEOUT");
  await expect(error).toContainText(
    "The preflight request exceeded its hard deadline.",
  );
  await expect(error).toContainText(timeoutRunId);
  await expect(page.locator(".decision-banner, .result-content")).toHaveCount(
    0,
  );
  expect(payloads).toHaveLength(1);
  expect(payloads[0]).toMatchObject({ mode: "LIVE" });
  await assertNoHorizontalOverflow(page);
});

test("duplicate input and a cancelled stale response cannot replace the newest run", async ({
  page,
}) => {
  let requestCount = 0;
  let markFirstSeen;
  let releaseFirst;
  const firstSeen = new Promise((resolve) => {
    markFirstSeen = resolve;
  });
  const firstGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });

  await page.route("**/api/preflight", async (route) => {
    requestCount += 1;
    if (requestCount === 1) {
      markFirstSeen();
      await firstGate;
      await route.continue().catch(() => undefined);
      return;
    }
    await route.continue();
  });

  await openWorkbench(page, DESKTOP);
  await page.getByRole("button", { name: "Fixture" }).click();
  await page.getByRole("button", { name: "Happy path" }).click();
  await page.getByRole("button", { name: "Run preflight" }).click();
  await firstSeen;

  const running = page.getByRole("button", { name: "Running preflight" });
  await expect(running).toBeDisabled();
  await running.evaluate((button) => button.click());
  await page.waitForTimeout(100);
  expect(requestCount).toBe(1);

  await page.getByRole("button", { name: "Cancel run" }).click();
  await page.getByRole("button", { name: "Amount mismatch" }).click();
  await page.getByRole("button", { name: "Run preflight" }).click();
  await expect(page.locator(".decision-banner.stop")).toContainText("STOP");

  releaseFirst();
  await page.waitForTimeout(250);
  await expect(page.locator(".decision-banner.stop")).toContainText(
    "DO_NOT_PROCEED_TO_SIGNER",
  );
  await expect(page.locator(".result-facts")).toContainText("FIXTURE");
  expect(requestCount).toBe(2);
});
