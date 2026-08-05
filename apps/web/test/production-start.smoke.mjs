import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const nextBuild = fileURLToPath(new URL("../.next/BUILD_ID", import.meta.url));
const expectedHealth = {
  contractVersion: "0.1",
  status: "ok",
  app: {
    name: "moss-mini-demo",
    version: "0.0.0",
    runtime: "nodejs",
    nodeVersion: "22.23.1",
  },
  moss: {
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
  },
  network: { configured: false, id: null },
  clear402: { enabled: false },
};

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function availablePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("Could not allocate a loopback port");
  }
  const { port } = address;
  server.close();
  await once(server, "close");
  return port;
}

async function terminate(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  const pid = child.pid;
  if (pid === undefined) {
    throw new Error("Production process did not expose a pid");
  }

  if (process.platform === "win32") {
    child.kill("SIGTERM");
  } else {
    process.kill(-pid, "SIGTERM");
  }

  const exited = await Promise.race([
    once(child, "exit").then(() => true),
    delay(5_000).then(() => false),
  ]);
  if (!exited) {
    if (process.platform === "win32") {
      child.kill("SIGKILL");
    } else {
      process.kill(-pid, "SIGKILL");
    }
    await once(child, "exit");
    throw new Error("Production process required forced cleanup");
  }
}

await access(nextBuild);
const port = await availablePort();
const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const child = spawn(command, ["start"], {
  cwd: repositoryRoot,
  detached: process.platform !== "win32",
  env: {
    ...process.env,
    HOSTNAME: "127.0.0.1",
    NEXT_TELEMETRY_DISABLED: "1",
    PORT: String(port),
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let logs = "";
const appendLogs = (chunk) => {
  logs = `${logs}${chunk.toString()}`.slice(-16_384);
};
child.stdout.on("data", appendLogs);
child.stderr.on("data", appendLogs);

try {
  const deadline = Date.now() + 30_000;
  let response;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Production server exited early.\n${logs}`);
    }
    try {
      const candidate = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (candidate.status === 200) {
        response = candidate;
        break;
      }
    } catch {
      // The server may still be binding the loopback port.
    }
    await delay(200);
  }

  if (response === undefined) {
    throw new Error(`Health endpoint did not become ready.\n${logs}`);
  }
  assert.equal(
    response.headers.get("content-type"),
    "application/json; charset=utf-8",
  );
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), expectedHealth);
} finally {
  await terminate(child);
}

console.log(`Production start and health smoke passed on 127.0.0.1:${port}.`);
