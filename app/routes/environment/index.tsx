import type {Route} from "../+types/home";
import Container from "~/components/container";
import type {Environment, Property, Secret} from "~/types";
import {useEffect, useState} from "react";
import {Link, useParams, useSearchParams} from "react-router";
import api from "~/lib/api";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import {toast} from "~/components/toast";
import Modal from "~/components/modal";
import "./index.css";
import { Icon } from "~/components/icons/Icon";
import ProtectedRoute from "~/components/protected-route";
import {PERMISSIONS} from "~/types";
import {
    providerCatalogue,
    defaultSelection,
    selectionToScopeString,
    scopesStringToSelection,
    countScopes,
    type ScopeSelection,
} from "./scope-catalogue";
import { ScopeServiceRow } from "./ScopeServiceRow";
import { awsPermissionCatalogue, defaultAwsSelection, awsSelectionToPolicy } from "./aws-permissions";

// Provider scope catalogue has moved to ./scope-catalogue.ts.
// The structured per-service shape lives there along with the
// selection ↔ scope-string helpers.

// A per-tenant OAuth URL variable declared by a provider (e.g. Shopify's shop
// subdomain). Mirrors the api's api.URLVariable Go struct.
interface URLVariable {
    key: string;
    label: string;
    placeholder?: string;
}

// OAuth credential provider as returned by /api/v1/credential/providers.
interface CredentialProvider {
    slug: string;
    name: string;
    icon?: string;
    // configured=false → no platform-level OAuth app exists, so the user
    // supplies their own Client ID/Secret ("bring your own app").
    configured?: boolean;
    url_variables?: URLVariable[];
}

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Environment" },
        { name: "description", content: "Manage environment" },
    ];
}

export default function EnvironmentDetail() {
    const environmentID = useParams().id;
    const [searchParams] = useSearchParams();
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
    const [ providers, setProviders ] = useState<CredentialProvider[]>([]);
    const [ showAddCredential, setShowAddCredential ] = useState(false);
    const [ newCredName, setNewCredName ] = useState("");
    const [ newCredProvider, setNewCredProvider ] = useState("");
    // Per-tenant OAuth URL variable values (e.g. {shop: "my-store"}) for
    // providers that declare url_variables (Shopify and other per-account SaaS).
    const [ newCredUrlVars, setNewCredUrlVars ] = useState<Record<string, string>>({});
    // Bring-your-own OAuth app credentials, used when the provider has no
    // platform-level app configured (e.g. Shopify — each user has their own app).
    const [ newCredClientId, setNewCredClientId ] = useState("");
    const [ newCredClientSecret, setNewCredClientSecret ] = useState("");
    // aws_role provider: a token-less credential (IAM Role ARN + region). After
    // creation the API returns the Flomation-generated External ID + the trust
    // policy to paste into the customer's role — held here to display.
    const [ newCredRoleARN, setNewCredRoleARN ] = useState("");
    const [ newCredRegion, setNewCredRegion ] = useState("");
    const [ awsRoleResult, setAwsRoleResult ] = useState<{ id: string; external_id: string; trust_principal_arn: string; trust_policy: string } | null>(null);
    // Structured per-service selection. Empty until a provider is
    // picked, at which point we hydrate from defaultSelection so
    // every service row has a sensible initial state.
    const [ newCredSelection, setNewCredSelection ] = useState<ScopeSelection>(new Map());
    // Scopes the catalogue doesn't recognise — only populated when
    // an edit-existing-credential flow reverse-parses a saved scope
    // string. Until then, always empty. Preserved on save so we
    // never silently strip legacy/custom scopes.
    const [ newCredOtherScopes, setNewCredOtherScopes ] = useState<Set<string>>(new Set());
    const [ showOtherScopes, setShowOtherScopes ] = useState(false);
    // Per-service accordion expansion state. All rows collapsed by
    // default — users open the one(s) they want to change. Keeps
    // the vertical density tight when scanning providers with many
    // services (Google has 8, Microsoft has 6).
    const [ expandedServices, setExpandedServices ] = useState<Map<string, boolean>>(new Map());

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

    // Deep-link entry from the variable picker's "+ Create new X"
    // button. ?tab=secrets|properties|credentials switches the active
    // tab; ?new=<name> opens the corresponding add form with the
    // name pre-filled. Both params are optional — the page renders
    // its default (properties tab, no form) if neither is present.
    //
    // Runs only on mount of the search params change, NOT on every
    // render — without this guard, clicking "Cancel" on the create
    // form would re-open it as the URL still carries ?new=.
    useEffect(() => {
        const tab = searchParams.get("tab");
        const newName = searchParams.get("new");
        if (tab === "properties" || tab === "secrets" || tab === "credentials") {
            setActiveTab(tab);
        }
        if (newName) {
            if (tab === "properties") {
                setNewPropName(newName);
                setShowAddProperty(true);
            } else if (tab === "secrets") {
                setNewSecretName(newName);
                setShowAddSecret(true);
            } else if (tab === "credentials") {
                setNewCredName(newName);
                setShowAddCredential(true);
            }
        }
        // Dependency array intentionally empty — we want first-mount
        // behaviour only. The user editing the form shouldn't re-trigger
        // open/pre-fill from URL.
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // Update a single service's access level in the selection map.
    // Selections are immutable per React state convention — clone
    // the outer map AND the inner ServiceSelection so React's
    // identity check sees the change.
    //
    // If the picked level declares `implies` (toggle ids that the
    // level's scope semantically subsumes — e.g. Google's
    // gmail.modify already grants send), auto-enable those toggles
    // so the UI reflects the actual granted capability. The auto-
    // tick is one-way: switching away from the implying level does
    // NOT auto-untick the toggle. Users remain free to manually
    // untick afterwards if they don't want the redundant scope
    // string in the OAuth request.
    const handleLevelChange = (serviceId: string, level: string) => {
        setNewCredSelection(prev => {
            const next = new Map(prev);
            const existing = next.get(serviceId) ?? { toggles: new Set<string>() };
            const toggles = new Set(existing.toggles);

            const service = providerCatalogue[newCredProvider]?.find(s => s.id === serviceId);
            const pickedLevel = service?.levels?.find(l => l.value === level);
            for (const toggleId of pickedLevel?.implies || []) {
                toggles.add(toggleId);
            }

            next.set(serviceId, { ...existing, level, toggles });
            return next;
        });
    };

    // Accordion expand/collapse for a single service row.
    const handleExpandToggle = (serviceId: string) => {
        setExpandedServices(prev => {
            const next = new Map(prev);
            next.set(serviceId, !next.get(serviceId));
            return next;
        });
    };

    // Toggle an orthogonal capability checkbox on or off. Independent
    // of the level segment — Gmail's Send is the canonical case.
    const handleToggleChange = (serviceId: string, toggleId: string, enabled: boolean) => {
        setNewCredSelection(prev => {
            const next = new Map(prev);
            const existing = next.get(serviceId) ?? { toggles: new Set<string>() };
            const toggles = new Set(existing.toggles);
            if (enabled) toggles.add(toggleId);
            else toggles.delete(toggleId);
            next.set(serviceId, { ...existing, toggles });
            return next;
        });
    };

    const resetCredentialForm = () => {
        setShowAddCredential(false);
        setNewCredName("");
        setNewCredProvider("");
        setNewCredUrlVars({});
        setNewCredClientId("");
        setNewCredClientSecret("");
        setNewCredRoleARN("");
        setNewCredRegion("");
        setAwsRoleResult(null);
        setNewCredSelection(new Map());
        setNewCredOtherScopes(new Set());
        setShowOtherScopes(false);
        setExpandedServices(new Map());
    };

    // Credential names back environment-variable references like
    // ${credentials.X.access_token}, so we keep them strictly to
    // identifier characters: ASCII letters, digits, dash and
    // underscore. Filter-on-change so a paste of "Company Slack
    // (prod)" becomes "CompanySlackprod" silently rather than
    // producing a validation error to dismiss.
    const sanitiseCredentialName = (raw: string) => raw.replace(/[^a-zA-Z0-9_-]/g, "");

    const credentialNameInvalidReason = (): string | null => {
        if (!newCredName.trim()) return "Enter a name first — letters, digits, dash and underscore only.";
        return null;
    };

    const copyText = (text: string, label: string) => {
        navigator.clipboard?.writeText(text);
        toast.success(label + " copied");
    };

    // Wizard step 2: attach the Role ARN the user built to the credential.
    const finishAWSRole = () => {
        if (!awsRoleResult) return;
        api.put(getUrl('/credential/' + awsRoleResult.id + '/aws-role'), {
            role_arn: newCredRoleARN.trim(),
        }, { headers })
            .then(() => {
                toast.success("AWS Role credential ready");
                resetCredentialForm();
                updateCredentials();
            })
            .catch(err => toast.error(err.response?.data?.error || "Failed to attach role"));
    };

    const saveCredential = () => {
        if (!newCredName.trim() || !newCredProvider) return;

        // aws_role: token-less. POST the Role ARN + region; the API generates the
        // External ID and returns the trust policy. Keep the form open and show
        // the result so the user can paste it into their AWS role.
        if (newCredProvider === 'aws_role') {
            // Wizard step 1: mint Flomation's dedicated identity (no role ARN yet).
            api.post(getUrl('/credential'), {
                provider_slug: 'aws_role',
                name: newCredName.trim(),
                region: newCredRegion.trim(),
            }, { headers })
                .then(r => {
                    setAwsRoleResult({
                        id: r?.data?.id || "",
                        external_id: r?.data?.external_id || "",
                        trust_principal_arn: r?.data?.trust_principal_arn || "",
                        trust_policy: r?.data?.trust_policy || "",
                    });
                    toast.success("Flomation identity created — now build your AWS role");
                    updateCredentials();
                })
                .catch(err => toast.error(err.response?.data?.error || "Failed to create credential"));
            return;
        }

        const scopeStr = selectionToScopeString(newCredProvider, newCredSelection, newCredOtherScopes);
        const body: any = { provider_slug: newCredProvider, name: newCredName };
        if (scopeStr) body.scopes = scopeStr;
        if (Object.keys(newCredUrlVars).length > 0) {
            // Trim on save too — onBlur normally trims, but guarantee no stray
            // whitespace reaches the API if the field is never blurred.
            body.url_vars = Object.fromEntries(
                Object.entries(newCredUrlVars).map(([k, val]) => [k, val.trim()])
            );
        }
        if (newCredClientId.trim()) body.client_id = newCredClientId.trim();
        if (newCredClientSecret.trim()) body.client_secret = newCredClientSecret.trim();

        api.post(getUrl('/credential'), body, { headers })
            .then(r => {
                resetCredentialForm();
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
                                            className="env-cred-provider-option"
                                            onClick={() => {
                                                setNewCredProvider(p.slug);
                                                setNewCredSelection(p.slug === 'aws_role' ? defaultAwsSelection() : defaultSelection(p.slug));
                                                setNewCredOtherScopes(new Set());
                                            }}
                                        >
                                            <Icon name={p.icon || 'link'} />
                                            <span>{p.name}</span>
                                            {/* Not platform-configured → the user supplies their own
                                                OAuth app's Client ID/Secret in the form below. */}
                                            {!p.configured && <span className="env-cred-provider-unconfigured">Bring your own app</span>}
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
                            <input
                                type="text"
                                placeholder="Credential name (e.g. company_linkedin)"
                                autoFocus
                                value={newCredName}
                                onChange={e => setNewCredName(sanitiseCredentialName(e.target.value))}
                                // `-` is placed at the START of the character class so it's
                                // guaranteed literal — Chrome enforces the ECMAScript `v` flag
                                // for HTML5 pattern regex, which treats a trailing `-` inside a
                                // class as an unfinished range operator and throws
                                // "Invalid regular expression: Invalid character in character class".
                                pattern="[-A-Za-z0-9_]+"
                                title="Letters, digits, dash and underscore only — no spaces or symbols."
                            />
                            <div className="env-detail-input-hint">
                                Letters, digits, <code>-</code> and <code>_</code> only.
                                Used in <code>{"${credentials.<name>}"}</code> references.
                            </div>
                            {/* AWS Role: token-less. Paste the Role ARN + region; on Create the
                                API returns the External ID + trust policy to attach to the role. */}
                            {newCredProvider === 'aws_role' && !awsRoleResult && (
                                <>
                                    <div className="env-cred-aws-step">Step 1 of 2 — Configure the credential</div>
                                    <input
                                        type="text"
                                        placeholder="Default region (optional, e.g. eu-west-2)"
                                        value={newCredRegion}
                                        onChange={e => setNewCredRegion(e.target.value)}
                                        onBlur={e => setNewCredRegion(e.target.value.trim())}
                                    />
                                    <div className="env-detail-input-hint" style={{ marginTop: 6 }}>
                                        Choose the permissions this role should grant — Flomation generates a least-privilege IAM policy to attach in step 2. Clicking Create mints this credential's dedicated Flomation identity.
                                    </div>
                                    <div className="scope-picker">
                                        {awsPermissionCatalogue.map(svc => (
                                            <ScopeServiceRow
                                                key={svc.id}
                                                service={svc}
                                                selection={newCredSelection.get(svc.id)}
                                                expanded={expandedServices.get(svc.id) ?? false}
                                                onExpandToggle={handleExpandToggle}
                                                onLevelChange={handleLevelChange}
                                                onToggleChange={handleToggleChange}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                            {newCredProvider === 'aws_role' && awsRoleResult && (
                                <div className="env-cred-aws-result">
                                    <div className="env-cred-aws-result-title">
                                        <Icon name="check" /> Step 2 of 2 — Build your AWS role
                                    </div>
                                    <ol className="env-cred-aws-steps">
                                        <li>
                                            In the AWS IAM console, <strong>create a role</strong> — trusted entity type <em>Custom trust policy</em>. Name it anything you like.
                                        </li>
                                        <li>
                                            Paste this as the role's <strong>trust policy</strong>:
                                            <pre className="env-cred-trust-policy">{awsRoleResult.trust_policy}</pre>
                                            <button type="button" className="env-cred-copy-btn" onClick={() => copyText(awsRoleResult.trust_policy, "Trust policy")}>
                                                <Icon name="check" /> Copy trust policy
                                            </button>
                                            <div className="env-cred-aws-chips">
                                                <div className="env-cred-aws-chip">
                                                    <span className="env-cred-aws-chip-label">Flomation principal</span>
                                                    <code>{awsRoleResult.trust_principal_arn}</code>
                                                    <button type="button" className="env-cred-copy-btn env-cred-copy-btn--sm" onClick={() => copyText(awsRoleResult.trust_principal_arn, "Principal ARN")}>Copy</button>
                                                </div>
                                                <div className="env-cred-aws-chip">
                                                    <span className="env-cred-aws-chip-label">External ID</span>
                                                    <code>{awsRoleResult.external_id}</code>
                                                    <button type="button" className="env-cred-copy-btn env-cred-copy-btn--sm" onClick={() => copyText(awsRoleResult.external_id, "External ID")}>Copy</button>
                                                </div>
                                            </div>
                                        </li>
                                        <li>
                                            {(() => {
                                                const policy = awsSelectionToPolicy(newCredSelection);
                                                return policy ? (
                                                    <>
                                                        Attach this <strong>permissions policy</strong> — generated from the access levels you chose:
                                                        <pre className="env-cred-trust-policy">{policy}</pre>
                                                        <button type="button" className="env-cred-copy-btn" onClick={() => copyText(policy, "Permissions policy")}>
                                                            <Icon name="check" /> Copy permissions policy
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className="env-cred-aws-warn">No permissions were selected in step 1 — the role would be able to assume but do nothing.</div>
                                                );
                                            })()}
                                        </li>
                                        <li>
                                            Paste the <strong>Role ARN</strong> of the role you just created, then click Finish:
                                            <input
                                                type="text"
                                                placeholder="arn:aws:iam::<account>:role/<name>"
                                                value={newCredRoleARN}
                                                onChange={e => setNewCredRoleARN(e.target.value)}
                                                onBlur={e => setNewCredRoleARN(e.target.value.trim())}
                                            />
                                        </li>
                                    </ol>
                                </div>
                            )}
                            {/* Per-tenant URL variables (e.g. Shopify shop subdomain) */}
                            {(providers.find(p => p.slug === newCredProvider)?.url_variables ?? []).map(v => (
                                <div key={v.key} className="env-detail-url-var">
                                    <input
                                        type="text"
                                        placeholder={v.placeholder || v.label}
                                        value={newCredUrlVars[v.key] ?? ""}
                                        // Store keystrokes verbatim and trim on blur (not on every
                                        // keystroke) so a value with an internal hyphen can be typed
                                        // without the next character stripping the trailing one —
                                        // consistent with the Client ID/Secret inputs, which trim on save.
                                        onChange={e => setNewCredUrlVars(prev => ({ ...prev, [v.key]: e.target.value }))}
                                        onBlur={e => setNewCredUrlVars(prev => ({ ...prev, [v.key]: e.target.value.trim() }))}
                                    />
                                    <div className="env-detail-input-hint">{v.label}</div>
                                </div>
                            ))}
                            {/* Bring-your-own OAuth app: shown when the provider has no
                                platform-level app configured (e.g. Shopify). Never for aws_role. */}
                            {newCredProvider !== 'aws_role' && !providers.find(p => p.slug === newCredProvider)?.configured && (
                                <>
                                    <input
                                        type="text"
                                        placeholder="Client ID (API key)"
                                        value={newCredClientId}
                                        onChange={e => setNewCredClientId(e.target.value)}
                                    />
                                    <input
                                        type="password"
                                        placeholder="Client Secret (API secret key)"
                                        value={newCredClientSecret}
                                        onChange={e => setNewCredClientSecret(e.target.value)}
                                    />
                                    <div className="env-detail-input-hint">
                                        From your OAuth app. Add this API's <code>/api/v1/credential/callback</code> as an allowed redirect URL in the app.
                                    </div>
                                </>
                            )}
                            {providerCatalogue[newCredProvider] && (
                                <div className="scope-picker">
                                    {providerCatalogue[newCredProvider].map(svc => (
                                        <ScopeServiceRow
                                            key={svc.id}
                                            service={svc}
                                            selection={newCredSelection.get(svc.id)}
                                            expanded={expandedServices.get(svc.id) ?? false}
                                            onExpandToggle={handleExpandToggle}
                                            onLevelChange={handleLevelChange}
                                            onToggleChange={handleToggleChange}
                                        />
                                    ))}

                                    {newCredOtherScopes.size > 0 && (
                                        <div className="scope-row scope-row--other">
                                            <button
                                                type="button"
                                                className="scope-other-toggle"
                                                onClick={() => setShowOtherScopes(s => !s)}
                                                aria-expanded={showOtherScopes}
                                            >
                                                <Icon name={showOtherScopes ? "chevron-down" : "chevron-right"} />
                                                <span>Other scopes ({newCredOtherScopes.size})</span>
                                                <span className="scope-other-hint">— legacy or custom values; preserved on save.</span>
                                            </button>
                                            {showOtherScopes && (
                                                <div className="scope-other-list">
                                                    {Array.from(newCredOtherScopes).sort().map(s => (
                                                        <code key={s} className="scope-other-item">{s}</code>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="scope-picker-footer">
                                        <Icon name="arrow-up-right-from-square" />
                                        <span>
                                            Create &amp; authorise sends you to {providers.find(p => p.slug === newCredProvider)?.name || newCredProvider} to approve these {countScopes(newCredProvider, newCredSelection, newCredOtherScopes)} scopes.
                                        </span>
                                    </div>
                                </div>
                            )}
                            <div className="env-detail-add-actions">
                                {(() => {
                                    const selProvider = providers.find(p => p.slug === newCredProvider);
                                    // aws_role: once created, the primary action becomes Done (the
                                    // trust policy is shown for copying). Before that, require a
                                    // valid Role ARN.
                                    if (newCredProvider === 'aws_role') {
                                        if (awsRoleResult) {
                                            // Step 2: attach the role ARN the user built.
                                            const arn = newCredRoleARN.trim();
                                            const ok = arn.startsWith("arn:aws:iam::") && arn.includes(":role/");
                                            return (
                                                <button
                                                    className="env-detail-btn-save"
                                                    onClick={finishAWSRole}
                                                    disabled={!ok}
                                                    title={ok ? undefined : "Paste the Role ARN you created first."}
                                                >
                                                    <Icon name="check" /> Finish
                                                </button>
                                            );
                                        }
                                        // Step 1: mint the Flomation identity (name only).
                                        const invalidReason = credentialNameInvalidReason();
                                        return (
                                            <button
                                                className="env-detail-btn-save"
                                                onClick={saveCredential}
                                                disabled={!!invalidReason}
                                                title={invalidReason || undefined}
                                            >
                                                <Icon name="check" /> Create Flomation identity
                                            </button>
                                        );
                                    }
                                    const missingVar = (selProvider?.url_variables ?? [])
                                        .find(v => !(newCredUrlVars[v.key] ?? "").trim());
                                    const needsClient = !selProvider?.configured;
                                    const invalidReason = credentialNameInvalidReason()
                                        || (missingVar ? `Enter the ${missingVar.label} first.` : "")
                                        || (needsClient && !newCredClientId.trim() ? "Enter the Client ID first." : "")
                                        || (needsClient && !newCredClientSecret.trim() ? "Enter the Client Secret first." : "");
                                    return (
                                        <button
                                            className="env-detail-btn-save"
                                            onClick={saveCredential}
                                            disabled={!!invalidReason}
                                            title={invalidReason || undefined}
                                        >
                                            <Icon name="check" /> Create &amp; Authorise
                                        </button>
                                    );
                                })()}
                                <button className="env-detail-btn-cancel" onClick={resetCredentialForm}>Cancel</button>
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
