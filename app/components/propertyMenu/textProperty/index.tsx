import React, {useEffect, useState} from "react";
import VariableInput, {type VariableItem} from "~/components/propertyMenu/variableInput";
import VariablePicker from "~/components/propertyMenu/variablePicker";
import { Icon } from "~/components/icons/Icon";

type PropertyProps = {
    nodeId: string;
    name: string;
    placeholder: string;
    label: string;
    value: string;
    required?: boolean;
    variables?: VariableItem[];
    /** When true, the textarea (and the expand-popup textarea) render
     *  in a monospace font — used for script-source inputs declared
     *  with ConnectionTypeCode. */
    monospace?: boolean;
    /** Prism grammar identifier (e.g. "python", "javascript", "bash").
     *  When set, the highlight overlay tokenises code segments with
     *  this grammar and colour-renders them inline. Implies
     *  monospace=true for layout consistency — the overlay tokens
     *  need the same character width as the textarea cursor. */
    language?: string;
    onValueChange?: (property: string, value: any) => void;
}

const TextProperty = (props: PropertyProps) => {
    const [ value, setValue ] = useState<string>(props.value);
    const [ popupOpen, setPopupOpen ] = useState(false);
    const [ popupValue, setPopupValue ] = useState("");
    // remountKey forces the inline VariableInput to unmount/remount
    // when the popup commits a new value. VariableInput is
    // uncontrolled (defaultValue + internal state + ref-managed
    // textarea), so changes pushed from the popup wouldn't otherwise
    // materialise in the inline view without this bump.
    const [ remountKey, setRemountKey ] = useState(0);

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
        setRemountKey(k => k + 1);
        setPopupOpen(false);
    };

    return (
        <div className={"property-menu-input-row"} key={props.name} >
            <div className={"property-menu-input-name"} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{props.label ? props.label : props.name}{props.required && <span className="property-menu-required"> *</span>}</span>
                <button className="text-expand-btn" onClick={openPopup} title="Expand">
                    <Icon name="expand" />
                </button>
            </div>
            <div className="variable-mode-row variable-mode-row--multiline">
                <VariableInput
                    key={`inline-${props.nodeId}-${remountKey}`}
                    nodeId={props.nodeId}
                    name={props.name}
                    placeholder={props.placeholder}
                    label={props.label}
                    value={value}
                    required={props.required}
                    multiline={true}
                    monospace={props.monospace || !!props.language}
                    language={props.language}
                    variables={props.variables ?? []}
                    onValueChange={(_, v) => setValue(v)}
                />
                <VariablePicker
                    value={value}
                    variables={props.variables ?? []}
                    onSelect={(ref) => setValue((prev) => prev + ref)}
                    onClear={() => setValue("")}
                    alwaysButton={true}
                />
            </div>

            {popupOpen && (
                <div className="text-popup-overlay" onClick={() => setPopupOpen(false)}>
                    <div className="text-popup" onClick={e => e.stopPropagation()}>
                        <div className="text-popup-header">
                            <span>{props.label || props.name}</span>
                            <button className="text-popup-close" onClick={() => setPopupOpen(false)}>&times;</button>
                        </div>
                        {/* The popup uses the same VariableInput as the
                            inline field so syntax highlighting, variable
                            pills, the secret detector and the cursor-aligned
                            overlay all behave consistently between the two
                            views. Keyed by popupOpen so it remounts fresh
                            when re-opened, picking up the latest value. */}
                        <div className={`text-popup-input ${props.monospace || props.language ? "text-popup-input--monospace" : ""}`}>
                            <VariableInput
                                key={`popup-${props.nodeId}`}
                                nodeId={`popup-${props.nodeId}`}
                                name={props.name}
                                placeholder={props.placeholder}
                                label={props.label}
                                value={popupValue}
                                required={props.required}
                                multiline={true}
                                monospace={props.monospace || !!props.language}
                                language={props.language}
                                variables={props.variables ?? []}
                                onValueChange={(_, v) => setPopupValue(v)}
                            />
                        </div>
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
