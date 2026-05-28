import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export class ConversionError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "ConversionError";
    this.cause = cause;
  }
}

/**
 * Converts Markdown to DOCX with Pandoc.
 *
 * @param {{ title: string; markdown: string; timeoutMs: number }} options conversion options.
 * @returns {Promise<Buffer>} DOCX bytes.
 */
export async function convertMarkdownToDocx({ title, markdown, timeoutMs }) {
  const tempDir = await mkdtemp(path.join(tmpdir(), "outline-docx-"));
  const inputPath = path.join(tempDir, "document.md");
  const outputPath = path.join(tempDir, "document.docx");

  try {
    await writeFile(inputPath, withDocumentTitle(title, markdown), "utf8");
    await execFileWithTimeout(
      "pandoc",
      [
        "--from=gfm+hard_line_breaks",
        "--to=docx",
        "--standalone",
        "--output",
        outputPath,
        inputPath,
      ],
      timeoutMs
    );

    return await readFile(outputPath);
  } catch (err) {
    throw new ConversionError("DOCX conversion failed.", err);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * Checks whether Pandoc is available.
 *
 * @returns {Promise<string>} Pandoc version line.
 */
export async function getPandocVersion() {
  const { stdout } = await execFileWithTimeout("pandoc", ["--version"], 5_000);
  return stdout.split("\n")[0] || "pandoc";
}

function withDocumentTitle(title, markdown) {
  const cleanTitle = title.replace(/\r?\n/g, " ").trim();

  if (!cleanTitle) {
    return markdown;
  }

  return `# ${escapeHeading(cleanTitle)}\n\n${markdown}`;
}

function escapeHeading(value) {
  return value.replace(/\\/g, "\\\\").replace(/#/g, "\\#");
}

function execFileWithTimeout(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      command,
      args,
      {
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024 * 4,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }

        resolve({ stdout, stderr });
      }
    );

    child.on("error", reject);
  });
}
