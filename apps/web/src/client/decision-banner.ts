import type { Limitation } from "@moss-mini-demo/report-schema";
import type { PreflightPresentation } from "../contracts/preflight";

export type DecisionBannerModel = Readonly<{
  status: "MANUAL_REVIEW" | "STOP";
  heading: "MANUAL_REVIEW" | "STOP";
  message: string;
  actionBoundary?: "DO_NOT_PROCEED_TO_SIGNER";
  limitations: readonly Limitation[];
}>;

export function decisionBannerModel(
  presentation: PreflightPresentation,
  limitations: readonly Limitation[],
): DecisionBannerModel {
  return presentation.decision.status === "STOP"
    ? {
        status: "STOP",
        heading: presentation.decision.heading,
        message: "Do not proceed to signer.",
        actionBoundary: presentation.decision.actionBoundary,
        limitations,
      }
    : {
        status: "MANUAL_REVIEW",
        heading: "MANUAL_REVIEW",
        message:
          "Human review remains required; this is not an approval or authorization.",
        limitations,
      };
}
