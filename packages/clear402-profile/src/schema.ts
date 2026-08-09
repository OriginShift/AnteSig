import { PreflightReportSchema } from "@moss-mini-demo/report-schema";
import { z } from "zod";

export const CLEAR402_CREDENTIAL_VERSION_V0_1 = "0.1" as const;
export const CLEAR402_CREDENTIAL_TYPE_V0_1 =
  "clear402.monad-action.preflight" as const;
export const CLEAR402_PROFILE_V0_1 = "clear402.monad-action.v0.1" as const;
export const CLEAR402_ASSURANCE_KIND_V0_1 =
  "UNSIGNED_INTEGRITY_EVIDENCE" as const;
export const CLEAR402_ASSURANCE_STATEMENT_V0_1 =
  "Unsigned integrity evidence only. The digest checks the enclosed report after RFC 8785 canonicalization; it does not establish signer identity, authenticity, authorization, safety, freshness, or protection from deliberate digest replacement." as const;

const ReportDigestV0_1Schema = z.string().regex(/^sha256:[0-9a-f]{64}$/);

const CredentialIntegrityV0_1Schema = z.strictObject({
  canonicalization: z.literal("RFC8785"),
  digestAlgorithm: z.literal("sha256"),
  reportDigest: ReportDigestV0_1Schema,
});

const CredentialAssuranceV0_1Schema = z.strictObject({
  kind: z.literal(CLEAR402_ASSURANCE_KIND_V0_1),
  statement: z.literal(CLEAR402_ASSURANCE_STATEMENT_V0_1),
});

export const Clear402MonadActionCredentialV0_1Schema = z.strictObject({
  credentialVersion: z.literal(CLEAR402_CREDENTIAL_VERSION_V0_1),
  credentialType: z.literal(CLEAR402_CREDENTIAL_TYPE_V0_1),
  profile: z.literal(CLEAR402_PROFILE_V0_1),
  report: PreflightReportSchema,
  integrity: CredentialIntegrityV0_1Schema,
  assurance: CredentialAssuranceV0_1Schema,
});

export type Clear402MonadActionCredentialV0_1 = z.infer<
  typeof Clear402MonadActionCredentialV0_1Schema
>;
