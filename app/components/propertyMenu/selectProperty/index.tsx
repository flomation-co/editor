import React, {useEffect, useState} from "react";
import type {ParameterOption} from "~/types";
import type {VariableItem} from "~/components/propertyMenu/variableInput";
import VariablePicker from "~/components/propertyMenu/variablePicker";

type PropertyProps = {
    nodeId: string;
    name: string;
    label: string;
    value: string;
    options: ParameterOption[];
    required?: boolean;
    variables?: VariableItem[];
    onValueChange?: (property: string, value: any) => void;
}

function isVariableRef(val: string): boolean {
    return typeof val === "string" && /^\$\{[\w.-]+}$/.test(val);
}

const SelectProperty = (props: PropertyProps) => {
    const [ value, setValue ] = useState<string>(props.value);

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
        <div className={"property-menu-input-row"} key={props.name} >
            <div className={"property-menu-input-name"} >
                {props.label ? props.label : props.name}
                {props.required && <span className="property-menu-required"> *</span>}
            </div>
            {showPicker ? (
                <VariablePicker
                    value={value}
                    variables={props.variables || []}
                    onSelect={(ref) => setValue(ref)}
                    onClear={() => setValue("")}
                />
            ) : (
                <div className="variable-mode-row">
                    <select value={value} onChange={(e) => setValue(e.target.value)}>
                        <option value="">Select...</option>
                        {props.options && props.options.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.name}</option>
                        ))}
                    </select>
                    <VariablePicker
                        value={value}
                        variables={props.variables ?? []}
                        onSelect={(ref) => setValue(ref)}
                        onClear={() => setValue("")}
                    />
                </div>
            )}
        </div>
    )
}

export default SelectProperty;
