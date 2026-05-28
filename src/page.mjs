/**
 * Renders the export page.
 *
 * @param {{ basePath: string; documentValue?: string; error?: string }} options render options.
 * @returns {string} HTML response.
 */
export function renderPage({ basePath, documentValue = "", error = "" }) {
  const bookmarklet = buildBookmarklet(basePath);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Outline DOCX Export</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.45;
    }
    body {
      margin: 0;
      background: Canvas;
      color: CanvasText;
    }
    main {
      box-sizing: border-box;
      max-width: 720px;
      min-height: 100vh;
      padding: 48px 24px;
      margin: 0 auto;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 28px;
      letter-spacing: 0;
    }
    p {
      margin: 0 0 24px;
      color: color-mix(in srgb, CanvasText 72%, Canvas);
    }
    form {
      display: grid;
      gap: 16px;
    }
    label {
      display: grid;
      gap: 6px;
      font-weight: 600;
    }
    input[type="text"],
    input[type="password"] {
      box-sizing: border-box;
      width: 100%;
      min-height: 42px;
      padding: 9px 11px;
      border: 1px solid color-mix(in srgb, CanvasText 22%, Canvas);
      border-radius: 6px;
      font: inherit;
      background: Canvas;
      color: CanvasText;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 400;
    }
    button,
    .bookmarklet {
      width: fit-content;
      min-height: 40px;
      padding: 9px 14px;
      border: 1px solid color-mix(in srgb, CanvasText 22%, Canvas);
      border-radius: 6px;
      background: CanvasText;
      color: Canvas;
      font: inherit;
      font-weight: 650;
      text-decoration: none;
      cursor: pointer;
    }
    .secondary {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid color-mix(in srgb, CanvasText 14%, Canvas);
    }
    .error {
      padding: 12px;
      border-radius: 6px;
      background: #fee2e2;
      color: #7f1d1d;
    }
    small {
      color: color-mix(in srgb, CanvasText 62%, Canvas);
    }
  </style>
</head>
<body>
  <main>
    <h1>Outline DOCX Export</h1>
    <p>Export a single Outline document to DOCX using your current Outline session or an API token.</p>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
    <form method="post" action="${escapeAttribute(basePath)}/export">
      <label>
        Document URL or id
        <input name="document" type="text" autocomplete="off" required value="${escapeAttribute(documentValue)}">
      </label>
      <label>
        Outline API token
        <input id="token" name="token" type="password" autocomplete="off">
        <small>Optional when this page is served on the same domain as Outline and you are signed in.</small>
      </label>
      <label class="row">
        <input id="remember" type="checkbox">
        Remember token in this browser
      </label>
      <button type="submit">Download DOCX</button>
    </form>
    <section class="secondary">
      <h2>Bookmarklet</h2>
      <p>Drag this link to your bookmarks, then click it while viewing an Outline document.</p>
      <a class="bookmarklet" href="${escapeAttribute(bookmarklet)}">Export DOCX</a>
    </section>
  </main>
  <script>
    const tokenInput = document.getElementById("token");
    const rememberInput = document.getElementById("remember");
    const storedToken = localStorage.getItem("outline-docx-token") || sessionStorage.getItem("outline-docx-token") || "";
    tokenInput.value = storedToken;
    rememberInput.checked = !!localStorage.getItem("outline-docx-token");
    tokenInput.form.addEventListener("submit", () => {
      if (rememberInput.checked) {
        localStorage.setItem("outline-docx-token", tokenInput.value);
        sessionStorage.removeItem("outline-docx-token");
      } else {
        sessionStorage.setItem("outline-docx-token", tokenInput.value);
        localStorage.removeItem("outline-docx-token");
      }
    });
  </script>
</body>
</html>`;
}

function buildBookmarklet(basePath) {
  const target = `${basePath || ""}/`;
  const source = `(() => { location.href = ${JSON.stringify(target)} + "?document=" + encodeURIComponent(location.href); })();`;
  return `javascript:${source.replace(/\s+/g, " ")}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
