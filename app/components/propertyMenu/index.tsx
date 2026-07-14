import "./index.css"

import React, {useEffect, useState, useCallback} from "react";
import type {NodeDefinition, Trigger} from "~/types";
import type {VariableItem} from "~/components/propertyMenu/variableInput";
import TextProperty from "~/components/propertyMenu/textProperty";
import StringProperty from "~/components/propertyMenu/stringProperty";
import CredentialProperty from "~/components/propertyMenu/credentialProperty";
import QRProperty from "~/components/propertyMenu/qrProperty";
import TriggerURLProperty from "~/components/propertyMenu/triggerURLProperty";
import FormBuilder from "~/components/propertyMenu/formBuilder";
import KeyValueProperty from "~/components/propertyMenu/keyValueProperty";
import RowsProperty from "~/components/propertyMenu/rowsProperty";
import BooleanProperty from "~/components/propertyMenu/booleanProperty";
import NumberProperty from "~/components/propertyMenu/numberProperty";
import MoneyProperty from "~/components/propertyMenu/moneyProperty";
import SelectProperty from "~/components/propertyMenu/selectProperty";
import DynamicSelectProperty from "~/components/propertyMenu/dynamicSelectProperty";
import GoogleAccountsProperty from "~/components/propertyMenu/googleAccountsProperty";
import FlowSelectProperty from "~/components/propertyMenu/flowSelectProperty";
import WebhookSecretProperty from "~/components/propertyMenu/webhookSecretProperty";
import FacebookPageProperty from "~/components/propertyMenu/facebookPageProperty";
import VoiceSelectorProperty from "~/components/propertyMenu/voiceSelectorProperty";
import ModelSelectorProperty from "~/components/propertyMenu/modelSelectorProperty";
import DateTimeProperty from "~/components/propertyMenu/dateTimeProperty";
import MultiSelectProperty from "~/components/propertyMenu/multiSelectProperty";
import FieldSourceMapProperty from "~/components/propertyMenu/fieldSourceMapProperty";
import "~/components/propertyMenu/multiSelectProperty/index.css";
import "~/components/propertyMenu/selectProperty/index.css";
import { Icon } from "~/components/icons/Icon";

type PropertyMenuProps = {
    node: object;
    variables?: VariableItem[];
    triggers?: Trigger[];
    environmentId?: string;
    // Freshly-fetched action definitions keyed by action id. Node configs
    // are snapshotted into flow revisions at add time, so serve-time-only
    // metadata (dynamic_options) must be resolved from here, not from the
    // saved node config — otherwise nodes added before a feature shipped
    // would never pick it up.
    actionDefinitions?: Record<string, any> | null;
    onValueChange?: (node_id: string, property: string, value: any) => void;
    onNameChange?: (node_id: string, value: any) => void;
    onDismiss?: () => void;
    onNodeDelete?: (node_id: string) => void;
    expanded?: boolean;
    onToggleExpand?: () => void;
}

const INPUT_TYPES = [
    {value: "string", label: "Text"},
    {value: "integer", label: "Number"},
    {value: "boolean", label: "Checkbox"},
    {value: "text", label: "Multiline Text"},
    {value: "date", label: "Date"},
    {value: "dropdown", label: "Dropdown"},
];

// slugifyOptionValue turns a display label into a machine-safe value —
// used to prefill a dropdown option's value while the author is only
// editing its label (mirrors the helper in formBuilder).
function slugifyOptionValue(label: string): string {
    return label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

// languageFromNodeLabel picks the Prism grammar identifier for a
// code-typed input based on the owning action's label. Centralised
// here so adding a new ConnectionTypeCode-using action (e.g. SQL
// query, YAML config) is one line — drop in the mapping and the
// editor automatically highlights its code field.
//
// Future-proofing: when we eventually add a Language field on
// Connection itself (per the recommended migration in the design),
// the call-site here will be replaced with a direct read of that
// field. Keeping the helper small and obvious makes that swap a
// one-line change rather than a refactor.
const NODE_LABEL_LANGUAGE: Record<string, string> = {
    "script/python": "python",
    "script/javascript": "javascript",
    "script/bash": "bash",
};

function languageFromNodeLabel(label?: string): string | undefined {
    if (!label) return undefined;
    return NODE_LABEL_LANGUAGE[label];
}

function TriggerInputsBuilder({nodeId, inputs, onInputsChange}: {nodeId: string; inputs: any[]; onInputsChange: (inputs: any[]) => void}) {
    // Local state so changes render immediately without waiting for parent re-render
    const [localInputs, setLocalInputs] = useState<any[]>(inputs || []);

    // Sync from props when the node changes
    useEffect(() => {
        setLocalInputs(inputs || []);
    }, [nodeId]);

    const commit = (updated: any[]) => {
        setLocalInputs(updated);
        onInputsChange(updated);
    };

    const addInput = () => {
        commit([...localInputs, {name: "", label: "", type: "string", required: false, placeholder: "", value: ""}]);
    };

    const removeInput = (idx: number) => {
        commit(localInputs.filter((_, i) => i !== idx));
    };

    const updateInput = (idx: number, field: string, value: any) => {
        commit(localInputs.map((inp, i) => {
            if (i !== idx) return inp;
            const updated = {...inp, [field]: value};
            // Seed a starter option when switching to dropdown so the
            // sub-editor renders something to edit rather than an empty state.
            if (field === "type" && value === "dropdown" && (!inp.options || inp.options.length === 0)) {
                updated.options = [{label: "Option 1", value: "option_1"}];
            }
            return updated;
        }));
    };

    const getOptions = (inp: any): any[] => Array.isArray(inp.options) ? inp.options : [];

    const addOption = (idx: number) => {
        commit(localInputs.map((inp, i) => {
            if (i !== idx) return inp;
            const existing = getOptions(inp);
            const n = existing.length + 1;
            return {...inp, options: [...existing, {label: `Option ${n}`, value: `option_${n}`}]};
        }));
    };

    const updateOption = (idx: number, optIdx: number, patch: any) => {
        commit(localInputs.map((inp, i) => {
            if (i !== idx) return inp;
            return {...inp, options: getOptions(inp).map((o, oi) => oi === optIdx ? {...o, ...patch} : o)};
        }));
    };

    const removeOption = (idx: number, optIdx: number) => {
        commit(localInputs.map((inp, i) => {
            if (i !== idx) return inp;
            return {...inp, options: getOptions(inp).filter((_, oi) => oi !== optIdx)};
        }));
    };

    const moveOption = (idx: number, optIdx: number, direction: -1 | 1) => {
        commit(localInputs.map((inp, i) => {
            if (i !== idx) return inp;
            const opts = [...getOptions(inp)];
            const target = optIdx + direction;
            if (target < 0 || target >= opts.length) return inp;
            [opts[optIdx], opts[target]] = [opts[target], opts[optIdx]];
            return {...inp, options: opts};
        }));
    };

    return (
        <div className="trigger-inputs-builder">
            <div className="trigger-inputs-header">
                <span className="trigger-inputs-title">Trigger Inputs</span>
                <button type="button" className="trigger-inputs-add-btn" onClick={addInput}>
                    <Icon name="plus" /> Add Input
                </button>
            </div>
            <div className="trigger-inputs-hint">
                Define inputs that are required when this flow is triggered. These are available downstream as outputs.
            </div>
            {localInputs.map((inp, idx) => (
                <div key={idx} className="trigger-input-def">
                    <div className="trigger-input-def-row">
                        <input
                            className="trigger-input-def-field"
                            value={inp.name || ""}
                            onChange={(e) => updateInput(idx, "name", e.target.value.replace(/\s+/g, "_").toLowerCase())}
                            placeholder="field_name"
                        />
                        <select
                            className="trigger-input-def-select"
                            value={inp.type || "string"}
                            onChange={(e) => updateInput(idx, "type", e.target.value)}
                        >
                            {INPUT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <button type="button" className="trigger-input-def-remove" onClick={() => removeInput(idx)}>
                            <Icon name="trash" />
                        </button>
                    </div>
                    <div className="trigger-input-def-row">
                        <input
                            className="trigger-input-def-field"
                            value={inp.label || ""}
                            onChange={(e) => updateInput(idx, "label", e.target.value)}
                            placeholder="Display Label"
                        />
                        <input
                            className="trigger-input-def-field"
                            value={inp.placeholder || ""}
                            onChange={(e) => updateInput(idx, "placeholder", e.target.value)}
                            placeholder="Placeholder"
                        />
                    </div>
                    <div className="trigger-input-def-row">
                        <input
                            className="trigger-input-def-field"
                            value={inp.value || ""}
                            onChange={(e) => updateInput(idx, "value", e.target.value)}
                            placeholder="Default value"
                        />
                        <label className="trigger-input-def-required">
                            <input
                                type="checkbox"
                                checked={inp.required || false}
                                onChange={(e) => updateInput(idx, "required", e.target.checked)}
                            />
                            Required
                        </label>
                    </div>
                    {inp.type === "dropdown" && (
                        <div className="trigger-input-options">
                            <span className="trigger-input-options-label">Options</span>
                            {getOptions(inp).map((opt, optIdx) => {
                                // Auto-track slug when the value hasn't been hand-edited
                                // off the current slug (empty value tracks too).
                                const valueTracksLabel = !opt.value || opt.value === slugifyOptionValue(opt.label || "");
                                return (
                                    <div key={optIdx} className="trigger-input-option-row">
                                        <input
                                            className="trigger-input-def-field"
                                            value={opt.label || ""}
                                            placeholder="Option label"
                                            onChange={(e) => {
                                                const newLabel = e.target.value;
                                                const nextValue = valueTracksLabel ? slugifyOptionValue(newLabel) : opt.value;
                                                updateOption(idx, optIdx, {label: newLabel, value: nextValue});
                                            }}
                                        />
                                        <input
                                            className="trigger-input-def-field"
                                            value={opt.value || ""}
                                            placeholder="option_value"
                                            onChange={(e) => updateOption(idx, optIdx, {value: e.target.value})}
                                        />
                                        <div className="trigger-input-option-actions">
                                            <button type="button" className="trigger-input-def-remove trigger-input-option-move" onClick={() => moveOption(idx, optIdx, -1)} disabled={optIdx === 0} title="Move up">
                                                <Icon name="chevron-up" />
                                            </button>
                                            <button type="button" className="trigger-input-def-remove trigger-input-option-move" onClick={() => moveOption(idx, optIdx, 1)} disabled={optIdx === getOptions(inp).length - 1} title="Move down">
                                                <Icon name="chevron-down" />
                                            </button>
                                            <button type="button" className="trigger-input-def-remove" onClick={() => removeOption(idx, optIdx)} disabled={getOptions(inp).length <= 1} title="Remove option">
                                                <Icon name="trash" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                            <button type="button" className="trigger-inputs-add-btn" onClick={() => addOption(idx)}>
                                <Icon name="plus" /> Add Option
                            </button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

const PropertyMenu = (props: PropertyMenuProps) => {
    const [ loading, setLoading ] = useState<boolean>(false);
    const [ name, setName ] = useState<string>(props.node && props.node.data && props.node.data.config && props.node.data.config.label ? props.node.data.config.label : "");
    const [ showHelp, setShowHelp ] = useState<boolean>(false);
    const [ localValues, setLocalValues ] = useState<Record<string, any>>({});

    const onValueChange = (property: string, value: any) => {
        setLocalValues(prev => ({ ...prev, [property]: value }));
        if (props.onValueChange) {
            props.onValueChange(props.node.data.id, property, value);
        }
    }

    // Reset local values when node changes
    React.useEffect(() => {
        setLocalValues({});
    }, [props.node?.data?.id]);

    const handleDismiss = () => {
        if (props.onDismiss) {
            props.onDismiss();
        }
    }

    useEffect(() => {
        if (props.node && props.node.data) {
            if (props.onNameChange) {
                props.onNameChange(props.node.data.id, name);
            }
        }
    }, [ name ]);

    useEffect(() => {
        if (!!(props.node && props.node.data && props.node.data.config && props.node.data.config.label)) {
            if (!!props.node.data.config.label) {
                setName(props.node.data.config.label);
            } else {
                setName('');
            }
        } else {
            setName('');
        }
    }, [ props.node?.id ]);

    return (
        <>
            {loading && (
                <></>
            )}

            {!loading && (
                <div className={"property-menu"} onClick={(e) => e.stopPropagation()}>
                    {props.node && props.node.data && props.node.data.config && (
                        <>
                            <div className={"property-menu-header"}>
                                <div className={"property-menu-header-title"}>
                                    {props.node.data.config.name}
                                </div>
                                {props.onToggleExpand && (
                                    <button className={"property-menu-close"} onClick={props.onToggleExpand} style={{ marginRight: 4 }}>
                                        <Icon name={props.expanded ? "compress" : "expand"} />
                                    </button>
                                )}
                                <button className={"property-menu-close"} onClick={handleDismiss}>
                                    <Icon name={"xmark"} />
                                </button>
                            </div>

                            {showHelp && (
                                <div className={"property-menu-help"}>
                                    {props.node.data.config.description && (
                                        <div className={"property-menu-help-desc"}>{props.node.data.config.description}</div>
                                    )}
                                    {props.node.data.config.inputs?.length > 0 && (
                                        <div className={"property-menu-help-section"}>
                                            <div className={"property-menu-help-label"}>Inputs</div>
                                            {props.node.data.config.inputs.map((i: any) => (
                                                <div key={i.name} className={"property-menu-help-item"}>
                                                    <span className={"property-menu-help-name"}>{i.name}</span>
                                                    <span className={"property-menu-help-type"}>{i.type}</span>
                                                    {i.required && <span className={"property-menu-help-required"}>required</span>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {props.node.data.config.outputs?.length > 0 && (
                                        <div className={"property-menu-help-section"}>
                                            <div className={"property-menu-help-label"}>Outputs</div>
                                            {props.node.data.config.outputs.map((o: any) => (
                                                <div key={o.name} className={"property-menu-help-item"}>
                                                    <span className={"property-menu-help-name"}>{o.name}</span>
                                                    <span className={"property-menu-help-type"}>{o.type}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {props.node.data.config.author && (
                                        <div className={"property-menu-help-author"}>By {props.node.data.config.author}</div>
                                    )}
                                </div>
                            )}

                            <div className={"property-menu-content"}>
                                <div className={"property-menu-input-row"} >
                                    <div className={"property-menu-input-name"} >Name</div>
                                    <input placeholder={"Name"} type={"text"} value={name} onChange={(e) => {
                                        console.log('name change', e.target.value);
                                        setName(e.target.value);
                                    }}/>
                                </div>
                                {/* Web Trigger: what's available to the flow + the trust warning */}
                                {(props.node.data.label === "trigger/web" || props.node.type === "trigger/web") && (
                                    <div className="property-menu-note property-menu-note--web-trigger">
                                        <div className="property-menu-note-title">Available in this flow</div>
                                        <p>
                                            <code>{"${method}"}</code>, your declared request fields (e.g.{" "}
                                            <code>{"${id}"}</code>), <code>{"${raw_body}"}</code>,{" "}
                                            <code>{"${history}"}</code> (when history is on), and the signed-in caller as{" "}
                                            <code>{"${user.name}"}</code> / <code>{"${user.email}"}</code>.
                                        </p>
                                        <p className="property-menu-note-warn">
                                            Treat <code>{"${history}"}</code> and request inputs as untrusted user input —
                                            never gate a privileged action on them, and don't mutate data on a{" "}
                                            <code>GET</code>. Use <code>{"${user.X}"}</code> for anything that must be trusted.
                                        </p>
                                    </div>
                                )}
                                {/* Dynamic trigger inputs builder for manual triggers */}
                                {(props.node.data.label === "trigger/manual" || props.node.type === "trigger/manual") && (
                                    <>
                                        <TriggerInputsBuilder
                                            nodeId={props.node.data.id}
                                            inputs={props.node.data.config.trigger_inputs || []}
                                            onInputsChange={(inputs) => {
                                                if (props.onValueChange) {
                                                    props.onValueChange(props.node.data.id, "__trigger_inputs__", inputs);
                                                }
                                            }}
                                        />
                                        <div className={"property-menu-input-row"}>
                                            <div className={"property-menu-input-name"}>Run token</div>
                                            <input
                                                type={"text"}
                                                placeholder={"Optional bearer token"}
                                                value={localValues["__run_token__"] ?? props.node.data.config.run_token ?? ""}
                                                onChange={(e) => onValueChange("__run_token__", e.target.value)}
                                            />
                                            <div className={"property-menu-input-hint"}>
                                                Optional bearer token required to run this trigger via its URL; may be a ${"{secrets.X}"} reference
                                            </div>
                                        </div>
                                    </>
                                )}

                                {props.node.data.config.inputs && (
                                    props.node.data.config.inputs.map(i => {
                                        // Conditional visibility via visible_when
                                        if (i.visible_when) {
                                            const refInput = props.node.data.config.inputs.find((x: any) => x.name === i.visible_when.field);
                                            // String() so boolean checkbox values ("true"/"false") can match
                                            const refValue = String(localValues[i.visible_when.field] ?? refInput?.value ?? '');
                                            if (!i.visible_when.values.includes(refValue)) return null;
                                        }

                                        // QuickBooks `sandbox` is a system-managed field: it's
                                        // auto-filled from the credential metadata (driven by the app's
                                        // OAuth config) and must not be exposed as a user toggle. Hide it
                                        // on QuickBooks auth actions (identified by credential + company
                                        // siblings) so the environment is chosen behind the scenes.
                                        if (i.name === "sandbox"
                                            && props.node.data.config.inputs.some((x: any) => x.name === "credential")
                                            && props.node.data.config.inputs.some((x: any) => x.name === "company")) {
                                            return null;
                                        }

                                        // Inputs marked dynamic_options fetch their choices from the
                                        // api at edit time; static options remain the fallback. The
                                        // marker is resolved from the freshly-fetched definitions
                                        // (falling back to the node snapshot) because saved nodes
                                        // carry configs snapshotted before the marker existed.
                                        const freshInput = props.actionDefinitions?.[props.node.data.label]
                                            ?.inputs?.find((x: any) => x.name === i.name);
                                        const dynamicOptions = freshInput?.dynamic_options ?? i.dynamic_options;
                                        if (dynamicOptions && dynamicOptions.endpoint) {
                                            // Params-declared sibling inputs are forwarded to the
                                            // resolver as query parameters — unsaved edits first
                                            // (localValues), then the stored node config — so the
                                            // dropdown tracks the values the user is typing.
                                            let fetchParams: Record<string, string> | undefined;
                                            if (dynamicOptions.params?.length) {
                                                fetchParams = {};
                                                for (const p of dynamicOptions.params) {
                                                    const paramInput = props.node.data.config.inputs.find((x: any) => x.name === p);
                                                    fetchParams[p] = String(localValues[p] ?? paramInput?.value ?? "");
                                                }
                                                if (props.environmentId) {
                                                    fetchParams["environment"] = props.environmentId;
                                                }
                                            }
                                            return (
                                                <DynamicSelectProperty
                                                    nodeId={props.node.data.id}
                                                    name={i.name}
                                                    label={i.label}
                                                    key={props.node.data.id + "-" + i.name}
                                                    value={i.value}
                                                    endpoint={dynamicOptions.endpoint}
                                                    params={fetchParams}
                                                    options={i.options || []}
                                                    required={i.required}
                                                    variables={props.variables}
                                                    onValueChange={onValueChange}
                                                />
                                            )
                                        }

                                        if (i.options && i.options.length > 0 && i.type !== "multi_select") {
                                            return (
                                                <SelectProperty
                                                    nodeId={props.node.data.id}
                                                    name={i.name}
                                                    label={i.label}
                                                    key={props.node.data.id + "-" + i.name}
                                                    value={i.value}
                                                    options={i.options}
                                                    required={i.required}
                                                    variables={props.variables}
                                                    onValueChange={onValueChange}
                                                />
                                            )
                                        }

                                        // Special case: form_definition on form triggers
                                        if (i.name === "form_definition" && props.node.data.label === "trigger/form") {
                                            return (
                                                <FormBuilder
                                                    key={props.node.data.id + "-" + i.name}
                                                    nodeId={props.node.data.id}
                                                    value={i.value || "{}"}
                                                    variables={props.variables}
                                                    onChange={(val) => onValueChange(i.name, val)}
                                                />
                                            );
                                        }

                                        // Special case: webhook_secret on GitLab/GitHub triggers — auto-generate with copy/regenerate
                                        if (i.name === "webhook_secret" && (
                                            props.node.data.label === "trigger/gitlab_webhook" ||
                                            props.node.data.label === "trigger/github_webhook"
                                        )) {
                                            return (
                                                <WebhookSecretProperty
                                                    key={props.node.data.id + "-" + i.name}
                                                    nodeId={props.node.data.id}
                                                    name={i.name}
                                                    label={i.label}
                                                    value={i.value || ""}
                                                    onValueChange={onValueChange}
                                                />
                                            );
                                        }

                                        // Special case: page_id on Facebook triggers — dropdown of managed pages
                                        if (i.name === "page_id" && (
                                            props.node.data.label === "trigger/facebook_messenger" ||
                                            props.node.data.label === "trigger/facebook_feed"
                                        )) {
                                            // Extract credential name from the access_token input value
                                            const tokenInput = props.node.data.config.inputs.find((x: any) => x.name === "access_token");
                                            const tokenValue = localValues["access_token"] ?? tokenInput?.value ?? "";
                                            const credMatch = tokenValue.match(/\$\{credentials\.([^}]+)\}/);
                                            const credentialName = credMatch ? credMatch[1] : "";

                                            return (
                                                <FacebookPageProperty
                                                    key={props.node.data.id + "-" + i.name}
                                                    nodeId={props.node.data.id}
                                                    name={i.name}
                                                    label={i.label}
                                                    value={localValues[i.name] ?? i.value ?? ""}
                                                    required={i.required}
                                                    credentialName={credentialName}
                                                    environmentId={props.environmentId}
                                                    onValueChange={onValueChange}
                                                />
                                            );
                                        }

                                        // Special case: voice_id on ElevenLabs TTS — dynamic voice dropdown
                                        if (i.name === "voice_id" && (
                                            props.node.data.label === "elevenlabs/text_to_speech"
                                        )) {
                                            const apiKeyInput = props.node.data.config.inputs.find((x: any) => x.name === "api_key");
                                            const apiKeyValue = localValues["api_key"] ?? apiKeyInput?.value ?? "";

                                            return (
                                                <VoiceSelectorProperty
                                                    key={props.node.data.id + "-" + i.name}
                                                    nodeId={props.node.data.id}
                                                    name={i.name}
                                                    label={i.label}
                                                    value={localValues[i.name] ?? i.value ?? ""}
                                                    required={i.required}
                                                    apiKeyValue={apiKeyValue}
                                                    environmentId={props.environmentId}
                                                    onValueChange={onValueChange}
                                                />
                                            );
                                        }

                                        // Special case: model_id on ElevenLabs TTS — dynamic model dropdown
                                        if (i.name === "model_id" && (
                                            props.node.data.label === "elevenlabs/text_to_speech"
                                        )) {
                                            const apiKeyInput = props.node.data.config.inputs.find((x: any) => x.name === "api_key");
                                            const apiKeyValue = localValues["api_key"] ?? apiKeyInput?.value ?? "";

                                            return (
                                                <ModelSelectorProperty
                                                    key={props.node.data.id + "-" + i.name}
                                                    nodeId={props.node.data.id}
                                                    name={i.name}
                                                    label={i.label}
                                                    value={localValues[i.name] ?? i.value ?? ""}
                                                    required={i.required}
                                                    apiKeyValue={apiKeyValue}
                                                    environmentId={props.environmentId}
                                                    onValueChange={onValueChange}
                                                />
                                            );
                                        }

                                        switch (i.type) {
                                            case "key_value_array":
                                                return (
                                                    <KeyValueProperty
                                                        nodeId={props.node.data.id}
                                                        name={i.name}
                                                        label={i.label}
                                                        key={props.node.data.id + "-" + i.name}
                                                        value={i.value || "[]"}
                                                        variables={props.variables}
                                                        onValueChange={onValueChange}
                                                    />
                                                )

                                            case "rows":
                                                return (
                                                    <RowsProperty
                                                        nodeId={props.node.data.id}
                                                        name={i.name}
                                                        label={i.label}
                                                        key={props.node.data.id + "-" + i.name}
                                                        value={i.value || ""}
                                                        placeholder={i.placeholder}
                                                        variables={props.variables}
                                                        onValueChange={onValueChange}
                                                    />
                                                )

                                            case "qr":
                                                return (
                                                    <QRProperty
                                                        id={props.node.data.id}
                                                    />
                                                )

                                            case "string":
                                                if (i.name === "flow_id") {
                                                    return (
                                                        <FlowSelectProperty
                                                            nodeId={props.node.data.id}
                                                            name={i.name}
                                                            label={i.label}
                                                            key={props.node.data.id + "-" + i.name}
                                                            value={i.value}
                                                            required={i.required}
                                                            onValueChange={onValueChange}
                                                        />
                                                    )
                                                }
                                                return (
                                                    <StringProperty
                                                        nodeId={props.node.data.id}
                                                        name={i.name}
                                                        placeholder={i.placeholder}
                                                        label={i.label}
                                                        key={props.node.data.id + "-" + i.name}
                                                        value={i.value}
                                                        required={i.required}
                                                        variables={props.variables}
                                                        onValueChange={onValueChange}
                                                    />
                                                )

                                            case "text":
                                                return (
                                                    <TextProperty
                                                        nodeId={props.node.data.id}
                                                        name={i.name}
                                                        placeholder={i.placeholder}
                                                        label={i.label}
                                                        key={props.node.data.id + "-" + i.name}
                                                        value={i.value}
                                                        required={i.required}
                                                        variables={props.variables}
                                                        onValueChange={onValueChange}
                                                    />
                                                )

                                            // Script source code (Python /
                                            // JavaScript / Bash / future
                                            // runtimes). Same multiline
                                            // shape as Text, monospace font,
                                            // and Prism-driven syntax
                                            // highlighting when the action
                                            // label tells us which language
                                            // grammar to use.
                                            case "code":
                                                return (
                                                    <TextProperty
                                                        nodeId={props.node.data.id}
                                                        name={i.name}
                                                        placeholder={i.placeholder}
                                                        label={i.label}
                                                        key={props.node.data.id + "-" + i.name}
                                                        value={i.value}
                                                        required={i.required}
                                                        variables={props.variables}
                                                        monospace={true}
                                                        language={languageFromNodeLabel(props.node.data.label)}
                                                        onValueChange={onValueChange}
                                                    />
                                                )

                                            // Picker-only inputs for credential and secret
                                            // slots. The component pre-filters the variable
                                            // list to the allowed categories — secret slots
                                            // accept managed credentials (since they also
                                            // resolve to a token) but credential slots
                                            // reject literal secrets (no refresh path).
                                            case "credential": {
                                                // QuickBooks/Xero actions pair the credential with a
                                                // sibling tenant/company input that must hold the
                                                // per-account identifier captured at connect time.
                                                // When the user picks a credential, auto-fill that
                                                // sibling with the matching metadata accessor
                                                // (${credentials.NAME.tenant_id|realm_id}) so they
                                                // never have to hunt for the id by hand. Keyed off the
                                                // presence of a `tenant`/`company` sibling, so no other
                                                // credential input (Google, Slack, …) is affected.
                                                const siblingInputs = props.node.data.config.inputs;
                                                const hasTenant = i.name === "credential" && siblingInputs.some((x: any) => x.name === "tenant");
                                                const hasCompany = i.name === "credential" && siblingInputs.some((x: any) => x.name === "company");
                                                const hasSandbox = siblingInputs.some((x: any) => x.name === "sandbox");
                                                const handleCredentialChange = (property: string, value: any) => {
                                                    onValueChange(property, value);
                                                    if (!hasTenant && !hasCompany) return;
                                                    const match = String(value ?? "").match(/\$\{credentials\.([^}.]+)\}/);
                                                    if (!match) return;
                                                    const credName = match[1];
                                                    if (hasTenant) {
                                                        onValueChange("tenant", "${credentials." + credName + ".tenant_id}");
                                                    } else if (hasCompany) {
                                                        onValueChange("company", "${credentials." + credName + ".realm_id}");
                                                        // QuickBooks: the sandbox/production host is a
                                                        // property of the app's keys, not a user choice —
                                                        // carry it through the credential metadata (hidden
                                                        // input, see the render skip below).
                                                        if (hasSandbox) {
                                                            onValueChange("sandbox", "${credentials." + credName + ".sandbox}");
                                                        }
                                                    }
                                                };
                                                return (
                                                    <CredentialProperty
                                                        nodeId={props.node.data.id}
                                                        name={i.name}
                                                        label={i.label}
                                                        key={props.node.data.id + "-" + i.name}
                                                        value={i.value}
                                                        required={i.required}
                                                        variables={props.variables}
                                                        kind="credential"
                                                        onValueChange={handleCredentialChange}
                                                    />
                                                )
                                            }
                                            case "secret":
                                                return (
                                                    <CredentialProperty
                                                        nodeId={props.node.data.id}
                                                        name={i.name}
                                                        label={i.label}
                                                        key={props.node.data.id + "-" + i.name}
                                                        value={i.value}
                                                        required={i.required}
                                                        variables={props.variables}
                                                        kind="secret"
                                                        onValueChange={onValueChange}
                                                    />
                                                )

                                            case "money": {
                                                // The currency symbol tracks the sibling `currency`
                                                // input reactively — unsaved edits (localValues)
                                                // first, then the stored node config.
                                                const currencyInput = props.node.data.config.inputs.find((x: any) => x.name === "currency");
                                                const currencyValue = String(localValues["currency"] ?? currencyInput?.value ?? "");
                                                return (
                                                    <MoneyProperty
                                                        nodeId={props.node.data.id}
                                                        name={i.name}
                                                        placeholder={i.placeholder}
                                                        label={i.label}
                                                        key={props.node.data.id + "-" + i.name}
                                                        value={i.value}
                                                        currency={currencyValue}
                                                        required={i.required}
                                                        variables={props.variables}
                                                        onValueChange={onValueChange}
                                                    />
                                                )
                                            }

                                            case "number":
                                                return (
                                                    <NumberProperty
                                                        nodeId={props.node.data.id}
                                                        name={i.name}
                                                        placeholder={i.placeholder}
                                                        label={i.label}
                                                        key={props.node.data.id + "-" + i.name}
                                                        value={i.value}
                                                        required={i.required}
                                                        variables={props.variables}
                                                        onValueChange={onValueChange}
                                                    />
                                                )

                                            case "boolean":
                                                return (
                                                    <BooleanProperty
                                                        nodeId={props.node.data.id}
                                                        name={i.name}
                                                        placeholder={i.placeholder}
                                                        label={i.label}
                                                        key={props.node.data.id + "-" + i.name}
                                                        value={i.value}
                                                        required={i.required}
                                                        variables={props.variables}
                                                        onValueChange={onValueChange}
                                                    />
                                                )

                                            case "datetime":
                                                return (
                                                    <DateTimeProperty
                                                        nodeId={props.node.data.id}
                                                        name={i.name}
                                                        placeholder={i.placeholder}
                                                        label={i.label}
                                                        key={props.node.data.id + "-" + i.name}
                                                        value={i.value}
                                                        required={i.required}
                                                        variables={props.variables}
                                                        onValueChange={onValueChange}
                                                    />
                                                )

                                            case "multi_select":
                                                return (
                                                    <MultiSelectProperty
                                                        nodeId={props.node.data.id}
                                                        name={i.name}
                                                        label={i.label}
                                                        key={props.node.data.id + "-" + i.name}
                                                        value={i.value}
                                                        options={i.options || []}
                                                        required={i.required}
                                                        variables={props.variables}
                                                        onValueChange={onValueChange}
                                                    />
                                                )

                                            case "field_source_map":
                                                return (
                                                    <FieldSourceMapProperty
                                                        nodeId={props.node.data.id}
                                                        name={i.name}
                                                        label={i.label}
                                                        key={props.node.data.id + "-" + i.name}
                                                        value={i.value || "{}"}
                                                        options={i.options || []}
                                                        onValueChange={onValueChange}
                                                    />
                                                )

                                            default:
                                                return (
                                                    <StringProperty
                                                        nodeId={props.node.data.id}
                                                        name={i.name}
                                                        placeholder={i.placeholder}
                                                        label={i.label}
                                                        key={props.node.data.id + "-" + i.name}
                                                        value={i.value}
                                                        required={i.required}
                                                        variables={props.variables}
                                                        onValueChange={onValueChange}
                                                    />
                                                )
                                        }
                                    })
                                )}
                                {/* Google account management for email triggers */}
                                {props.node.data.label === "trigger/email" && (
                                    <GoogleAccountsProperty
                                        nodeId={props.node.data.id}
                                        triggers={props.triggers}
                                        nodeLabel={props.node.data.label}
                                    />
                                )}
                                <TriggerURLProperty
                                    node={props.node}
                                    triggers={props.triggers}
                                />
                                {props.onNodeDelete && (
                                    <div className={"property-menu-delete"}>
                                        <button onClick={() => props.onNodeDelete(props.node.data.id)}>
                                            <Icon name={"trash"} /> Delete Node
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </>
    );
};

export default PropertyMenu;
