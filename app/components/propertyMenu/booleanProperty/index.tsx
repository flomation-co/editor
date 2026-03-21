import React, {useEffect, useState} from "react";
import VariableInput, {type VariableItem} from "~/components/propertyMenu/variableInput";

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

function looksLikeVariable(val: any): boolean {
    return typeof val === "string" && /\$\{/.test(val);
}

const BooleanProperty = (props: PropertyProps) => {
    const [ value, setValue ] = useState<boolean | string>(props.value);
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
            setValue(false);
        } else {
            setValue("");
        }
        setVariableMode(!variableMode);
    };

    return (
        <div className={"property-menu-input-row"} key={props.name}>
            <div className={"property-menu-input-name"} >
                {props.label ? props.label : props.name}
                {props.required && <span className="property-menu-required"> *</span>}
            </div>
            <div className="variable-mode-row">
                {variableMode ? (
                    <VariableInput
                        nodeId={props.nodeId || ""}
                        name={props.name}
                        placeholder={"${secrets.NAME} or ${env.NAME}"}
                        label={props.label}
                        value={typeof value === "string" ? value : ""}
                        required={props.required}
                        multiline={false}
                        variables={props.variables || []}
                        onValueChange={(_, v) => setValue(v)}
                    />
                ) : (
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
                )}
                {hasVariables && (
                    <button
                        type="button"
                        className={`variable-mode-toggle ${variableMode ? "variable-mode-toggle--active" : ""}`}
                        onClick={toggleVariableMode}
                        title={variableMode ? "Switch to checkbox" : "Use a variable"}
                    >
                        {"{x}"}
                    </button>
                )}
            </div>
        </div>
    )
}

export default BooleanProperty;
