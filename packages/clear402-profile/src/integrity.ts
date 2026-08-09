import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import {
  PreflightReportSchema,
  type PreflightReport,
} from "@moss-mini-demo/report-schema";
import canonicalize from "canonicalize";
import {
  type Clear402MonadActionCredentialV0_1,
  Clear402MonadActionCredentialV0_1Schema,
} from "./schema.js";

export type Clear402ReportDigestV0_1 = `sha256:${string}`;

export type Clear402VerificationResultV0_1 =
  | Readonly<{
      valid: true;
      integrity: "VALID";
      credential: Clear402MonadActionCredentialV0_1;
    }>
  | Readonly<{
      valid: false;
      integrity: "INVALID";
      error: Readonly<{
        code: "SCHEMA_INVALID" | "DIGEST_INVALID";
      }>;
    }>;

function validatedReport(value: unknown): PreflightReport {
  return PreflightReportSchema.parse(value);
}

function canonicalizeValidatedReport(report: PreflightReport): string {
  const canonical = canonicalize(report);
  /* v8 ignore next -- the strict report schema admits only canonicalizable JSON */
  if (canonical === undefined) {
    throw new TypeError(
      "The validated report cannot be RFC 8785 canonicalized",
    );
  }
  return canonical;
}

function schemaInvalid(): Clear402VerificationResultV0_1 {
  return Object.freeze({
    valid: false,
    integrity: "INVALID",
    error: Object.freeze({ code: "SCHEMA_INVALID" }),
  });
}

function digestInvalid(): Clear402VerificationResultV0_1 {
  return Object.freeze({
    valid: false,
    integrity: "INVALID",
    error: Object.freeze({ code: "DIGEST_INVALID" }),
  });
}

export function canonicalizeClear402ReportV0_1(report: unknown): string {
  return canonicalizeValidatedReport(validatedReport(report));
}

export function clear402ReportProtectedBytesV0_1(report: unknown): Uint8Array {
  return utf8ToBytes(canonicalizeClear402ReportV0_1(report));
}

export function digestClear402ReportV0_1(
  report: unknown,
): Clear402ReportDigestV0_1 {
  return `sha256:${bytesToHex(sha256(clear402ReportProtectedBytesV0_1(report)))}`;
}

export function verifyClear402CredentialV0_1(
  value: unknown,
): Clear402VerificationResultV0_1 {
  let parsed: ReturnType<
    typeof Clear402MonadActionCredentialV0_1Schema.safeParse
  >;
  try {
    parsed = Clear402MonadActionCredentialV0_1Schema.safeParse(value);
  } catch {
    return schemaInvalid();
  }
  if (!parsed.success) {
    return schemaInvalid();
  }

  let recomputedDigest: Clear402ReportDigestV0_1;
  try {
    recomputedDigest = digestClear402ReportV0_1(parsed.data.report);
    /* v8 ignore next -- the parsed strict report is canonicalizable by contract */
  } catch {
    /* v8 ignore next -- retained for a third-party canonicalizer failure */
    return schemaInvalid();
  }
  if (recomputedDigest !== parsed.data.integrity.reportDigest) {
    return digestInvalid();
  }

  return Object.freeze({
    valid: true,
    integrity: "VALID",
    credential: parsed.data,
  });
}
