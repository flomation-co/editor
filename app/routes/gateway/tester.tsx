import {useEffect, useMemo, useState} from "react";
import {Icon} from "~/components/icons/Icon";
import type {GatewayAPI, GatewayAuthType} from "~/types";

// Methods that carry a request body — the body editor only shows for these.
const BODY_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Auth modes the tester can send. Independent of the API's configured type so a
// user can probe what happens with the wrong (or no) credentials.
type AuthMode = "none" | "api_key" | "basic" | "bearer";
const AUTH_MODES: {value: AuthMode; label: string}[] = [
    {value: "none", label: "None"},
    {value: "api_key", label: "API Key (header)"},
    {value: "basic", label: "HTTP Basic"},
    {value: "bearer", label: "Bearer token"},
];

// defaultAuthMode maps the API's configured auth type to a starting test mode.
function defaultAuthMode(t: GatewayAuthType | undefined): AuthMode {
    switch (t) {
        case "api_key": return "api_key";
        case "basic": return "basic";
        case "oidc":
        case "flomation": return "bearer";
        default: return "none";
    }
}

type HeaderRow = {key: string; value: string};

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

// pathParamNames extracts the :param segments from a path pattern (deduped).
function pathParamNames(pattern: string | undefined): string[] {
    if (!pattern) return [];
    const found = pattern.match(/:([A-Za-z0-9_]+)/g) ?? [];
    return Array.from(new Set(found.map(s => s.slice(1))));
}

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
    const [paramValues, setParamValues] = useState<Record<string, string>>({});
    const [body, setBody] = useState<string>("");
    // Auth (overridable, defaults to the API's configured type).
    const [authMode, setAuthMode] = useState<AuthMode>("none");
    const [apiKeyHeader, setApiKeyHeader] = useState<string>("X-API-Key");
    const [apiKey, setApiKey] = useState<string>("");
    const [username, setUsername] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [token, setToken] = useState<string>("");
    // Custom headers (collapsible).
    const [headers, setHeaders] = useState<HeaderRow[]>([]);
    const [showHeaders, setShowHeaders] = useState<boolean>(false);
    const [resp, setResp] = useState<Resp | null>(null);

    const api = useMemo(() => apis.find(a => a.id === apiPk) ?? apis[0], [apis, apiPk]);
    const endpoints = api?.endpoints ?? [];
    const ep = useMemo(() => endpoints.find(e => e.id === epId) ?? endpoints[0], [endpoints, epId]);
    const method = (ep?.method ?? "GET").toUpperCase();
    const params = useMemo(() => pathParamNames(ep?.path_pattern), [ep?.path_pattern]);

    // The concrete path with :params substituted (unfilled params left visible).
    const resolvedPath = useMemo(() => {
        const pattern = ep?.path_pattern ?? "/";
        return pattern.replace(/:([A-Za-z0-9_]+)/g, (_, n) => {
            const v = paramValues[n];
            return v ? encodeURIComponent(v) : `:${n}`;
        });
    }, [ep?.path_pattern, paramValues]);

    // Keep the selected API valid as the list loads / changes.
    useEffect(() => {
        if (apis.length && !apis.some(a => a.id === apiPk)) {
            setApiPk(apis[0].id);
        }
    }, [apis, apiPk]);

    // When the API changes, default the auth mode + api-key header to its config.
    useEffect(() => {
        setAuthMode(defaultAuthMode(api?.auth_type));
        setApiKeyHeader((api?.auth_config?.header as string) || "X-API-Key");
        setEpId(endpoints[0]?.id ?? "");
        setResp(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiPk]);

    // When the endpoint changes, reset its path params and clear the result.
    useEffect(() => {
        setParamValues({});
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

    const setParam = (name: string, value: string) => setParamValues(p => ({...p, [name]: value}));
    const setHeader = (i: number, patch: Partial<HeaderRow>) =>
        setHeaders(hs => hs.map((h, idx) => (idx === i ? {...h, ...patch} : h)));
    const addHeader = () => setHeaders(hs => [...hs, {key: "", value: ""}]);
    const removeHeader = (i: number) => setHeaders(hs => hs.filter((_, idx) => idx !== i));

    async function send() {
        if (!api || !ep) return;
        setResp({loading: true});

        const h: Record<string, string> = {};
        // Auth first, so an explicit custom header below can still override it.
        if (authMode === "api_key" && apiKey) {
            h[apiKeyHeader || "X-API-Key"] = apiKey;
        } else if (authMode === "basic" && (username || password)) {
            h["Authorization"] = "Basic " + btoa(`${username}:${password}`);
        } else if (authMode === "bearer" && token) {
            h["Authorization"] = "Bearer " + token;
        }

        let bodyToSend: string | undefined;
        if (BODY_METHODS.has(method) && body.trim()) {
            h["Content-Type"] = "application/json";
            bodyToSend = body;
        }
        // Custom headers last — they win over the defaults above.
        headers.forEach(row => {
            if (row.key.trim()) h[row.key.trim()] = row.value;
        });

        const rel = resolvedPath.startsWith("/") ? resolvedPath : "/" + resolvedPath;
        const target = `${launchBase}/gateway/${api.api_id}${rel}`;
        const t0 = performance.now();
        try {
            const res = await fetch(target, {method, headers: h, body: bodyToSend});
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
                    {params.length > 0 && (
                        <div className="gwt-field">
                            <span>Path parameters</span>
                            <div className="gwt-params">
                                {params.map(name => (
                                    <div key={name} className="gwt-param">
                                        <label className="gwt-param-key">:{name}</label>
                                        <input
                                            value={paramValues[name] ?? ""}
                                            onChange={e => setParam(name, e.target.value)}
                                            placeholder={`value for ${name}`}
                                            spellCheck={false}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="gwt-field">
                        <span>Request path</span>
                        <div className="gwt-path">
                            <span className={`gwt-method gwt-method--${method.toLowerCase()}`}>{method}</span>
                            <code className="gwt-resolved">{resolvedPath}</code>
                        </div>
                    </div>

                    <label className="gwt-field">
                        <span>Auth</span>
                        <select value={authMode} onChange={e => setAuthMode(e.target.value as AuthMode)}>
                            {AUTH_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                    </label>
                    {authMode === "api_key" && (
                        <div className="gwt-row">
                            <label className="gwt-field"><span>Header</span>
                                <input value={apiKeyHeader} onChange={e => setApiKeyHeader(e.target.value)} placeholder="X-API-Key" /></label>
                            <label className="gwt-field"><span>Key</span>
                                <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="secret" /></label>
                        </div>
                    )}
                    {authMode === "basic" && (
                        <div className="gwt-row">
                            <label className="gwt-field"><span>Username</span>
                                <input value={username} onChange={e => setUsername(e.target.value)} /></label>
                            <label className="gwt-field"><span>Password</span>
                                <input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>
                        </div>
                    )}
                    {authMode === "bearer" && (
                        <label className="gwt-field">
                            <span>Bearer token</span>
                            <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="JWT" />
                        </label>
                    )}

                    <div className="gwt-collapse-section">
                        <button type="button" className="gwt-collapse" onClick={() => setShowHeaders(v => !v)}>
                            <Icon name={showHeaders ? "chevron-down" : "chevron-right"} />
                            Headers{headers.length ? ` (${headers.length})` : ""}
                        </button>
                        {showHeaders && (
                            <div className="gwt-headers">
                                {headers.map((row, i) => (
                                    <div key={i} className="gwt-header-row">
                                        <input value={row.key} onChange={e => setHeader(i, {key: e.target.value})} placeholder="Header" spellCheck={false} />
                                        <input value={row.value} onChange={e => setHeader(i, {value: e.target.value})} placeholder="Value" spellCheck={false} />
                                        <button type="button" className="gwt-icon-btn" onClick={() => removeHeader(i)} title="Remove header"><Icon name="xmark" /></button>
                                    </div>
                                ))}
                                <button type="button" className="gwt-add" onClick={addHeader}><Icon name="plus" /> Add header</button>
                            </div>
                        )}
                    </div>

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
