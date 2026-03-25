import React, {useEffect, useState} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faExpand} from "@fortawesome/free-solid-svg-icons";
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

const TextProperty = (props: PropertyProps) => {
    const [ value, setValue ] = useState<string>(props.value);
    const [ popupOpen, setPopupOpen ] = useState(false);
    const [ popupValue, setPopupValue ] = useState("");

    useEffect(() => {
        if (props.onValueChange) {
            props.onValueChange(props.name, value);
        }
    }, [ value ]);

    useEffect(() => {
        setValue(props.value)
    }, [ props.nodeId ]);

    const openPopup = () => {
        setPopupValue(value);
        setPopupOpen(true);
    };

    const savePopup = () => {
        setValue(popupValue);
        setPopupOpen(false);
    };

    return (
        <div className={"property-menu-input-row"} key={props.name} >
            <div className={"property-menu-input-name"} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{props.label ? props.label : props.name}{props.required && <span className="property-menu-required"> *</span>}</span>
                <button className="text-expand-btn" onClick={openPopup} title="Expand">
                    <FontAwesomeIcon icon={faExpand} />
                </button>
            </div>
            <VariableInput
                nodeId={props.nodeId}
                name={props.name}
                placeholder={props.placeholder}
                label={props.label}
                value={value}
                required={props.required}
                multiline={true}
                variables={props.variables ?? []}
                onValueChange={(_, v) => setValue(v)}
            />

            {popupOpen && (
                <div className="text-popup-overlay" onClick={() => setPopupOpen(false)}>
                    <div className="text-popup" onClick={e => e.stopPropagation()}>
                        <div className="text-popup-header">
                            <span>{props.label || props.name}</span>
                            <button className="text-popup-close" onClick={() => setPopupOpen(false)}>&times;</button>
                        </div>
                        <textarea
                            className="text-popup-textarea"
                            value={popupValue}
                            onChange={e => setPopupValue(e.target.value)}
                            placeholder={props.placeholder}
                            autoFocus
                        />
                        <div className="text-popup-footer">
                            <button className="text-popup-cancel" onClick={() => setPopupOpen(false)}>Cancel</button>
                            <button className="text-popup-save" onClick={savePopup}>Apply</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default TextProperty;
