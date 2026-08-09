import {
  type Clear402MonadActionCredentialV0_1,
  Clear402MonadActionCredentialV0_1Schema,
} from "@moss-mini-demo/clear402-profile";
import type { Clear402VerifyResponse } from "../contracts/clear402";

export type CredentialExport = Readonly<{
  filename: string;
  mediaType: "application/json";
  text: string;
}>;

export function credentialExport(
  credential: Clear402MonadActionCredentialV0_1,
): CredentialExport {
  const parsed = Clear402MonadActionCredentialV0_1Schema.parse(credential);
  return {
    filename: `antesig-clear402-v${parsed.credentialVersion}-${parsed.report.reportId}.json`,
    mediaType: "application/json",
    text: `${JSON.stringify(parsed, null, 2)}\n`,
  };
}

export function credentialCopy(
  credential: Clear402MonadActionCredentialV0_1,
): Clear402MonadActionCredentialV0_1 {
  return structuredClone(credential);
}

export function tamperProtectedReportCopy(
  credential: Clear402MonadActionCredentialV0_1,
): Clear402MonadActionCredentialV0_1 {
  const copy = credentialCopy(credential);
  return Clear402MonadActionCredentialV0_1Schema.parse({
    ...copy,
    report: {
      ...copy.report,
      generatedAt:
        copy.report.generatedAt === "2031-03-04T05:06:08.000Z"
          ? "2032-03-04T05:06:08.000Z"
          : "2031-03-04T05:06:08.000Z",
    },
  });
}

export function credentialVerificationLabel(
  result: Clear402VerifyResponse,
): string {
  if (result.ok) return "Integrity VALID";
  if ("integrity" in result) {
    return result.error.code === "DIGEST_INVALID"
      ? "Digest INVALID"
      : "Schema INVALID";
  }
  return "Verification unavailable";
}
