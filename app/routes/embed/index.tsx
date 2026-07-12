import type {Route} from "../+types/home";
import Container from "~/components/container";
import {useEffect, useState} from "react";
import useConfig from "~/components/config";
import api from "~/lib/api";
import useCookieToken from "~/components/cookie";
import type {EmbedApp} from "~/types";
import {PERMISSIONS} from "~/types";
import Modal from "~/components/modal";
import {toast} from "react-toastify";
import {Icon} from "~/components/icons/Icon";
import ProtectedRoute from "~/components/protected-route";
import "./index.css";

export function meta({}: Route.MetaArgs) {
    return [
        {title: "Flomation - Embed SDK"},
        {name: "description", content: "Publishable keys for embedding forms, flows and agents"},
    ];
}

// A pickable embeddable resource — a Flow or an Agent — with its display name.
type ResourceOption = {type: "flow" | "agent"; id: string; name: string};

// isLoopbackHost reports whether a hostname is a local-development loopback,
// where insecure http:// is acceptable.
function isLoopbackHost(hostname: string): boolean {
    const h = hostname.toLowerCase();
    return h === "localhost" || h.endsWith(".localhost") ||
        h === "127.0.0.1" || h.startsWith("127.") ||
        h === "::1" || h === "[::1]";
}

// normaliseOrigin returns the canonical origin (scheme://host[:port], no trailing
// path) for a candidate string, or null if it isn't a valid embeddable origin.
// This is exactly the shape a browser sends in the Origin header, so the
// allowlist stores and matches it verbatim. Rules: http(s) only; a path / query /
// fragment is rejected (an origin is host-level); and insecure http:// is allowed
// ONLY for localhost loopback — a real site must serve the embed over https.
function normaliseOrigin(value: string): string | null {
    const v = value.trim();
    if (!v) return null;
    let u: URL;
    try {
        u = new URL(v);
    } catch {
        return null;
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if ((u.pathname && u.pathname !== "/") || u.search || u.hash) return null;
    // A host must have at least one label; reject bare schemes.
    if (!u.hostname) return null;
    // Insecure http:// is dev-only (localhost); everything else must be https://.
    if (u.protocol === "http:" && !isLoopbackHost(u.hostname)) return null;
    return u.origin;
}

function isValidOrigin(value: string): boolean {
    return normaliseOrigin(value) !== null;
}

export default function EmbedApps() {
    const token = useCookieToken();
    const [isLoading, setIsLoading] = useState(true);
    const [apps, setApps] = useState<EmbedApp[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState("");
    const [newOrigins, setNewOrigins] = useState<string[]>([]);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const base = () => useConfig()("AUTOMATE_API_URL") + "/api/v1/embed/app";
    const auth = {headers: {Authorization: "Bearer " + token}};

    const [resourceOptions, setResourceOptions] = useState<ResourceOption[]>([]);

    const load = () => {
        api.get(base(), auth)
            .then(r => setApps(Array.isArray(r?.data) ? r.data : []))
            .catch(() => setApps([]))
            .finally(() => setIsLoading(false));
    };

    // Flows and agents the user can opt in — fetched once and searched in the
    // resource picker. Flows come back under { flos: [...] }; agents as an array.
    const loadResourceOptions = () => {
        const apiURL = useConfig()("AUTOMATE_API_URL");
        Promise.all([
            api.get(apiURL + "/api/v1/flo?limit=200", auth).then(r => r?.data?.flos ?? r?.data ?? []).catch(() => []),
            api.get(apiURL + "/api/v1/agent", auth).then(r => (Array.isArray(r?.data) ? r.data : [])).catch(() => []),
        ]).then(([flos, agents]) => {
            const opts: ResourceOption[] = [
                ...flos.map((f: any) => ({type: "flow" as const, id: f.id, name: f.name || "Untitled flow"})),
                ...agents.map((a: any) => ({type: "agent" as const, id: a.id, name: a.name || "Untitled agent"})),
            ];
            setResourceOptions(opts);
        });
    };

    useEffect(() => { load(); loadResourceOptions(); }, []);

    const create = () => {
        if (newName.trim().length < 3) return;
        api.post(base(), {name: newName.trim(), allowed_origins: newOrigins}, auth)
            .then(() => {
                setNewName(""); setNewOrigins([]); setShowCreate(false);
                toast.success("Embed key created");
                load();
            })
            .catch(() => toast.error("Failed to create embed key"));
    };

    const remove = (id: string) => {
        api.delete(base() + "/" + id, auth)
            .then(() => { toast.success("Embed key deleted"); load(); })
            .catch(() => toast.error("Failed to delete embed key"));
    };

    const copyKey = (key: string) => {
        navigator.clipboard?.writeText(key).then(
            () => toast.success("Publishable key copied"),
            () => toast.error("Could not copy"),
        );
    };

    return (
        <Container>
            <ProtectedRoute permission={PERMISSIONS.EMBED_VIEW}>
                <div className="header">Embed SDK</div>
                <p className="embed-intro">
                    Publishable keys let you render Flomation forms, flows and agents natively in your own
                    site with the SDK — no iframe. A key is safe in client-side code: access is gated by the
                    allowed origins and the resources you opt in below, and every submission is re-validated
                    server-side.
                </p>

                {isLoading && (
                    <div className="loading-container"><Icon name="spinner" spin /></div>
                )}

                {!isLoading && (
                    <div className="embed-page">
                        {!showCreate && (
                            <button className="embed-create-btn" onClick={() => setShowCreate(true)}>
                                <Icon name="plus" /> Create Embed Key
                            </button>
                        )}

                        {showCreate && (
                            <div className="embed-create-form">
                                <input
                                    type="text" autoFocus placeholder="Key name (e.g. Marketing site)"
                                    value={newName} onChange={e => setNewName(e.target.value)}
                                />
                                <label className="embed-field-label">Allowed origins</label>
                                <OriginInput value={newOrigins} onChange={setNewOrigins} />
                                <div className="embed-create-actions">
                                    <button className="embed-btn-save" onClick={create} disabled={newName.trim().length < 3}>
                                        <Icon name="plus" /> Create
                                    </button>
                                    <button className="embed-btn-cancel" onClick={() => { setShowCreate(false); setNewName(""); setNewOrigins([]); }}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        {apps.length === 0 && <div className="embed-empty">No embed keys yet</div>}

                        <div className="embed-list">
                            {apps.map(app => (
                                <EmbedCard
                                    key={app.id}
                                    app={app}
                                    expanded={expanded === app.id}
                                    onToggle={() => setExpanded(expanded === app.id ? null : app.id)}
                                    onCopy={() => copyKey(app.publishable_key)}
                                    onDelete={() => setConfirmDeleteId(app.id)}
                                    onChanged={load}
                                    base={base}
                                    auth={auth}
                                    resourceOptions={resourceOptions}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {confirmDeleteId && (
                    <Modal
                        label="Delete Embed Key" footerMessage="This action cannot be undone"
                        visible={true} canDismiss={true} onDismiss={() => setConfirmDeleteId(null)}
                        actions={[{
                            label: "Delete", primary: false, variant: "danger",
                            onClick: () => { remove(confirmDeleteId); setConfirmDeleteId(null); },
                        }]}
                    >
                        Deleting this key immediately stops any site using it from loading your embedded forms.
                    </Modal>
                )}
            </ProtectedRoute>
        </Container>
    );
}

// OriginInput edits a list of allowed origins: a single validated textbox with a
// "+" to add (Enter also adds), and a removable chip per existing origin. Only a
// well-formed http(s) origin can be added, and it is normalised before storage so
// it matches the browser's Origin header exactly.
function OriginInput(props: {value: string[]; onChange: (v: string[]) => void}) {
    const [text, setText] = useState("");
    const norm = normaliseOrigin(text);
    const canAdd = norm !== null && !props.value.includes(norm);

    const add = () => {
        if (!canAdd) return;
        props.onChange([...props.value, norm!]);
        setText("");
    };

    return (
        <div className="embed-origin-input">
            <div className="embed-add-row">
                <input
                    placeholder="https://example.com"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
                    className={text && norm === null ? "embed-input-invalid" : ""}
                />
                <button type="button" className="embed-origin-add" onClick={add} disabled={!canAdd} title="Add origin">
                    <Icon name="plus" /> Add
                </button>
            </div>
            {text.trim().length > 0 && norm === null && (
                <div className="embed-origin-error">
                    Enter a valid origin — e.g. https://example.com (scheme + host, no path). Insecure
                    http:// is allowed for localhost only.
                </div>
            )}
            {props.value.length > 0 && (
                <div className="embed-chip-row">
                    {props.value.map(o => (
                        <span key={o} className="embed-chip">
                            {o}
                            <button type="button" onClick={() => props.onChange(props.value.filter(x => x !== o))} title="Remove origin">
                                <Icon name="trash" />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

function EmbedCard(props: {
    app: EmbedApp;
    expanded: boolean;
    onToggle: () => void;
    onCopy: () => void;
    onDelete: () => void;
    onChanged: () => void;
    base: () => string;
    auth: {headers: {Authorization: string}};
    resourceOptions: ResourceOption[];
}) {
    const {app, base, auth, onChanged, resourceOptions} = props;
    const [origin, setOrigin] = useState("");
    const [resSearch, setResSearch] = useState("");
    const [resFocus, setResFocus] = useState(false);

    const appURL = base() + "/" + app.id;

    // Names for the opted-in resources (id -> name), so chips read nicely.
    const nameFor = (id: string) => resourceOptions.find(o => o.id === id)?.name;
    const optedIn = new Set((app.resources ?? []).map(r => r.resource_id));
    const matches = resourceOptions
        .filter(o => !optedIn.has(o.id))
        .filter(o => o.name.toLowerCase().includes(resSearch.trim().toLowerCase()))
        .slice(0, 8);

    const addOrigin = () => {
        const norm = normaliseOrigin(origin);
        if (!norm) { toast.error("Enter a valid origin, e.g. https://example.com"); return; }
        api.post(appURL + "/origin", {origin: norm}, auth)
            .then(() => { setOrigin(""); toast.success("Origin added"); onChanged(); })
            .catch(() => toast.error("Failed to add origin"));
    };
    const removeOrigin = (o: string) => {
        api.delete(appURL + "/origin", {...auth, data: {origin: o}})
            .then(() => { toast.success("Origin removed"); onChanged(); })
            .catch(() => toast.error("Failed to remove origin"));
    };
    const setResource = (rt: string, rid: string, enabled: boolean) => {
        if (!rid.trim()) return;
        api.post(appURL + "/resource", {resource_type: rt, resource_id: rid.trim(), enabled}, auth)
            .then(() => {
                if (enabled) { setResSearch(""); setResFocus(false); }
                toast.success(enabled ? "Resource added" : "Resource removed");
                onChanged();
            })
            .catch(() => toast.error("Failed to update resource"));
    };

    const masked = app.publishable_key.slice(0, 7) + "…" + app.publishable_key.slice(-4);

    return (
        <div className="embed-card">
            <div className="embed-card-head" onClick={props.onToggle}>
                <div className="embed-card-icon"><Icon name="code" /></div>
                <div className="embed-card-info">
                    <div className="embed-card-name">{app.name}</div>
                    <div className="embed-card-meta">
                        <span>{(app.allowed_origins?.length ?? 0)} origins</span>
                        <span>{(app.resources?.length ?? 0)} resources</span>
                    </div>
                </div>
                <button className="embed-key-pill" onClick={e => { e.stopPropagation(); props.onCopy(); }} title="Copy publishable key">
                    <Icon name="copy" /> {masked}
                </button>
                <button className="embed-card-delete" onClick={e => { e.stopPropagation(); props.onDelete(); }}>
                    <Icon name="trash" />
                </button>
                <Icon name={props.expanded ? "chevron-up" : "chevron-down"} />
            </div>

            {props.expanded && (
                <div className="embed-card-body">
                    <section>
                        <h4>Allowed origins</h4>
                        <div className="embed-chip-row">
                            {(app.allowed_origins ?? []).map(o => (
                                <span key={o} className="embed-chip">
                                    {o}
                                    <button onClick={() => removeOrigin(o)}><Icon name="xmark" /></button>
                                </span>
                            ))}
                            {(app.allowed_origins?.length ?? 0) === 0 && <span className="embed-hint">No origins — the key can't be used from any site yet.</span>}
                        </div>
                        <div className="embed-add-row">
                            <input placeholder="https://example.com" value={origin}
                                   className={origin.trim() && !isValidOrigin(origin) ? "embed-input-invalid" : ""}
                                   onChange={e => setOrigin(e.target.value)}
                                   onKeyDown={e => e.key === "Enter" && addOrigin()} />
                            <button onClick={addOrigin} disabled={!isValidOrigin(origin)}><Icon name="plus" /> Add origin</button>
                        </div>
                        {origin.trim().length > 0 && !isValidOrigin(origin) && (
                            <div className="embed-origin-error">Enter a valid origin (https://…; http:// for localhost only).</div>
                        )}
                    </section>

                    <section>
                        <h4>Embeddable resources</h4>
                        <div className="embed-chip-row">
                            {(app.resources ?? []).map(r => (
                                <span key={r.resource_type + r.resource_id} className="embed-chip">
                                    <span className={"embed-res-badge embed-res-badge--" + r.resource_type}>{r.resource_type}</span>
                                    {nameFor(r.resource_id) ?? r.resource_id.slice(0, 8)}
                                    <button onClick={() => setResource(r.resource_type, r.resource_id, false)} title="Remove"><Icon name="trash" /></button>
                                </span>
                            ))}
                            {(app.resources?.length ?? 0) === 0 && <span className="embed-hint">Nothing embeddable yet — search for a flow or agent below.</span>}
                        </div>
                        <div className="embed-resource-search">
                            <input
                                placeholder="Search a flow or agent to embed…"
                                value={resSearch}
                                onChange={e => { setResSearch(e.target.value); setResFocus(true); }}
                                onFocus={() => setResFocus(true)}
                                onBlur={() => setTimeout(() => setResFocus(false), 150)}
                            />
                            {resFocus && matches.length > 0 && (
                                <div className="embed-autocomplete">
                                    {matches.map(o => (
                                        <button key={o.type + o.id} className="embed-autocomplete-item"
                                                onMouseDown={e => e.preventDefault()}
                                                onClick={() => setResource(o.type, o.id, true)}>
                                            <span className={"embed-res-badge embed-res-badge--" + o.type}>{o.type}</span>
                                            <span className="embed-autocomplete-name">{o.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {resFocus && resSearch.trim() && matches.length === 0 && (
                                <div className="embed-autocomplete"><div className="embed-autocomplete-empty">No matching flow or agent</div></div>
                            )}
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
