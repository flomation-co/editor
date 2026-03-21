import React, {useEffect, useState} from "react";
import type {ParameterOption} from "~/types";
import VariableInput, {type VariableItem} from "~/components/propertyMenu/variableInput";

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

function looksLikeVariable(val: string): boolean {
    return typeof val === "string" && /\$\{/.test(val);
}

const SelectProperty = (props: PropertyProps) => {
    const [ value, setValue ] = useState<string>(props.value);
    const [ variableMode, setVariableMode ] = useState<boolean>(looksLikeVariable(props.value));
    const hasVariables = props.variables && props.variables.length > 0;

    useEffect(() => {
        if (props.onValueChange) {
            props.onValueChange(props.name, value);
        }
    }, [ value ]);

    useEffect(() => {
        setValue(props.value);
        setVariableMode(looksLikeVariable(props.value));
    }, [ props.nodeId ]);

    const toggleVariableMode = () => {
        if (variableMode) {
            setValue("");
        }
        setVariableMode(!variableMode);
    };

    return (
        <div className={"property-menu-input-row"} key={props.name} >
            <div className={"property-menu-input-name"} >
                {props.label ? props.label : props.name}
                {props.required && <span className="property-menu-required"> *</span>}
            </div>
            <div className="variable-mode-row">
                {variableMode ? (
                    <VariableInput
                        nodeId={props.nodeId}
                        name={props.name}
                        placeholder={"${secrets.NAME} or ${env.NAME}"}
                        label={props.label}
                        value={value}
                        required={props.required}
                        multiline={false}
                        variables={props.variables || []}
                        onValueChange={(_, v) => setValue(v)}
                    />
                ) : (
                    <select value={value} onChange={(e) => setValue(e.target.value)}>
                        <option value="">Select...</option>
                        {props.options && props.options.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.name}</option>
                        ))}
                    </select>
                )}
                {hasVariables && (
                    <button
                        type="button"
                        className={`variable-mode-toggle ${variableMode ? "variable-mode-toggle--active" : ""}`}
                        onClick={toggleVariableMode}
                        title={variableMode ? "Switch to dropdown" : "Use a variable"}
                    >
                        {"{x}"}
                    </button>
                )}
            </div>
        </div>
    )
}

export default SelectProperty;
