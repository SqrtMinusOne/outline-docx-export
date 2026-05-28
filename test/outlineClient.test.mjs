import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  normalizeToken,
  OutlineApiError,
  OutlineClient,
} from "../src/outlineClient.mjs";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("normalizeToken", () => {
  it("strips a pasted Bearer prefix", () => {
    assert.equal(normalizeToken("Bearer ol_api_123"), "ol_api_123");
  });
});

describe("OutlineClient", () => {
  it("fetches document metadata and Markdown", async () => {
    const requests = [];
    globalThis.fetch = async (url, options) => {
      requests.push({ url, options });

      if (url.endsWith("/api/documents.info")) {
        return jsonResponse(200, { data: { title: "Roadmap" } });
      }

      return jsonResponse(200, { data: "Body" });
    };

    const client = new OutlineClient({
      baseUrl: "https://outline.example.com",
      requestTimeoutMs: 1000,
      signedUrlTtlSeconds: 123,
    });
    const result = await client.fetchDocument({
      documentId: "roadmap-abcdefghij",
      token: "Bearer token",
    });

    assert.deepEqual(result, { title: "Roadmap", markdown: "Body" });
    assert.equal(requests.length, 2);
    assert.equal(requests[0].options.headers.Authorization, "Bearer token");
    assert.equal(
      JSON.parse(requests[1].options.body).signedUrls,
      123
    );
  });

  it("throws an OutlineApiError for upstream failures", async () => {
    globalThis.fetch = async () =>
      jsonResponse(403, { message: "Forbidden" });

    const client = new OutlineClient({
      baseUrl: "https://outline.example.com",
      requestTimeoutMs: 1000,
      signedUrlTtlSeconds: 123,
    });

    await assert.rejects(
      client.fetchDocumentMarkdown({
        documentId: "roadmap-abcdefghij",
        token: "token",
      }),
      (err) => err instanceof OutlineApiError && err.status === 403
    );
  });
});

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
