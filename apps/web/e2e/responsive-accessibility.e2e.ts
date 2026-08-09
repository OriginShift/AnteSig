import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";

const SCREENSHOTS = resolve("artifacts/screenshots");
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
const COMPACT_DESKTOP = { width: 1280, height: 720 };
const COMPACT_MOBILE = { width: 360, height: 800 };
const WRITE_SCREENSHOTS = process.env.E2E_WRITE_SCREENSHOTS !== "0";

async function runFixture(page: Page, name: "Happy path" | "Amount mismatch") {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page).toHaveTitle("AnteSig | Preflight Workbench");
  await expect(page.locator(".brand-name")).toHaveText("AnteSig");
  const logo = page.getByRole("img", { name: "AnteSig logo" });
  await expect(logo).toBeVisible();
  const logoGeometry = await logo.evaluate((image: HTMLImageElement) => ({
    renderedHeight: image.getBoundingClientRect().height,
    renderedWidth: image.getBoundingClientRect().width,
  }));
  const sourceGeometry = await page.evaluate(async () => {
    const source = new Image();
    source.src = "/brand/antesig-logo.png";
    await source.decode();
    return {
      naturalHeight: source.naturalHeight,
      naturalWidth: source.naturalWidth,
    };
  });
  expect(sourceGeometry.naturalWidth).toBe(1188);
  expect(sourceGeometry.naturalHeight).toBe(1168);
  expect(logoGeometry.renderedWidth / logoGeometry.renderedHeight).toBeCloseTo(
    1188 / 1168,
    2,
  );
  await page.getByRole("button", { name: "Fixture" }).click();
  await page.getByRole("button", { name }).click();
  await page.getByRole("button", { name: "Run preflight" }).click();
  await page.getByRole("heading", { name: "Three-way comparison" }).waitFor();
}

async function assertNoOverflowOrOverlap(page: Page) {
  const audit = await page.evaluate(() => {
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        box.width > 0
      );
    };
    const outside = [...document.querySelectorAll("body *")]
      .filter(visible)
      .map((element) => {
        const box = element.getBoundingClientRect();
        return {
          className: element.className,
          left: box.left,
          right: box.right,
          tag: element.tagName,
        };
      })
      .filter(
        (element) =>
          element.left < -0.5 || element.right > window.innerWidth + 0.5,
      )
      .slice(0, 20);
    const overflowingControls = [
      ...document.querySelectorAll("button, input, textarea"),
    ]
      .filter(visible)
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map(
        (element) => element.getAttribute("aria-label") ?? element.textContent,
      );
    const topLevel = [...document.querySelectorAll(".result-content > *")]
      .filter(visible)
      .map((element) => {
        const box = element.getBoundingClientRect();
        return { bottom: box.bottom, top: box.top, tag: element.tagName };
      });
    const overlaps = topLevel.flatMap((current, itemIndex) => {
      const next = topLevel[itemIndex + 1];
      return next && next.top < current.bottom - 0.5 ? [{ current, next }] : [];
    });
    return {
      documentWidth: document.documentElement.scrollWidth,
      outside,
      overflowingControls,
      overlaps,
      viewportWidth: window.innerWidth,
    };
  });

  expect(audit.documentWidth).toBeLessThanOrEqual(audit.viewportWidth);
  expect(audit.outside).toEqual([]);
  expect(audit.overflowingControls).toEqual([]);
  expect(audit.overlaps).toEqual([]);
}

async function assertColumnOrder(page: Page, mobile: boolean) {
  const boxes = await page
    .locator(".comparison-column")
    .evaluateAll((columns) =>
      columns.map((column) => {
        const box = column.getBoundingClientRect();
        return { left: box.left, top: box.top };
      }),
    );
  expect(boxes).toHaveLength(3);
  if (mobile) {
    expect(boxes[0]?.top).toBeLessThan(boxes[1]?.top ?? 0);
    expect(boxes[1]?.top).toBeLessThan(boxes[2]?.top ?? 0);
  } else {
    expect(Math.abs((boxes[0]?.top ?? 0) - (boxes[2]?.top ?? 0))).toBeLessThan(
      2,
    );
    expect(boxes[0]?.left).toBeLessThan(boxes[1]?.left ?? 0);
    expect(boxes[1]?.left).toBeLessThan(boxes[2]?.left ?? 0);
  }
}

async function assertWorkbenchHintInFirstViewport(page: Page) {
  const top = await page
    .locator("#preflight-workbench")
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(top).toBeLessThan(await page.evaluate(() => window.innerHeight));
}

async function contrastRatio(locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    const rgb = (value: string) => {
      const values = value.match(/[\d.]+/g)?.map(Number) ?? [];
      return values.slice(0, 3) as [number, number, number];
    };
    const luminance = (value: [number, number, number]) => {
      const channels = value.map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return (
        0.2126 * (channels[0] ?? 0) +
        0.7152 * (channels[1] ?? 0) +
        0.0722 * (channels[2] ?? 0)
      );
    };

    const foreground = rgb(getComputedStyle(element).color);
    let background = element;
    while (
      background.parentElement &&
      getComputedStyle(background).backgroundColor.endsWith(", 0)")
    ) {
      background = background.parentElement;
    }
    const first = luminance(foreground);
    const second = luminance(rgb(getComputedStyle(background).backgroundColor));
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  });
}

async function assertAccessibleControls(page: Page) {
  const controls = page.locator(
    "button:visible, input:visible, textarea:visible",
  );
  for (
    let itemIndex = 0;
    itemIndex < (await controls.count());
    itemIndex += 1
  ) {
    await expect(controls.nth(itemIndex)).toHaveAccessibleName(/\S/);
  }
  expect(
    await contrastRatio(page.locator(".command-button.primary")),
  ).toBeGreaterThanOrEqual(4.5);
  expect(
    await contrastRatio(page.locator(".comparison-sources a").first()),
  ).toBeGreaterThanOrEqual(4.5);
}

async function assertKeyboardDrawer(page: Page) {
  const trigger = page
    .locator(".capability-inspector")
    .getByRole("button", { name: "View raw JSON" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Capability evidence" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Close raw evidence" }),
  ).toHaveAttribute("title", "Close");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
}

async function captureScreenshot(page: Page, filename: string) {
  if (!WRITE_SCREENSHOTS) return;

  await page.evaluate(() => window.scrollTo({ left: 0, top: 0 }));
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  const runIds = page.locator('[data-run-id="true"]');
  for (let index = 0; index < (await runIds.count()); index += 1) {
    await runIds.nth(index).evaluate((element) => {
      element.textContent = "run_redacted-for-stable-qa";
    });
  }
  await page.screenshot({
    fullPage: true,
    path: resolve(SCREENSHOTS, filename),
  });
}

test.beforeAll(async () => mkdir(SCREENSHOTS, { recursive: true }));

test("responsive desktop happy", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await runFixture(page, "Happy path");
  await expect(page.locator(".decision-banner.manual-review")).toContainText(
    "Human review remains required",
  );
  const alignmentChecks = page.locator(".alignment-check");
  expect(await alignmentChecks.count()).toBeGreaterThan(0);
  expect(
    await alignmentChecks.evaluateAll((checks) =>
      checks.every((check) => check.classList.contains("pass")),
    ),
  ).toBe(true);
  await assertColumnOrder(page, false);
  await assertNoOverflowOrOverlap(page);
  await assertWorkbenchHintInFirstViewport(page);
  await captureScreenshot(page, "mini-desktop-happy.png");
  await captureScreenshot(page, "visual-1440x900-happy.png");
});

test("responsive desktop stop", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await runFixture(page, "Amount mismatch");
  await expect(page.locator(".decision-banner.stop")).toContainText(
    "DO_NOT_PROCEED_TO_SIGNER",
  );
  await expect(page.locator(".alignment-check.fail")).toContainText("FAIL");
  await expect(page.locator(".stop-details")).toContainText(
    "CRITICAL_ALIGNMENT_FAIL",
  );
  await assertColumnOrder(page, false);
  await assertNoOverflowOrOverlap(page);
  await captureScreenshot(page, "mini-desktop-stop.png");
});

test("responsive mobile happy", async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await runFixture(page, "Happy path");
  await assertColumnOrder(page, true);
  await assertNoOverflowOrOverlap(page);
  await assertWorkbenchHintInFirstViewport(page);
  await captureScreenshot(page, "mini-mobile-happy.png");
  await captureScreenshot(page, "visual-390x844-happy.png");
});

test("responsive mobile stop", async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await runFixture(page, "Amount mismatch");
  await expect(page.locator(".comparison-column.intent")).toContainText(
    "1000000000000000000",
  );
  await expect(page.locator(".comparison-column.prepared")).toContainText(
    "10000000000000000000",
  );
  await assertColumnOrder(page, true);
  await assertNoOverflowOrOverlap(page);
  await captureScreenshot(page, "mini-mobile-stop.png");
});

test("fixed compact desktop stop", async ({ page }) => {
  await page.setViewportSize(COMPACT_DESKTOP);
  await runFixture(page, "Amount mismatch");
  await assertColumnOrder(page, false);
  await assertNoOverflowOrOverlap(page);
  await assertWorkbenchHintInFirstViewport(page);
  await captureScreenshot(page, "visual-1280x720-stop.png");
});

test("fixed compact mobile stop", async ({ page }) => {
  await page.setViewportSize(COMPACT_MOBILE);
  await runFixture(page, "Amount mismatch");
  await assertColumnOrder(page, true);
  await assertNoOverflowOrOverlap(page);
  await assertWorkbenchHintInFirstViewport(page);
  await captureScreenshot(page, "visual-360x800-stop.png");
});

test("accessibility controls, keyboard, focus, contrast and reduced motion", async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await runFixture(page, "Happy path");
  await assertAccessibleControls(page);
  await assertKeyboardDrawer(page);

  const source = page.locator(".comparison-sources a").first();
  await source.focus();
  await expect(source).toBeFocused();
  expect(
    await source.evaluate((element) => getComputedStyle(element).outlineStyle),
  ).not.toBe("none");

  await page.emulateMedia({ reducedMotion: "reduce" });
  const animationName = await page.evaluate(() => {
    const indicator = document.createElement("span");
    indicator.className = "loading-indicator";
    document.body.append(indicator);
    const value = getComputedStyle(indicator).animationName;
    indicator.remove();
    return value;
  });
  expect(animationName).toBe("none");
  await expect(page.locator(".card .card, [class*='hero']")).toHaveCount(0);
});

test("accessibility loading and state-switch controls stay operable", async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Fixture" }).click();
  await page.getByRole("button", { name: "Happy path" }).click();
  await page.route(
    "**/api/preflight",
    async (route) => {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));
      await route.continue();
    },
    { times: 1 },
  );
  const run = page.getByRole("button", { name: "Run preflight" });
  const widthBefore = (await run.boundingBox())?.width;
  await run.click();
  const running = page.getByRole("button", { name: "Running preflight" });
  await expect(running).toBeDisabled();
  expect((await running.boundingBox())?.width).toBe(widthBefore);
  await page.getByRole("heading", { name: "Three-way comparison" }).waitFor();
  await assertNoOverflowOrOverlap(page);
});

test("disabled runtime keeps credential actions absent", async ({ page }) => {
  test.skip(
    process.env.CLEAR402_ENABLED === "true",
    "This assertion covers the default disabled runtime.",
  );
  await page.setViewportSize(DESKTOP);
  await runFixture(page, "Happy path");
  await expect(page.locator(".credential-actions")).toHaveCount(0);
  await expect(page.locator(".environment-item").last()).toHaveText(
    "Optional profile: disabled",
  );
  await assertNoOverflowOrOverlap(page);
});

test("provenance stays isolated through explicit Live failure fallback recovery", async ({
  page,
}) => {
  const payloads: Array<Record<string, unknown>> = [];
  page.on("request", (request) => {
    if (
      request.url().endsWith("/api/preflight") &&
      request.method() === "POST"
    ) {
      payloads.push(request.postDataJSON() as Record<string, unknown>);
    }
  });

  await page.setViewportSize(DESKTOP);
  await page.goto("/", { waitUntil: "networkidle" });
  await page
    .getByLabel("Account")
    .fill("0x47833B74E85e2847125e5c3F20B59f6eD063985A");
  await page
    .getByLabel("Output token address")
    .fill("0xFcd0DA3726376D618d88B4999Ca6030B18aA62aC");
  await page.getByLabel("Amount in").fill("1000000000000000000");
  await page.getByRole("button", { name: "Run preflight" }).click();

  const errorState = page.locator(".error-state");
  await expect(errorState).toContainText("LIVE_UNAVAILABLE");
  await expect(errorState).toContainText("LIVE");
  const liveRunId = await errorState
    .locator(".error-run-facts > div")
    .filter({ hasText: "Failed run ID" })
    .locator("dd")
    .textContent();
  expect(liveRunId).toMatch(/^run_[0-9a-f-]{36}$/);
  expect(payloads.map(({ mode }) => mode)).toEqual(["LIVE"]);
  await expect(page.locator(".result-content, .fixture-picker")).toHaveCount(0);

  const recoveryStartedAt = Date.now();
  await page.getByRole("button", { name: "Recover with Fixture" }).click();
  await expect(page.getByRole("button", { name: "Fixture" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const recovery = page.locator(".recovery-audit");
  await expect(recovery).toContainText("Live failure retained");
  await expect(recovery).toContainText("LIVE_UNAVAILABLE");
  await expect(recovery).toContainText(liveRunId ?? "");
  await expect(recovery).toContainText("awaiting Fixture run");
  expect(payloads.map(({ mode }) => mode)).toEqual(["LIVE"]);

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
  await expect(
    page
      .locator(".result-facts > div")
      .filter({ hasText: "Provenance" })
      .locator("dd"),
  ).toHaveText("FIXTURE");
  await expect(recovery).toContainText("Recovery sourceFIXTURE");
  await expect(recovery).toContainText(fixtureRunId ?? "");
  await expect(recovery).toContainText("Recovery stateCOMPLETE");
  await expect(recovery).toContainText("Evidence reuseNONE");

  await page
    .locator(".capability-inspector")
    .getByRole("button", { name: "View raw JSON" })
    .click();
  const rawDialog = page.getByRole("dialog", { name: "Capability evidence" });
  await expect(rawDialog.locator(".raw-drawer-provenance")).toHaveText(
    "Source: FIXTURE",
  );
  const rawArtifact = JSON.parse(
    await rawDialog.getByLabel("Capability evidence raw JSON").inputValue(),
  ) as Record<string, unknown>;
  expect(rawArtifact).toMatchObject({
    provenance: "FIXTURE",
    capability: { availability: "AVAILABLE" },
  });
  const rawDownloadPromise = page.waitForEvent("download");
  await rawDialog.getByRole("button", { name: "Download JSON" }).click();
  const rawDownload = await rawDownloadPromise;
  expect(rawDownload.suggestedFilename()).toBe(
    "antesig-fixture-capability-evidence.json",
  );
  const rawDownloadPath = await rawDownload.path();
  expect(rawDownloadPath).not.toBeNull();
  expect(
    JSON.parse(await readFile(rawDownloadPath ?? "", "utf8")),
  ).toMatchObject({ provenance: "FIXTURE" });
  await page.keyboard.press("Escape");

  if (process.env.CLEAR402_ENABLED === "true") {
    const credentialPanel = page.locator(".credential-actions");
    await expect(credentialPanel).toContainText("ProvenanceFIXTURE");
    const reportId = await page
      .locator(".result-facts > div")
      .filter({ hasText: "Report ID" })
      .locator("dd")
      .textContent();
    const credentialDownloadPromise = page.waitForEvent("download");
    await credentialPanel
      .getByRole("button", { name: "Export credential" })
      .click();
    const credentialDownload = await credentialDownloadPromise;
    const credentialDownloadPath = await credentialDownload.path();
    expect(credentialDownloadPath).not.toBeNull();
    expect(
      JSON.parse(await readFile(credentialDownloadPath ?? "", "utf8")),
    ).toMatchObject({
      report: { provenance: "FIXTURE", reportId },
    });
  }

  await assertNoOverflowOrOverlap(page);
  await captureScreenshot(
    page,
    process.env.CLEAR402_ENABLED === "true"
      ? "recovery-desktop-clear402.png"
      : "recovery-desktop-baseline.png",
  );
});

test.describe("Clear402 credential actions", () => {
  test.skip(
    process.env.CLEAR402_ENABLED !== "true",
    "Credential actions require the enabled runtime mode.",
  );

  test("credential export and verify remain keyboard operable", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await runFixture(page, "Happy path");
    const panel = page.locator(".credential-actions");

    await expect(panel).toContainText("UNSIGNED_INTEGRITY_EVIDENCE");
    await expect(panel).toContainText("FIXTURE");
    await expect(panel).toContainText("Original copy");
    const filename = await panel
      .locator(".credential-filename dd")
      .textContent();
    expect(filename).toMatch(/^antesig-clear402-v0\.1-[0-9a-f-]{36}\.json$/);

    const exportButton = panel.getByRole("button", {
      name: "Export credential",
    });
    await exportButton.focus();
    const download = page.waitForEvent("download");
    await page.keyboard.press("Enter");
    expect((await download).suggestedFilename()).toBe(filename);

    const verifyButton = panel.getByRole("button", {
      name: "Verify credential",
    });
    await verifyButton.focus();
    await page.keyboard.press("Enter");
    await expect(panel.locator(".credential-verification")).toContainText(
      "Integrity VALID",
    );
    await assertNoOverflowOrOverlap(page);
    await captureScreenshot(page, "credential-desktop-valid.png");
  });

  test("credential tamper changes only the copy and shows digest invalid", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await runFixture(page, "Happy path");
    const panel = page.locator(".credential-actions");
    const reportId = await page
      .locator(".result-facts > div")
      .filter({ has: page.locator("dt", { hasText: "Report ID" }) })
      .locator("dd")
      .textContent();
    const amount = await page
      .locator(".report-intent-facts > div")
      .filter({ has: page.locator("dt", { hasText: "Amount in" }) })
      .locator("dd")
      .textContent();

    await panel.getByRole("button", { name: "Tamper protected field" }).click();
    await expect(panel).toContainText("Protected field modified");
    await panel.getByRole("button", { name: "Verify credential" }).click();
    await expect(panel.locator(".credential-verification")).toContainText(
      "Digest INVALID",
    );
    await expect(page.locator(".decision-banner.manual-review")).toContainText(
      "MANUAL_REVIEW",
    );
    await expect(
      page
        .locator(".result-facts > div")
        .filter({ has: page.locator("dt", { hasText: "Report ID" }) })
        .locator("dd"),
    ).toHaveText(reportId ?? "");
    await expect(
      page
        .locator(".report-intent-facts > div")
        .filter({ has: page.locator("dt", { hasText: "Amount in" }) })
        .locator("dd"),
    ).toHaveText(amount ?? "");
    await assertNoOverflowOrOverlap(page);
    await captureScreenshot(page, "credential-mobile-tamper.png");
  });
});
