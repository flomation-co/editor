import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faXmark, faPencil, faCheck } from "@fortawesome/free-solid-svg-icons";
import VariableInput, { type VariableItem } from "~/components/propertyMenu/variableInput";
import "./index.css";

type KeyValuePair = {
    key: string;
    value: string;
};

type KeyValuePropertyProps = {
    nodeId: string;
    name: string;
    label: string;
    value: string;
    variables?: VariableItem[];
    onValueChange?: (property: string, value: any) => void;
};

const KeyValueProperty = (props: KeyValuePropertyProps) => {
    const [pairs, setPairs] = useState<KeyValuePair[]>([]);
    const [editIndex, setEditIndex] = useState<number | null>(null);
    const [editKey, setEditKey] = useState("");
    const [editValue, setEditValue] = useState("");
    const [addingNew, setAddingNew] = useState(false);
    const [newKey, setNewKey] = useState("");
    const [newValue, setNewValue] = useState("");

    useEffect(() => {
        try {
            const parsed = typeof props.value === "string" ? JSON.parse(props.value || "[]") : props.value;
            if (Array.isArray(parsed)) {
                setPairs(parsed);
            }
        } catch {
            setPairs([]);
        }
    }, [props.nodeId]);

    const save = (updated: KeyValuePair[]) => {
        setPairs(updated);
        if (props.onValueChange) {
            props.onValueChange(props.name, JSON.stringify(updated));
        }
    };

    const addPair = () => {
        if (!newKey.trim()) return;
        save([...pairs, { key: newKey.trim(), value: newValue }]);
        setNewKey("");
        setNewValue("");
        setAddingNew(false);
    };

    const removePair = (index: number) => {
        save(pairs.filter((_, i) => i !== index));
    };

    const startEdit = (index: number) => {
        setEditIndex(index);
        setEditKey(pairs[index].key);
        setEditValue(pairs[index].value);
    };

    const saveEdit = () => {
        if (editIndex === null || !editKey.trim()) return;
        const updated = [...pairs];
        updated[editIndex] = { key: editKey.trim(), value: editValue };
        save(updated);
        setEditIndex(null);
    };

    return (
        <div className="property-menu-input-row">
            <div className="property-menu-input-name kv-header">
                <span>{props.label}</span>
                <button className="kv-add-btn" onClick={() => setAddingNew(true)} title="Add variable">
                    <FontAwesomeIcon icon={faPlus} />
                </button>
            </div>

            <div className="kv-list">
                {pairs.map((pair, i) => (
                    <div key={i} className="kv-item">
                        {editIndex === i ? (
                            <div className="kv-edit-row">
                                <div className="kv-variable-wrap">
                                    <VariableInput
                                        nodeId={props.nodeId}
                                        name={`${props.name}_editkey_${i}`}
                                        placeholder="Key"
                                        label=""
                                        value={editKey}
                                        variables={props.variables ?? []}
                                        onValueChange={(_, v) => setEditKey(v)}
                                    />
                                </div>
                                <div className="kv-variable-wrap">
                                    <VariableInput
                                        nodeId={props.nodeId}
                                        name={`${props.name}_edit_${i}`}
                                        placeholder="Value"
                                        label=""
                                        value={editValue}
                                        variables={props.variables ?? []}
                                        onValueChange={(_, v) => setEditValue(v)}
                                    />
                                </div>
                                <button className="kv-icon-btn kv-icon-btn--save" onClick={saveEdit}>
                                    <FontAwesomeIcon icon={faCheck} />
                                </button>
                                <button className="kv-icon-btn" onClick={() => setEditIndex(null)}>
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            </div>
                        ) : (
                            <div className="kv-display-row">
                                <span className="kv-key">{pair.key}</span>
                                <span className="kv-value">{pair.value || <em className="kv-empty">empty</em>}</span>
                                <button className="kv-icon-btn" onClick={() => startEdit(i)} title="Edit">
                                    <FontAwesomeIcon icon={faPencil} />
                                </button>
                                <button className="kv-icon-btn kv-icon-btn--danger" onClick={() => removePair(i)} title="Remove">
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            </div>
                        )}
                    </div>
                ))}

                {addingNew && (
                    <div className="kv-item kv-item--new">
                        <div className="kv-edit-row">
                            <div className="kv-variable-wrap">
                                <VariableInput
                                    nodeId={props.nodeId}
                                    name={`${props.name}_newkey`}
                                    placeholder="Key"
                                    label=""
                                    value={newKey}
                                    variables={props.variables ?? []}
                                    onValueChange={(_, v) => setNewKey(v)}
                                />
                            </div>
                            <div className="kv-variable-wrap">
                                <VariableInput
                                    nodeId={props.nodeId}
                                    name={`${props.name}_new`}
                                    placeholder="Value (supports ${...})"
                                    label=""
                                    value={newValue}
                                    variables={props.variables ?? []}
                                    onValueChange={(_, v) => setNewValue(v)}
                                />
                            </div>
                            <button className="kv-icon-btn kv-icon-btn--save" onClick={addPair}>
                                <FontAwesomeIcon icon={faCheck} />
                            </button>
                            <button className="kv-icon-btn" onClick={() => { setAddingNew(false); setNewKey(""); setNewValue(""); }}>
                                <FontAwesomeIcon icon={faXmark} />
                            </button>
                        </div>
                    </div>
                )}

                {pairs.length === 0 && !addingNew && (
                    <div className="kv-empty-state">No variables defined</div>
                )}
            </div>
        </div>
    );
};

export default KeyValueProperty;
