import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const staticRoot = join(repositoryRoot, "apps/web/.next/static");
const serverRoot = join(repositoryRoot, "apps/web/.next/server");
const forbiddenMarkers = [
  "@themoss/",
  "@moss-mini-demo/moss-adapter",
  "vendor/moss",
  "MossBuildInfo",
  "INTEGRATION_FORK",
  "MONAD_RPC",
  "RPC_URL",
  "PRIVATE_KEY",
];

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
}

const staticFiles = await listFiles(staticRoot);
const staticJavaScript = staticFiles.filter(
  (file) => file.endsWith(".js") || file.endsWith(".mjs"),
);
if (staticJavaScript.length === 0) {
  throw new Error("Browser leakage smoke found no static JavaScript artifact");
}

for (const file of staticJavaScript) {
  const contents = (await readFile(file, "utf8")).toLowerCase();
  for (const marker of forbiddenMarkers) {
    if (contents.includes(marker.toLowerCase())) {
      throw new Error(`Browser artifact leaked forbidden marker ${marker}`);
    }
  }
}

const serverFiles = await listFiles(serverRoot);
const serverText = (
  await Promise.all(serverFiles.map((file) => readFile(file, "utf8")))
).join("\n");
for (const marker of [
  "1ae6b6322d51fae9104f047efb94e601050b967f",
  "@themoss/core",
]) {
  if (!serverText.includes(marker)) {
    throw new Error(`Server output is missing required marker ${marker}`);
  }
}

console.log(
  `Browser bundle leakage smoke passed for ${staticJavaScript.length} static JavaScript artifacts.`,
);
