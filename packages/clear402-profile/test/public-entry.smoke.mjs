const resolvedEntry = import.meta.resolve("@moss-mini-demo/clear402-profile");
if (!resolvedEntry.endsWith("/dist/index.js")) {
  throw new Error(
    `public package entry resolved outside dist: ${resolvedEntry}`,
  );
}

const packageEntry = await import("@moss-mini-demo/clear402-profile");

if (
  typeof packageEntry.Clear402MonadActionCredentialV0_1Schema?.safeParse !==
  "function"
) {
  throw new Error("public package entry did not expose the credential schema");
}

for (const constantName of [
  "CLEAR402_CREDENTIAL_VERSION_V0_1",
  "CLEAR402_CREDENTIAL_TYPE_V0_1",
  "CLEAR402_PROFILE_V0_1",
  "CLEAR402_ASSURANCE_KIND_V0_1",
  "CLEAR402_ASSURANCE_STATEMENT_V0_1",
]) {
  if (typeof packageEntry[constantName] !== "string") {
    throw new Error(
      `public package entry did not expose ${constantName} at runtime`,
    );
  }
}

for (const functionName of [
  "canonicalizeClear402ReportV0_1",
  "clear402ReportProtectedBytesV0_1",
  "digestClear402ReportV0_1",
  "verifyClear402CredentialV0_1",
]) {
  if (typeof packageEntry[functionName] !== "function") {
    throw new Error(
      `public package entry did not expose ${functionName} at runtime`,
    );
  }
}
