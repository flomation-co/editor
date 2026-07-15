import React, {useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {HexColorPicker} from "react-colorful";
import type {VariableItem} from "~/components/propertyMenu/variableInput";
import VariablePicker from "~/components/propertyMenu/variablePicker";
import "./index.css";

type PropertyProps = {
    nodeId: string;
    name: string;
    placeholder: string;
    label: string;
    value: string;
    required?: boolean;
    variables?: VariableItem[];
    onValueChange?: (property: string, value: any) => void;
};

function isVariableRef(val: string): boolean {
    return typeof val === "string" && /^\$\{[\w.-]+}$/.test(val);
}

// Named colours the executor's parseColour understands, so the swatch can show
// them and the presets can offer the brand palette.
const NAMED: Record<string, string> = {
    white: "#ffffff",
    black: "#000000",
    "flomation-purple": "#460070",
    "flomation-teal": "#00aa9c",
};

const PRESETS: {label: string; value: string}[] = [
    {label: "Flomation Purple", value: "#460070"},
    {label: "Flomation Teal", value: "#00aa9c"},
    {label: "White", value: "#ffffff"},
    {label: "Black", value: "#000000"},
    {label: "Red", value: "#e23c3c"},
    {label: "Amber", value: "#f5a623"},
    {label: "Green", value: "#3ba55d"},
    {label: "Blue", value: "#3b82f6"},
];

function normaliseHex(v: string): string | null {
    let s = v.trim().toLowerCase();
    if (NAMED[s]) return NAMED[s];
    if (!s.startsWith("#")) return null;
    s = s.slice(1);
    if (s.length === 3) s = s.split("").map((c) => c + c).join("");
    if (!/^[0-9a-f]{6}$/.test(s)) return null;
    return "#" + s;
}

function hexToRgb(hex: string): {r: number; g: number; b: number} {
    const h = normaliseHex(hex) || "#ffffff";
    return {
        r: parseInt(h.slice(1, 3), 16),
        g: parseInt(h.slice(3, 5), 16),
        b: parseInt(h.slice(5, 7), 16),
    };
}

function rgbToHex(r: number, g: number, b: number): string {
    const c = (n: number) => Math.max(0, Math.min(255, Math.round(n || 0))).toString(16).padStart(2, "0");
    return "#" + c(r) + c(g) + c(b);
}

const ColourProperty = (props: PropertyProps) => {
    const [value, setValue] = useState<string>(props.value);
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{top: number; left: number}>({top: 0, left: 0});
    const swatchRef = useRef<HTMLButtonElement | null>(null);
    const popRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (props.onValueChange) props.onValueChange(props.name, value);
    }, [value]);
    useEffect(() => {
        setValue(props.value);
        setOpen(false);
    }, [props.nodeId]);

    // Position the portaled popover under the swatch, viewport-clamped.
    useEffect(() => {
        if (!open || !swatchRef.current) return;
        const r = swatchRef.current.getBoundingClientRect();
        const width = 232;
        let left = r.left;
        if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
        let top = r.bottom + 6;
        if (top + 300 > window.innerHeight - 8) top = Math.max(8, r.top - 306);
        setPos({top, left});
    }, [open]);

    // Close on outside click (popover is portaled, so check both refs).
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const t = e.target as Node;
            if (swatchRef.current && swatchRef.current.contains(t)) return;
            if (popRef.current && popRef.current.contains(t)) return;
            setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const resolved = normaliseHex(value) || "#ffffff";
    const validHex = normaliseHex(value) !== null;
    const rgb = hexToRgb(value);
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
                    <div className="colour-input-field">
                        <button
                            ref={swatchRef}
                            type="button"
                            className="colour-swatch"
                            style={{background: validHex ? resolved : "transparent"}}
                            onClick={() => setOpen((o) => !o)}
                            title="Pick a colour"
                        >
                            {!validHex && <span className="colour-swatch-unknown">?</span>}
                        </button>
                        <input
                            className="colour-hex-text"
                            type="text"
                            placeholder={props.placeholder || "#ffffff"}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                        />
                    </div>
                    <VariablePicker
                        value={value}
                        variables={props.variables ?? []}
                        onSelect={(ref) => setValue(ref)}
                        onClear={() => setValue("")}
                    />
                </div>
            )}

            {open && typeof document !== "undefined" && createPortal(
                <div ref={popRef} className="colour-popover" style={{top: pos.top, left: pos.left}}>
                    <HexColorPicker color={resolved} onChange={(c) => setValue(c)} />
                    <div className="colour-fields">
                        <label className="colour-field colour-field--hex">
                            <span>HEX</span>
                            <input
                                type="text"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                            />
                        </label>
                        {(["r", "g", "b"] as const).map((ch) => (
                            <label key={ch} className="colour-field">
                                <span>{ch.toUpperCase()}</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={255}
                                    value={rgb[ch]}
                                    onChange={(e) => {
                                        const next = {...rgb, [ch]: parseInt(e.target.value || "0", 10)};
                                        setValue(rgbToHex(next.r, next.g, next.b));
                                    }}
                                />
                            </label>
                        ))}
                    </div>
                    <div className="colour-presets">
                        {PRESETS.map((p) => (
                            <button
                                key={p.value}
                                type="button"
                                className="colour-preset"
                                style={{background: p.value}}
                                title={p.label}
                                onClick={() => setValue(p.value)}
                            />
                        ))}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default ColourProperty;
