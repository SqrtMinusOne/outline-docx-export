const RESERVED_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

/**
 * Produces a filesystem and HTTP-header friendly filename stem.
 *
 * @param {string | undefined} value candidate filename.
 * @returns {string} sanitized filename without extension.
 */
export function sanitizeFilename(value) {
  const sanitized = (value || "")
    .replace(RESERVED_FILENAME_CHARS, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .trim()
    .replace(/^[.\s-]+|[.\s-]+$/g, "")
    .slice(0, 120);

  return sanitized || "outline-document";
}
