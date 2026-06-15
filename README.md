# Flomation Editor

> Visual web app for building, running, and monitoring automation workflows ("flos").

## Overview

The Flomation Editor is the user-facing front end for the Flomation Automate platform.
It is a [React Router 7](https://reactrouter.com/) (framework mode, server-side
rendered) application written in TypeScript and styled with TailwindCSS. The flo editor
canvas is built on [React Flow](https://reactflow.dev/) (`@xyflow/react`).

The editor talks to the API
for all data, to the identity service for authentication, and to the
Launch service for
trigger URLs. Backend endpoints are injected at runtime (not baked into the bundle) via a
generated `run-config.js` — see [Configuration](#configuration).

Key areas of the app:

- **Flo editor** — drag-and-drop graph editor for building workflows
- **Dashboards & boards** — customisable widget boards (including public, shareable boards)
- **Executions** — live and historical execution runs with log and state inspection
- **Triggers, runners, queues** — manage how and where flos run
- **Environments** — manage per-environment properties and secrets
- **Organisations, teams, billing, usage** — account and tenancy management

## Prerequisites

- Node.js 20+ (the production image tracks Node 26)
- npm
- Docker (optional, for containerised builds and deployment)

## Installation

```bash
# Clone the repository
git clone <repo-url> && cd editor

# Install dependencies
npm install
```

## Configuration

Backend service URLs are provided to the client at runtime through a `run-config.js`
file loaded by `app/root.tsx`, which populates `window.properties`. In the container this
file is generated on every start by `docker-entrypoint.sh` from the following environment
variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTOMATE_API_URL` | Base URL of the Flomation API | `http://localhost:8080` |
| `BILLING_API_URL` | Base URL of the billing API | `http://localhost:9085` |
| `TRIGGER_URL` | Base URL for trigger endpoints | `http://localhost:8081` |
| `LOGIN_URL` | Identity / login service URL | `http://localhost:8081` |
| `LAUNCH_URL` | Base URL of the Launch service | `http://localhost:8081` |
| `PORT` | Port the server listens on | `8080` |

For local development, copy `public/run-config.js.template` to `public/run-config.js` and
fill in the URLs you want to develop against.

## Usage

```bash
# Start the dev server with HMR (defaults to port 5174)
npm run dev

# Type-check the project
npm run typecheck

# Create a production build
npm run build

# Serve the production build (defaults to port 8080)
npm start
```

During development the app is available at `http://localhost:5174`.

## Development

```bash
# Build a versioned, self-contained bundle (build/ + build.zip) — used by CI
make compile

# Build the Docker image
make docker-compile
```

The production build output lives in `build/`:

```
build/
├── client/    # Static assets (run-config.js is generated here at startup)
└── server/    # Server-side render code
```

## Docker

Base image: `dhi.io/node:26-alpine-dev` (DHI only tracks Node 26). Runs as a non-root
`flomation` user with a health check on `/`. CI publishes the image to
[Docker Hub](https://hub.docker.com/r/flomationco/flomation-editor) as
`flomationco/flomation-editor:{1.0.<pipeline>,latest}` on every `main` pipeline.

```bash
# Build (pulling the DHI base requires `docker login dhi.io`; without DHI
# credentials, fall back to the public base):
docker build -t flomationco/flomation-editor .
docker build --build-arg NODE_IMAGE=node:26-alpine -t flomationco/flomation-editor .

# Run
docker run -p 8080:8080 \
  -e AUTOMATE_API_URL=https://api.dev.flomation.app \
  -e LOGIN_URL=https://id.dev.flomation.app \
  flomationco/flomation-editor
```

The container regenerates `build/client/run-config.js` from the environment variables
above on every start (see `docker-entrypoint.sh`).

## Project Structure

```
.
├── app/
│   ├── root.tsx              # App shell; loads run-config.js into window.properties
│   ├── routes.ts             # Route table
│   ├── routes/               # Page routes (dashboard, editor, executions, …)
│   ├── components/           # Reusable UI (editor canvas, nodes, modals, widgets)
│   ├── context/              # React context providers (auth, organisation, permissions)
│   ├── lib/                  # API client, billing, export, utilities
│   └── app.css               # Global styles
├── public/                   # Static assets and run-config.js template
├── docker-entrypoint.sh      # Generates run-config.js, then starts the server
├── react-router.config.ts    # React Router config (SSR enabled)
├── vite.config.ts            # Vite / build config
├── tailwind.config.ts        # TailwindCSS config
├── Dockerfile
├── Makefile
└── package.json
```

## Licence

MIT — Flomation LTD. See [LICENCE.md](LICENCE.md).
