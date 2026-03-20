import "./index.css"

import React, {useEffect, useState} from "react";
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'

import {library} from '@fortawesome/fontawesome-svg-core'
import {fas} from '@fortawesome/free-solid-svg-icons'
import {fab} from '@fortawesome/free-brands-svg-icons'
import type {NodeDefinition} from "~/types";
import TextProperty from "~/components/propertyMenu/textProperty";
import StringProperty from "~/components/propertyMenu/stringProperty";
import QRProperty from "~/components/propertyMenu/qrProperty";
import BooleanProperty from "~/components/propertyMenu/booleanProperty";
import NumberProperty from "~/components/propertyMenu/numberProperty";
import SelectProperty from "~/components/propertyMenu/selectProperty";

type PropertyMenuProps = {
    node: object;
    onValueChange?: (node_id: string, property: string, value: any) => void;
    onNameChange?: (node_id: string, value: any) => void;
    onDismiss?: () => void;
    onNodeDelete?: (node_id: string) => void;
}

// RG: PERFORMANCE IMPROVEMENT: add the fontawesome icons to the library outside of the node so not to re-add on every render
library.add(fab, fas);

const PropertyMenu = (props: PropertyMenuProps) => {
    const [ loading, setLoading ] = useState<boolean>(false);
    const [ name, setName ] = useState<string>(props.node && props.node.data && props.node.data.config && props.node.data.config.label ? props.node.data.config.label : "");

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
                                <button className={"property-menu-close"} onClick={handleDismiss}>
                                    <FontAwesomeIcon icon={["fas", "xmark"]} />
                                </button>
                            </div>
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
                                                    key={i.name}
                                                    value={i.value}
                                                    options={i.options}
                                                    required={i.required}
                                                    onValueChange={onValueChange}
                                                />
                                            )
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
                                                        key={i.name}
                                                        value={i.value}
                                                        required={i.required}
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
                                                        key={i.name}
                                                        value={i.value}
                                                        required={i.required}
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
                                                        key={i.name}
                                                        value={i.value}
                                                        required={i.required}
                                                        onValueChange={onValueChange}
                                                    />
                                                )

                                            case "boolean":
                                                return (
                                                    <BooleanProperty
                                                        name={i.name}
                                                        placeholder={i.placeholder}
                                                        label={i.label}
                                                        key={i.name}
                                                        value={i.value}
                                                        required={i.required}
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
                                                        key={i.name}
                                                        value={i.value}
                                                        required={i.required}
                                                        onValueChange={onValueChange}
                                                    />
                                                )
                                        }
                                    })
                                )}
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
