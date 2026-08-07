import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Node types are owned by the existing Web package; this package adds no dependency.
// @ts-expect-error -- runtime-only smoke uses the Node 22 built-in module.
const { spawnSync } = await import("node:child_process");

declare const process: { readonly execPath: string };

const repositoryRoot = new URL("../../../", import.meta.url);
const builtEntry = new URL("../dist/index.js", import.meta.url).href;
const importProgram = `await import(${JSON.stringify(builtEntry)})`;

function importPackage(conditions: readonly string[]) {
  return spawnSync(
    process.execPath,
    [...conditions, "--input-type=module", "--eval", importProgram],
    { cwd: repositoryRoot, encoding: "utf8" },
  );
}

describe("moss-adapter server-only boundary", () => {
  it("keeps the source entry limited to the approved runtime exports", async () => {
    const entry = await import("../src/index.js");

    expect(Object.keys(entry).sort()).toEqual([
      "MOSS_BUILD_INFO",
      "MossAdapterError",
      "collectAndSelectQuotesV0_1",
      "constructCapabilityV0_1",
      "createFakeMossPort",
      "createProductionMossPort",
    ]);
  });

  it("imports its public package under the server condition", () => {
    const result = importPackage(["--conditions=react-server"]);

    expect(result.status, result.stderr).toBe(0);
  });

  it("fails closed without the server condition", () => {
    const result = importPackage([]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Client Component module");
  });
});
