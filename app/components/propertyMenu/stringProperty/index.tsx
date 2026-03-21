import React, {useEffect, useState} from "react";
import VariableInput, {type VariableItem} from "~/components/propertyMenu/variableInput";

type PropertyProps = {
    nodeId: string;
    name: string;
    placeholder: string;
    label: string;
    value: string;
    required?: boolean;
    variables?: VariableItem[];
    onValueChange?: (property: string, value: any) => void;
}

const StringProperty = (props: PropertyProps) => {
    const [ value, setValue ] = useState<string>(props.value);

    useEffect(() => {
        if (props.onValueChange) {
            props.onValueChange(props.name, value);
        }
    }, [ value ]);

    useEffect(() => {
        setValue(props.value)
    }, [ props.nodeId ]);

    const hasVariables = props.variables && props.variables.length > 0;

    return (
        <div className={"property-menu-input-row"} key={props.name} >
            <div className={"property-menu-input-name"} >{props.label ? props.label : props.name}{props.required && <span className="property-menu-required"> *</span>}</div>
            {hasVariables ? (
                <VariableInput
                    nodeId={props.nodeId}
                    name={props.name}
                    placeholder={props.placeholder}
                    label={props.label}
                    value={value}
                    required={props.required}
                    multiline={false}
                    variables={props.variables!}
                    onValueChange={(_, v) => setValue(v)}
                />
            ) : (
                <input placeholder={props.placeholder} type={"text"} value={value} onChange={(e) => {
                    setValue(e.target.value);
                }}/>
            )}
        </div>
    )
}

export default StringProperty;
