import {
  CapabilitySchema,
  LimitationSchema,
} from "@moss-mini-demo/report-schema";
import { describe, expect, it } from "vitest";
import {
  capabilityInspectorModel,
  flattenCapabilityNodes,
  serializeRawArtifact,
} from "../src/client/evidence-model";

const ACCOUNT = "0x1111111111111111111111111111111111111111";
const TOKEN = "0x2222222222222222222222222222222222222222";
const ROUTER = "0x3333333333333333333333333333333333333333";

const RAW_CAPABILITY = {
  kind: "capability",
  protocol: "swap-protocol",
  method: "swap",
  params: { amountIn: "1000000000000000000" },
  children: [
    {
      kind: "capability",
      protocol: "token-protocol",
      method: "approve",
      params: { spender: ROUTER },
      children: [
        {
          kind: "transaction",
          transaction: {
            from: ACCOUNT,
            to: TOKEN,
            data: "0xaaaa",
            value: "0x0",
          },
        },
      ],
    },
    {
      kind: "transaction",
      transaction: {
        from: ACCOUNT,
        to: ROUTER,
        data: "0xbbbb",
        value: "0x1",
      },
    },
  ],
  unknownFutureField: { retained: true, nested: ["alpha", { version: 2 }] },
};

const CAPABILITY = CapabilitySchema.parse({
  availability: "AVAILABLE",
  raw: {
    operation: {
      mossOriginal: { riskLabels: ["TOKEN_APPROVAL"] },
      miniDemoDerived: { riskLabels: ["VALUE_TRANSFER"] },
    },
    mossOriginal: { value: RAW_CAPABILITY },
    unknownEnvelopeField: { retained: "yes" },
  },
});

const LIMITATION = LimitationSchema.parse({
  code: "RAW_SOURCE_LIMITATION",
  description: "Synthetic test limitation.",
  sourceReferences: ["/capability/raw/mossOriginal/value"],
});

describe("Capability inspector model", () => {
  it("preserves root/nested hierarchy and stable Approval then Swap transaction order", () => {
    const model = capabilityInspectorModel(CAPABILITY, [LIMITATION]);
    const nodes = flattenCapabilityNodes(model.root);

    expect(nodes.map((node) => node.role)).toEqual([
      "CAPABILITY",
      "APPROVAL",
      "APPROVAL_TRANSACTION",
      "TRANSACTION",
    ]);
    expect(
      nodes
        .filter((node) => node.kind === "TRANSACTION")
        .map((node) => node.transactionIndex),
    ).toEqual([0, 1]);
    expect(nodes[2]).toMatchObject({
      protocol: "token-protocol",
      method: "approve",
      from: ACCOUNT,
      to: TOKEN,
      value: "0x0",
    });
    expect(nodes[3]).toMatchObject({
      protocol: "swap-protocol",
      method: "swap",
      from: ACCOUNT,
      to: ROUTER,
      value: "0x1",
    });
  });

  it("keeps risk-label and limitation source references explicit", () => {
    const model = capabilityInspectorModel(CAPABILITY, [LIMITATION]);
    expect(model.riskLabels).toEqual([
      {
        label: "TOKEN_APPROVAL",
        sourceReference: "/capability/raw/operation/mossOriginal/riskLabels/0",
      },
      {
        label: "VALUE_TRANSFER",
        sourceReference:
          "/capability/raw/operation/miniDemoDerived/riskLabels/0",
      },
    ]);
    expect(model.limitations).toEqual([LIMITATION]);
  });

  it("serializes the untouched raw object including unknown fields", () => {
    const serialized = serializeRawArtifact(CAPABILITY);
    expect(JSON.parse(serialized)).toEqual(CAPABILITY);
    expect(serialized).toContain("unknownFutureField");
    expect(serialized).toContain("unknownEnvelopeField");
  });

  it("represents unavailable Capability without inventing hierarchy", () => {
    const unavailable = CapabilitySchema.parse({
      availability: "UNPROVABLE",
      failure: {
        code: "CAPABILITY_UNPROVABLE",
        sourceReferences: ["/selection/status"],
      },
    });
    const model = capabilityInspectorModel(unavailable, []);
    expect(model.root).toBeUndefined();
    expect(model.failureCode).toBe("CAPABILITY_UNPROVABLE");
    expect(model.failureSourceReferences).toEqual(["/selection/status"]);
  });
});
