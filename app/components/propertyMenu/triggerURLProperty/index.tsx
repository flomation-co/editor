import React, {useState} from "react";
import QRCode from "react-qr-code";
import useConfig from "~/components/config";
import type {Trigger} from "~/types";
import "./index.css";
import { Icon } from "~/components/icons/Icon";

type Props = {
    node: any;
    triggers?: Trigger[];
}

// esc HTML-escapes a value for safe inclusion in the generated snippet's text
// and attributes.
const esc = (s: unknown): string =>
    String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

// fieldToHtml renders one form field as a plain HTML control. Mirrors the field
// types the launch submit endpoint accepts from an urlencoded/multipart post.
// Structured/interactive types (matrix, table, address, file, payment,
// signature, camera, qr, license_plate, picture_choice, slider, rating, …) can't
// be expressed as flat inputs, so they emit a comment pointing at the hosted
// form/SDK. Display-only types emit nothing.
function fieldToHtml(c: any): string {
    const name = esc(c?.name || "");
    const label = esc(c?.label || c?.name || "");
    const star = c?.required ? " *" : "";
    const req = c?.required ? " required" : "";
    const opts: any[] = Array.isArray(c?.options) ? c.options : [];
    const optList = (tag: "radio" | "checkbox") =>
        opts
            .map((o) => `    <label><input type="${tag}" name="${name}" value="${esc(o?.value)}"${tag === "radio" ? req : ""}> ${esc(o?.label ?? o?.value)}</label>`)
            .join("\n");

    switch (c?.type) {
        case "text": case "email": case "number": case "url": case "phone":
        case "date": case "time": case "datetime": {
            const t: Record<string, string> = {
                text: "text", email: "email", number: "number", url: "url",
                phone: "tel", date: "date", time: "time", datetime: "datetime-local",
            };
            return `  <label>${label}${star}<br>\n    <input type="${t[c.type]}" name="${name}"${req}>\n  </label>`;
        }
        case "multiline":
            return `  <label>${label}${star}<br>\n    <textarea name="${name}"${req}></textarea>\n  </label>`;
        case "dropdown":
            return `  <label>${label}${star}<br>\n    <select name="${name}"${req}>\n      <option value="">Choose…</option>\n${opts.map((o) => `      <option value="${esc(o?.value)}">${esc(o?.label ?? o?.value)}</option>`).join("\n")}\n    </select>\n  </label>`;
        case "radio": case "opinion_scale":
            return `  <fieldset>\n    <legend>${label}${star}</legend>\n${optList("radio")}\n  </fieldset>`;
        case "checkboxes":
            return `  <fieldset>\n    <legend>${label}</legend>\n${optList("checkbox")}\n  </fieldset>`;
        case "boolean": case "consent":
            return `  <label><input type="checkbox" name="${name}"${c.type === "consent" ? req : ""}> ${label}</label>`;
        case "section_header": case "divider": case "info_text":
            return ""; // display-only — nothing to submit
        default:
            return `  <!-- "${label}" (${esc(c?.type)}) needs the hosted form or SDK — not a plain HTML input -->`;
    }
}

// buildFormEmbedSnippet turns a form definition + its endpoint URL into a
// copy-paste plain HTML <form>. Simple fields become inputs; structured ones
// become explanatory comments (see fieldToHtml).
function buildFormEmbedSnippet(formDefJson: string, actionUrl: string): string {
    let def: any = {};
    try { def = JSON.parse(formDefJson || "{}"); } catch { /* leave empty */ }
    const pages: any[] = Array.isArray(def?.pages) ? def.pages : [];
    const fields = pages
        .flatMap((p) => (Array.isArray(p?.components) ? p.components : []))
        .map(fieldToHtml)
        .filter((s) => s !== "");
    const body = fields.length ? fields.join("\n") : "  <!-- add fields to your form -->";
    return `<form action="${esc(actionUrl)}" method="post">\n${body}\n  <button type="submit">Submit</button>\n</form>`;
}

const TriggerURLProperty = (props: Props) => {
    const config = useConfig();
    const [copied, setCopied] = useState(false);

    const nodeLabel = props.node?.data?.label || "";
    const nodeType = props.node?.data?.config?.type;

    // Only render for trigger nodes (type 1)
    if (nodeType !== 1) return null;

    // Map node label to trigger type name
    const typeName = nodeLabel.replace("trigger/", "").replace(/_/g, "-");

    // Find the matching trigger from the flow's triggers
    const trigger = props.triggers?.find(t => t.type_name === typeName);
    if (!trigger) {
        return (
            <div className="trigger-url-section">
                <div className="trigger-url-hint">
                    Save this flow to generate the trigger URL
                </div>
            </div>
        );
    }

    const launchUrl = config("TRIGGER_URL") || config("LAUNCH_URL") || "";
    let triggerUrl = "";
    let triggerPath = "";
    let showQR = false;
    let showSnippet = false;
    let snippetCode = "";
    let snippetLabel = "Embed Code";
    let snippetMultiline = false;
    let snippetHint = "";

    switch (typeName) {
        case "webhook":
            triggerPath = `/webhook/${trigger.id}`;
            triggerUrl = launchUrl + triggerPath;
            break;
        case "gitlab-webhook":
            triggerPath = `/webhook/${trigger.id}`;
            triggerUrl = launchUrl + triggerPath;
            break;
        case "github-webhook":
            triggerPath = `/webhook/${trigger.id}`;
            triggerUrl = launchUrl + triggerPath;
            break;
        case "qr":
            triggerPath = `/qr/${trigger.id}`;
            triggerUrl = launchUrl + triggerPath;
            showQR = true;
            break;
        case "form": {
            triggerPath = `/form/${trigger.id}`;
            triggerUrl = launchUrl + triggerPath;
            // Copy-paste plain HTML <form> that posts straight to the endpoint.
            const formDef = props.node?.data?.config?.inputs
                ?.find((i: any) => i?.name === "form_definition")?.value || "";
            showSnippet = true;
            snippetMultiline = true;
            snippetLabel = "HTML Form Embed";
            snippetHint = "Drop this into any page to post directly to the form. Simple fields are included; structured/interactive fields (matrix, table, file upload, payment, …) need the hosted form or SDK. Public forms only — a login-gated form needs the hosted page or SDK.";
            snippetCode = buildFormEmbedSnippet(formDef, triggerUrl);
            break;
        }
        case "web":
            // Invoked over HTTP (any accepted verb) by the flow id, embed-gated.
            triggerPath = `/v1/embed/flow/${trigger.flo_id}/invoke`;
            triggerUrl = launchUrl + triggerPath;
            break;
        case "image":
            triggerPath = `/image/${trigger.id}`;
            triggerUrl = launchUrl + triggerPath;
            showSnippet = true;
            snippetCode = `<img src="${triggerUrl}" width="1" height="1" alt="" style="display:none" />`;
            break;
        case "facebook-messenger":
        case "facebook-feed": {
            // Facebook webhooks must be publicly accessible — use LAUNCH_URL (ngrok)
            const publicUrl = config("LAUNCH_URL") || launchUrl;
            triggerPath = `/webhook/facebook`;
            triggerUrl = publicUrl + triggerPath;
            break;
        }
        case "intercom-webhook": {
            // Intercom webhooks must be publicly accessible — use LAUNCH_URL (ngrok)
            const publicUrl = config("LAUNCH_URL") || launchUrl;
            triggerPath = `/webhook/${trigger.id}`;
            triggerUrl = publicUrl + triggerPath;
            break;
        }
        case "linkedin-poll":
            // Polling-based — no URL needed
            return null;
        default:
            return null;
    }

    const isFacebookTrigger = typeName === "facebook-messenger" || typeName === "facebook-feed";
    const isIntercomTrigger = typeName === "intercom-webhook";
    const isWebTrigger = typeName === "web";

    // Web Trigger auth mode: "public" ⇒ open endpoint (no key), otherwise the
    // secure default of requiring an embed-app publishable key. Read from the
    // sibling auth_mode input so the hint matches how the endpoint is gated.
    const webAuthMode = props.node?.data?.config?.inputs
        ?.find((i: any) => i?.name === "auth_mode")?.value;
    const isWebPublic = isWebTrigger && webAuthMode === "public";

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="trigger-url-section">
            <div className="trigger-url-label">{isFacebookTrigger ? "Facebook Webhook URL" : isIntercomTrigger ? "Intercom Webhook URL" : isWebTrigger ? "Invoke URL" : "Trigger URL"}</div>
            {isWebTrigger && !isWebPublic && (
                <div className="trigger-url-hint" style={{ marginBottom: 6 }}>
                    Call this over HTTP with your embed app's publishable key
                    (<code>X-Flomation-Publishable-Key</code>) — via the SDK's{" "}
                    <code>invoke()</code> or any HTTP client. Opt this flow in on the{" "}
                    <strong>Embed SDK</strong> page first.
                </div>
            )}
            {isWebPublic && (
                <div className="trigger-url-hint" style={{ marginBottom: 6 }}>
                    <strong>Publicly open</strong> — call this over HTTP from any
                    origin with no key required. Anyone with the URL can invoke this
                    flow, so avoid exposing sensitive actions.
                </div>
            )}
            {isFacebookTrigger && (
                <div className="trigger-url-hint" style={{ marginBottom: 6 }}>
                    Paste this URL in your{" "}
                    <a
                        href="https://developers.facebook.com/apps/"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#00aa9c", textDecoration: "underline" }}
                    >
                        Facebook App Dashboard
                    </a>
                    {" "}under <strong>Webhooks</strong>. Subscribe to <strong>Page</strong> events.
                </div>
            )}
            {isIntercomTrigger && (
                <div className="trigger-url-hint" style={{ marginBottom: 6 }}>
                    Paste this URL in your{" "}
                    <a
                        href="https://app.intercom.com/a/apps/_/developer-hub"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#00aa9c", textDecoration: "underline" }}
                    >
                        Intercom Developer Hub
                    </a>
                    {" "}app under <strong>Configure → Webhooks</strong>, then pick the topics you want to receive. Intercom checks the URL with a HEAD request when you save.
                </div>
            )}
            <div className="trigger-url-box">
                <code className="trigger-url-text">{triggerUrl}</code>
                <button className="trigger-url-copy" onClick={() => copyToClipboard(triggerUrl)}>
                    <Icon name={copied? "check" : "copy"} />
                </button>
            </div>

            {showQR && (
                <div className="trigger-qr-container">
                    <QRCode
                        size={180}
                        value={triggerUrl}
                        style={{height: "auto", maxWidth: "100%", width: "100%", padding: "10px", background: "#fff", borderRadius: "8px"}}
                    />
                </div>
            )}

            {showSnippet && (
                <>
                    <div className="trigger-url-label" style={{marginTop: "10px"}}>{snippetLabel}</div>
                    {snippetHint && (
                        <div className="trigger-url-hint" style={{marginBottom: 6}}>{snippetHint}</div>
                    )}
                    <div className={`trigger-url-box${snippetMultiline ? " trigger-url-box--snippet" : ""}`}>
                        {snippetMultiline
                            ? <pre className="trigger-url-snippet">{snippetCode}</pre>
                            : <code className="trigger-url-text">{snippetCode}</code>}
                        <button className="trigger-url-copy" onClick={() => copyToClipboard(snippetCode)}>
                            <Icon name={copied? "check" : "copy"} />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default TriggerURLProperty;
