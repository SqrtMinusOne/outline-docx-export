const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OUTLINE_SLUG_REGEX = /^(?:[0-9a-zA-Z-_~]*-)?([a-zA-Z0-9]{10,15})$/;

export class UserInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "UserInputError";
  }
}

/**
 * Extracts an Outline document identifier from a URL, slug, or UUID.
 *
 * @param {string} input document URL, slug, or UUID.
 * @returns {string} Outline document identifier accepted by the API.
 * @throws {UserInputError} if no document identifier can be found.
 */
export function normalizeDocumentInput(input) {
  const value = input.trim();

  if (!value) {
    throw new UserInputError("Enter an Outline document URL or id.");
  }

  const fromUrl = tryExtractFromUrl(value);
  if (fromUrl) {
    return fromUrl;
  }

  if (UUID_REGEX.test(value) || OUTLINE_SLUG_REGEX.test(value)) {
    return value;
  }

  throw new UserInputError(
    "Document must be an Outline URL, document slug, or UUID."
  );
}

function tryExtractFromUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch (_err) {
    return undefined;
  }

  const idParam = url.searchParams.get("id");
  if (idParam && (UUID_REGEX.test(idParam) || OUTLINE_SLUG_REGEX.test(idParam))) {
    return idParam;
  }

  const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const docSegmentIndex = segments.indexOf("doc");

  if (docSegmentIndex === -1) {
    return undefined;
  }

  const slug = segments[docSegmentIndex + 1];
  if (slug && OUTLINE_SLUG_REGEX.test(slug)) {
    return slug;
  }

  return undefined;
}
