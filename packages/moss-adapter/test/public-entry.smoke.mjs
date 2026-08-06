import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const builtEntry = new URL("../dist/index.js", import.meta.url).href;
const resolvedEntry = import.meta.resolve("@moss-mini-demo/moss-adapter");
if (!resolvedEntry.endsWith("/packages/moss-adapter/dist/index.js")) {
  throw new Error(
    `public package entry resolved outside moss-adapter dist: ${resolvedEntry}`,
  );
}

const packageEntry = await import("@moss-mini-demo/moss-adapter");
const runtimeExports = Object.keys(packageEntry).sort();
const expectedRuntimeExports = [
  "MOSS_BUILD_INFO",
  "MossAdapterError",
  "createFakeMossPort",
  "createProductionMossPort",
];
assert.deepEqual(runtimeExports, expectedRuntimeExports);
assert.equal(
  packageEntry.MOSS_BUILD_INFO.integrationCommit,
  "1ae6b6322d51fae9104f047efb94e601050b967f",
);
assert.equal(packageEntry.MOSS_BUILD_INFO.officialRelease, false);

for (const typeOnlyName of [
  "MossPort",
  "MossSourceBindings",
  "RawOperationContract",
  "RawCapabilityEvidence",
  "RawSimulationEvidence",
]) {
  assert.equal(typeOnlyName in packageEntry, false);
}

const browserLikeImport = spawnSync(
  process.execPath,
  [
    "--input-type=module",
    "--eval",
    `await import(${JSON.stringify(builtEntry)})`,
  ],
  { cwd: repositoryRoot, encoding: "utf8" },
);
assert.notEqual(browserLikeImport.status, 0);
assert.match(browserLikeImport.stderr, /Client Component module/);

console.log("moss-adapter public entry and server-only boundary passed.");
