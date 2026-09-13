export type SentryEnvironment = "development" | "preview" | "production";

const SENTRY_ENVIRONMENTS = new Set<SentryEnvironment>([
  "development",
  "preview",
  "production",
]);

/**
 * Prefer the build profile's explicit variant. When Expo is started directly,
 * APP_VARIANT is absent, so use the bundle mode instead of reporting local
 * Metro errors as production incidents.
 */
export function resolveSentryEnvironment(
  configuredVariant: unknown,
  isDev: boolean
): SentryEnvironment {
  if (
    typeof configuredVariant === "string" &&
    SENTRY_ENVIRONMENTS.has(configuredVariant as SentryEnvironment)
  ) {
    return configuredVariant as SentryEnvironment;
  }

  return isDev ? "development" : "production";
}
