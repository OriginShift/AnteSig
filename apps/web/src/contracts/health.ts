import { z } from "zod";

export const HealthResponseSchema = z.strictObject({
  contractVersion: z.literal("0.1"),
  status: z.literal("ok"),
  app: z.strictObject({
    name: z.literal("antesig"),
    version: z.literal("0.0.0"),
    runtime: z.literal("nodejs"),
    nodeVersion: z.literal("22.23.1"),
  }),
  moss: z.strictObject({
    sourceMode: z.literal("INTEGRATION_FORK"),
    upstreamCommit: z.literal("1ae6b6322d51fae9104f047efb94e601050b967f"),
    integrationCommit: z.literal("1ae6b6322d51fae9104f047efb94e601050b967f"),
    officialRelease: z.literal(false),
    packages: z.strictObject({
      "@themoss/core": z.literal("0.1.0"),
      "@themoss/simulator": z.literal("0.1.0"),
      "@themoss/protocol-kuru": z.literal("0.1.0"),
      "@themoss/protocol-pancakeswap": z.literal("0.1.0"),
    }),
  }),
  network: z.strictObject({
    configured: z.literal(false),
    id: z.null(),
  }),
  clear402: z.strictObject({
    enabled: z.boolean(),
  }),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
