import React, {useEffect, useState} from "react";
import type {ParameterOption} from "~/types";

type PropertyProps = {
    nodeId: string;
    name: string;
    label: string;
    value: string;
    options: ParameterOption[];
    required?: boolean;
    onValueChange?: (property: string, value: any) => void;
}

const SelectProperty = (props: PropertyProps) => {
    const [ value, setValue ] = useState<string>(props.value);

    useEffect(() => {
        if (props.onValueChange) {
            props.onValueChange(props.name, value);
        }
    }, [ value ]);

    useEffect(() => {
        setValue(props.value)
    }, [ props.nodeId ]);

    return (
        <div className={"property-menu-input-row"} key={props.name} >
            <div className={"property-menu-input-name"} >
                {props.label ? props.label : props.name}
                {props.required && <span className="property-menu-required"> *</span>}
            </div>
            <select value={value} onChange={(e) => setValue(e.target.value)}>
                <option value="">Select...</option>
                {props.options && props.options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.name}</option>
                ))}
            </select>
        </div>
    )
}

export default SelectProperty;
