import {useEffect, useMemo, useRef, useState} from "react";
import type {ReactNode} from "react";
import {Icon} from "~/components/icons/Icon";
import type {GatewayAPI, GatewayAuthType, GatewayEndpoint} from "~/types";

// Methods that carry a request body — the body editor only shows for these.
const BODY_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Auth modes the tester can send. Independent of the API's configured type so a
// user can probe what happens with the wrong (or no) credentials. "flomation"
// reuses the editor's own login (the browser session token / cookie).
type AuthMode = "none" | "api_key" | "basic" | "bearer" | "flomation";
const AUTH_MODES: {value: AuthMode; label: string}[] = [
    {value: "none", label: "None"},
    {value: "flomation", label: "Flomation session"},
    {value: "api_key", label: "API Key (header)"},
    {value: "basic", label: "HTTP Basic"},
    {value: "bearer", label: "Bearer token"},
];

// defaultAuthMode maps the API's configured auth type to a starting test mode.
function defaultAuthMode(t: GatewayAuthType | undefined): AuthMode {
    switch (t) {
        case "api_key": return "api_key";
        case "basic": return "basic";
        case "flomation": return "flomation";
        case "oidc": return "bearer";
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

// formatBody pretty-prints (2-space indented) a JSON response and reports whether
// it was in fact JSON — non-JSON falls back to the raw text and no highlighting.
function formatBody(text: string, contentType: string): {text: string; json: boolean} {
    if (/json/i.test(contentType) || /^\s*[\[{]/.test(text.trim())) {
        try {
            return {text: JSON.stringify(JSON.parse(text), null, 2), json: true};
        } catch {
            /* not valid JSON after all — show raw */
        }
    }
    return {text, json: false};
}

// highlightJSON turns formatted JSON into coloured token spans (keys, strings,
// numbers, booleans, null). Hand-rolled so there's no syntax-highlighter dep.
function highlightJSON(code: string): ReactNode[] {
    const nodes: ReactNode[] = [];
    const re = /("(?:\\.|[^"\\])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
    let last = 0;
    let key = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
        if (m.index > last) nodes.push(code.slice(last, m.index));
        const tok = m[0];
        let cls = "tok-num";
        if (tok.startsWith('"')) cls = m[2] ? "tok-key" : "tok-str";
        else if (tok === "true" || tok === "false") cls = "tok-bool";
        else if (tok === "null") cls = "tok-null";
        nodes.push(<span key={key++} className={cls}>{tok}</span>);
        last = m.index + tok.length;
    }
    if (last < code.length) nodes.push(code.slice(last));
    return nodes;
}

/**
 * JsonBodyEditor is an editable, syntax-highlighted JSON field. Textareas can't
 * render coloured text, so a highlighted <pre> sits behind a transparent-text
 * <textarea>; the two share identical typography/padding and their scroll is
 * kept in sync. Tab inserts two spaces rather than moving focus.
 */
function JsonBodyEditor({value, onChange, placeholder}: {value: string; onChange: (v: string) => void; placeholder?: string}) {
    const taRef = useRef<HTMLTextAreaElement>(null);
    const preRef = useRef<HTMLPreElement>(null);

    const syncScroll = () => {
        if (taRef.current && preRef.current) {
            preRef.current.scrollTop = taRef.current.scrollTop;
            preRef.current.scrollLeft = taRef.current.scrollLeft;
        }
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Tab") {
            e.preventDefault();
            const ta = e.currentTarget;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            onChange(value.slice(0, start) + "  " + value.slice(end));
            requestAnimationFrame(() => {
                ta.selectionStart = ta.selectionEnd = start + 2;
            });
        }
    };

    return (
        <div className="gwt-code">
            <pre ref={preRef} className="gwt-code-hl" aria-hidden="true">
                <code>{highlightJSON(value)}{"\n"}</code>
            </pre>
            <textarea
                ref={taRef}
                className="gwt-code-input"
                value={value}
                onChange={e => onChange(e.target.value)}
                onScroll={syncScroll}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                spellCheck={false}
                rows={5}
            />
        </div>
    );
}

/**
 * EndpointSelect is a searchable autocomplete for an API's endpoints, mirroring
 * the app's FlowSelect UX. Closed, it shows the chosen endpoint as a coloured
 * method chip + path; open, it becomes a filter box over a dropdown of matches.
 */
function EndpointSelect({endpoints, value, onChange}: {endpoints: GatewayEndpoint[]; value: string; onChange: (id: string) => void}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const ref = useRef<HTMLDivElement>(null);
    const selected = endpoints.find(e => e.id === value);

    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const filtered = endpoints.filter(e =>
        `${e.method} ${e.path_pattern}`.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="gwt-ep" ref={ref}>
            <div className="gwt-ep-control" onClick={() => { setOpen(o => !o); setSearch(""); }}>
                {open ? (
                    <input
                        autoFocus
                        className="gwt-ep-input"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        placeholder="Search endpoints…"
                    />
                ) : selected ? (
                    <span className="gwt-ep-current">
                        <span className={`gwt-method gwt-method--${selected.method.toLowerCase()}`}>{selected.method}</span>
                        <code>{selected.path_pattern}</code>
                    </span>
                ) : (
                    <span className="gwt-ep-placeholder">Select an endpoint…</span>
                )}
                <Icon name="chevron-down" className="gwt-ep-caret" />
            </div>
            {open && (
                <div className="gwt-ep-dropdown">
                    {filtered.map(e => (
                        <div
                            key={e.id}
                            className={`gwt-ep-option ${e.id === value ? "selected" : ""}`}
                            onClick={() => { onChange(e.id); setOpen(false); }}
                        >
                            <span className={`gwt-method gwt-method--${e.method.toLowerCase()}`}>{e.method}</span>
                            <code>{e.path_pattern}</code>
                        </div>
                    ))}
                    {filtered.length === 0 && <div className="gwt-ep-empty">No endpoints found</div>}
                </div>
            )}
        </div>
    );
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
export default function GatewayTester({apis, launchBase, sessionToken}: {apis: GatewayAPI[]; launchBase: string; sessionToken?: string | null}) {
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
    const [copied, setCopied] = useState<boolean>(false);

    const copyResponse = () => {
        navigator.clipboard?.writeText(resp?.body ?? "").then(
            () => { setCopied(true); setTimeout(() => setCopied(false), 1500); },
            () => {},
        );
    };

    const api = useMemo(() => apis.find(a => a.id === apiPk) ?? apis[0], [apis, apiPk]);
    const endpoints = api?.endpoints ?? [];
    const ep = useMemo(() => endpoints.find(e => e.id === epId) ?? endpoints[0], [endpoints, epId]);
    const method = (ep?.method ?? "GET").toUpperCase();
    const params = useMemo(() => pathParamNames(ep?.path_pattern), [ep?.path_pattern]);
    const authIdx = Math.max(0, AUTH_MODES.findIndex(m => m.value === authMode));
    const cycleAuth = (dir: number) =>
        setAuthMode(AUTH_MODES[(authIdx + dir + AUTH_MODES.length) % AUTH_MODES.length].value);

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

    // Pretty-print the current request body if it is valid JSON (no-op otherwise).
    const formatBodyInput = () => {
        try {
            setBody(JSON.stringify(JSON.parse(body), null, 2));
        } catch {
            /* leave malformed JSON untouched */
        }
    };

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
        } else if (authMode === "flomation" && sessionToken) {
            // Reuse the editor's own login — the gateway reads it as a bearer.
            h["Authorization"] = "Bearer " + sessionToken;
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

            <div className="gwt-field">
                <span>Endpoint</span>
                {endpoints.length ? (
                    <EndpointSelect endpoints={endpoints} value={ep?.id ?? ""} onChange={setEpId} />
                ) : (
                    <div className="gwt-empty">This API has no endpoints yet.</div>
                )}
            </div>

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

                    <div className="gwt-field">
                        <span>Auth</span>
                        <div className="gwt-carousel">
                            <button type="button" className="gwt-carousel-arrow" onClick={() => cycleAuth(-1)} aria-label="Previous auth mode"><Icon name="chevron-left" /></button>
                            <span className="gwt-carousel-label">{AUTH_MODES[authIdx].label}</span>
                            <button type="button" className="gwt-carousel-arrow" onClick={() => cycleAuth(1)} aria-label="Next auth mode"><Icon name="chevron-right" /></button>
                        </div>
                    </div>
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
                    {authMode === "flomation" && (
                        <div className="gwt-note">
                            {sessionToken
                                ? "Sends your current Flomation login, so the request is authenticated as you (subject to the API's org/RBAC rules)."
                                : "You are not signed in, so no session token is available to send."}
                        </div>
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
                        <div className="gwt-field">
                            <div className="gwt-field-head">
                                <span>Body (JSON)</span>
                                <button type="button" className="gwt-mini-btn" onClick={formatBodyInput} disabled={!body.trim()} title="Pretty-print the JSON body">
                                    <Icon name="align-left" /> Format
                                </button>
                            </div>
                            <JsonBodyEditor value={body} onChange={setBody} placeholder={`{\n  "name": "Ada"\n}`} />
                        </div>
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
                        {!resp.error && resp.body != null && (
                            <button type="button" className="gwt-copy" onClick={copyResponse} title="Copy response body">
                                <Icon name={copied ? "circle-check" : "copy"} /> {copied ? "Copied" : "Copy"}
                            </button>
                        )}
                    </div>
                    {resp.error ? (
                        <div className="gwt-error">{resp.error}</div>
                    ) : (() => {
                        const {text, json} = formatBody(resp.body ?? "", resp.contentType ?? "");
                        return <pre className="gwt-body">{json ? highlightJSON(text) : text}</pre>;
                    })()}
                </div>
            )}
        </div>
    );
}
