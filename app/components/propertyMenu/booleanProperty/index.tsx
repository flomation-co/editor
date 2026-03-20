import React, {useEffect, useState} from "react";

type PropertyProps = {
    name: string;
    placeholder: string;
    label: string;
    value: boolean;
    required?: boolean;
    onValueChange?: (property: string, value: boolean) => void;
}

const BooleanProperty = (props: PropertyProps) => {
    const [ value, setValue ] = useState<boolean>(props.value);

    useEffect(() => {
        if (props.onValueChange) {
            props.onValueChange(props.name, value);
        }
    }, [ value ]);

    return (
        <div className={"property-menu-input-inline-row"} key={props.name}>
            <label htmlFor={props.name} className={"property-menu-checkbox-label"} >{props.label ? props.label : props.name}{props.required && <span className="property-menu-required"> *</span>}
                <input className={"property-menu-checkbox-input"} id={props.name} placeholder={props.placeholder} type={"checkbox"} checked={value} onChange={(e) => {
                    setValue(e.target.checked);
                }}/>
                <span className={"property-menu-checkbox"}></span>
            </label>
        </div>
    )
}

export default BooleanProperty;