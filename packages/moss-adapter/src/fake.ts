import "server-only";

import { createBoundMossPort } from "./source-bindings.js";
import type {
  ActionInput,
  MossBuildInfo,
  MossPort,
  MossSourceBindings,
  QuoteInput,
  RawCapability,
  RawCapabilityEvidence,
  RawOperationContract,
  RawQuote,
  RawSimulationEvidence,
} from "./types.js";

class FakeMossPort implements MossPort {
  readonly #delegate: MossPort;

  constructor(bindings: MossSourceBindings) {
    this.#delegate = createBoundMossPort(bindings, "SYNTHETIC_FAKE");
  }

  describe(protocolId: string, method: string): Promise<RawOperationContract> {
    return this.#delegate.describe(protocolId, method);
  }

  quote(protocolId: string, input: QuoteInput): Promise<RawQuote> {
    return this.#delegate.quote(protocolId, input);
  }

  action(
    protocolId: string,
    input: ActionInput,
  ): Promise<RawCapabilityEvidence> {
    return this.#delegate.action(protocolId, input);
  }

  simulate(capability: RawCapability): Promise<RawSimulationEvidence> {
    return this.#delegate.simulate(capability);
  }

  buildInfo(): MossBuildInfo {
    return this.#delegate.buildInfo();
  }
}

export function createFakeMossPort(bindings: MossSourceBindings): MossPort {
  return new FakeMossPort(bindings);
}
