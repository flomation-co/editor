# Welcome to React Router!

A modern, production-ready template for building full-stack React applications using React Router.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/remix-run/react-router-templates/tree/main/default)

## Features

- 🚀 Server-side rendering
- ⚡️ Hot Module Replacement (HMR)
- 📦 Asset bundling and optimization
- 🔄 Data loading and mutations
- 🔒 TypeScript by default
- 🎉 TailwindCSS for styling
- 📖 [React Router docs](https://reactrouter.com/)

## Getting Started

### Installation

Install the dependencies:

```bash
npm install
```

### Development

Start the development server with HMR:

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`.

## Building for Production

Create a production build:

```bash
npm run build
```

## Deployment

### Docker Deployment

Base image: `dhi.io/node:22-alpine3.23-dev`. Runs as non-root `flomation` user.
CI publishes the image to [Docker Hub](https://hub.docker.com/r/flomationco/flomation-editor)
as `flomationco/flomation-editor:{1.0.<pipeline>,latest}` on every `main` pipeline.

The container generates `build/client/run-config.js` from environment variables
on every start (see `docker-entrypoint.sh`): `AUTOMATE_API_URL`,
`BILLING_API_URL`, `TRIGGER_URL`, `LOGIN_URL`, `LAUNCH_URL`.

```bash
# Build (pulling the DHI base requires `docker login dhi.io`; without DHI
# credentials, fall back to the public base):
docker build -t flomationco/flomation-editor .
docker build --build-arg NODE_IMAGE=node:22-alpine -t flomationco/flomation-editor .

# Run
docker run -p 8080:8080 \
  -e AUTOMATE_API_URL=https://api.dev.flomation.app \
  -e LOGIN_URL=https://id.dev.flomation.app \
  flomationco/flomation-editor
```

### DIY Deployment

If you're familiar with deploying Node applications, the built-in app server is production-ready.

Make sure to deploy the output of `npm run build`

```
├── package.json
├── package-lock.json (or pnpm-lock.yaml, or bun.lockb)
├── build/
│   ├── client/    # Static assets
│   └── server/    # Server-side code
```

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever CSS framework you prefer.

---

Built with ❤️ using React Router.
