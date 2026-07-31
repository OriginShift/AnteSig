const resolvedEntry = import.meta.resolve("@moss-mini-demo/report-schema");
if (!resolvedEntry.endsWith("/dist/index.js")) {
  throw new Error(
    `public package entry resolved outside dist: ${resolvedEntry}`,
  );
}

const packageEntry = await import("@moss-mini-demo/report-schema");

for (const schemaName of [
  "PreflightReportSchema",
  "DecisionInputV0_1Schema",
  "StopReasonCodeV0_1Schema",
]) {
  if (typeof packageEntry[schemaName]?.safeParse !== "function") {
    throw new Error(
      `public package entry did not expose ${schemaName} at runtime`,
    );
  }
}

if (!Array.isArray(packageEntry.STOP_REASON_CODES_V0_1)) {
  throw new Error(
    "public package entry did not expose STOP_REASON_CODES_V0_1 at runtime",
  );
}
