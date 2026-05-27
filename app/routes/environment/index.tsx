import type {Route} from "../+types/home";
import Container from "~/components/container";
import type {Environment, Property, Secret} from "~/types";
import {useEffect, useState} from "react";
import {Link, useParams} from "react-router";
import api from "~/lib/api";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import {toast} from "react-toastify";
import Modal from "~/components/modal";
import "./index.css";
import { Icon } from "~/components/icons/Icon";
import ProtectedRoute from "~/components/protected-route";
import {PERMISSIONS} from "~/types";

type ScopeItem = { scope: string; label: string; default?: boolean };
type ScopeGroup = { group: string; scopes: ScopeItem[] };

const providerScopes: Record<string, ScopeGroup[]> = {
    google: [
        { group: "Identity", scopes: [
            { scope: "openid", label: "OpenID", default: true },
            { scope: "email", label: "Email address", default: true },
            { scope: "profile", label: "Profile info", default: true },
        ]},
        { group: "Gmail", scopes: [
            { scope: "https://www.googleapis.com/auth/gmail.readonly", label: "Read-only" },
            { scope: "https://www.googleapis.com/auth/gmail.send", label: "Send" },
            { scope: "https://www.googleapis.com/auth/gmail.modify", label: "Read/write" },
        ]},
        { group: "Calendar", scopes: [
            { scope: "https://www.googleapis.com/auth/calendar", label: "Full access" },
            { scope: "https://www.googleapis.com/auth/calendar.readonly", label: "Read-only" },
        ]},
        { group: "Drive", scopes: [
            { scope: "https://www.googleapis.com/auth/drive.readonly", label: "Read-only" },
            { scope: "https://www.googleapis.com/auth/drive.file", label: "File access" },
        ]},
        { group: "Sheets", scopes: [
            { scope: "https://www.googleapis.com/auth/spreadsheets", label: "Full access" },
            { scope: "https://www.googleapis.com/auth/spreadsheets.readonly", label: "Read-only" },
        ]},
        { group: "Docs & Slides", scopes: [
            { scope: "https://www.googleapis.com/auth/documents", label: "Google Docs" },
            { scope: "https://www.googleapis.com/auth/presentations", label: "Google Slides" },
        ]},
        { group: "YouTube", scopes: [
            { scope: "https://www.googleapis.com/auth/youtube", label: "Manage" },
            { scope: "https://www.googleapis.com/auth/youtube.readonly", label: "Read-only" },
            { scope: "https://www.googleapis.com/auth/youtube.upload", label: "Upload" },
        ]},
    ],
    microsoft: [
        { group: "Identity", scopes: [
            { scope: "openid", label: "OpenID", default: true },
            { scope: "email", label: "Email address", default: true },
            { scope: "profile", label: "Profile info", default: true },
            { scope: "offline_access", label: "Offline access", default: true },
            { scope: "User.Read", label: "Read user profile" },
        ]},
        { group: "Outlook Mail", scopes: [
            { scope: "Mail.Read", label: "Read" },
            { scope: "Mail.Send", label: "Send" },
            { scope: "Mail.ReadWrite", label: "Read/write" },
        ]},
        { group: "Calendar", scopes: [
            { scope: "Calendars.Read", label: "Read" },
            { scope: "Calendars.ReadWrite", label: "Read/write" },
        ]},
        { group: "OneDrive", scopes: [
            { scope: "Files.Read", label: "Read" },
            { scope: "Files.ReadWrite", label: "Read/write" },
        ]},
        { group: "SharePoint & Teams", scopes: [
            { scope: "Sites.Read.All", label: "Read SharePoint sites" },
            { scope: "Teams.ReadBasic.All", label: "Read Teams" },
            { scope: "Chat.Read", label: "Read chats" },
            { scope: "Chat.ReadWrite", label: "Read/write chats" },
        ]},
    ],
    github: [
        { group: "User", scopes: [
            { scope: "read:user", label: "Read profile", default: true },
            { scope: "user:email", label: "Read emails", default: true },
        ]},
        { group: "Repositories", scopes: [
            { scope: "repo", label: "Full access" },
            { scope: "public_repo", label: "Public only" },
            { scope: "repo:status", label: "Commit statuses" },
        ]},
        { group: "Organisations", scopes: [
            { scope: "read:org", label: "Read membership" },
            { scope: "write:org", label: "Write membership" },
            { scope: "admin:org", label: "Full control" },
        ]},
        { group: "Actions & Packages", scopes: [
            { scope: "workflow", label: "Workflows" },
            { scope: "write:packages", label: "Write packages" },
            { scope: "read:packages", label: "Read packages" },
            { scope: "delete:packages", label: "Delete packages" },
        ]},
        { group: "Other", scopes: [
            { scope: "gist", label: "Gists" },
            { scope: "notifications", label: "Notifications" },
            { scope: "admin:repo_hook", label: "Webhooks" },
        ]},
    ],
    linkedin: [
        { group: "Identity", scopes: [
            { scope: "openid", label: "OpenID", default: true },
            { scope: "profile", label: "Profile info", default: true },
            { scope: "email", label: "Email address", default: true },
            { scope: "r_liteprofile", label: "Lite profile" },
        ]},
        { group: "Social", scopes: [
            { scope: "w_member_social", label: "Post as member", default: true },
        ]},
        { group: "Organisation (requires approval)", scopes: [
            { scope: "r_organization_social", label: "Read org posts" },
            { scope: "w_organization_social", label: "Post as organisation" },
            { scope: "rw_organization_admin", label: "Manage organisation" },
            { scope: "r_ads", label: "Read ad accounts" },
            { scope: "r_ads_reporting", label: "Read ad reports" },
        ]},
    ],
    linkedin_community: [
        { group: "Member Content", scopes: [
            { scope: "r_member_social", label: "Read member posts", default: true },
            { scope: "w_member_social", label: "Write member posts", default: true },
        ]},
        { group: "Organisation Content", scopes: [
            { scope: "r_organization_social", label: "Read organisation posts", default: true },
            { scope: "w_organization_social", label: "Write organisation posts", default: true },
        ]},
        { group: "Organisation Admin", scopes: [
            { scope: "rw_organization_admin", label: "Manage organisation pages", default: true },
        ]},
    ],
    facebook: [
        { group: "Pages", scopes: [
            { scope: "pages_manage_posts", label: "Manage posts", default: true },
            { scope: "pages_read_engagement", label: "Read engagement", default: true },
            { scope: "pages_show_list", label: "Show list" },
            { scope: "pages_read_user_content", label: "Read user content" },
            { scope: "pages_manage_metadata", label: "Manage metadata" },
            { scope: "pages_manage_engagement", label: "Manage engagement" },
            { scope: "pages_messaging", label: "Messaging" },
        ]},
        { group: "Instagram", scopes: [
            { scope: "instagram_basic", label: "Basic access" },
            { scope: "instagram_content_publish", label: "Publish content" },
            { scope: "instagram_manage_comments", label: "Manage comments" },
            { scope: "instagram_manage_insights", label: "Insights" },
        ]},
        { group: "Business", scopes: [
            { scope: "business_management", label: "Business management" },
            { scope: "ads_management", label: "Ads management" },
            { scope: "ads_read", label: "Read ads" },
        ]},
    ],
    twitter: [
        { group: "Tweets", scopes: [
            { scope: "tweet.read", label: "Read", default: true },
            { scope: "tweet.write", label: "Write", default: true },
        ]},
        { group: "Users", scopes: [
            { scope: "users.read", label: "Read profiles", default: true },
            { scope: "offline.access", label: "Offline access", default: true },
        ]},
        { group: "Social", scopes: [
            { scope: "follows.read", label: "Read follows" },
            { scope: "follows.write", label: "Manage follows" },
            { scope: "like.read", label: "Read likes" },
            { scope: "like.write", label: "Manage likes" },
        ]},
        { group: "Lists & Bookmarks", scopes: [
            { scope: "list.read", label: "Read lists" },
            { scope: "list.write", label: "Manage lists" },
            { scope: "bookmark.read", label: "Read bookmarks" },
            { scope: "bookmark.write", label: "Manage bookmarks" },
        ]},
        { group: "Messaging", scopes: [
            { scope: "space.read", label: "Read Spaces" },
            { scope: "dm.read", label: "Read DMs" },
            { scope: "dm.write", label: "Send DMs" },
        ]},
    ],
};

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Environment" },
        { name: "description", content: "Manage environment" },
    ];
}

export default function EnvironmentDetail() {
    const environmentID = useParams().id;
    const token = useCookieToken();
    const controller = new AbortController();

    const [ environment, setEnvironment ] = useState<Environment>();
    const [ properties, setProperties ] = useState<Property[]>();
    const [ secrets, setSecrets ] = useState<Secret[]>();

    const [ showAddProperty, setShowAddProperty ] = useState(false);
    const [ newPropName, setNewPropName ] = useState("");
    const [ newPropValue, setNewPropValue ] = useState("");

    const [ showAddSecret, setShowAddSecret ] = useState(false);
    const [ newSecretName, setNewSecretName ] = useState("");
    const [ newSecretValue, setNewSecretValue ] = useState("");

    const [ editingPropertyID, setEditingPropertyID ] = useState<string | null>(null);
    const [ editingPropertyName, setEditingPropertyName ] = useState("");
    const [ editingPropertyValue, setEditingPropertyValue ] = useState("");

    const [ editingSecretID, setEditingSecretID ] = useState<string | null>(null);
    const [ editingSecretValue, setEditingSecretValue ] = useState("");

    const [ activeTab, setActiveTab ] = useState<'properties' | 'secrets' | 'credentials'>('properties');
    const [ confirmDelete, setConfirmDelete ] = useState<{ type: 'property' | 'secret' | 'credential', id: string, name: string } | null>(null);

    const [ credentials, setCredentials ] = useState<any[]>([]);
    const [ providers, setProviders ] = useState<any[]>([]);
    const [ showAddCredential, setShowAddCredential ] = useState(false);
    const [ newCredName, setNewCredName ] = useState("");
    const [ newCredProvider, setNewCredProvider ] = useState("");
    const [ newCredSelectedScopes, setNewCredSelectedScopes ] = useState<Set<string>>(new Set());

    const getUrl = (path: string) => {
        const config = useConfig();
        return config("AUTOMATE_API_URL") + '/api/v1/environment/' + environmentID + path;
    };

    const headers = { Authorization: "Bearer " + token };

    useEffect(() => {
        api.get(getUrl(''), { signal: controller.signal, headers }).then(r => { if (r) setEnvironment(r.data); }).catch(console.error);
        updateProperties();
        updateSecrets();
        updateCredentials();
        loadProviders();
    }, []);

    const updateProperties = () => {
        api.get(getUrl('/property'), { signal: controller.signal, headers })
            .then(r => setProperties(Array.isArray(r?.data) ? r.data : []))
            .catch(() => setProperties([]));
    };

    const updateSecrets = () => {
        api.get(getUrl('/secret'), { signal: controller.signal, headers })
            .then(r => setSecrets(Array.isArray(r?.data) ? r.data : []))
            .catch(() => setSecrets([]));
    };

    const saveProperty = () => {
        if (!newPropName.trim()) return;
        api.post(getUrl('/property'), { name: newPropName, value: newPropValue }, { headers })
            .then(() => { setShowAddProperty(false); setNewPropName(""); setNewPropValue(""); toast.success("Property created"); updateProperties(); })
            .catch(() => toast.error("Failed to create property"));
    };

    const saveSecret = () => {
        if (!newSecretName.trim()) return;
        api.post(getUrl('/secret'), { name: newSecretName, value: newSecretValue }, { headers })
            .then(() => { setShowAddSecret(false); setNewSecretName(""); setNewSecretValue(""); toast.success("Secret created"); updateSecrets(); })
            .catch(() => toast.error("Failed to create secret"));
    };

    const deleteProperty = (id: string) => {
        api.delete(getUrl('/property/' + id), { headers })
            .then(() => { toast.success("Property deleted"); updateProperties(); })
            .catch(() => toast.error("Failed to delete property"));
    };

    const deleteSecret = (id: string) => {
        api.delete(getUrl('/secret/' + id), { headers })
            .then(() => { toast.success("Secret deleted"); updateSecrets(); })
            .catch(() => toast.error("Failed to delete secret"));
    };

    const saveEditProperty = () => {
        if (!editingPropertyID) return;
        api.post(getUrl('/property/' + editingPropertyID), { name: editingPropertyName, value: editingPropertyValue }, { headers })
            .then(() => { setEditingPropertyID(null); toast.success("Property updated"); updateProperties(); })
            .catch(() => toast.error("Failed to update property"));
    };

    const saveEditSecret = () => {
        if (!editingSecretID) return;
        api.post(getUrl('/secret/' + editingSecretID), { value: editingSecretValue }, { headers })
            .then(() => { setEditingSecretID(null); toast.success("Secret updated"); updateSecrets(); })
            .catch(() => toast.error("Failed to update secret"));
    };

    const updateCredentials = () => {
        api.get(getUrl('/credential'), { signal: controller.signal, headers })
            .then(r => setCredentials(Array.isArray(r?.data) ? r.data : []))
            .catch(() => setCredentials([]));
    };

    const loadProviders = () => {
        const config = useConfig();
        api.get(config("AUTOMATE_API_URL") + '/api/v1/credential/providers', { headers })
            .then(r => setProviders(Array.isArray(r?.data) ? r.data : []))
            .catch(() => setProviders([]));
    };

    const toggleScope = (scope: string) => {
        setNewCredSelectedScopes(prev => {
            const next = new Set(prev);
            if (next.has(scope)) next.delete(scope);
            else next.add(scope);
            return next;
        });
    };

    const saveCredential = () => {
        if (!newCredName.trim() || !newCredProvider) return;
        const scopeStr = Array.from(newCredSelectedScopes).join(' ');
        const body: any = { provider_slug: newCredProvider, name: newCredName };
        if (scopeStr) body.scopes = scopeStr;

        api.post(getUrl('/credential'), body, { headers })
            .then(r => {
                setShowAddCredential(false);
                setNewCredName("");
                setNewCredProvider("");
                setNewCredSelectedScopes(new Set());
                toast.success("Credential created — authorise in the popup");
                updateCredentials();
                if (r?.data?.auth_url) {
                    window.open(r.data.auth_url, '_blank', 'width=600,height=700');
                }
            })
            .catch(err => {
                const msg = err.response?.data?.error || "Failed to create credential";
                toast.error(msg);
            });
    };

    const reauthoriseCredential = (id: string) => {
        api.post(getUrl('/credential/' + id + '/reauthorise'), {}, { headers })
            .then(r => {
                if (r?.data?.auth_url) {
                    window.open(r.data.auth_url, '_blank', 'width=600,height=700');
                    toast.info("Complete authorisation in the popup");
                }
            })
            .catch(() => toast.error("Failed to start re-authorisation"));
    };

    const deleteCredential = (id: string) => {
        api.delete(getUrl('/credential/' + id), { headers })
            .then(() => { toast.success("Credential deleted"); updateCredentials(); })
            .catch(() => toast.error("Failed to delete credential"));
    };

    const handleConfirmDelete = () => {
        if (!confirmDelete) return;
        if (confirmDelete.type === 'property') deleteProperty(confirmDelete.id);
        else if (confirmDelete.type === 'secret') deleteSecret(confirmDelete.id);
        else if (confirmDelete.type === 'credential') deleteCredential(confirmDelete.id);
        setConfirmDelete(null);
    };

    return (
        <Container>
            <ProtectedRoute permission={PERMISSIONS.ENVIRONMENT_VIEW}>
            <div className={"header"}>{environment?.name || "Environment"}</div>
            <div className="env-detail-back">
                <Link to="/environment" className="env-detail-back-link">
                    <Icon name="arrow-left" /> All Environments
                </Link>
            </div>

            <div className="env-detail-tabs">
                <button className={`env-detail-tab ${activeTab === 'properties' ? 'env-detail-tab--active' : ''}`} onClick={() => setActiveTab('properties')}>
                    <Icon name="cubes" /> Properties
                    {properties && properties.length > 0 && <span className="env-detail-tab-count">{properties.length}</span>}
                </button>
                <button className={`env-detail-tab ${activeTab === 'secrets' ? 'env-detail-tab--active' : ''}`} onClick={() => setActiveTab('secrets')}>
                    <Icon name="key" /> Secrets
                    {secrets && secrets.length > 0 && <span className="env-detail-tab-count">{secrets.length}</span>}
                </button>
                <button className={`env-detail-tab ${activeTab === 'credentials' ? 'env-detail-tab--active' : ''}`} onClick={() => setActiveTab('credentials')}>
                    <Icon name="link" /> Credentials
                    {credentials.length > 0 && <span className="env-detail-tab-count">{credentials.length}</span>}
                </button>
            </div>

            <div className="env-detail-page">
                {/* Properties */}
                {activeTab === 'properties' && (
                <div className="env-detail-card">
                    <div className="env-detail-card-header">
                        <div className="env-detail-section-label">
                            <Icon name="cubes" className="env-detail-section-icon" /> Properties
                        </div>
                        {!showAddProperty && (
                            <button className="env-detail-add-btn" onClick={() => setShowAddProperty(true)}>
                                <Icon name="plus" /> Add
                            </button>
                        )}
                    </div>

                    {showAddProperty && (
                        <div className="env-detail-add-form">
                            <input type="text" placeholder="Name" autoFocus value={newPropName} onChange={e => setNewPropName(e.target.value)} />
                            <textarea placeholder="Value" rows={2} value={newPropValue} onChange={e => setNewPropValue(e.target.value)} />
                            <div className="env-detail-add-actions">
                                <button className="env-detail-btn-save" onClick={saveProperty} disabled={!newPropName.trim()}><Icon name="check" /> Save</button>
                                <button className="env-detail-btn-cancel" onClick={() => setShowAddProperty(false)}>Cancel</button>
                            </div>
                        </div>
                    )}

                    {(!properties || properties.length === 0) && !showAddProperty && (
                        <div className="env-detail-empty">No properties</div>
                    )}

                    <div className="env-detail-items">
                        {properties?.slice().sort((a, b) => a.name.localeCompare(b.name)).map(prop => {
                            const isEditing = editingPropertyID === prop.id;
                            return (
                                <div key={prop.id} className="env-detail-item">
                                    {isEditing ? (
                                        <div className="env-detail-edit-form">
                                            <input type="text" value={editingPropertyName} onChange={e => setEditingPropertyName(e.target.value)} />
                                            <textarea rows={2} value={editingPropertyValue} onChange={e => setEditingPropertyValue(e.target.value)} autoFocus />
                                            <div className="env-detail-add-actions">
                                                <button className="env-detail-btn-save" onClick={saveEditProperty}><Icon name="check" /> Save</button>
                                                <button className="env-detail-btn-cancel" onClick={() => setEditingPropertyID(null)}>Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="env-detail-item-info">
                                                <div className="env-detail-item-name">{prop.name}</div>
                                                <div className="env-detail-item-value">{prop.value}</div>
                                            </div>
                                            <div className="env-detail-item-actions">
                                                <button className="env-detail-icon-btn" onClick={() => { setEditingPropertyID(prop.id); setEditingPropertyName(prop.name); setEditingPropertyValue(prop.value); }}>
                                                    <Icon name="pencil" />
                                                </button>
                                                <button className="env-detail-icon-btn env-detail-icon-btn--danger" onClick={() => setConfirmDelete({ type: 'property', id: prop.id, name: prop.name })}>
                                                    <Icon name="trash" />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
                )}

                {/* Secrets */}
                {activeTab === 'secrets' && (
                <div className="env-detail-card">
                    <div className="env-detail-card-header">
                        <div className="env-detail-section-label">
                            <Icon name="key" className="env-detail-section-icon" /> Secrets
                        </div>
                        {!showAddSecret && (
                            <button className="env-detail-add-btn" onClick={() => setShowAddSecret(true)}>
                                <Icon name="plus" /> Add
                            </button>
                        )}
                    </div>

                    {showAddSecret && (
                        <div className="env-detail-add-form">
                            <input type="text" placeholder="Name" autoFocus value={newSecretName} onChange={e => setNewSecretName(e.target.value)} />
                            <textarea placeholder="Value (will be encrypted)" rows={2} value={newSecretValue} onChange={e => setNewSecretValue(e.target.value)} />
                            <div className="env-detail-add-actions">
                                <button className="env-detail-btn-save" onClick={saveSecret} disabled={!newSecretName.trim()}><Icon name="check" /> Save</button>
                                <button className="env-detail-btn-cancel" onClick={() => setShowAddSecret(false)}>Cancel</button>
                            </div>
                        </div>
                    )}

                    {(!secrets || secrets.length === 0) && !showAddSecret && (
                        <div className="env-detail-empty">No secrets</div>
                    )}

                    <div className="env-detail-items">
                        {secrets?.slice().sort((a, b) => a.name.localeCompare(b.name)).map(secret => {
                            const isEditing = editingSecretID === secret.id;
                            return (
                                <div key={secret.id} className="env-detail-item">
                                    {isEditing ? (
                                        <div className="env-detail-edit-form">
                                            <div className="env-detail-item-name" style={{ marginBottom: 8 }}>{secret.name}</div>
                                            <textarea placeholder="Enter new secret value..." rows={2} value={editingSecretValue} onChange={e => setEditingSecretValue(e.target.value)} autoFocus />
                                            <div className="env-detail-add-actions">
                                                <button className="env-detail-btn-save" onClick={saveEditSecret}><Icon name="check" /> Save</button>
                                                <button className="env-detail-btn-cancel" onClick={() => setEditingSecretID(null)}>Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="env-detail-item-info">
                                                <div className="env-detail-item-name">{secret.name}</div>
                                                <div className="env-detail-item-value env-detail-item-value--hidden">Encrypted</div>
                                            </div>
                                            <div className="env-detail-item-actions">
                                                <button className="env-detail-icon-btn" onClick={() => { setEditingSecretID(secret.id); setEditingSecretValue(""); }}>
                                                    <Icon name="pencil" />
                                                </button>
                                                <button className="env-detail-icon-btn env-detail-icon-btn--danger" onClick={() => setConfirmDelete({ type: 'secret', id: secret.id, name: secret.name })}>
                                                    <Icon name="trash" />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
                )}

                {/* Credentials */}
                {activeTab === 'credentials' && (
                <div className="env-detail-card">
                    <div className="env-detail-card-header">
                        <div className="env-detail-section-label">
                            <Icon name="key" className="env-detail-section-icon" /> Credentials
                        </div>
                        <div className="env-cred-add-wrap">
                            <button className="env-detail-add-btn" onClick={() => setShowAddCredential(!showAddCredential)}>
                                <Icon name="plus" /> Add
                            </button>
                            {showAddCredential && !newCredProvider && (
                                <div className="env-cred-provider-menu">
                                    {providers.length === 0 && (
                                        <div className="env-cred-provider-empty">No OAuth providers configured</div>
                                    )}
                                    {providers.map(p => (
                                        <button
                                            key={p.slug}
                                            className={`env-cred-provider-option ${!p.configured ? 'env-cred-provider-option--disabled' : ''}`}
                                            disabled={!p.configured}
                                            onClick={() => {
                                                if (!p.configured) return;
                                                setNewCredProvider(p.slug);
                                                const defaults = new Set<string>();
                                                (providerScopes[p.slug] || []).forEach((g: any) => {
                                                    g.scopes.forEach((s: any) => { if (s.default) defaults.add(s.scope); });
                                                });
                                                setNewCredSelectedScopes(defaults);
                                            }}
                                        >
                                            <Icon name={p.icon || 'link'} />
                                            <span>{p.name}</span>
                                            {!p.configured && <span className="env-cred-provider-unconfigured">Not configured</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {showAddCredential && newCredProvider && (
                        <div className="env-detail-add-form">
                            <div className="env-cred-provider-badge">
                                <Icon name={providers.find(p => p.slug === newCredProvider)?.icon || 'link'} />
                                {providers.find(p => p.slug === newCredProvider)?.name}
                            </div>
                            <input type="text" placeholder="Credential name (e.g. company_linkedin)" autoFocus value={newCredName} onChange={e => setNewCredName(e.target.value)} />
                            {providerScopes[newCredProvider] && (
                                <div className="env-cred-scopes-section">
                                    <div className="env-cred-scopes-label">Scopes</div>
                                    <div className="env-cred-scopes-groups">
                                        {providerScopes[newCredProvider].map(group => (
                                            <div key={group.group} className="env-cred-scope-group">
                                                <div className="env-cred-scope-group-name">{group.group}</div>
                                                <div className="env-cred-scopes-grid">
                                                    {group.scopes.map(s => (
                                                        <label key={s.scope} className="env-cred-scope-item" title={s.scope}>
                                                            <input
                                                                type="checkbox"
                                                                checked={newCredSelectedScopes.has(s.scope)}
                                                                onChange={() => toggleScope(s.scope)}
                                                            />
                                                            <span>{s.label}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="env-detail-add-actions">
                                <button className="env-detail-btn-save" onClick={saveCredential} disabled={!newCredName.trim() || newCredSelectedScopes.size === 0}><Icon name="check" /> Create &amp; Authorise</button>
                                <button className="env-detail-btn-cancel" onClick={() => { setShowAddCredential(false); setNewCredName(""); setNewCredProvider(""); setNewCredSelectedScopes(new Set()); }}>Cancel</button>
                            </div>
                        </div>
                    )}

                    {credentials.length === 0 && !newCredProvider && (
                        <div className="env-detail-empty">No credentials — add one to connect to external services via OAuth</div>
                    )}

                    <div className="env-detail-items">
                        {credentials.slice().sort((a: any, b: any) => a.name.localeCompare(b.name)).map((cred: any) => (
                            <div key={cred.id} className="env-detail-item">
                                <div className="env-detail-item-info">
                                    <div className="env-detail-item-name">
                                        {cred.name}
                                        <span className={`env-cred-status env-cred-status--${cred.status}`}>
                                            {cred.status}
                                        </span>
                                    </div>
                                    <div className="env-detail-item-value">
                                        {cred.provider_name || cred.provider_slug}
                                        {cred.scopes && <span className="env-cred-scopes"> — {cred.scopes}</span>}
                                    </div>
                                    {cred.token_expires_at && (
                                        <div className="env-detail-item-value" style={{ fontSize: 10, marginTop: 2 }}>
                                            Expires: {new Date(cred.token_expires_at).toLocaleString()}
                                        </div>
                                    )}
                                    {cred.last_error && (
                                        <div className="env-cred-error">{cred.last_error}</div>
                                    )}
                                </div>
                                <div className="env-detail-item-actions">
                                    <button className="env-detail-icon-btn" onClick={() => reauthoriseCredential(cred.id)} title="Re-authorise">
                                        <Icon name="arrow-rotate-right" />
                                    </button>
                                    <button className="env-detail-icon-btn env-detail-icon-btn--danger" onClick={() => setConfirmDelete({ type: 'credential', id: cred.id, name: cred.name })}>
                                        <Icon name="trash" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                )}
            </div>

            {confirmDelete && (
                <Modal
                    label={`Delete ${confirmDelete.type === 'property' ? 'Property' : confirmDelete.type === 'secret' ? 'Secret' : 'Credential'}`}
                    footerMessage="This action cannot be undone"
                    visible={true}
                    canDismiss={true}
                    onDismiss={() => setConfirmDelete(null)}
                    actions={[{ label: "Delete", primary: false, variant: 'danger', onClick: handleConfirmDelete }]}
                >
                    Are you sure you want to delete <strong>{confirmDelete.name}</strong>?
                </Modal>
            )}
            </ProtectedRoute>
        </Container>
    );
}
