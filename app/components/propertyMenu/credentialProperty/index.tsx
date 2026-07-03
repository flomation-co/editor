import React, { useEffect, useMemo, useRef, useState } from "react";
import VariablePicker from "~/components/propertyMenu/variablePicker";
import type { VariableItem } from "~/components/propertyMenu/variableInput";
import "./index.css";

// CredentialProperty is the picker-only input for action fields that
// take a token, secret, or managed credential. It deliberately does
// NOT render a text input — users can't paste a literal token here.
// They pick from the set of environment-stored secrets and managed
// credentials that the flow's environment exposes.
//
// The kind prop chooses which variable categories are eligible:
//
//   - "credential" → only managed credentials (${credentials.X}).
//     OAuth-refreshed providers like Google, Microsoft, Slack.
//
//   - "secret" → both managed credentials AND raw secrets
//     (${secrets.X}). A managed credential can always satisfy a
//     secret slot since both resolve to a token at run-time, but
//     the reverse isn't true — a literal secret can't be
//     refreshed, so a "credential" slot won't accept one.

type CredentialKind = "credential" | "secret";

type CredentialPropertyProps = {
    nodeId: string;
    name: string;
    label: string;
    value: string;
    required?: boolean;
    variables?: VariableItem[];
    kind: CredentialKind;
    onValueChange?: (property: string, value: any) => void;
};

const ALLOWED_BY_KIND: Record<CredentialKind, VariableItem["category"][]> = {
    credential: ["credentials"],
    secret: ["credentials", "secrets"],
};

const EMPTY_LABEL: Record<CredentialKind, string> = {
    credential: "Choose a credential…",
    secret: "Choose a credential or secret…",
};

const CredentialProperty = (props: CredentialPropertyProps) => {
    const [value, setValue] = useState<string>(props.value || "");
    const emptyRowRef = useRef<HTMLDivElement>(null);

    // Propagate value changes up to the flow — but NOT on the initial mount.
    // The node already carries its saved value via props.value, so echoing it
    // back on mount is redundant; worse, on a panel with more than one secret
    // picker (e.g. a node with both an API token and an OAuth token) those
    // mount-time pushes feed the flow's setNodes and can loop into React's
    // "maximum update depth exceeded" (#185). Skipping the first run breaks
    // that cycle while still notifying on a real user select/clear.
    const didPropagateRef = useRef(false);
    useEffect(() => {
        if (!didPropagateRef.current) {
            didPropagateRef.current = true;
            return;
        }
        if (props.onValueChange) {
            props.onValueChange(props.name, value);
        }
    }, [value]);

    // Reset to the incoming value when the inspected node changes —
    // matches the pattern used by every other property menu input.
    useEffect(() => {
        setValue(props.value || "");
    }, [props.nodeId]);

    const allowedCategories = ALLOWED_BY_KIND[props.kind];

    // Pre-filter the variable list so the picker dropdown only ever
    // offers the right categories. Cheaper than threading a filter
    // down into VariablePicker, and keeps the picker generic.
    const filteredVariables = useMemo(
        () => (props.variables ?? []).filter((v) => allowedCategories.includes(v.category)),
        [props.variables, allowedCategories.join(",")],
    );

    const hasValue = value.trim().length > 0;

    // Whole-row open: clicking anywhere on the empty-state CTA
    // should open the picker, not just the $ button. We forward the
    // click by programmatically clicking the embedded VariablePicker
    // toggle. If the user clicked the button itself the picker's own
    // handler fires; the short-circuit below prevents a double-toggle
    // that would otherwise immediately close it again.
    const handleEmptyRowClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target.closest("button.variable-mode-toggle")) return;
        const btn = emptyRowRef.current?.querySelector(
            "button.variable-mode-toggle",
        ) as HTMLButtonElement | null;
        btn?.click();
    };

    const handleEmptyRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            const btn = emptyRowRef.current?.querySelector(
                "button.variable-mode-toggle",
            ) as HTMLButtonElement | null;
            btn?.click();
        }
    };

    return (
        <div className="property-menu-input-row" key={props.name}>
            <div className="property-menu-input-name">
                {props.label ? props.label : props.name}
                {props.required && <span className="property-menu-required"> *</span>}
            </div>
            <div className={`credential-property credential-property--${props.kind}`}>
                {hasValue ? (
                    // Chip-mode display once a variable is selected.
                    // VariablePicker renders the pill + clear button.
                    <VariablePicker
                        value={value}
                        variables={filteredVariables}
                        onSelect={(ref) => setValue(ref)}
                        onClear={() => setValue("")}
                    />
                ) : (
                    // Empty-state row styled to mirror a regular
                    // StringProperty: placeholder area on the left,
                    // thin $ tab on the right (same .variable-mode-row
                    // shape used by every other input). The whole row
                    // is clickable.
                    <div
                        className="variable-mode-row credential-property-empty"
                        ref={emptyRowRef}
                        onClick={handleEmptyRowClick}
                        onKeyDown={handleEmptyRowKeyDown}
                        role="button"
                        tabIndex={0}
                        aria-label={EMPTY_LABEL[props.kind]}
                    >
                        <div className="credential-property-placeholder">
                            {EMPTY_LABEL[props.kind]}
                        </div>
                        <VariablePicker
                            value=""
                            variables={filteredVariables}
                            onSelect={(ref) => setValue(ref)}
                            onClear={() => setValue("")}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default CredentialProperty;
