import "./index.css"

import React, {useEffect, useState} from "react";
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'

import {library} from '@fortawesome/fontawesome-svg-core'
import {fas} from '@fortawesome/free-solid-svg-icons'
import {fab} from '@fortawesome/free-brands-svg-icons'
import type {NodeDefinition, Trigger} from "~/types";
import type {VariableItem} from "~/components/propertyMenu/variableInput";
import TextProperty from "~/components/propertyMenu/textProperty";
import StringProperty from "~/components/propertyMenu/stringProperty";
import QRProperty from "~/components/propertyMenu/qrProperty";
import TriggerURLProperty from "~/components/propertyMenu/triggerURLProperty";
import FormBuilder from "~/components/propertyMenu/formBuilder";
import BooleanProperty from "~/components/propertyMenu/booleanProperty";
import NumberProperty from "~/components/propertyMenu/numberProperty";
import SelectProperty from "~/components/propertyMenu/selectProperty";

type PropertyMenuProps = {
    node: object;
    variables?: VariableItem[];
    triggers?: Trigger[];
    onValueChange?: (node_id: string, property: string, value: any) => void;
    onNameChange?: (node_id: string, value: any) => void;
    onDismiss?: () => void;
    onNodeDelete?: (node_id: string) => void;
    expanded?: boolean;
    onToggleExpand?: () => void;
}

// RG: PERFORMANCE IMPROVEMENT: add the fontawesome icons to the library outside of the node so not to re-add on every render
library.add(fab, fas);

const PropertyMenu = (props: PropertyMenuProps) => {
    const [ loading, setLoading ] = useState<boolean>(false);
    const [ name, setName ] = useState<string>(props.node && props.node.data && props.node.data.config && props.node.data.config.label ? props.node.data.config.label : "");
    const [ showHelp, setShowHelp ] = useState<boolean>(false);

    const onValueChange = (property: string, value: any) => {
        if (props.onValueChange) {
            props.onValueChange(props.node.data.id, property, value);
        }
    }

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
                                        <FontAwesomeIcon icon={["fas", props.expanded ? "compress" : "expand"]} />
                                    </button>
                                )}
                                <button className={"property-menu-close"} onClick={handleDismiss}>
                                    <FontAwesomeIcon icon={["fas", "xmark"]} />
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
                                {props.node.data.config.inputs && (
                                    props.node.data.config.inputs.map(i => {
                                        if (i.options && i.options.length > 0) {
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
                                                    value={i.value || "{}"}
                                                    onChange={(val) => onValueChange(i.name, val)}
                                                />
                                            );
                                        }

                                        switch (i.type) {
                                            case "qr":
                                                return (
                                                    <QRProperty
                                                        id={props.node.data.id}
                                                    />
                                                )

                                            case "string":
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
                                <TriggerURLProperty
                                    node={props.node}
                                    triggers={props.triggers}
                                />
                                {props.onNodeDelete && (
                                    <div className={"property-menu-delete"}>
                                        <button onClick={() => props.onNodeDelete(props.node.data.id)}>
                                            <FontAwesomeIcon icon={["fas", "trash"]} /> Delete Node
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
