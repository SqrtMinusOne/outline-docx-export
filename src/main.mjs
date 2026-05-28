import { readConfig } from "./config.mjs";
import { convertMarkdownToDocx, getPandocVersion } from "./converter.mjs";
import { OutlineClient } from "./outlineClient.mjs";
import { createServer } from "./server.mjs";

const config = readConfig();
const outlineClient = new OutlineClient({
  baseUrl: config.outlineBaseUrl,
  requestTimeoutMs: config.requestTimeoutMs,
  signedUrlTtlSeconds: config.signedUrlTtlSeconds,
});
const server = createServer({
  config,
  outlineClient,
  convertMarkdownToDocx,
  getPandocVersion,
});

server.listen(config.port, config.host, () => {
  console.log(
    `outline-docx-export listening on ${config.host}:${config.port}${config.publicBasePath || "/"}`
  );
});
