import React, { useState, useEffect, useRef } from "react";
import api from "~/lib/api";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import type { Flo } from "~/types";
import "./index.css";

type FlowSelectProps = {
    value?: string;
    onChange: (flowId: string) => void;
    placeholder?: string;
    // Extra class on the wrapper so callers can size/position it (the property
    // menu takes full width; the gateway endpoint row constrains it).
    className?: string;
};

// FlowSelect is the shared searchable flow autocomplete: a text box that filters
// the user's flows as you type, with a dropdown of matches. Self-contained (it
// fetches the flow list) and unwrapped (no label / property-menu chrome), so it
// drops into any layout. FlowSelectProperty wraps it for the node property menu.
export default function FlowSelect({ value, onChange, placeholder = "Search flows...", className }: FlowSelectProps) {
    const config = useConfig();
    const token = useCookieToken();

    const [flows, setFlows] = useState<Flo[]>([]);
    const [search, setSearch] = useState("");
    const [open, setOpen] = useState(false);
    const [selectedId, setSelectedId] = useState(value || "");
    const [selectedName, setSelectedName] = useState("");
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const url = config("AUTOMATE_API_URL");
        api.get(`${url}/api/v1/flo?limit=200`, { headers: { Authorization: "Bearer " + token } })
            .then(res => {
                let list: Flo[] = [];
                if (res.data && Array.isArray(res.data.flos)) list = res.data.flos;
                else if (res.data && Array.isArray(res.data)) list = res.data;
                setFlows(list);
            })
            .catch(() => {});
    }, []);

    // Track the authoritative value (reload / undo / external update).
    useEffect(() => { setSelectedId(value || ""); }, [value]);

    // Resolve the display name from the loaded list; fall back to the raw id so
    // the value is never lost before the list arrives.
    useEffect(() => {
        if (!selectedId) { setSelectedName(""); return; }
        const match = flows.find(f => f.id === selectedId);
        if (match) setSelectedName(match.name);
    }, [selectedId, flows]);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const filtered = flows.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

    const handleSelect = (flow: Flo) => {
        setSelectedId(flow.id);
        setSelectedName(flow.name);
        setOpen(false);
        onChange(flow.id);
    };

    return (
        <div className={`flow-select-wrap ${className ?? ""}`.trim()} ref={ref}>
            <input
                className="flow-select-input"
                value={open ? search : (selectedName || selectedId || "")}
                onChange={e => { setSearch(e.target.value); setOpen(true); }}
                onFocus={() => { setSearch(""); setOpen(true); }}
                placeholder={placeholder}
            />
            {open && (
                <div className="flow-select-dropdown">
                    {filtered.map(f => (
                        <div
                            key={f.id}
                            className={`flow-select-option ${selectedId === f.id ? "selected" : ""}`}
                            onClick={() => handleSelect(f)}
                        >
                            <div className="flow-select-dot" />
                            {f.name}
                        </div>
                    ))}
                    {filtered.length === 0 && <div className="flow-select-empty">No flows found</div>}
                </div>
            )}
        </div>
    );
}
