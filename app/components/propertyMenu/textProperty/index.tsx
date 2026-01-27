import React, {useEffect, useState} from "react";

type PropertyProps = {
    nodeId: string;
    name: string;
    placeholder: string;
    label: string;
    value: string;
    onValueChange?: (property: string, value: any) => void;
}

const TextProperty = (props: PropertyProps) => {
    const [ value, setValue ] = useState<string>(props.value);

    useEffect(() => {
        if (props.onValueChange) {
            props.onValueChange(props.name, value);
        }
    }, [ value ]);

    useEffect(() => {
        console.log("node id changed");
        setValue(props.value)
    }, [ props.nodeId ]);

    return (
        <div className={"property-menu-input-row"} key={props.name} >
            <div className={"property-menu-input-name"} >{props.label ? props.label : props.name}</div>
            <textarea placeholder={props.placeholder} value={value} onChange={(e) => {
                setValue(e.target.value);
            }}>

            </textarea>
        </div>
    )
}

export default TextProperty;