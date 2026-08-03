import {
  DecisionInputV0_1Schema,
  type DecisionInputV0_1,
} from "@moss-mini-demo/report-schema";

const ERROR_MESSAGES = {
  UNSUPPORTED_SCHEMA_VERSION: "Unsupported DecisionInput schema version",
  INVALID_SOURCE_REFERENCE: "Invalid DecisionInput source reference",
  INVALID_DECISION_INPUT: "Invalid DecisionInput",
} as const;

type DecisionInputErrorCodeV0_1 = keyof typeof ERROR_MESSAGES;

interface StructuredIssue {
  readonly path: readonly PropertyKey[];
}

export class DecisionInputErrorV0_1 extends Error {
  readonly code: DecisionInputErrorCodeV0_1;

  constructor(code: DecisionInputErrorCodeV0_1) {
    super(ERROR_MESSAGES[code]);
    this.name = "DecisionInputErrorV0_1";
    this.code = code;
  }
}

function hasSupportedSchemaVersion(input: unknown): boolean {
  return (
    typeof input === "object" &&
    input !== null &&
    "schemaVersion" in input &&
    input.schemaVersion === "0.1"
  );
}

function isSourceReferenceIssue(issue: StructuredIssue): boolean {
  return issue.path.some((segment) => segment === "sourceReferences");
}

export function parseDecisionInputV0_1(input: unknown): DecisionInputV0_1 {
  if (!hasSupportedSchemaVersion(input)) {
    throw new DecisionInputErrorV0_1("UNSUPPORTED_SCHEMA_VERSION");
  }

  const parsed = DecisionInputV0_1Schema.safeParse(input);
  if (!parsed.success) {
    const code = parsed.error.issues.some(isSourceReferenceIssue)
      ? "INVALID_SOURCE_REFERENCE"
      : "INVALID_DECISION_INPUT";
    throw new DecisionInputErrorV0_1(code);
  }

  if (!parsed.data.alignment.checks.some((check) => check.critical)) {
    throw new DecisionInputErrorV0_1("INVALID_DECISION_INPUT");
  }

  return parsed.data;
}
