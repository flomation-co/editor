import React, {useEffect, useState} from "react";
import type {VariableItem} from "~/components/propertyMenu/variableInput";
import VariablePicker from "~/components/propertyMenu/variablePicker";
import "./index.css";

type PropertyProps = {
    nodeId: string;
    name: string;
    placeholder: string;
    label: string;
    value: string;
    // currency is the resolved value of the sibling currency input (e.g. "gbp").
    // Drives which symbol prefixes the field; may be blank or a ${...} reference.
    currency?: string;
    required?: boolean;
    variables?: VariableItem[];
    onValueChange?: (property: string, value: any) => void;
}

function isVariableRef(val: string): boolean {
    return typeof val === "string" && /^\$\{[\w.-]+}$/.test(val);
}

// currencySymbol maps a Stripe currency code to a display symbol. Amounts are
// entered in MAJOR units (e.g. £12.34); the executor converts to the currency's
// smallest unit at run time. An unknown or variable currency falls back to the
// uppercased code (e.g. "AUD") so the field still reads clearly.
const SYMBOLS: Record<string, string> = {
    gbp: "£", usd: "$", eur: "€", jpy: "¥", aud: "$", cad: "$",
    nzd: "$", chf: "Fr", cny: "¥", inr: "₹", sek: "kr", nok: "kr",
    dkk: "kr", pln: "zł", zar: "R", brl: "R$", mxn: "$", sgd: "$",
    hkd: "$", krw: "₩", try: "₺", rub: "₽", ils: "₪", aed: "د.إ",
};

function symbolFor(currency?: string): string {
    if (!currency || currency.includes("${")) return "£";
    const code = currency.trim().toLowerCase();
    return SYMBOLS[code] ?? currency.trim().toUpperCase();
}

const MoneyProperty = (props: PropertyProps) => {
    const [ value, setValue ] = useState<string>(props.value);

    useEffect(() => {
        if (props.onValueChange) {
            props.onValueChange(props.name, value);
        }
    }, [ value ]);

    useEffect(() => {
        setValue(props.value);
    }, [ props.nodeId ]);

    const showPicker = isVariableRef(value);
    const symbol = symbolFor(props.currency);

    return (
        <div className={"property-menu-input-row"} key={props.name} >
            <div className={"property-menu-input-name"} >{props.label ? props.label : props.name}{props.required && <span className="property-menu-required"> *</span>}</div>
            {showPicker ? (
                <VariablePicker
                    value={value}
                    variables={props.variables || []}
                    onSelect={(ref) => setValue(ref)}
                    onClear={() => setValue("")}
                />
            ) : (
                <div className="variable-mode-row">
                    <div className="money-input-field">
                        <span className="money-input-symbol" title={props.currency || "GBP"}>{symbol}</span>
                        <input
                            className="money-input-amount"
                            placeholder={props.placeholder || "0.00"}
                            type="text"
                            inputMode="decimal"
                            value={value}
                            onChange={(e) => {
                                // Allow only digits and a single decimal point so the
                                // stored value stays a clean major-unit decimal.
                                const cleaned = e.target.value.replace(/[^0-9.]/g, "");
                                const parts = cleaned.split(".");
                                const normalised = parts.length > 2
                                    ? parts[0] + "." + parts.slice(1).join("")
                                    : cleaned;
                                setValue(normalised);
                            }}
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
        </div>
    )
}

export default MoneyProperty;
