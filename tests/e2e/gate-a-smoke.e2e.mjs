import { expect, test } from "@playwright/test";

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
const EXPECTED_LIVE_UNAVAILABLE_DIAGNOSTIC =
  "Failed to load resource: the server responded with a status of 503 (Service Unavailable)";

const pageErrors = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      message.text() !== EXPECTED_LIVE_UNAVAILABLE_DIAGNOSTIC
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
    "User intent",
    "Agent prepared",
    "Simulation observed",
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
    await expect(page.locator(".comparison-primary-value > strong")).toHaveText(
      ["1.00", "10.00", "10.00"],
    );
    await expect(page.locator(".simulation-boundary-note")).toContainText(
      "Success is not permission to sign",
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

test("Live failure remains fail-closed without Fixture fallback", async ({
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
  await page
    .getByLabel("Account")
    .fill("0x47833B74E85e2847125e5c3F20B59f6eD063985A");
  await page
    .getByLabel("Output token address")
    .fill("0xFcd0DA3726376D618d88B4999Ca6030B18aA62aC");
  await page.getByLabel("Amount in").fill("1000000000000000000");
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
