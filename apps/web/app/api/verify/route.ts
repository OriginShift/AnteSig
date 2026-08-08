import { isClear402Enabled } from "../../../src/server/clear402-config";
import {
  createVerifyHandler,
  resolveVerifyCredential,
} from "../../../src/server/verify-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const handleVerify = createVerifyHandler({
    verify: resolveVerifyCredential(isClear402Enabled()),
  });
  return handleVerify(request);
}
