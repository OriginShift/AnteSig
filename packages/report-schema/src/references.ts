import { z } from "zod";

const ARRAY_INDEX_PATTERN = /^(?:0|[1-9][0-9]*)$/;

function hasCanonicalEscapes(pointer: string): boolean {
  for (let index = 0; index < pointer.length; index += 1) {
    if (
      pointer[index] === "~" &&
      pointer[index + 1] !== "0" &&
      pointer[index + 1] !== "1"
    ) {
      return false;
    }
  }
  return true;
}

export function decodeJsonPointer(pointer: string): string[] {
  return pointer
    .slice(1)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
}

export const JsonPointerSyntaxSchema = z
  .string()
  .min(1)
  .superRefine((value, context) => {
    if (!value.startsWith("/")) {
      context.addIssue({
        code: "custom",
        message: "Source reference must begin with /",
      });
    }
    if (value.includes("#") || /%[0-9a-fA-F]{2}/.test(value)) {
      context.addIssue({
        code: "custom",
        message: "Fragments and percent encoding are forbidden",
      });
    }
    if (!hasCanonicalEscapes(value)) {
      context.addIssue({
        code: "custom",
        message: "JSON Pointer escape is not canonical",
      });
    }
  })
  .brand<"JsonPointerSyntax">();

export const JsonPointerSyntaxListSchema = z
  .array(JsonPointerSyntaxSchema)
  .min(1)
  .superRefine((references, context) => {
    if (new Set(references).size !== references.length) {
      context.addIssue({
        code: "custom",
        message: "Source references must be unique",
      });
    }
  });

export function resolvesJsonPointer(
  document: unknown,
  pointer: string,
): boolean {
  let current: unknown = document;

  for (const segment of decodeJsonPointer(pointer)) {
    if (Array.isArray(current)) {
      if (!ARRAY_INDEX_PATTERN.test(segment)) {
        return false;
      }
      const index = Number(segment);
      if (!Number.isSafeInteger(index) || index >= current.length) {
        return false;
      }
      current = current[index];
      continue;
    }

    if (typeof current !== "object" || current === null) {
      return false;
    }
    if (!Object.hasOwn(current, segment)) {
      return false;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return true;
}

export type JsonPointerSyntax = z.infer<typeof JsonPointerSyntaxSchema>;
