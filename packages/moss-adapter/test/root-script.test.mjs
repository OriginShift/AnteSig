import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("root release commands", () => {
  it("exposes the Gate C live smoke through the pinned Moss adapter", async () => {
    const packageJson = JSON.parse(
      await readFile(resolve(process.cwd(), "package.json"), "utf8"),
    );

    expect(packageJson.scripts?.["test:live"]).toBe(
      "pnpm --filter @moss-mini-demo/moss-adapter test:live",
    );
  });
});
