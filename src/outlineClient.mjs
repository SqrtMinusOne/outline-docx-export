export class OutlineApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "OutlineApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * API client for the Outline document export endpoints.
 */
export class OutlineClient {
  /**
   * @param {{ baseUrl: string; requestTimeoutMs: number; signedUrlTtlSeconds: number }} options client options.
   */
  constructor(options) {
    this.baseUrl = options.baseUrl;
    this.requestTimeoutMs = options.requestTimeoutMs;
    this.signedUrlTtlSeconds = options.signedUrlTtlSeconds;
  }

  /**
   * Fetches document title and Markdown content.
   *
   * @param {{ documentId: string; token: string }} options export options.
   * @returns {Promise<{ title: string; markdown: string }>} document export data.
   */
  async fetchDocument(options) {
    const [info, markdown] = await Promise.all([
      this.fetchDocumentInfo(options),
      this.fetchDocumentMarkdown(options),
    ]);

    return {
      title: info.title,
      markdown,
    };
  }

  /**
   * Fetches document metadata.
   *
   * @param {{ documentId: string; token: string }} options request options.
   * @returns {Promise<{ title: string }>} document metadata.
   */
  async fetchDocumentInfo({ documentId, token }) {
    const body = await this.postJson("/api/documents.info", token, {
      id: documentId,
    });
    const title = body?.data?.title;

    return {
      title: typeof title === "string" && title.trim() ? title : "Untitled",
    };
  }

  /**
   * Fetches document Markdown using signed attachment URLs.
   *
   * @param {{ documentId: string; token: string }} options request options.
   * @returns {Promise<string>} Markdown content.
   */
  async fetchDocumentMarkdown({ documentId, token }) {
    const body = await this.postJson("/api/documents.export", token, {
      id: documentId,
      signedUrls: this.signedUrlTtlSeconds,
    });
    const markdown = body?.data;

    if (typeof markdown !== "string") {
      throw new OutlineApiError("Outline returned an invalid export response.", 502, body);
    }

    return markdown;
  }

  async postJson(path, token, data) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${normalizeToken(token)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const body = await readBody(response);

      if (!response.ok) {
        throw new OutlineApiError(
          getErrorMessage(body, response.status),
          response.status,
          body
        );
      }

      return body;
    } catch (err) {
      if (err.name === "AbortError") {
        throw new OutlineApiError("Outline request timed out.", 504);
      }

      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Accepts either a raw token or a pasted Authorization header value.
 *
 * @param {string} token raw token or Bearer token.
 * @returns {string} normalized token.
 */
export function normalizeToken(token) {
  return token.trim().replace(/^Bearer\s+/i, "");
}

async function readBody(response) {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch (_err) {
    return text;
  }
}

function getErrorMessage(body, status) {
  if (body && typeof body === "object" && typeof body.message === "string") {
    return body.message;
  }

  if (status === 401) {
    return "Outline rejected the authentication token.";
  }

  if (status === 403) {
    return "This token does not have access to download the document.";
  }

  return `Outline request failed with status ${status}.`;
}
