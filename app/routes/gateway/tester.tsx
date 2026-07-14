import {useEffect, useMemo, useState} from "react";
import {Icon} from "~/components/icons/Icon";
import type {GatewayAPI} from "~/types";

// Methods that carry a request body — the body editor only shows for these.
const BODY_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type Resp = {
    loading?: boolean;
    error?: string;
    status?: number;
    statusText?: string;
    ok?: boolean;
    timeMs?: number;
    contentType?: string;
    body?: string;
};

// prettyBody pretty-prints a JSON response; falls back to the raw text otherwise.
function prettyBody(text: string, contentType: string): string {
    if (/json/i.test(contentType) || /^\s*[\[{]/.test(text)) {
        try {
            return JSON.stringify(JSON.parse(text), null, 2);
        } catch {
            /* not valid JSON after all — show raw */
        }
    }
    return text;
}

function statusClass(status?: number, error?: string): string {
    if (error) return "gwt-status--err";
    if (!status) return "";
    if (status >= 500) return "gwt-status--err";
    if (status >= 400) return "gwt-status--warn";
    if (status >= 300) return "gwt-status--info";
    return "gwt-status--ok";
}

/**
 * GatewayTester is a live, in-browser client for a Gateway API. It fires a real
 * request at the running gateway URL (the gateway serves permissive CORS, so no
 * proxy is needed) and reports the status, timing and body. It's page-specific
 * tooling mounted into the help rail via HelpContent.extra.
 */
export default function GatewayTester({apis, launchBase}: {apis: GatewayAPI[]; launchBase: string}) {
    const [apiPk, setApiPk] = useState<string>("");
    const [epId, setEpId] = useState<string>("");
    const [path, setPath] = useState<string>("");
    const [body, setBody] = useState<string>("");
    // Auth inputs (only the ones relevant to the API's auth type are shown).
    const [apiKey, setApiKey] = useState<string>("");
    const [username, setUsername] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [token, setToken] = useState<string>("");
    const [resp, setResp] = useState<Resp | null>(null);

    const api = useMemo(() => apis.find(a => a.id === apiPk) ?? apis[0], [apis, apiPk]);
    const endpoints = api?.endpoints ?? [];
    const ep = useMemo(() => endpoints.find(e => e.id === epId) ?? endpoints[0], [endpoints, epId]);
    const method = (ep?.method ?? "GET").toUpperCase();

    // Keep the selected API valid as the list loads / changes.
    useEffect(() => {
        if (apis.length && !apis.some(a => a.id === apiPk)) {
            setApiPk(apis[0].id);
        }
    }, [apis, apiPk]);

    // When the API changes, default to its first endpoint and clear the result.
    useEffect(() => {
        setEpId(endpoints[0]?.id ?? "");
        setResp(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiPk]);

    // When the endpoint changes, prefill the editable path with its pattern.
    useEffect(() => {
        setPath(ep?.path_pattern ?? "/");
        setResp(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [epId, ep?.path_pattern]);

    if (!apis.length) {
        return (
            <div className="gwt">
                <div className="gwt-title"><Icon name="play" /> Live tester</div>
                <div className="gwt-empty">Create an API and add an endpoint to try it out here.</div>
            </div>
        );
    }

    async function send() {
        if (!api || !ep) return;
        setResp({loading: true});

        const headers: Record<string, string> = {};
        let bodyToSend: string | undefined;
        if (BODY_METHODS.has(method) && body.trim()) {
            headers["Content-Type"] = "application/json";
            bodyToSend = body;
        }
        // Attach whatever auth the API expects.
        if (api.auth_type === "api_key" && apiKey) {
            headers[(api.auth_config?.header as string) || "X-API-Key"] = apiKey;
        } else if (api.auth_type === "basic" && (username || password)) {
            headers["Authorization"] = "Basic " + btoa(`${username}:${password}`);
        } else if ((api.auth_type === "oidc" || api.auth_type === "flomation") && token) {
            headers["Authorization"] = "Bearer " + token;
        }

        const rel = path.startsWith("/") ? path : "/" + path;
        const target = `${launchBase}/gateway/${api.api_id}${rel}`;
        const t0 = performance.now();
        try {
            const res = await fetch(target, {method, headers, body: bodyToSend});
            const text = await res.text();
            setResp({
                loading: false,
                status: res.status,
                statusText: res.statusText,
                ok: res.ok,
                timeMs: Math.round(performance.now() - t0),
                contentType: res.headers.get("content-type") ?? "",
                body: text,
            });
        } catch (e: any) {
            setResp({
                loading: false,
                timeMs: Math.round(performance.now() - t0),
                error: (e?.message || "Request failed") + " — the gateway may be unreachable or blocked by CORS.",
            });
        }
    }

    return (
        <div className="gwt">
            <div className="gwt-title"><Icon name="play" /> Live tester</div>

            {apis.length > 1 && (
                <label className="gwt-field">
                    <span>API</span>
                    <select value={api?.id ?? ""} onChange={e => setApiPk(e.target.value)}>
                        {apis.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                </label>
            )}

            <label className="gwt-field">
                <span>Endpoint</span>
                {endpoints.length ? (
                    <select value={ep?.id ?? ""} onChange={e => setEpId(e.target.value)}>
                        {endpoints.map(e => (
                            <option key={e.id} value={e.id}>{e.method} {e.path_pattern}</option>
                        ))}
                    </select>
                ) : (
                    <div className="gwt-empty">This API has no endpoints yet.</div>
                )}
            </label>

            {endpoints.length > 0 && (
                <>
                    <label className="gwt-field">
                        <span>Path</span>
                        <div className="gwt-path">
                            <span className={`gwt-method gwt-method--${method.toLowerCase()}`}>{method}</span>
                            <input value={path} onChange={e => setPath(e.target.value)} placeholder="/users/123" spellCheck={false} />
                        </div>
                    </label>

                    {api?.auth_type === "api_key" && (
                        <label className="gwt-field">
                            <span>{(api.auth_config?.header as string) || "X-API-Key"}</span>
                            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="API key" />
                        </label>
                    )}
                    {api?.auth_type === "basic" && (
                        <div className="gwt-row">
                            <label className="gwt-field"><span>Username</span>
                                <input value={username} onChange={e => setUsername(e.target.value)} /></label>
                            <label className="gwt-field"><span>Password</span>
                                <input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>
                        </div>
                    )}
                    {(api?.auth_type === "oidc" || api?.auth_type === "flomation") && (
                        <label className="gwt-field">
                            <span>Bearer token</span>
                            <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="JWT" />
                        </label>
                    )}

                    {BODY_METHODS.has(method) && (
                        <label className="gwt-field">
                            <span>Body (JSON)</span>
                            <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder={`{\n  "name": "Ada"\n}`} spellCheck={false} />
                        </label>
                    )}

                    <button className="gwt-send" onClick={send} disabled={resp?.loading}>
                        {resp?.loading ? <><Icon name="spinner" spin /> Sending…</> : <><Icon name="play" /> Send request</>}
                    </button>
                </>
            )}

            {resp && !resp.loading && (
                <div className="gwt-result">
                    <div className="gwt-result-head">
                        {resp.error ? (
                            <span className={`gwt-status ${statusClass(undefined, resp.error)}`}>Error</span>
                        ) : (
                            <span className={`gwt-status ${statusClass(resp.status)}`}>{resp.status} {resp.statusText}</span>
                        )}
                        {typeof resp.timeMs === "number" && <span className="gwt-time">{resp.timeMs} ms</span>}
                    </div>
                    {resp.error ? (
                        <div className="gwt-error">{resp.error}</div>
                    ) : (
                        <pre className="gwt-body">{prettyBody(resp.body ?? "", resp.contentType ?? "")}</pre>
                    )}
                </div>
            )}
        </div>
    );
}
