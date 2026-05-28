/**
 * Reads runtime configuration from environment variables.
 *
 * @param {NodeJS.ProcessEnv} env environment variables.
 * @returns {{
 *   outlineBaseUrl: string;
 *   port: number;
 *   host: string;
 *   publicBasePath: string;
 *   signedUrlTtlSeconds: number;
 *   requestTimeoutMs: number;
 *   conversionTimeoutMs: number;
 * }}
 */
export function readConfig(env = process.env) {
  return {
    outlineBaseUrl: stripTrailingSlash(
      env.OUTLINE_BASE_URL || "http://outline:3000"
    ),
    port: parsePositiveInteger(env.PORT, 3010),
    host: env.HOST || "0.0.0.0",
    publicBasePath: normalizeBasePath(env.PUBLIC_BASE_PATH || ""),
    signedUrlTtlSeconds: parsePositiveInteger(
      env.SIGNED_URL_TTL_SECONDS,
      60 * 60
    ),
    requestTimeoutMs: parsePositiveInteger(env.REQUEST_TIMEOUT_MS, 30_000),
    conversionTimeoutMs: parsePositiveInteger(
      env.CONVERSION_TIMEOUT_MS,
      60_000
    ),
  };
}

/**
 * Normalizes a public base path for reverse-proxy deployments.
 *
 * @param {string} value raw base path.
 * @returns {string} normalized base path, or an empty string for root.
 */
export function normalizeBasePath(value) {
  const trimmed = value.trim();

  if (!trimmed || trimmed === "/") {
    return "";
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return stripTrailingSlash(withLeadingSlash);
}

/**
 * Removes a trailing slash unless the value is root.
 *
 * @param {string} value input value.
 * @returns {string} value without a trailing slash.
 */
export function stripTrailingSlash(value) {
  if (value.length > 1 && value.endsWith("/")) {
    return value.slice(0, -1);
  }

  return value;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value || "", 10);

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
}
