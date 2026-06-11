import React, {useEffect, useState} from "react";
import type {VariableItem} from "~/components/propertyMenu/variableInput";
import VariablePicker from "~/components/propertyMenu/variablePicker";

type PropertyProps = {
    nodeId: string;
    name: string;
    placeholder?: string;
    label: string;
    value: string;
    required?: boolean;
    variables?: VariableItem[];
    onValueChange?: (property: string, value: any) => void;
}

function isVariableRef(val: any): boolean {
    return typeof val === "string" && /^\$\{[\w.-]+}$/.test(val);
}

// toDateTimeLocal accepts either the empty string, an RFC3339 timestamp from
// a previously saved flow, or the already-trimmed datetime-local format. It
// returns the YYYY-MM-DDTHH:MM string the native input wants.
function toDateTimeLocal(val: string): string {
    if (!val) return "";
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) {
        return val.slice(0, 16);
    }
    const parsed = new Date(val);
    if (isNaN(parsed.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

const DateTimeProperty = (props: PropertyProps) => {
    const [value, setValue] = useState<string>(props.value || "");

    useEffect(() => {
        if (props.onValueChange) {
            props.onValueChange(props.name, value);
        }
    }, [value]);

    useEffect(() => {
        setValue(props.value || "");
    }, [props.nodeId]);

    const showPicker = isVariableRef(value);

    return (
        <div className={"property-menu-input-row"} key={props.name}>
            <div className={"property-menu-input-name"}>
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
                    <input
                        type="datetime-local"
                        value={toDateTimeLocal(value)}
                        placeholder={props.placeholder}
                        onChange={(e) => setValue(e.target.value)}
                    />
                    <VariablePicker
                        value={value}
                        variables={props.variables ?? []}
                        onSelect={(ref) => setValue(ref)}
                        onClear={() => setValue("")}
                    />
                </div>
            )}
        </div>
    );
};

export default DateTimeProperty;
