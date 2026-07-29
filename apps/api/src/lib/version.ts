/**
 * Runtime app version. Prefer APP_VERSION from the image/build;
 * fall back to package version when present (dev), else "0.0.0-dev".
 */
export function resolveAppVersion(
  envVersion: string | undefined = process.env.APP_VERSION,
): string {
  const fromEnv = envVersion?.trim();
  if (fromEnv) return fromEnv;
  return "0.0.0-dev";
}

export const APP_VERSION = resolveAppVersion();
