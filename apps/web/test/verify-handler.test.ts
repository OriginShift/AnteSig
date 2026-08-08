import { verifyClear402CredentialV0_1 } from "@moss-mini-demo/clear402-profile";
import { PreflightReportSchema } from "@moss-mini-demo/report-schema";
import { describe, expect, it, vi } from "vitest";
import manualReviewReport from "../../../packages/report-schema/fixtures/manual-review-success.v0.1.json";
import { POST as postVerify } from "../app/api/verify/route";
import {
  Clear402VerifyResponseSchema,
  MAX_CLEAR402_VERIFY_REQUEST_BYTES,
} from "../src/contracts/clear402";
import { OfflineCredentialService } from "../src/server/credential-service";
import { createVerifyHandler } from "../src/server/verify-handler";

vi.mock("server-only", () => ({}));

function jsonRequest(
  body: string,
  headers: Record<string, string> = {},
): Request {
  return new Request("http://localhost/api/verify", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

async function responseBody(response: Response) {
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("content-type")).toBe(
    "application/json; charset=utf-8",
  );
  return Clear402VerifyResponseSchema.parse(await response.json());
}

function credential() {
  return new OfflineCredentialService().generate(
    PreflightReportSchema.parse(manualReviewReport),
  );
}

describe("POST /api/verify handler", () => {
  it("returns the exact disabled response before reading request properties", async () => {
    const inaccessibleRequest = new Proxy({} as Request, {
      get() {
        throw new Error("disabled handler read the request");
      },
    });
    const response = await createVerifyHandler({})(inaccessibleRequest);

    expect(response.status).toBe(404);
    expect(await responseBody(response)).toEqual({
      ok: false,
      error: {
        code: "CLEAR402_DISABLED",
        message: "Clear402 credential verification is disabled.",
      },
    });
  });

  it("returns integrity VALID without echoing the credential or calling network", async () => {
    const fetchProbe = vi.fn();
    vi.stubGlobal("fetch", fetchProbe);
    const response = await createVerifyHandler({
      verify: verifyClear402CredentialV0_1,
    })(jsonRequest(JSON.stringify(credential())));

    expect(response.status).toBe(200);
    expect(await responseBody(response)).toEqual({
      ok: true,
      integrity: "VALID",
    });
    expect(fetchProbe).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("distinguishes digest and schema failures", async () => {
    const valid = credential();
    const digestTampered = {
      ...valid,
      report: { ...valid.report, generatedAt: "2031-03-04T05:06:08.000Z" },
    };
    const wrongVersion = { ...valid, credentialVersion: "0.2" };
    const handler = createVerifyHandler({
      verify: verifyClear402CredentialV0_1,
    });

    const digestResponse = await handler(
      jsonRequest(JSON.stringify(digestTampered)),
    );
    expect(digestResponse.status).toBe(422);
    expect(await responseBody(digestResponse)).toMatchObject({
      ok: false,
      integrity: "INVALID",
      error: { code: "DIGEST_INVALID" },
    });

    const schemaResponse = await handler(
      jsonRequest(JSON.stringify(wrongVersion)),
    );
    expect(schemaResponse.status).toBe(422);
    expect(await responseBody(schemaResponse)).toMatchObject({
      ok: false,
      integrity: "INVALID",
      error: { code: "SCHEMA_INVALID" },
    });
  });

  it("rejects media type, invalid JSON, declared overflow, and observed overflow", async () => {
    const verify = vi.fn(verifyClear402CredentialV0_1);
    const handler = createVerifyHandler({ verify });

    const media = await handler(
      new Request("http://localhost/api/verify", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(media.status).toBe(415);
    expect(await responseBody(media)).toMatchObject({
      error: { code: "UNSUPPORTED_MEDIA_TYPE" },
    });

    const invalid = await handler(jsonRequest("{"));
    expect(invalid.status).toBe(400);
    expect(await responseBody(invalid)).toMatchObject({
      error: { code: "INVALID_JSON" },
    });

    const declared = await handler(
      jsonRequest("{}", {
        "content-length": String(MAX_CLEAR402_VERIFY_REQUEST_BYTES + 1),
      }),
    );
    expect(declared.status).toBe(413);
    expect(await responseBody(declared)).toMatchObject({
      error: { code: "REQUEST_TOO_LARGE" },
    });

    const observed = await handler(
      jsonRequest(
        JSON.stringify({
          padding: "x".repeat(MAX_CLEAR402_VERIFY_REQUEST_BYTES),
        }),
        { "content-length": "1" },
      ),
    );
    expect(observed.status).toBe(413);
    expect(await responseBody(observed)).toMatchObject({
      error: { code: "REQUEST_TOO_LARGE" },
    });
    expect(verify).not.toHaveBeenCalled();
  });

  it("redacts unexpected verifier failures", async () => {
    const logger = { error: vi.fn() };
    const handler = createVerifyHandler({
      verify: () => {
        throw new Error("private verifier detail");
      },
      logger,
    });
    const response = await handler(jsonRequest("{}"));
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).not.toContain("private verifier detail");
    expect(logger.error).toHaveBeenCalledWith({
      event: "CLEAR402_VERIFY_INTERNAL_ERROR",
      code: "INTERNAL_ERROR",
    });
  });

  it("composes the production route from the exact environment flag", async () => {
    const previous = process.env.CLEAR402_ENABLED;
    try {
      process.env.CLEAR402_ENABLED = "false";
      const disabled = await postVerify(
        jsonRequest(JSON.stringify(credential())),
      );
      expect(disabled.status).toBe(404);

      process.env.CLEAR402_ENABLED = "true";
      const enabled = await postVerify(
        jsonRequest(JSON.stringify(credential())),
      );
      expect(enabled.status).toBe(200);
      expect(await responseBody(enabled)).toEqual({
        ok: true,
        integrity: "VALID",
      });
    } finally {
      if (previous === undefined) {
        delete process.env.CLEAR402_ENABLED;
      } else {
        process.env.CLEAR402_ENABLED = previous;
      }
    }
  });
});
