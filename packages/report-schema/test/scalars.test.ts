import { describe, expect, it } from "vitest";
import {
  AssetSchema,
  EvmAddressSchema,
  GeneratedAtSchema,
  MaxSlippageBpsSchema,
  NetworkSchema,
  PositiveAmountSchema,
  ProtocolIdSchema,
  ReportIdSchema,
  UnsignedAmountSchema,
} from "../src/index.js";
import { syntheticAddress } from "./synthetic.js";

describe("canonical scalar schemas", () => {
  it("accepts an exact synthetic EIP-55 address without rewriting it", () => {
    const address = syntheticAddress("accepted-address");

    expect(EvmAddressSchema.parse(address)).toBe(address);
  });

  it.each([
    "0x0000000000000000000000000000000000000000",
    "0X1111111111111111111111111111111111111111",
    "0x1234",
    "not-an-address",
  ])("rejects an invalid address rendering: %s", (address) => {
    expect(EvmAddressSchema.safeParse(address).success).toBe(false);
  });

  it("rejects non-canonical address casing", () => {
    const address = syntheticAddress("mixed-case-address");

    expect(EvmAddressSchema.safeParse(address.toLowerCase()).success).toBe(
      false,
    );
  });

  it("uses an explicit NATIVE asset variant", () => {
    expect(AssetSchema.safeParse({ kind: "NATIVE" }).success).toBe(true);
    expect(
      AssetSchema.safeParse({
        kind: "NATIVE",
        address: syntheticAddress("forbidden-native-address"),
      }).success,
    ).toBe(false);
  });

  it.each(["0", "1", "999999999999999999999999999999999999"])(
    "accepts canonical unsigned integer string %s",
    (amount) => {
      expect(UnsignedAmountSchema.safeParse(amount).success).toBe(true);
    },
  );

  it.each(["", "-1", "+1", "01", "1.0", "1e3", 1, 1n])(
    "rejects a non-canonical amount: %s",
    (amount) => {
      expect(UnsignedAmountSchema.safeParse(amount).success).toBe(false);
    },
  );

  it("requires positive amounts where zero has no meaning", () => {
    expect(PositiveAmountSchema.safeParse("1").success).toBe(true);
    expect(PositiveAmountSchema.safeParse("0").success).toBe(false);
  });

  it.each(["synthetic", "synthetic-protocol", "p2"])(
    "accepts protocol id %s",
    (protocolId) => {
      expect(ProtocolIdSchema.safeParse(protocolId).success).toBe(true);
    },
  );

  it.each(["", "Synthetic", "synthetic_protocol", " synthetic", "a--b"])(
    "rejects protocol id %s",
    (protocolId) => {
      expect(ProtocolIdSchema.safeParse(protocolId).success).toBe(false);
    },
  );

  it.each([0, 1, 10_000])("accepts integer slippage %s bps", (slippage) => {
    expect(MaxSlippageBpsSchema.safeParse(slippage).success).toBe(true);
  });

  it.each([-1, 10_001, 0.5, "50", Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid slippage %s",
    (slippage) => {
      expect(MaxSlippageBpsSchema.safeParse(slippage).success).toBe(false);
    },
  );

  it("requires canonical report metadata", () => {
    expect(
      ReportIdSchema.safeParse("11111111-1111-4111-8111-111111111111").success,
    ).toBe(true);
    expect(
      ReportIdSchema.safeParse("11111111-1111-1111-1111-111111111111").success,
    ).toBe(false);
    expect(
      GeneratedAtSchema.safeParse("2026-01-02T03:04:05.000Z").success,
    ).toBe(true);
    expect(
      GeneratedAtSchema.safeParse("2026-02-30T03:04:05.000Z").success,
    ).toBe(false);
    expect(NetworkSchema.safeParse("eip155:999999").success).toBe(true);
    expect(NetworkSchema.safeParse("eip155:0999999").success).toBe(false);
  });
});
