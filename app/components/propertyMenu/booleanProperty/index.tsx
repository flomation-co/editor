import React, {useEffect, useState} from "react";
import type {VariableItem} from "~/components/propertyMenu/variableInput";
import VariablePicker from "~/components/propertyMenu/variablePicker";

type PropertyProps = {
    nodeId?: string;
    name: string;
    placeholder: string;
    label: string;
    value: boolean | string;
    required?: boolean;
    variables?: VariableItem[];
    onValueChange?: (property: string, value: any) => void;
}

function isVariableRef(val: any): boolean {
    return typeof val === "string" && /^\$\{[\w.-]+}$/.test(val);
}

const BooleanProperty = (props: PropertyProps) => {
    const [ value, setValue ] = useState<boolean | string>(props.value);

    useEffect(() => {
        if (props.onValueChange) {
            props.onValueChange(props.name, value);
        }
    }, [ value ]);

    useEffect(() => {
        setValue(props.value);
    }, [ props.nodeId ]);

    const showPicker = isVariableRef(value);

    return (
        <div className={"property-menu-input-row"} key={props.name}>
            <div className={"property-menu-input-name"} >
                {props.label ? props.label : props.name}
                {props.required && <span className="property-menu-required"> *</span>}
            </div>
            {showPicker ? (
                <VariablePicker
                    value={value as string}
                    variables={props.variables || []}
                    onSelect={(ref) => setValue(ref)}
                    onClear={() => setValue(false)}
                />
            ) : (
                <div className="variable-mode-row">
                    <div className={"property-menu-input-inline-row"} style={{ margin: 0 }}>
                        <label htmlFor={props.name} className={"property-menu-checkbox-label"}>
                            <input
                                className={"property-menu-checkbox-input"}
                                id={props.name}
                                placeholder={props.placeholder}
                                type={"checkbox"}
                                checked={typeof value === "boolean" ? value : false}
                                onChange={(e) => setValue(e.target.checked)}
                            />
                            <span className={"property-menu-checkbox"}></span>
                        </label>
                    </div>
                    <VariablePicker
                        value={typeof value === "string" ? value : ""}
                        variables={props.variables ?? []}
                        onSelect={(ref) => setValue(ref)}
                        onClear={() => setValue(false)}
                    />
                </div>
            )}
        </div>
    )
}

export default BooleanProperty;
