import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createServer } from "../src/server.mjs";

describe("createServer", () => {
  let server;
  let baseUrl;
  let exportRequest;

  before(async () => {
    server = createServer({
      config: {
        publicBasePath: "/docx-export",
        conversionTimeoutMs: 321,
      },
      outlineClient: {
        async fetchDocument(options) {
          exportRequest = options;
          return {
            title: "Product Spec",
            markdown: "Body",
          };
        },
      },
      async convertMarkdownToDocx(options) {
        assert.equal(options.title, "Product Spec");
        assert.equal(options.markdown, "Body");
        assert.equal(options.timeoutMs, 321);
        return Buffer.from("docx");
      },
      async getPandocVersion() {
        return "pandoc 3.1";
      },
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it("serves health under the configured base path", async () => {
    const response = await fetch(`${baseUrl}/docx-export/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { status: "ok", pandoc: "pandoc 3.1" });
  });

  it("renders the export page with a prefilled document", async () => {
    const response = await fetch(
      `${baseUrl}/docx-export/?document=https%3A%2F%2Foutline.example.com%2Fdoc%2Fplan-abcdefghij`
    );
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(body, /plan-abcdefghij/);
    assert.match(body, /Export DOCX/);
  });

  it("exports a DOCX", async () => {
    const response = await fetch(`${baseUrl}/docx-export/export`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        document: "https://outline.example.com/doc/spec-abcdefghij",
        token: "api-token",
      }),
    });
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.equal(body, "docx");
    assert.equal(exportRequest.documentId, "spec-abcdefghij");
    assert.equal(exportRequest.token, "api-token");
    assert.equal(
      response.headers.get("content-type"),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    assert.match(
      response.headers.get("content-disposition") || "",
      /Product Spec\.docx/
    );
  });

  it("uses the Outline accessToken cookie when no API token is submitted", async () => {
    const response = await fetch(`${baseUrl}/docx-export/export`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: "other=value; accessToken=session-token",
      },
      body: new URLSearchParams({
        document: "https://outline.example.com/doc/spec-abcdefghij",
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(exportRequest.documentId, "spec-abcdefghij");
    assert.equal(exportRequest.token, "session-token");
  });
});
