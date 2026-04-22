import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import stylesheet from "./app.css?url";
import useCookieToken from "~/components/cookie";
import '@xyflow/react/dist/style.css';

import AuthContext from "~/context/auth/context";
import AuthProvider from "~/context/auth/provider";
import OrganisationProvider from "~/context/organisation/provider";
import PermissionsProvider from "~/context/permissions/provider";
import {ToastProvider} from "~/components/toast";
import CookieBanner from "~/components/cookieBanner";
import EulaModal from "~/components/eulaModal";
import TutorialProvider from "~/context/tutorial/provider";
import TutorialOverlay from "~/components/tutorial";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
  { rel: "stylesheet", href: stylesheet },
];

export function Layout({ children }: { children: React.ReactNode }) {
  let jwt = useCookieToken();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <meta property="og:title"  content="Flomation - Automate your workflow" />
        <meta property="og:description" content="Flomation is a powerful workflow automation platform that connects your tools, teams, and processes into seamless flows. With a simple drag-and-drop editor, 100s of connectors, and flexible deployment options (cloud, on-prem, or hybrid), Flomation helps organisations save time, reduce errors, and unlock real productivity gains — without the complexity." />

        <meta name="twitter:title" content="Flomation - Automate your workflow" />
        <meta name="twitter:description" content="Flomation is a powerful workflow automation platform that connects your tools, teams, and processes into seamless flows. With a simple drag-and-drop editor, 100s of connectors, and flexible deployment options (cloud, on-prem, or hybrid), Flomation helps organisations save time, reduce errors, and unlock real productivity gains — without the complexity." />
        <meta name="twitter:image" content="/flomation_logo_dark.gif" />
        <meta name="twitter:card" content="summary_large_image" />

        <meta property="og:title" content="Flomation - Automate your workflow" />
        <meta property="og:description" content="Flomation is a powerful workflow automation platform that connects your tools, teams, and processes into seamless flows. With a simple drag-and-drop editor, 100s of connectors, and flexible deployment options (cloud, on-prem, or hybrid), Flomation helps organisations save time, reduce errors, and unlock real productivity gains — without the complexity." />
        <meta property="og:url" content="https://flomation.app" />
        <meta property="og:image:secure_url" content="/flomation_logo_dark.gif" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="image" property="og:image" content="/flomation_logo_dark.gif" />

        <script src="/run-config.js"></script>
        <Meta />
        <Links />
      </head>
      <body>
        <CookieBanner />
        <AuthProvider>
          <EulaModal />
          <TutorialProvider>
            <TutorialOverlay />
            <OrganisationProvider>
            <PermissionsProvider>
              <ToastProvider>
                {children}
                <ScrollRestoration />
                <Scripts />
              </ToastProvider>
            </PermissionsProvider>
          </OrganisationProvider>
          </TutorialProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
