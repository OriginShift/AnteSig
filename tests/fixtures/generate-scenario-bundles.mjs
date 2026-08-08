import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  CLEAR402_ASSURANCE_KIND_V0_1,
  CLEAR402_ASSURANCE_STATEMENT_V0_1,
  CLEAR402_CREDENTIAL_TYPE_V0_1,
  CLEAR402_CREDENTIAL_VERSION_V0_1,
  CLEAR402_PROFILE_V0_1,
  digestClear402ReportV0_1,
} from "../../packages/clear402-profile/dist/index.js";
import { evaluateDecisionV0_1 } from "../../packages/decision-engine/dist/index.js";
import { PreflightReportSchema } from "../../packages/report-schema/dist/index.js";

const FIXTURES = resolve(process.cwd(), "fixtures");
const REPORT_FIXTURES = resolve(
  process.cwd(),
  "packages/report-schema/fixtures",
);
const WARNING = Object.freeze({
  code: "TRACE_FAILED",
  message: "Synthetic receipt trace warning.",
  detail: "offline-fixture-only",
});

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function decisionInput(report) {
  const { decision: _decision, limitations: _limitations, ...input } = report;
  return input;
}

function rebuiltReport(base, overrides) {
  const candidate = structuredClone(base);
  Object.assign(candidate, overrides);
  candidate.decision = evaluateDecisionV0_1(decisionInput(candidate));
  return PreflightReportSchema.parse(candidate);
}

function fixtureRequest(scenario, report) {
  return {
    bundleVersion: "0.1",
    sourceBoundary: "FIXTURE",
    scenario,
    intent: report.intent,
  };
}

function selectedProtocol(report) {
  if (report.selection.status !== "SELECTED") {
    throw new Error("Scenario bundle requires a selected protocol");
  }
  return report.selection.protocolId;
}

function successfulQuote(report) {
  const quote = report.quotes.find((item) => item.status === "SUCCESS");
  if (quote === undefined) {
    throw new Error("Scenario bundle requires a successful quote");
  }
  return quote;
}

function transaction(report) {
  return {
    from: report.intent.account,
    to:
      report.intent.outputAsset.kind === "ERC20"
        ? report.intent.outputAsset.address
        : report.intent.account,
    data: "0x1234",
    value: "0x0",
  };
}

function rawMossResult(scenario, report) {
  const protocol = selectedProtocol(report);
  const amountIn =
    report.capability.availability === "AVAILABLE" &&
    typeof report.capability.raw.amountIn === "string"
      ? report.capability.raw.amountIn
      : report.intent.inputAmount;
  const capability = {
    kind: "capability",
    protocol,
    method: "swap",
    params: { amountIn },
    children: [
      {
        kind: "transaction",
        transaction: transaction(report),
      },
    ],
  };
  const common = {
    fixtureVersion: "0.1",
    sourceBoundary: "FIXTURE",
    scenario,
    operation: { protocol, method: "swap" },
    capability,
  };
  if (scenario === "rpc-failure") {
    return {
      ...common,
      simulation: {
        status: "FAILED",
        error: {
          code: "SIMULATION_ACQUISITION_FAILED",
          message: "Synthetic offline fixture acquisition failure.",
        },
      },
    };
  }

  const quote = successfulQuote(report);
  const warningItems = scenario === "receipt-warning" ? [WARNING] : [];
  return {
    ...common,
    simulation: {
      status: "AVAILABLE",
      result: {
        results: [
          {
            protocol,
            method: "swap",
            transaction: transaction(report),
            reverted: false,
            receipt: {
              kind: "receipt",
              protocol,
              outcome: {
                status: "SUCCESS",
                amountIn,
                amountOut: quote.outputAmount,
              },
              text: `${scenario} synthetic receipt`,
              changes: [],
            },
            changes: [],
            warnings: warningItems,
            gas: "21000",
          },
        ],
      },
    },
  };
}

function credentialInvariants(report) {
  return {
    credentialVersion: CLEAR402_CREDENTIAL_VERSION_V0_1,
    credentialType: CLEAR402_CREDENTIAL_TYPE_V0_1,
    profile: CLEAR402_PROFILE_V0_1,
    protectedObject: "report",
    canonicalization: "RFC8785",
    digestAlgorithm: "sha256",
    reportDigest: digestClear402ReportV0_1(report),
    assuranceKind: CLEAR402_ASSURANCE_KIND_V0_1,
    assuranceStatement: CLEAR402_ASSURANCE_STATEMENT_V0_1,
  };
}

function readme(scenario, report) {
  const decision = report.decision.status;
  return `# ${scenario}\n\nOffline synthetic reliability bundle. Source boundary: \`FIXTURE\`.\n\nExpected Decision: \`${decision}\`. All addresses, amounts, evidence, timestamps,\nand identifiers are deterministic test data.\n\n- \`request.json\`: fixture-only request and intent\n- \`raw-moss-result.json\`: synthetic adapter input or acquisition failure\n- \`expected-report.json\`: strict PreflightReport v0.1\n- \`expected-decision.json\`: Decision Engine output\n- \`expected-credential-invariants.json\`: unsigned Credential invariants\n\nRun \`pnpm test:fixtures\` to validate and recompute this bundle.\n`;
}

async function writeText(path, text) {
  await writeFile(path, text, "utf8");
}

async function writeJson(path, value) {
  await writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeBundle(scenario, report) {
  const directory = resolve(FIXTURES, scenario);
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeJson(
      resolve(directory, "request.json"),
      fixtureRequest(scenario, report),
    ),
    writeJson(
      resolve(directory, "raw-moss-result.json"),
      rawMossResult(scenario, report),
    ),
    writeJson(resolve(directory, "expected-report.json"), report),
    writeJson(resolve(directory, "expected-decision.json"), report.decision),
    writeJson(
      resolve(directory, "expected-credential-invariants.json"),
      credentialInvariants(report),
    ),
    writeText(resolve(directory, "README.md"), readme(scenario, report)),
  ]);
}

async function main() {
  const happy = PreflightReportSchema.parse(
    await readJson(resolve(REPORT_FIXTURES, "manual-review-success.v0.1.json")),
  );
  const amountMismatch = PreflightReportSchema.parse(
    await readJson(resolve(REPORT_FIXTURES, "amount-in-mismatch.v0.1.json")),
  );
  const rpcFailure = rebuiltReport(happy, {
    reportId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    generatedAt: "2031-06-07T08:09:10.000Z",
    simulation: {
      availability: "FAILED",
      failure: {
        code: "SIMULATION_ACQUISITION_FAILED",
        sourceReferences: ["/capability/raw"],
      },
    },
    limitations: [
      {
        code: "SYNTHETIC_RPC_FAILURE_FIXTURE_ONLY",
        description:
          "Synthetic offline acquisition failure for deterministic reliability testing only.",
        sourceReferences: ["/simulation/availability"],
      },
    ],
  });
  const receiptWarning = rebuiltReport(happy, {
    reportId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    generatedAt: "2031-07-08T09:10:11.000Z",
    simulation: {
      ...structuredClone(happy.simulation),
      warnings: { availability: "AVAILABLE", items: [WARNING] },
    },
    limitations: [
      {
        code: "SYNTHETIC_RECEIPT_WARNING_FIXTURE_ONLY",
        description:
          "Synthetic offline receipt warning for deterministic reliability testing only.",
        sourceReferences: ["/simulation/warnings/items/0"],
      },
    ],
  });

  await Promise.all([
    writeBundle("happy-path", happy),
    writeBundle("amount-mismatch", amountMismatch),
    writeBundle("rpc-failure", rpcFailure),
    writeBundle("receipt-warning", receiptWarning),
  ]);
}

await main();
