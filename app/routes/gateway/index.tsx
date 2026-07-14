import Container from "~/components/container";
import {useEffect, useState} from "react";
import {Link} from "react-router";
import useConfig from "~/components/config";
import api from "~/lib/api";
import FlowSelect from "~/components/flowSelect";
import useCookieToken from "~/components/cookie";
import type {GatewayAPI, GatewayEndpoint, GatewayAuthType} from "~/types";
import {PERMISSIONS} from "~/types";
import Modal from "~/components/modal";
import {useToast} from "~/components/toast";
import {Icon} from "~/components/icons/Icon";
import ProtectedRoute from "~/components/protected-route";
import type {HelpContent} from "~/components/helpPane";
import "./index.css";

// Plain-English description of this page for the right-hand help pane. Aimed at
// a first-time reader, keeping jargon to the minimum the concept needs.
const GATEWAY_HELP: HelpContent = {
    title: "About the Gateway",
    intro: "The Gateway turns your flows into a web address that other apps and websites can call. You build an API, add a few endpoints, and each one runs a flow and hands back its result.",
    points: [
        "Create an API and give it a friendly name",
        "Add endpoints, choosing how each is called and which flow it runs",
        "Share the short web address so other systems can use it",
        "Decide who's allowed in: anyone, a secret key, or a signed-in Flomation account",
    ],
    tip: (
        <>
            Each endpoint runs a flow that starts with a Web Trigger.{" "}
            <Link to="/flow" className="help-pane-link">Build that flow first</Link>, then point an endpoint at it.
        </>
    ),
};

export function meta() {
    return [
        {title: "Flomation - Gateway"},
        {name: "description", content: "Build HTTP APIs backed by your flows"},
    ];
}

type ToastKind = "success" | "error" | "info" | "warning";

type FlowOption = {id: string; name: string};

const AUTH_TYPES: {value: GatewayAuthType; label: string}[] = [
    {value: "open", label: "Open (no auth)"},
    {value: "api_key", label: "API Key (header)"},
    {value: "basic", label: "HTTP Basic"},
    {value: "oidc", label: "OIDC / JWT"},
    {value: "flomation", label: "Flomation session (org RBAC)"},
];

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

// AuthDraft is the editable auth policy for the create/edit forms.
type AuthDraft = {type: GatewayAuthType; config: Record<string, any>; secret: string};

const emptyAuth: AuthDraft = {type: "open", config: {}, secret: ""};

// AuthPolicyForm renders the auth type selector + the fields for the chosen type.
function AuthPolicyForm({value, onChange, secretPlaceholder}: {value: AuthDraft; onChange: (a: AuthDraft) => void; secretPlaceholder: string}) {
    const setConfig = (k: string, v: string) => onChange({...value, config: {...value.config, [k]: v}});
    return (
        <div className="gw-auth-form">
            <label className="gw-field">
                <span>Authentication</span>
                <select value={value.type} onChange={e => onChange({type: e.target.value as GatewayAuthType, config: {}, secret: ""})}>
                    {AUTH_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
            </label>
            {value.type === "api_key" && (
                <>
                    <label className="gw-field"><span>Header name</span>
                        <input value={value.config.header ?? ""} placeholder="X-API-Key" onChange={e => setConfig("header", e.target.value)} /></label>
                    <label className="gw-field"><span>Key (secret)</span>
                        <input type="password" value={value.secret} placeholder={secretPlaceholder} onChange={e => onChange({...value, secret: e.target.value})} /></label>
                </>
            )}
            {value.type === "basic" && (
                <>
                    <label className="gw-field"><span>Username</span>
                        <input value={value.config.username ?? ""} onChange={e => setConfig("username", e.target.value)} /></label>
                    <label className="gw-field"><span>Password (secret)</span>
                        <input type="password" value={value.secret} placeholder={secretPlaceholder} onChange={e => onChange({...value, secret: e.target.value})} /></label>
                    <label className="gw-field"><span>Realm (optional)</span>
                        <input value={value.config.realm ?? ""} onChange={e => setConfig("realm", e.target.value)} /></label>
                </>
            )}
            {value.type === "oidc" && (
                <>
                    <label className="gw-field"><span>Issuer</span>
                        <input value={value.config.issuer ?? ""} placeholder="https://id.example.com" onChange={e => setConfig("issuer", e.target.value)} /></label>
                    <label className="gw-field"><span>JWKS URI</span>
                        <input value={value.config.jwks_uri ?? ""} placeholder="https://id.example.com/.well-known/jwks.json" onChange={e => setConfig("jwks_uri", e.target.value)} /></label>
                    <label className="gw-field"><span>Audience (optional)</span>
                        <input value={value.config.audience ?? ""} onChange={e => setConfig("audience", e.target.value)} /></label>
                </>
            )}
            {value.type === "flomation" && (
                <label className="gw-field"><span>Required permission (optional)</span>
                    <input value={value.config.required_permission ?? ""} placeholder="flow.execute" onChange={e => setConfig("required_permission", e.target.value)} /></label>
            )}
        </div>
    );
}

// buildAuthPayload maps the draft to the API's {type, config, secret} shape,
// omitting an empty secret (so an edit keeps the existing one).
function buildAuthPayload(a: AuthDraft) {
    const payload: any = {type: a.type, config: a.config};
    if (a.secret) payload.secret = a.secret;
    return payload;
}

export default function GatewayAPIs() {
    const token = useCookieToken();
    const {showToast} = useToast();
    const config = useConfig();
    const [isLoading, setIsLoading] = useState(true);
    const [apis, setApis] = useState<GatewayAPI[]>([]);
    const [flows, setFlows] = useState<FlowOption[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState("");
    const [newAuth, setNewAuth] = useState<AuthDraft>(emptyAuth);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const base = config("AUTOMATE_API_URL") + "/api/v1/gateway";
    const launchBase = config("TRIGGER_URL") || config("LAUNCH_URL") || "";
    const auth = {headers: {Authorization: "Bearer " + token}};

    const load = () => {
        api.get(base, auth)
            .then(r => setApis(Array.isArray(r?.data) ? r.data : []))
            .catch(() => setApis([]))
            .finally(() => setIsLoading(false));
    };
    const loadFlows = () => {
        api.get(config("AUTOMATE_API_URL") + "/api/v1/flo?limit=200", auth)
            .then(r => {
                const list = r?.data?.flos ?? r?.data ?? [];
                setFlows(list.map((f: any) => ({id: f.id, name: f.name || "Untitled flow"})));
            })
            .catch(() => setFlows([]));
    };
    useEffect(() => { load(); loadFlows(); /* eslint-disable-next-line */ }, []);

    const create = () => {
        if (newName.trim().length < 3) return;
        api.post(base, {name: newName.trim(), auth: buildAuthPayload(newAuth)}, auth)
            .then(r => {
                setNewName(""); setNewAuth(emptyAuth); setShowCreate(false);
                showToast("Gateway API created", "success");
                load();
                if (r?.data?.id) setExpanded(r.data.id);
            })
            .catch(e => showToast(e?.response?.data?.error || "Failed to create Gateway API", "error"));
    };
    const remove = (id: string) => {
        api.delete(base + "/" + id, auth)
            .then(() => { showToast("Gateway API deleted", "success"); load(); })
            .catch(() => showToast("Failed to delete Gateway API", "error"));
    };
    const copy = (text: string) => {
        navigator.clipboard?.writeText(text).then(
            () => showToast("Copied", "success"),
            () => showToast("Could not copy", "error"),
        );
    };

    return (
        <Container help={GATEWAY_HELP}>
            <ProtectedRoute permission={PERMISSIONS.GATEWAY_VIEW}>
                <h1 className="gw-title">Gateway</h1>

                {!showCreate && (
                    <button className="gw-create-btn" onClick={() => setShowCreate(true)}>
                        <Icon name="plus" /> New API
                    </button>
                )}
                {showCreate && (
                    <div className="gw-create-form">
                        <label className="gw-field"><span>Name</span>
                            <input autoFocus value={newName} placeholder="e.g. Customers API" onChange={e => setNewName(e.target.value)} /></label>
                        <AuthPolicyForm value={newAuth} onChange={setNewAuth} secretPlaceholder="shown once, store it safely" />
                        <div className="gw-form-actions">
                            <button className="gw-btn gw-btn--primary" disabled={newName.trim().length < 3} onClick={create}>Create</button>
                            <button className="gw-btn" onClick={() => { setShowCreate(false); setNewName(""); setNewAuth(emptyAuth); }}>Cancel</button>
                        </div>
                    </div>
                )}

                {isLoading ? (
                    <div className="gw-loading"><Icon name="spinner" spin /> Loading…</div>
                ) : apis.length === 0 ? (
                    <div className="gw-empty">No Gateway APIs yet. Create one to expose a flow over HTTP.</div>
                ) : (
                    <div className="gw-list">
                        {apis.map(a => (
                            <GatewayCard
                                key={a.id}
                                gw={a}
                                flows={flows}
                                expanded={expanded === a.id}
                                onToggle={() => setExpanded(expanded === a.id ? null : a.id)}
                                onDelete={() => setConfirmDeleteId(a.id)}
                                onChanged={load}
                                base={base}
                                auth={auth}
                                launchBase={launchBase}
                                onCopy={copy}
                                showToast={showToast}
                            />
                        ))}
                    </div>
                )}

                {confirmDeleteId && (
                    <Modal
                        label="Delete Gateway API" footerMessage="This action cannot be undone"
                        visible={true} canDismiss={true} onDismiss={() => setConfirmDeleteId(null)}
                        actions={[{
                            label: "Delete", primary: false, variant: "danger",
                            onClick: () => { remove(confirmDeleteId); setConfirmDeleteId(null); },
                        }]}
                    >
                        Its endpoints stop responding immediately.
                    </Modal>
                )}
            </ProtectedRoute>
        </Container>
    );
}

function GatewayCard(props: {
    gw: GatewayAPI; flows: FlowOption[]; expanded: boolean; onToggle: () => void; onDelete: () => void;
    onChanged: () => void; base: string; auth: any; launchBase: string; onCopy: (t: string) => void;
    showToast: (m: string, k?: ToastKind) => void;
}) {
    const {gw, flows, expanded, onToggle, onDelete, onChanged, base, auth, launchBase, onCopy, showToast} = props;
    const url = `${launchBase}/gateway/${gw.api_id}`;
    const apiURL = base + "/" + gw.id;

    const [method, setMethod] = useState("GET");
    const [pathPattern, setPathPattern] = useState("");
    const [flowId, setFlowId] = useState("");
    const [editAuth, setEditAuth] = useState(false);
    const [authDraft, setAuthDraft] = useState<AuthDraft>({type: gw.auth_type, config: gw.auth_config ?? {}, secret: ""});

    const addEndpoint = () => {
        if (!pathPattern.startsWith("/") || !flowId) {
            showToast("Enter a path (starting with /) and pick a flow", "error");
            return;
        }
        api.post(apiURL + "/endpoint", {method, path_pattern: pathPattern.trim(), flow_id: flowId}, auth)
            .then(() => { setPathPattern(""); setFlowId(""); showToast("Endpoint added", "success"); onChanged(); })
            .catch(e => showToast(e?.response?.data?.error || "Failed to add endpoint", "error"));
    };
    const removeEndpoint = (eid: string) => {
        api.delete(apiURL + "/endpoint/" + eid, auth)
            .then(() => { showToast("Endpoint removed", "success"); onChanged(); })
            .catch(() => showToast("Failed to remove endpoint", "error"));
    };
    const saveAuth = () => {
        api.patch(apiURL, {name: gw.name, auth: buildAuthPayload(authDraft)}, auth)
            .then(() => { setEditAuth(false); showToast("Authentication updated", "success"); onChanged(); })
            .catch(e => showToast(e?.response?.data?.error || "Failed to update auth", "error"));
    };

    const flowName = (id: string) => flows.find(f => f.id === id)?.name ?? id;
    const authLabel = AUTH_TYPES.find(t => t.value === gw.auth_type)?.label ?? gw.auth_type;

    return (
        <div className="gw-card">
            <div className="gw-card-head" onClick={onToggle}>
                <Icon name="server" />
                <div className="gw-card-title">
                    <span className="gw-card-name">{gw.name}</span>
                    <span className="gw-card-meta">{(gw.endpoints?.length ?? 0)} endpoint{(gw.endpoints?.length ?? 0) === 1 ? "" : "s"} · {authLabel}</span>
                </div>
                <button className="gw-url-pill" onClick={e => { e.stopPropagation(); onCopy(url); }} title="Copy base URL">
                    <code>/gateway/{gw.api_id}</code><Icon name="copy" />
                </button>
                <Icon name={expanded ? "chevron-up" : "chevron-down"} />
            </div>

            {expanded && (
                <div className="gw-card-body">
                    <div className="gw-base-url">
                        <span className="gw-section-label">Base URL</span>
                        <div className="gw-url-box"><code>{url}</code><button className="gw-icon-btn" onClick={() => onCopy(url)}><Icon name="copy" /></button></div>
                    </div>

                    <div className="gw-section">
                        <span className="gw-section-label">Endpoints</span>
                        {(gw.endpoints ?? []).length === 0 && <div className="gw-endpoint-empty">No endpoints yet.</div>}
                        {(gw.endpoints ?? []).map(ep => (
                            <div key={ep.id} className="gw-endpoint-row">
                                <span className={`gw-method gw-method--${ep.method.toLowerCase()}`}>{ep.method}</span>
                                <code className="gw-endpoint-path">{ep.path_pattern}</code>
                                <span className="gw-endpoint-flow">→ {flowName(ep.flow_id)}</span>
                                <button className="gw-icon-btn gw-icon-btn--danger" onClick={() => removeEndpoint(ep.id)} title="Remove"><Icon name="xmark" /></button>
                            </div>
                        ))}
                        <div className="gw-add-endpoint">
                            <select value={method} onChange={e => setMethod(e.target.value)}>
                                {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <input value={pathPattern} placeholder="/users/:id" onChange={e => setPathPattern(e.target.value)} />
                            <FlowSelect value={flowId} onChange={setFlowId} placeholder="Search flows…" className="gw-flow-select" />
                            <button className="gw-btn gw-btn--primary" onClick={addEndpoint}>Add</button>
                        </div>
                    </div>

                    <div className="gw-section">
                        <span className="gw-section-label">Authentication</span>
                        {!editAuth ? (
                            <div className="gw-auth-summary">
                                <span>{authLabel}</span>
                                <button className="gw-btn" onClick={() => { setAuthDraft({type: gw.auth_type, config: gw.auth_config ?? {}, secret: ""}); setEditAuth(true); }}>Edit</button>
                            </div>
                        ) : (
                            <>
                                <AuthPolicyForm value={authDraft} onChange={setAuthDraft} secretPlaceholder="leave blank to keep the current secret" />
                                <div className="gw-form-actions">
                                    <button className="gw-btn gw-btn--primary" onClick={saveAuth}>Save</button>
                                    <button className="gw-btn" onClick={() => setEditAuth(false)}>Cancel</button>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="gw-card-footer">
                        <button className="gw-delete-btn" onClick={onDelete} title="Delete this API">
                            <Icon name="trash" /> Delete API
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
