# outline-docx-export

A small sidecar service that exports a single Outline document as DOCX without
building or deploying a custom Outline image.

The service runs next to Outline, calls Outline’s public API with the user’s own
API token, converts the exported Markdown to DOCX with Pandoc, and returns the
generated file.

## What it provides

- A web page at `/docx-export/`.
- A bookmarklet on that page that opens the exporter from the current Outline
  document.
- A `POST /docx-export/export` endpoint that streams a `.docx` file.
- A `GET /docx-export/health` endpoint for health checks.

## How users export a document

1. Open the exporter page, for example:

   `https://your-outline-domain.example/docx-export/`

2. Create an Outline API token:

   `Settings -> API keys -> New API key`

   Use a token with read access. The service uses the permissions of this token,
   so users can only export documents that token owner can download.

3. Paste either:

   - a full Outline document URL, for example
     `https://your-outline-domain.example/doc/project-plan-abcdefghij`
   - a document slug, for example `project-plan-abcdefghij`
   - a document UUID

4. Paste the API token and click `Download DOCX`.

5. Optional: drag the `Export DOCX` bookmarklet from the exporter page to the
   browser bookmarks bar. While viewing an Outline document, click the
   bookmarklet to open the exporter with the document URL prefilled.

Tokens are not stored server-side. The page stores the token in browser
`sessionStorage` by default, or in `localStorage` if the user selects
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

## Deploying with your current Outline setup

Your current deployment directory is:

`/opt/deploy/outline`

with this shape:

```text
/opt/deploy/outline
├── data
├── docker-compose.yml
├── docker.env
└── redis.conf
```

and Outline is exposed only locally:

```yaml
ports:
  - "127.0.0.1:3000:3000"
```

That is fine. The exporter should also listen only on localhost, and your
existing reverse proxy should publish it under the same public domain at
`/docx-export`.

### 1. Copy this project to the server

Example location:

```bash
sudo mkdir -p /opt/deploy/outline-docx-export
sudo rsync -a ./ /opt/deploy/outline-docx-export/
cd /opt/deploy/outline-docx-export
```

### 2. Configure the exporter

Create `/opt/deploy/outline-docx-export/.env`:

```bash
OUTLINE_BASE_URL=http://host.docker.internal:3000
DOCX_EXPORT_BASE_PATH=/docx-export
```

Because your Outline container publishes `127.0.0.1:3000:3000` on the Docker
host, `host.docker.internal:3000` is the simplest way for the exporter container
to reach Outline.

On Linux, the provided compose file below adds:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

If you instead attach the exporter to the same Docker network as Outline, you can
use:

```bash
OUTLINE_BASE_URL=http://outline:3000
```

### 3. Use this compose file

`/opt/deploy/outline-docx-export/docker-compose.yml`:

```yaml
services:
  docx-export:
    build:
      context: .
    restart: unless-stopped
    env_file: ./.env
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      PUBLIC_BASE_PATH: ${DOCX_EXPORT_BASE_PATH:-/docx-export}
      PORT: 3010
    ports:
      - "127.0.0.1:3010:3010"
```

The repository’s default compose file already matches this shape.

### 4. Start the service

```bash
cd /opt/deploy/outline-docx-export
docker compose up -d --build
docker compose ps
```

Health check from the server:

```bash
curl http://127.0.0.1:3010/docx-export/health
```

Expected shape:

```json
{"status":"ok","pandoc":"pandoc ..."}
```

### 5. Add reverse proxy routing

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

- `401` from Outline: the API token is missing, expired, or invalid.
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
- Tokens are submitted to the exporter for conversion requests, so deploy this
  only on infrastructure you control and serve it over HTTPS.
