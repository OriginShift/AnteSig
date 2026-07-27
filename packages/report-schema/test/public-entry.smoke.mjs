const resolvedEntry = import.meta.resolve("@moss-mini-demo/report-schema");
if (!resolvedEntry.endsWith("/dist/index.js")) {
  throw new Error(
    `public package entry resolved outside dist: ${resolvedEntry}`,
  );
}

const packageEntry = await import("@moss-mini-demo/report-schema");

if (typeof packageEntry.PreflightReportSchema?.safeParse !== "function") {
  throw new Error(
    "public package entry did not expose PreflightReportSchema at runtime",
  );
}
