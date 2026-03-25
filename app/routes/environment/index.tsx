import type {Route} from "../+types/home";
import Container from "~/components/container";
import type {Environment, Property, Secret} from "~/types";
import {useEffect, useState} from "react";
import {Link, useParams} from "react-router";
import api from "~/lib/api";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faPencil, faTrash, faArrowLeft, faKey, faCubes} from "@fortawesome/free-solid-svg-icons";
import {faCancel, faCheck, faPlus} from "@fortawesome/pro-solid-svg-icons";
import {toast} from "react-toastify";
import Modal from "~/components/modal";
import "./index.css";

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

    const [ confirmDelete, setConfirmDelete ] = useState<{ type: 'property' | 'secret', id: string, name: string } | null>(null);

    const getUrl = (path: string) => {
        const config = useConfig();
        return config("AUTOMATE_API_URL") + '/api/v1/environment/' + environmentID + path;
    };

    const headers = { Authorization: "Bearer " + token };

    useEffect(() => {
        api.get(getUrl(''), { signal: controller.signal, headers }).then(r => { if (r) setEnvironment(r.data); }).catch(console.error);
        updateProperties();
        updateSecrets();
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

    const handleConfirmDelete = () => {
        if (!confirmDelete) return;
        if (confirmDelete.type === 'property') deleteProperty(confirmDelete.id);
        else deleteSecret(confirmDelete.id);
        setConfirmDelete(null);
    };

    return (
        <Container>
            <div className={"header"}>{environment?.name || "Environment"}</div>
            <div className="env-detail-back">
                <Link to="/environment" className="env-detail-back-link">
                    <FontAwesomeIcon icon={faArrowLeft} /> All Environments
                </Link>
            </div>

            <div className="env-detail-page">
                {/* Properties */}
                <div className="env-detail-card">
                    <div className="env-detail-card-header">
                        <div className="env-detail-section-label">
                            <FontAwesomeIcon icon={faCubes} className="env-detail-section-icon" /> Properties
                        </div>
                        {!showAddProperty && (
                            <button className="env-detail-add-btn" onClick={() => setShowAddProperty(true)}>
                                <FontAwesomeIcon icon={faPlus} /> Add
                            </button>
                        )}
                    </div>

                    {showAddProperty && (
                        <div className="env-detail-add-form">
                            <input type="text" placeholder="Name" autoFocus value={newPropName} onChange={e => setNewPropName(e.target.value)} />
                            <textarea placeholder="Value" rows={2} value={newPropValue} onChange={e => setNewPropValue(e.target.value)} />
                            <div className="env-detail-add-actions">
                                <button className="env-detail-btn-save" onClick={saveProperty} disabled={!newPropName.trim()}><FontAwesomeIcon icon={faCheck} /> Save</button>
                                <button className="env-detail-btn-cancel" onClick={() => setShowAddProperty(false)}>Cancel</button>
                            </div>
                        </div>
                    )}

                    {(!properties || properties.length === 0) && !showAddProperty && (
                        <div className="env-detail-empty">No properties</div>
                    )}

                    <div className="env-detail-items">
                        {properties?.map(prop => {
                            const isEditing = editingPropertyID === prop.id;
                            return (
                                <div key={prop.id} className="env-detail-item">
                                    {isEditing ? (
                                        <div className="env-detail-edit-form">
                                            <input type="text" value={editingPropertyName} onChange={e => setEditingPropertyName(e.target.value)} />
                                            <textarea rows={2} value={editingPropertyValue} onChange={e => setEditingPropertyValue(e.target.value)} autoFocus />
                                            <div className="env-detail-add-actions">
                                                <button className="env-detail-btn-save" onClick={saveEditProperty}><FontAwesomeIcon icon={faCheck} /> Save</button>
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
                                                    <FontAwesomeIcon icon={faPencil} />
                                                </button>
                                                <button className="env-detail-icon-btn env-detail-icon-btn--danger" onClick={() => setConfirmDelete({ type: 'property', id: prop.id, name: prop.name })}>
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Secrets */}
                <div className="env-detail-card">
                    <div className="env-detail-card-header">
                        <div className="env-detail-section-label">
                            <FontAwesomeIcon icon={faKey} className="env-detail-section-icon" /> Secrets
                        </div>
                        {!showAddSecret && (
                            <button className="env-detail-add-btn" onClick={() => setShowAddSecret(true)}>
                                <FontAwesomeIcon icon={faPlus} /> Add
                            </button>
                        )}
                    </div>

                    {showAddSecret && (
                        <div className="env-detail-add-form">
                            <input type="text" placeholder="Name" autoFocus value={newSecretName} onChange={e => setNewSecretName(e.target.value)} />
                            <textarea placeholder="Value (will be encrypted)" rows={2} value={newSecretValue} onChange={e => setNewSecretValue(e.target.value)} />
                            <div className="env-detail-add-actions">
                                <button className="env-detail-btn-save" onClick={saveSecret} disabled={!newSecretName.trim()}><FontAwesomeIcon icon={faCheck} /> Save</button>
                                <button className="env-detail-btn-cancel" onClick={() => setShowAddSecret(false)}>Cancel</button>
                            </div>
                        </div>
                    )}

                    {(!secrets || secrets.length === 0) && !showAddSecret && (
                        <div className="env-detail-empty">No secrets</div>
                    )}

                    <div className="env-detail-items">
                        {secrets?.map(secret => {
                            const isEditing = editingSecretID === secret.id;
                            return (
                                <div key={secret.id} className="env-detail-item">
                                    {isEditing ? (
                                        <div className="env-detail-edit-form">
                                            <div className="env-detail-item-name" style={{ marginBottom: 8 }}>{secret.name}</div>
                                            <textarea placeholder="Enter new secret value..." rows={2} value={editingSecretValue} onChange={e => setEditingSecretValue(e.target.value)} autoFocus />
                                            <div className="env-detail-add-actions">
                                                <button className="env-detail-btn-save" onClick={saveEditSecret}><FontAwesomeIcon icon={faCheck} /> Save</button>
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
                                                    <FontAwesomeIcon icon={faPencil} />
                                                </button>
                                                <button className="env-detail-icon-btn env-detail-icon-btn--danger" onClick={() => setConfirmDelete({ type: 'secret', id: secret.id, name: secret.name })}>
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {confirmDelete && (
                <Modal
                    label={`Delete ${confirmDelete.type === 'property' ? 'Property' : 'Secret'}`}
                    footerMessage="This action cannot be undone"
                    visible={true}
                    canDismiss={true}
                    onDismiss={() => setConfirmDelete(null)}
                    actions={[{ label: "Delete", primary: false, variant: 'danger', onClick: handleConfirmDelete }]}
                >
                    Are you sure you want to delete <strong>{confirmDelete.name}</strong>?
                </Modal>
            )}
        </Container>
    );
}
