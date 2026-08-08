const resolvedEntry = import.meta.resolve("@moss-mini-demo/preflight-core");
if (!resolvedEntry.endsWith("/packages/preflight-core/dist/index.js")) {
  throw new Error(
    `public package entry resolved outside preflight-core dist: ${resolvedEntry}`,
  );
}

const packageEntry = await import("@moss-mini-demo/preflight-core");
const runtimeExports = Object.keys(packageEntry).sort();
const expectedRuntimeExports = [
  "AlignmentInputErrorV0_1",
  "evaluateAlignmentV0_1",
];
if (JSON.stringify(runtimeExports) !== JSON.stringify(expectedRuntimeExports)) {
  throw new Error(
    `unexpected preflight-core runtime exports: ${runtimeExports.join(", ")}`,
  );
}

let boundaryError;
try {
  packageEntry.evaluateAlignmentV0_1({ schemaVersion: "0.2" });
} catch (error) {
  boundaryError = error;
}
if (!(boundaryError instanceof packageEntry.AlignmentInputErrorV0_1)) {
  throw new Error("invalid input did not throw AlignmentInputErrorV0_1");
}
if (boundaryError.code !== "UNSUPPORTED_SCHEMA_VERSION") {
  throw new Error(`unexpected boundary error code: ${boundaryError.code}`);
}

for (const typeOnlyName of [
  "AlignmentCheckIdV0_1",
  "AlignmentFactValueV0_1",
  "AlignmentInputV0_1",
  "AlignmentMovementV0_1",
  "AlignmentObservationV0_1",
  "AlignmentStateStatusV0_1",
  "AlignmentTransactionTargetV0_1",
  "AlignmentVerificationStatusV0_1",
]) {
  if (typeOnlyName in packageEntry) {
    throw new Error(`${typeOnlyName} must not exist at runtime`);
  }
}
