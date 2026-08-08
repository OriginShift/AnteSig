import { HealthResponseSchema } from "../../../src/contracts/health";
import { MOSS_BUILD_INFO } from "../../../src/server/moss-build-info";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const health = HealthResponseSchema.parse({
    contractVersion: "0.1",
    status: "ok",
    app: {
      name: "antesig",
      version: "0.0.0",
      runtime: "nodejs",
      nodeVersion: "22.23.1",
    },
    moss: MOSS_BUILD_INFO,
    network: {
      configured: false,
      id: null,
    },
    clear402: {
      enabled: false,
    },
  });

  return Response.json(health, {
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}
