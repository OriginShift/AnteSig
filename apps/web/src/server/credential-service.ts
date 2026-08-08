import "server-only";

import {
  CLEAR402_ASSURANCE_KIND_V0_1,
  CLEAR402_ASSURANCE_STATEMENT_V0_1,
  CLEAR402_CREDENTIAL_TYPE_V0_1,
  CLEAR402_CREDENTIAL_VERSION_V0_1,
  CLEAR402_PROFILE_V0_1,
  type Clear402MonadActionCredentialV0_1,
  Clear402MonadActionCredentialV0_1Schema,
  digestClear402ReportV0_1,
} from "@moss-mini-demo/clear402-profile";
import {
  type PreflightReport,
  PreflightReportSchema,
} from "@moss-mini-demo/report-schema";
import { isClear402Enabled } from "./clear402-config";

export interface CredentialService {
  generate(report: PreflightReport): Clear402MonadActionCredentialV0_1;
}

export class OfflineCredentialService implements CredentialService {
  generate(report: PreflightReport): Clear402MonadActionCredentialV0_1 {
    const parsedReport = PreflightReportSchema.parse(report);
    return Clear402MonadActionCredentialV0_1Schema.parse({
      credentialVersion: CLEAR402_CREDENTIAL_VERSION_V0_1,
      credentialType: CLEAR402_CREDENTIAL_TYPE_V0_1,
      profile: CLEAR402_PROFILE_V0_1,
      report: parsedReport,
      integrity: {
        canonicalization: "RFC8785",
        digestAlgorithm: "sha256",
        reportDigest: digestClear402ReportV0_1(parsedReport),
      },
      assurance: {
        kind: CLEAR402_ASSURANCE_KIND_V0_1,
        statement: CLEAR402_ASSURANCE_STATEMENT_V0_1,
      },
    });
  }
}

export function resolveCredentialService(
  environment?: Readonly<Record<string, string | undefined>>,
): CredentialService | undefined {
  return isClear402Enabled(environment)
    ? new OfflineCredentialService()
    : undefined;
}
