import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";

const SCREENSHOTS = resolve("artifacts/screenshots");
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
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

  const runId = page
    .locator(".result-facts > div")
    .filter({ has: page.locator("dt", { hasText: "Run ID" }) })
    .locator("dd");
  await runId.evaluate((element) => {
    element.textContent = "run_redacted-for-stable-qa";
  });
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
  await captureScreenshot(page, "mini-desktop-happy.png");
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
  await captureScreenshot(page, "mini-mobile-happy.png");
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
