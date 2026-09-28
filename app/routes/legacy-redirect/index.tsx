import { redirect } from "react-router";

// Redirects for paths that were published somewhere we cannot edit.
//
// "/editor" went out in the first onboarding email as the button on "Create
// your first flow". It has never been a route — the canvas is "/flo" and the
// list is "/flow" — so 34 people clicked it and got a 404. The email is sent;
// the only way to make those clicks land is to answer the URL.
//
// Server-side, because the editor renders on the server: an unknown path 404s
// before any JavaScript runs, so a client-side route would never get the
// chance. A loader that throws a redirect answers with a real 302.
//
// 302 rather than 301 deliberately. A permanent redirect is cached by the
// browser more or less for ever, which would make "/editor" impossible to
// reuse later; this is a compatibility shim for a link already in people's
// inboxes, not a statement about the URL.
export function loader() {
    return redirect("/flow");
}

// Never rendered — the loader always redirects. React Router still wants a
// component for the route to be valid.
export default function LegacyRedirect() {
    return null;
}
