import { LimitationSchema } from "@moss-mini-demo/report-schema";
import { describe, expect, it } from "vitest";
import { decisionBannerModel } from "../src/client/decision-banner";
import { PreflightPresentationSchema } from "../src/contracts/preflight";

const LIMITATION = LimitationSchema.parse({
  code: "EVIDENCE_LIMITATION",
  description: "Evidence remains bounded and requires human review.",
  sourceReferences: ["/simulation"],
});

describe("Decision banner", () => {
  it("keeps MANUAL_REVIEW neutral and makes its limitation visible", () => {
    const presentation = PreflightPresentationSchema.parse({
      schemaVersion: "0.1",
      reportId: "11111111-1111-4111-8111-111111111111",
      decision: { status: "MANUAL_REVIEW" },
      sourceContextReferences: [],
      limitationReferences: ["/limitations/0"],
    });

    expect(decisionBannerModel(presentation, [LIMITATION])).toEqual({
      status: "MANUAL_REVIEW",
      heading: "MANUAL_REVIEW",
      message:
        "Human review remains required; this is not an approval or authorization.",
      limitations: [LIMITATION],
    });
  });

  it("preserves the STOP action boundary and canonical reason order", () => {
    const presentation = PreflightPresentationSchema.parse({
      schemaVersion: "0.1",
      reportId: "11111111-1111-4111-8111-111111111111",
      decision: {
        status: "STOP",
        heading: "STOP",
        actionBoundary: "DO_NOT_PROCEED_TO_SIGNER",
        reasons: [
          {
            code: "WARNING_PRESENT",
            explanation: "The available simulation contains a Warning.",
            sourceReferences: ["/simulation/warnings/items/0"],
          },
          {
            code: "CRITICAL_ALIGNMENT_FAIL",
            explanation: "A critical alignment check records failure.",
            sourceReferences: ["/alignment/checks/0"],
          },
        ],
      },
      sourceContextReferences: [],
      limitationReferences: [],
    });

    expect(decisionBannerModel(presentation, [])).toEqual({
      status: "STOP",
      heading: "STOP",
      message: "Do not proceed to signer.",
      actionBoundary: "DO_NOT_PROCEED_TO_SIGNER",
      limitations: [],
    });
    if (presentation.decision.status !== "STOP") {
      throw new Error("synthetic presentation must STOP");
    }
    expect(presentation.decision.reasons.map((reason) => reason.code)).toEqual([
      "WARNING_PRESENT",
      "CRITICAL_ALIGNMENT_FAIL",
    ]);
    expect(presentation.decision.reasons[0]?.sourceReferences).toEqual([
      "/simulation/warnings/items/0",
    ]);
  });

  it("does not synthesize reasons for MANUAL_REVIEW", () => {
    const presentation = PreflightPresentationSchema.parse({
      schemaVersion: "0.1",
      reportId: "11111111-1111-4111-8111-111111111111",
      decision: { status: "MANUAL_REVIEW" },
      sourceContextReferences: [],
      limitationReferences: [],
    });

    expect(presentation.decision).not.toHaveProperty("reasons");
    expect(decisionBannerModel(presentation, []).status).toBe("MANUAL_REVIEW");
  });
});
