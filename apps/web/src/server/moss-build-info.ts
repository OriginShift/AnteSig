import "server-only";

import type { HealthResponse } from "../contracts/health";

export const MOSS_BUILD_INFO = {
  sourceMode: "INTEGRATION_FORK",
  upstreamCommit: "1ae6b6322d51fae9104f047efb94e601050b967f",
  integrationCommit: "1ae6b6322d51fae9104f047efb94e601050b967f",
  officialRelease: false,
  packages: {
    "@themoss/core": "0.1.0",
    "@themoss/simulator": "0.1.0",
    "@themoss/protocol-kuru": "0.1.0",
    "@themoss/protocol-pancakeswap": "0.1.0",
  },
} as const satisfies HealthResponse["moss"];
