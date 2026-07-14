import React from "react";
import FlowSelect from "~/components/flowSelect";

type FlowSelectPropertyProps = {
    nodeId: string;
    name: string;
    label?: string;
    value?: string;
    required?: boolean;
    onValueChange?: (property: string, value: string) => void;
};

// FlowSelectProperty is the property-menu wrapper around the shared FlowSelect
// searchable flow autocomplete: it adds the labelled row chrome and threads the
// selection back through the property menu's onValueChange contract.
export default function FlowSelectProperty(props: FlowSelectPropertyProps) {
    return (
        <div className="property-menu-input-row">
            <div className="property-menu-input-name">
                {props.label || "Flow"}
                {props.required && <span className="property-menu-required"> *</span>}
            </div>
            <FlowSelect
                value={props.value}
                onChange={(flowId) => props.onValueChange?.(props.name, flowId)}
            />
        </div>
    );
}
