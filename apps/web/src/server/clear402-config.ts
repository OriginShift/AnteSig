import "server-only";

type Clear402Environment = Readonly<Record<string, string | undefined>>;

function runtimeEnvironment(): Clear402Environment {
  return (
    globalThis as typeof globalThis & {
      process: { env: Clear402Environment };
    }
  ).process.env;
}

export function isClear402Enabled(
  environment: Clear402Environment = runtimeEnvironment(),
): boolean {
  return environment.CLEAR402_ENABLED === "true";
}
