import http from "node:http";
import { parse as parseQuery } from "node:querystring";
import { normalizeDocumentInput, UserInputError } from "./documentInput.mjs";
import { sanitizeFilename } from "./filename.mjs";
import { renderPage } from "./page.mjs";

/**
 * Creates the DOCX export HTTP server.
 *
 * @param {{
 *   config: {
 *     publicBasePath: string;
 *     conversionTimeoutMs: number;
 *   };
 *   outlineClient: { fetchDocument(options: { documentId: string; token: string }): Promise<{ title: string; markdown: string }> };
 *   convertMarkdownToDocx: (options: { title: string; markdown: string; timeoutMs: number }) => Promise<Buffer>;
 *   getPandocVersion: () => Promise<string>;
 * }} options server dependencies.
 * @returns {http.Server} HTTP server.
 */
export function createServer(options) {
  return http.createServer(async (req, res) => {
    try {
      await handleRequest(req, res, options);
    } catch (err) {
      handleError(req, res, options.config.publicBasePath, err);
    }
  });
}

async function handleRequest(req, res, options) {
  const url = new URL(req.url || "/", "http://localhost");
  const routePath = stripBasePath(url.pathname, options.config.publicBasePath);

  if (req.method === "GET" && routePath === "/health") {
    const pandoc = await options.getPandocVersion();
    sendJson(res, 200, { status: "ok", pandoc });
    return;
  }

  if (req.method === "GET" && routePath === "/") {
    sendHtml(
      res,
      200,
      renderPage({
        basePath: options.config.publicBasePath,
        documentValue: url.searchParams.get("document") || "",
      })
    );
    return;
  }

  if (req.method === "POST" && routePath === "/export") {
    const body = await readRequestBody(req);
    const documentId = normalizeDocumentInput(String(body.document || ""));
    const token =
      String(body.token || "").trim() || getCookieValue(req, "accessToken");

    if (!token) {
      throw new UserInputError(
        "Sign in to Outline on this domain or enter an Outline API token."
      );
    }

    const document = await options.outlineClient.fetchDocument({
      documentId,
      token,
    });
    const docx = await options.convertMarkdownToDocx({
      title: document.title,
      markdown: document.markdown,
      timeoutMs: options.config.conversionTimeoutMs,
    });

    const filename = `${sanitizeFilename(document.title)}.docx`;
    res.writeHead(200, {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Length": String(docx.byteLength),
      "Content-Disposition": getAttachmentDisposition(filename),
      "Cache-Control": "no-store",
    });
    res.end(docx);
    return;
  }

  sendText(res, 404, "Not found");
}

function stripBasePath(pathname, basePath) {
  if (!basePath) {
    return pathname;
  }

  if (pathname === basePath) {
    return "/";
  }

  if (pathname.startsWith(`${basePath}/`)) {
    return pathname.slice(basePath.length);
  }

  return pathname;
}

async function readRequestBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.byteLength;

    if (size > 64 * 1024) {
      throw new UserInputError("Request body is too large.");
    }

    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  const contentType = req.headers["content-type"] || "";

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(raw || "{}");
    } catch (_err) {
      throw new UserInputError("Request body must be valid JSON.");
    }
  }

  return parseQuery(raw);
}

function handleError(req, res, basePath, err) {
  const status = err instanceof UserInputError ? 400 : err.status || 500;
  const message =
    status >= 500
      ? "The DOCX export failed. Check the service logs for details."
      : err.message;

  if (status >= 500) {
    console.error("DOCX export failed", {
      name: err.name,
      message: err.message,
      status: err.status,
    });
  }

  if (req.method === "POST") {
    sendHtml(
      res,
      status,
      renderPage({
        basePath,
        error: message,
      })
    );
    return;
  }

  sendText(res, status, message);
}

function sendHtml(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function sendText(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function getCookieValue(req, name) {
  const header = req.headers.cookie;

  if (!header) {
    return "";
  }

  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");

    if (rawName !== name) {
      continue;
    }

    try {
      return decodeURIComponent(rawValue.join("="));
    } catch (_err) {
      return rawValue.join("=");
    }
  }

  return "";
}

function getAttachmentDisposition(filename) {
  const asciiFilename = filename.replace(/[^\x20-\x7e]/g, "_");
  const quoted = asciiFilename.replace(/["\\]/g, "\\$&");

  return `attachment; filename="${quoted}"; filename*=UTF-8''${encodeRFC5987ValueChars(
    filename
  )}`;
}

function encodeRFC5987ValueChars(value) {
  return encodeURIComponent(value)
    .replace(/['()]/g, (char) => `%${char.charCodeAt(0).toString(16)}`)
    .replace(/\*/g, "%2A");
}
