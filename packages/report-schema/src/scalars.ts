import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { z } from "zod";

const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const PROTOCOL_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const UNSIGNED_AMOUNT_PATTERN = /^(?:0|[1-9][0-9]*)$/;
const POSITIVE_AMOUNT_PATTERN = /^[1-9][0-9]*$/;
const REPORT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const GENERATED_AT_PATTERN =
  /^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\.[0-9]{3}Z$/;
const NETWORK_PATTERN = /^eip155:[1-9][0-9]{0,31}$/;

function checksumAddress(address: string): string {
  const lowercaseBody = address.slice(2).toLowerCase();
  const hash = bytesToHex(keccak_256(utf8ToBytes(lowercaseBody)));
  let checksummedBody = "";

  for (const [index, character] of [...lowercaseBody].entries()) {
    checksummedBody +=
      /[a-f]/.test(character) && Number.parseInt(hash[index] ?? "0", 16) >= 8
        ? character.toUpperCase()
        : character;
  }

  return `0x${checksummedBody}`;
}

export const EvmAddressSchema = z
  .string()
  .superRefine((value, context) => {
    if (!EVM_ADDRESS_PATTERN.test(value)) {
      context.addIssue({
        code: "custom",
        message:
          "Address must use a lowercase 0x prefix and 40 hexadecimal characters",
      });
      return;
    }

    if (value === ZERO_ADDRESS) {
      context.addIssue({
        code: "custom",
        message: "Zero address is forbidden",
      });
      return;
    }

    if (checksumAddress(value) !== value) {
      context.addIssue({
        code: "custom",
        message: "Address must use its exact EIP-55 canonical rendering",
      });
    }
  })
  .brand<"EvmAddress">();

export const ProtocolIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(PROTOCOL_ID_PATTERN)
  .brand<"ProtocolId">();

export const UnsignedAmountSchema = z
  .string()
  .regex(UNSIGNED_AMOUNT_PATTERN)
  .brand<"UnsignedAmount">();

export const PositiveAmountSchema = z
  .string()
  .regex(POSITIVE_AMOUNT_PATTERN)
  .brand<"PositiveAmount">();

export const MaxSlippageBpsSchema = z.number().int().safe().min(0).max(10_000);

export const ReportIdSchema = z
  .string()
  .regex(REPORT_ID_PATTERN)
  .brand<"ReportId">();

export const GeneratedAtSchema = z
  .string()
  .regex(GENERATED_AT_PATTERN)
  .superRefine((value, context) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value) {
      context.addIssue({
        code: "custom",
        message: "Timestamp must be a calendar-valid canonical UTC instant",
      });
    }
  })
  .brand<"GeneratedAt">();

export const NetworkSchema = z
  .string()
  .regex(NETWORK_PATTERN)
  .brand<"Network">();

export const StableCodeSchema = z
  .string()
  .min(1)
  .max(128)
  .brand<"StableCode">();
export const RecordIdSchema = z.string().min(1).max(128).brand<"RecordId">();
export const JsonValueSchema = z.json();

export type EvmAddress = z.infer<typeof EvmAddressSchema>;
export type ProtocolId = z.infer<typeof ProtocolIdSchema>;
export type UnsignedAmount = z.infer<typeof UnsignedAmountSchema>;
export type PositiveAmount = z.infer<typeof PositiveAmountSchema>;
export type ReportId = z.infer<typeof ReportIdSchema>;
export type GeneratedAt = z.infer<typeof GeneratedAtSchema>;
export type Network = z.infer<typeof NetworkSchema>;
export type JsonValue = z.infer<typeof JsonValueSchema>;
