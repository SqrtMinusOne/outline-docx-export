# outline-docx-export

A small sidecar service that exports a single Outline document as DOCX without
building or deploying a custom Outline image.

The service runs next to Outline, calls Outline’s public API as the current
Outline user, converts the exported Markdown to DOCX with Pandoc, and returns
the generated file.

When served on the same public domain as Outline, the exporter uses the existing
Outline session cookie. If the exporter is hosted on a different domain, users
can paste an Outline API token instead.

## What it provides

- A web page at `/docx-export/`.
- A bookmarklet on that page that opens the exporter from the current Outline
  document.
- A `POST /docx-export/export` endpoint that streams a `.docx` file.
- A `GET /docx-export/health` endpoint for health checks.

## How users export a document

1. Open the exporter page, for example:

   `https://your-outline-domain.example/docx-export/`

2. If the exporter is served on the same domain as Outline and you are already
   signed in, leave the API token field empty.

   If the exporter is hosted elsewhere, create an Outline API token:

   `Settings -> API keys -> New API key`

   Use a token with read access. The service uses the permissions of this token,
   so users can only export documents that the token owner can download.

3. Paste either:

   - a full Outline document URL, for example
     `https://your-outline-domain.example/doc/project-plan-abcdefghij`
   - a document slug, for example `project-plan-abcdefghij`
   - a document UUID

4. Optionally paste the API token and click `Download DOCX`.

5. Optional: drag the `Export DOCX` bookmarklet from the exporter page to the
   browser bookmarks bar. While viewing an Outline document, click the
   bookmarklet to open the exporter with the document URL prefilled.

API tokens are not stored server-side. If a token is entered, the page stores it
in browser `sessionStorage` by default, or in `localStorage` if the user selects
`Remember token in this browser`.

## Local run

Requirements:

- Node.js 20 or newer.
- Pandoc installed and available as `pandoc`.

Run:

```bash
OUTLINE_BASE_URL=http://127.0.0.1:3000 \
PUBLIC_BASE_PATH=/docx-export \
PORT=3010 \
npm start
```

Then open:

`http://127.0.0.1:3010/docx-export/`

## Docker deployment

This project includes a standalone `Dockerfile` and `docker-compose.yml`.

The image installs Pandoc inside the exporter container. It does not modify the
Outline container.

### Docker Compose

Create `.env`:

```bash
OUTLINE_BASE_URL=https://outline.example.com
DOCX_EXPORT_BASE_PATH=/docx-export
```

Start the service:

```bash
docker compose up -d --build
```

The included compose file builds the service and binds it to localhost:

```yaml
services:
  docx-export:
    build:
      context: .
    restart: unless-stopped
    env_file: ./.env
    environment:
      PUBLIC_BASE_PATH: ${DOCX_EXPORT_BASE_PATH:-/docx-export}
      PORT: 3010
    ports:
      - "127.0.0.1:3010:3010"
```

Health check:

```bash
curl http://127.0.0.1:3010/docx-export/health
```

Expected response:

```json
{"status":"ok","pandoc":"pandoc ..."}
```

### Docker CLI

Build:

```bash
docker build -t outline-docx-export .
```

Run:

```bash
docker run -d \
  --name outline-docx-export \
  --restart unless-stopped \
  -e OUTLINE_BASE_URL=https://outline.example.com \
  -e PUBLIC_BASE_PATH=/docx-export \
  -p 127.0.0.1:3010:3010 \
  outline-docx-export
```

### Choosing `OUTLINE_BASE_URL`

Set `OUTLINE_BASE_URL` to an internal URL that the exporter container can use to
reach Outline.

Common choices:

- `http://outline:3000` when this service is attached to the same Docker network
  as an Outline service named `outline`.
- `https://outline.example.com` when the container should call Outline through
  the public HTTPS endpoint.
- `http://127.0.0.1:3000` only when the exporter uses host networking, not the
  default Docker bridge network.

If Outline is published on the host as `127.0.0.1:3000:3000`, a separate Docker
container normally cannot reach it through `host.docker.internal:3000` because
the host service is bound only to host loopback. Use one of these instead:

- attach the exporter to the same Docker network as Outline and use
  `OUTLINE_BASE_URL=http://outline:3000`;
- set `OUTLINE_BASE_URL` to the public HTTPS URL of Outline;
- run the exporter with host networking and use
  `OUTLINE_BASE_URL=http://127.0.0.1:3000`.

To check what the exporter can reach, open:

```text
/docx-export/debug/upstream
```

## Reverse proxy

Route this path on the same public domain as Outline:

```text
/docx-export -> http://127.0.0.1:3010/docx-export
```

For Nginx, this is typically:

```nginx
location /docx-export/ {
  proxy_pass http://127.0.0.1:3010/docx-export/;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

Then open:

`https://your-outline-domain.example/docx-export/`

Same-domain routing is recommended because the browser will send Outline’s
`accessToken` cookie to the exporter. The exporter then forwards that session
token to Outline’s API, so users do not need to create or paste API tokens.

If the exporter is served on a separate domain or subdomain that does not receive
Outline’s cookies, users must enter an API token manually.

If you use a different path, set both:

```bash
DOCX_EXPORT_BASE_PATH=/your-path
PUBLIC_BASE_PATH=/your-path
```

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `OUTLINE_BASE_URL` | `http://outline:3000` | Internal URL the exporter uses to call Outline. |
| `DOCX_EXPORT_BASE_PATH` | `/docx-export` | Public path used in the compose file. Passed to the app as `PUBLIC_BASE_PATH`. |
| `PUBLIC_BASE_PATH` | empty | Path prefix served by the app, for example `/docx-export`. |
| `PORT` | `3010` | Port inside the exporter container. |
| `SIGNED_URL_TTL_SECONDS` | `3600` | Lifetime for signed attachment URLs requested from Outline. |
| `REQUEST_TIMEOUT_MS` | `30000` | Timeout for Outline API requests. |
| `CONVERSION_TIMEOUT_MS` | `60000` | Timeout for Pandoc conversion. |

## Troubleshooting

- `401` from Outline: the session cookie or API token is missing, expired, or
  invalid.
- `401` with an empty token field: the exporter did not receive Outline’s
  `accessToken` cookie. Use the same public domain as Outline or enter an API
  token.
- `403` from Outline: the token owner cannot download that document.
- DOCX has missing images: check whether Outline attachments are accessible from
  inside the exporter container and whether signed URLs are enabled by your
  Outline storage setup.
- `/health` fails: Pandoc is missing or the container did not build correctly.
- Exporter page works locally but not publicly: check the reverse proxy path and
  make sure `PUBLIC_BASE_PATH`/`DOCX_EXPORT_BASE_PATH` is `/docx-export`.

## Security notes

- The service does not need Outline database, Redis, or filesystem access.
- Prefer exposing it only through your reverse proxy, not directly to the
  internet.
- Keep `ports: "127.0.0.1:3010:3010"` so it only binds to localhost.
- The exporter receives either the Outline session cookie or a pasted API token
  for conversion requests, so deploy this only on infrastructure you control and
  serve it over HTTPS.
