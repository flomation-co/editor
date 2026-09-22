import { useEffect, useState } from "react";
import api from "~/lib/api";
import Container from "~/components/container";
import type { HelpContent } from "~/components/helpPane";
import ProtectedRoute from "~/components/protected-route";
import { PERMISSIONS } from "~/types";
import { useOrganisation } from "~/context/organisation/use";
import useCookieToken from "~/components/cookie";
import useConfig from "~/components/config";
import { toast } from "~/components/toast";
import { Icon } from "~/components/icons/Icon";
import "./index.css";

const config = useConfig();
const API_URL = config("AUTOMATE_API_URL");

const SSO_HELP: HelpContent = {
    title: "About Single Sign-On",
    intro: "Let people in your organisation sign in with your own identity provider — any OpenID Connect (OIDC) provider, such as Microsoft Entra ID, Okta or Google Workspace — instead of a Flomation password.",
    points: [
        "Pick your provider (or Generic OIDC) and enter its issuer + app credentials",
        "Register the redirect URI shown here in your provider",
        "Claim your email domains and verify each with a DNS TXT record",
        "Once verified, anyone typing an address at that domain is sent to your provider to sign in",
    ],
    tip: "Organisation admins can always sign in with a password (automatic break-glass), so a misconfigured connection can never lock them out.",
};

// Provider presets. Entra is the guided default; the engine itself is generic
// OIDC, so any compliant provider works. Tenant ID is Entra-only.
// directory describes the extra credential a provider needs to power the
// searchable group picker. Entra reuses the OIDC client secret via Graph, so it
// needs nothing; Okta needs an SSWS API token; Google needs a service-account
// JSON plus an admin email to impersonate. Providers without a `directory` block
// fall back to free-text group entry.
type Preset = {
    label: string; issuerHint: string; tenant: boolean; note?: string; docs?: string; docsLabel?: string;
    directory?: { secretLabel?: string; secretPlaceholder?: string; secretMultiline?: boolean; adminLabel?: string; adminPlaceholder?: string; hint?: string };
};

const PRESETS: Record<string, Preset> = {
    entra:   { label: "Microsoft Entra ID", issuerHint: "https://login.microsoftonline.com/<tenant-id>/v2.0", tenant: true,  note: "Client secret comes from Entra → Certificates & secrets.",
               docs: "https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app", docsLabel: "Register an app in Microsoft Entra ID",
               directory: { hint: "Group search uses Microsoft Graph via the client secret above — grant the app the Group.Read.All application permission with admin consent." } },
    okta:    { label: "Okta",               issuerHint: "https://<your-org>.okta.com",                        tenant: false,
               docs: "https://developer.okta.com/docs/guides/implement-grant-type/authcode/main/", docsLabel: "Create an OIDC app in Okta",
               directory: { secretLabel: "Okta API token", secretPlaceholder: "00abCdEf…", hint: "Create a read-only API token in Okta → Security → API → Tokens to enable the group picker (optional)." } },
    google:  { label: "Google Workspace",   issuerHint: "https://accounts.google.com",                       tenant: false,
               docs: "https://developers.google.com/identity/openid-connect/openid-connect#registeringyourapp", docsLabel: "Create OAuth credentials in Google Cloud",
               directory: { secretLabel: "Service account JSON", secretPlaceholder: '{ "type": "service_account", … }', secretMultiline: true, adminLabel: "Admin email to impersonate", adminPlaceholder: "admin@your-domain.com", hint: "Paste a service-account key with domain-wide delegation for admin.directory.group.readonly to enable the group picker (optional)." } },
    generic: { label: "",                   issuerHint: "https://idp.example.com",                            tenant: false,
               docs: "https://openid.net/developers/how-connect-works/", docsLabel: "How OpenID Connect works" },
};

type Connection = {
    id: string;
    name?: string;
    protocol: string;
    issuer: string;
    tenant_id?: string;
    client_id: string;
    enabled: boolean;
    directory_admin?: string;
    directory_configured?: boolean;
};

type Domain = { id: string; domain: string; verification_token: string; verified_at?: string | null };

const blankForm = { preset: "entra", name: "Microsoft Entra ID", issuer: "", tenant_id: "", client_id: "", client_secret: "", directory_secret: "", directory_admin: "" };

export default function SSO() {
    const { currentOrg } = useOrganisation();
    const token = useCookieToken();

    const [connections, setConnections] = useState<Connection[]>([]);
    const [domains, setDomains] = useState<Record<string, Domain[]>>({});
    const [showForm, setShowForm] = useState(false);

    // The redirect URI is Sentinel's login host + /sso/callback. Derived from
    // LOGIN_URL so it's always populated (no cross-service call to load it).
    const redirectUri = (() => {
        try { const u = config("LOGIN_URL"); return u ? new URL(u).origin + "/sso/callback" : ""; }
        catch { return ""; }
    })();
    const [form, setForm] = useState({ ...blankForm });
    const [newDomain, setNewDomain] = useState<Record<string, string>>({});
    const [txtHint, setTxtHint] = useState<{ name: string; value: string } | null>(null);
    const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
    const [mappings, setMappings] = useState<{ id: string; idp_group: string; idp_group_label?: string; organisation_group_id: string; group_name: string }[]>([]);
    const [newMapping, setNewMapping] = useState<{ idp_group: string; idp_group_label: string; group_id: string }>({ idp_group: "", idp_group_label: "", group_id: "" });
    // Which connection the group picker queries (mappings are org-level but groups
    // come from a specific IdP). Defaults to the first connection.
    const [mappingConn, setMappingConn] = useState<string>("");

    const base = () => `${API_URL}/api/v1/organisation/${currentOrg?.id}/sso`;
    const hdr = { headers: { Authorization: "Bearer " + token } };

    const copy = (text: string) => {
        navigator.clipboard?.writeText(text).then(() => toast.success("Copied to clipboard")).catch(() => toast.error("Couldn't copy"));
    };

    const loadConnections = () => {
        if (!currentOrg) return;
        api.get(`${base()}/connection`, hdr).then(r => setConnections(Array.isArray(r.data) ? r.data : [])).catch(() => setConnections([]));
    };
    const loadDomains = (connID: string) => {
        api.get(`${base()}/connection/${connID}/domain`, hdr).then(r => setDomains(p => ({ ...p, [connID]: Array.isArray(r.data) ? r.data : [] }))).catch(() => setDomains(p => ({ ...p, [connID]: [] })));
    };
    const loadTeams = () => {
        if (!currentOrg) return;
        api.get(`${API_URL}/api/v1/organisation/${currentOrg.id}/group`, hdr).then(r => setTeams(Array.isArray(r.data) ? r.data.map((g: any) => ({ id: g.id, name: g.name })) : [])).catch(() => setTeams([]));
    };
    const loadMappings = () => {
        if (!currentOrg) return;
        api.get(`${base()}/group-mapping`, hdr).then(r => setMappings(Array.isArray(r.data) ? r.data : [])).catch(() => setMappings([]));
    };
    const addMapping = () => {
        if (!newMapping.idp_group.trim() || !newMapping.group_id) { toast.error("Enter a group and pick a Team"); return; }
        api.post(`${base()}/group-mapping`, { idp_group: newMapping.idp_group.trim(), idp_group_label: newMapping.idp_group_label.trim(), organisation_group_id: newMapping.group_id }, hdr)
            .then(() => { setNewMapping({ idp_group: "", idp_group_label: "", group_id: "" }); loadMappings(); })
            .catch(() => toast.error("Failed to add mapping"));
    };
    const deleteMapping = (id: string) => {
        api.delete(`${base()}/group-mapping/${id}`, hdr).then(loadMappings).catch(() => toast.error("Failed to delete mapping"));
    };

    useEffect(() => { loadConnections(); loadTeams(); loadMappings(); }, [currentOrg]);
    useEffect(() => {
        connections.forEach(c => loadDomains(c.id));
        // Keep the group-picker's connection valid: default to the first, or reset
        // if the selected one was deleted.
        if (connections.length && !connections.some(c => c.id === mappingConn)) setMappingConn(connections[0].id);
        /* eslint-disable-next-line */
    }, [connections.length]);

    const applyPreset = (key: string) => {
        const p = PRESETS[key];
        setForm(f => ({ ...f, preset: key, name: p.label || f.name }));
    };

    const activePreset = PRESETS[form.preset] || PRESETS.generic;

    const createConnection = () => {
        if (!form.issuer.trim() || !form.client_id.trim()) { toast.error("Issuer and Client ID are required"); return; }
        api.post(`${base()}/connection`, {
            name: form.name.trim() || activePreset.label || "OIDC provider",
            protocol: "oidc",
            issuer: form.issuer.trim(),
            tenant_id: form.tenant_id.trim() || null,
            client_id: form.client_id.trim(),
            client_secret: form.client_secret || null,
            directory_secret: form.directory_secret || null,
            directory_admin: form.directory_admin.trim() || null,
            enabled: true,
        }, hdr)
            .then(() => { toast.success("Connection created"); setShowForm(false); setForm({ ...blankForm }); loadConnections(); })
            .catch(err => toast.error(err?.response?.data?.error || "Failed to create connection"));
    };

    const toggleEnabled = (c: Connection) => {
        api.put(`${base()}/connection/${c.id}`, { name: c.name, issuer: c.issuer, tenant_id: c.tenant_id || null, client_id: c.client_id, enabled: !c.enabled }, hdr)
            .then(loadConnections).catch(() => toast.error("Failed to update"));
    };
    const deleteConnection = (c: Connection) => {
        api.delete(`${base()}/connection/${c.id}`, hdr).then(() => { toast.success("Connection deleted"); loadConnections(); }).catch(() => toast.error("Failed to delete"));
    };
    const addDomain = (connID: string) => {
        const d = (newDomain[connID] || "").trim().toLowerCase();
        if (!d) return;
        api.post(`${base()}/connection/${connID}/domain`, { domain: d }, hdr)
            .then(r => { setTxtHint({ name: r.data.record_name, value: r.data.record_value }); setNewDomain(p => ({ ...p, [connID]: "" })); loadDomains(connID); })
            .catch(() => toast.error("Domain already claimed, or invalid"));
    };
    const verifyDomain = (connID: string, dom: Domain) => {
        api.post(`${base()}/connection/${connID}/domain/${dom.id}/verify`, null, hdr)
            .then(r => { r.data?.verified ? toast.success("Domain verified") : toast.error("TXT record not found yet — DNS can take a while"); loadDomains(connID); })
            .catch(() => toast.error("Verification failed"));
    };
    const deleteDomain = (connID: string, dom: Domain) => {
        api.delete(`${base()}/connection/${connID}/domain/${dom.id}`, hdr).then(() => loadDomains(connID)).catch(() => toast.error("Failed to delete domain"));
    };

    const CopyField = ({ label, value }: { label?: string; value: string }) => (
        <div className="sso-copy">
            {label ? <span className="sso-copy-label">{label}</span> : null}
            <code className="sso-copy-value">{value || "—"}</code>
            <button className="sso-btn" disabled={!value} onClick={() => copy(value)}><Icon name="copy" /> Copy</button>
        </div>
    );

    return (
        <Container help={SSO_HELP}>
            <ProtectedRoute permissions={[PERMISSIONS.ORGANISATION_MANAGE]}>
                <div className="header">Single Sign-On</div>

                {!currentOrg && <div className="sso-empty">SSO is configured per organisation — switch to an organisation to set it up.</div>}

                {currentOrg && (
                    <>
                        <div className="sso-actions">
                            <button className="sso-btn sso-btn--primary" onClick={() => { setForm({ ...blankForm }); setShowForm(v => !v); }}>
                                <Icon name="plus" /> New connection
                            </button>
                        </div>

                        {showForm && (
                            <div className="sso-card sso-form">
                                <label className="sso-label">Provider</label>
                                <div className="sso-presets">
                                    {Object.entries(PRESETS).map(([key, p]) => (
                                        <button key={key} className={`sso-preset ${form.preset === key ? "sso-preset--active" : ""}`} onClick={() => applyPreset(key)}>
                                            {p.label || "Generic OIDC"}
                                        </button>
                                    ))}
                                </div>
                                {activePreset.docs && (
                                    <a className="sso-docs-link" href={activePreset.docs} target="_blank" rel="noopener noreferrer">
                                        <Icon name="book" /> {activePreset.docsLabel || "Provider setup guide"} <Icon name="arrow-up-right-from-square" className="sso-docs-ext" />
                                    </a>
                                )}

                                <div className="sso-form-redirect">
                                    <label className="sso-label">Redirect URI <span className="sso-label-note">— register this in your provider (must match exactly)</span></label>
                                    <CopyField value={redirectUri} />
                                </div>

                                <label className="sso-label">Display name</label>
                                <input className="sso-input" placeholder="e.g. Okta" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />

                                <label className="sso-label">Issuer URL</label>
                                <input className="sso-input" placeholder={activePreset.issuerHint} value={form.issuer} onChange={e => setForm({ ...form, issuer: e.target.value })} />

                                {activePreset.tenant && (
                                    <>
                                        <label className="sso-label">Tenant ID <span className="sso-label-note">(Microsoft Entra only — pins the tenant)</span></label>
                                        <input className="sso-input" placeholder="00000000-0000-0000-0000-000000000000" value={form.tenant_id} onChange={e => setForm({ ...form, tenant_id: e.target.value })} />
                                    </>
                                )}

                                <label className="sso-label">Application (client) ID</label>
                                <input className="sso-input" value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} />

                                <label className="sso-label">Client secret</label>
                                <input className="sso-input" type="password" value={form.client_secret} onChange={e => setForm({ ...form, client_secret: e.target.value })} />

                                {activePreset.note && <div className="sso-hint">{activePreset.note}</div>}

                                {activePreset.directory && (activePreset.directory.secretLabel || activePreset.directory.adminLabel) && (
                                    <div className="sso-directory">
                                        <div className="sso-directory-title"><Icon name="magnifying-glass" /> Group picker (optional)</div>
                                        {activePreset.directory.secretLabel && (
                                            <>
                                                <label className="sso-label">{activePreset.directory.secretLabel}</label>
                                                {activePreset.directory.secretMultiline
                                                    ? <textarea className="sso-input sso-textarea" rows={4} placeholder={activePreset.directory.secretPlaceholder} value={form.directory_secret} onChange={e => setForm({ ...form, directory_secret: e.target.value })} />
                                                    : <input className="sso-input" type="password" placeholder={activePreset.directory.secretPlaceholder} value={form.directory_secret} onChange={e => setForm({ ...form, directory_secret: e.target.value })} />}
                                            </>
                                        )}
                                        {activePreset.directory.adminLabel && (
                                            <>
                                                <label className="sso-label">{activePreset.directory.adminLabel}</label>
                                                <input className="sso-input" placeholder={activePreset.directory.adminPlaceholder} value={form.directory_admin} onChange={e => setForm({ ...form, directory_admin: e.target.value })} />
                                            </>
                                        )}
                                    </div>
                                )}
                                {activePreset.directory?.hint && <div className="sso-hint">{activePreset.directory.hint}</div>}

                                <div className="sso-form-actions">
                                    <button className="sso-btn" onClick={() => { setShowForm(false); setForm({ ...blankForm }); }}>Cancel</button>
                                    <button className="sso-btn sso-btn--primary" onClick={createConnection}>Create</button>
                                </div>
                            </div>
                        )}

                        {txtHint && (
                            <div className="sso-card sso-txt">
                                <div className="sso-txt-title"><Icon name="circle-info" /> Add this DNS TXT record, then click Verify</div>
                                <CopyField label="Host" value={txtHint.name} />
                                <CopyField label="Value" value={txtHint.value} />
                                <button className="sso-btn" onClick={() => setTxtHint(null)}>Dismiss</button>
                            </div>
                        )}

                        {connections.length === 0 && !showForm && (
                            <div className="sso-empty">No SSO connections yet. Add one to let your team sign in with your identity provider.</div>
                        )}

                        {connections.map(c => (
                            <div key={c.id} className="sso-card">
                                <div className="sso-conn-head">
                                    <Icon name="lock" className="sso-conn-icon" />
                                    <div className="sso-conn-title">
                                        <div className="sso-conn-name">{c.name || "OIDC provider"}</div>
                                        <div className="sso-conn-issuer">{c.issuer}</div>
                                    </div>
                                    <span className={`sso-badge ${c.enabled ? "sso-badge--on" : "sso-badge--off"}`}>{c.enabled ? "Enabled" : "Disabled"}</span>
                                    <button className="sso-btn" onClick={() => toggleEnabled(c)}>{c.enabled ? "Disable" : "Enable"}</button>
                                    <button className="sso-btn sso-btn--danger" onClick={() => deleteConnection(c)}><Icon name="trash" /></button>
                                </div>

                                <div className="sso-domains">
                                    <div className="sso-domains-title">Claimed domains</div>
                                    {(domains[c.id] || []).map(dom => (
                                        <div key={dom.id} className="sso-domain-row">
                                            <span className="sso-domain-name">{dom.domain}</span>
                                            {dom.verified_at
                                                ? <span className="sso-badge sso-badge--on"><Icon name="check" /> Verified</span>
                                                : <span className="sso-badge sso-badge--off">Unverified</span>}
                                            {!dom.verified_at && <button className="sso-btn" onClick={() => verifyDomain(c.id, dom)}>Verify</button>}
                                            <button className="sso-btn sso-btn--danger" onClick={() => deleteDomain(c.id, dom)}><Icon name="trash" /></button>
                                        </div>
                                    ))}
                                    <div className="sso-domain-add">
                                        <input className="sso-input" placeholder="example.gov.uk" value={newDomain[c.id] || ""} onChange={e => setNewDomain(p => ({ ...p, [c.id]: e.target.value }))} />
                                        <button className="sso-btn" onClick={() => addDomain(c.id)}>Add domain</button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {connections.length > 0 && (
                            <div className="sso-card">
                                <div className="sso-domains-title" style={{ marginBottom: 6 }}>Group → Team mapping</div>
                                <div className="sso-hint" style={{ margin: "0 0 12px" }}>
                                    Members of an identity-provider group are added to the mapped Team on sign-in (and removed when they leave it). Teams with no mapping are managed manually. Search for a group below, or type its name/object id exactly as your provider emits it in the token.
                                </div>
                                {mappings.length === 0 && <div className="sso-empty" style={{ marginTop: 0 }}>No mappings yet.</div>}
                                {mappings.map(m => (
                                    <div key={m.id} className="sso-domain-row">
                                        <span className="sso-domain-name"><code>{m.idp_group_label || m.idp_group}</code> &nbsp;→&nbsp; {m.group_name}</span>
                                        <button className="sso-btn sso-btn--danger" onClick={() => deleteMapping(m.id)}><Icon name="trash" /></button>
                                    </div>
                                ))}
                                {connections.length > 1 && (
                                    <div className="sso-mapping-conn">
                                        <label className="sso-label" style={{ marginTop: 4 }}>Search groups from</label>
                                        <select className="sso-input" value={mappingConn} onChange={e => setMappingConn(e.target.value)}>
                                            {connections.map(c => <option key={c.id} value={c.id}>{c.name || c.issuer}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div className="sso-domain-add">
                                    <GroupPicker
                                        connId={mappingConn || (connections[0]?.id ?? null)}
                                        apiBase={base()}
                                        token={token}
                                        value={{ idp_group: newMapping.idp_group, idp_group_label: newMapping.idp_group_label }}
                                        onChange={v => setNewMapping({ ...newMapping, idp_group: v.idp_group, idp_group_label: v.idp_group_label })}
                                    />
                                    <select className="sso-input sso-team-select" value={newMapping.group_id} onChange={e => setNewMapping({ ...newMapping, group_id: e.target.value })}>
                                        <option value="">Select a Team…</option>
                                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                    <button className="sso-btn" onClick={addMapping}>Add mapping</button>
                                </div>
                                {teams.length === 0 && <div className="sso-hint">No Teams yet — create Teams in the Organisation area to map groups to them.</div>}
                            </div>
                        )}
                    </>
                )}
            </ProtectedRoute>
        </Container>
    );
}

// GroupPicker is a searchable, autocompleting group selector backed by the IdP's
// directory API (Entra/Okta/Google). It degrades to plain free-text entry when
// the provider can't be queried or no directory credential is configured — so a
// group can always be entered by hand. The chosen id (what the token's groups
// claim carries) is stored, while the friendly name is shown and kept as a label.
function GroupPicker({ connId, apiBase, token, value, onChange }: {
    connId: string | null;
    apiBase: string;
    token: string | null;
    value: { idp_group: string; idp_group_label: string };
    onChange: (v: { idp_group: string; idp_group_label: string }) => void;
}) {
    const [q, setQ] = useState("");
    const [open, setOpen] = useState(false);
    const [results, setResults] = useState<{ id: string; name: string }[]>([]);
    const [supported, setSupported] = useState(true);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

    // When closed, show the chosen label (falling back to the raw id); when open,
    // show what the user is typing.
    const text = value.idp_group_label || value.idp_group || "";

    useEffect(() => {
        if (!connId || !open) return;
        setLoading(true);
        const t = setTimeout(() => {
            api.get(`${apiBase}/connection/${connId}/groups?q=${encodeURIComponent(q)}`, { headers: { Authorization: "Bearer " + token } })
                .then(r => {
                    setSupported(r.data?.supported !== false);
                    setResults(Array.isArray(r.data?.groups) ? r.data.groups : []);
                    setErr(r.data?.error || "");
                })
                .catch(() => { setResults([]); setSupported(true); setErr(""); })
                .finally(() => setLoading(false));
        }, 250);
        return () => clearTimeout(t);
    }, [q, connId, open, apiBase, token]);

    return (
        <div className="sso-group-picker">
            <input
                className="sso-input"
                placeholder="Search groups, or type a name/id"
                value={open ? q : text}
                onFocus={() => { setOpen(true); setQ(""); }}
                onChange={e => { setQ(e.target.value); onChange({ idp_group: e.target.value, idp_group_label: e.target.value }); }}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
            />
            {open && (
                <div className="sso-group-dropdown">
                    {loading && <div className="sso-group-item sso-group-item--ink-muted">Searching…</div>}
                    {!loading && !supported && <div className="sso-group-item sso-group-item--ink-muted">Group search isn't available for this provider — type the group name/id.</div>}
                    {!loading && supported && err && <div className="sso-group-item sso-group-item--ink-muted">{err}</div>}
                    {!loading && supported && !err && results.length === 0 && <div className="sso-group-item sso-group-item--ink-muted">No matching groups — type a name/id to enter it manually.</div>}
                    {!loading && results.map(g => (
                        <button key={g.id} className="sso-group-item" onMouseDown={e => { e.preventDefault(); onChange({ idp_group: g.id, idp_group_label: g.name }); setQ(""); setOpen(false); }}>
                            <span className="sso-group-name">{g.name}</span>
                            {g.name !== g.id && <span className="sso-group-id">{g.id}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
