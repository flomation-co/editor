import React, { useState, useEffect, useRef } from "react";
import api from "~/lib/api";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import type { Flo } from "~/types";
import "./index.css";

type FlowSelectPropertyProps = {
    nodeId: string;
    name: string;
    label?: string;
    value?: string;
    required?: boolean;
    onValueChange?: (property: string, value: string) => void;
};

export default function FlowSelectProperty(props: FlowSelectPropertyProps) {
    const config = useConfig();
    const token = useCookieToken();

    const [flows, setFlows] = useState<Flo[]>([]);
    const [search, setSearch] = useState("");
    const [open, setOpen] = useState(false);
    const [selectedId, setSelectedId] = useState(props.value || "");
    const [selectedName, setSelectedName] = useState("");
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const url = config("AUTOMATE_API_URL");
        api.get(`${url}/api/v1/flo?limit=200`, {
            headers: { Authorization: "Bearer " + token },
        })
            .then(res => {
                let list: Flo[] = [];
                if (res.data && Array.isArray(res.data.flos)) {
                    list = res.data.flos;
                } else if (res.data && Array.isArray(res.data)) {
                    list = res.data;
                }
                setFlows(list);
            })
            .catch(() => {});
    }, []);

    // Re-seed the selected id whenever the authoritative value changes — not
    // just on a node switch. An external update (reload / undo / a sibling
    // re-render handing back a fresh value) must be reflected, otherwise the
    // control keeps showing a stale selection. Keyed on props.value so it tracks
    // the source of truth; the search box has its own state and is untouched.
    useEffect(() => {
        setSelectedId(props.value || "");
    }, [props.nodeId, props.value]);

    // Resolve the display name from the loaded flow list whenever the selection
    // or the list changes. Until the list loads (or if the flow isn't in it) the
    // input falls back to showing the raw id, so the value is never lost.
    useEffect(() => {
        if (!selectedId) { setSelectedName(""); return; }
        const match = flows.find(f => f.id === selectedId);
        if (match) setSelectedName(match.name);
    }, [selectedId, flows]);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const filtered = flows.filter(f =>
        f.name.toLowerCase().includes(search.toLowerCase())
    );

    const handleSelect = (flow: Flo) => {
        setSelectedId(flow.id);
        setSelectedName(flow.name);
        setOpen(false);
        if (props.onValueChange) {
            props.onValueChange(props.name, flow.id);
        }
    };

    return (
        <div className="property-menu-input-row" ref={ref}>
            <div className="property-menu-input-name">
                {props.label || "Flow"}
                {props.required && <span className="property-menu-required"> *</span>}
            </div>
            <div className="flow-select-wrap">
                <input
                    className="flow-select-input"
                    value={open ? search : (selectedName || selectedId || "")}
                    onChange={e => { setSearch(e.target.value); setOpen(true); }}
                    onFocus={() => { setSearch(""); setOpen(true); }}
                    placeholder="Search flows..."
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
                        {filtered.length === 0 && (
                            <div className="flow-select-empty">No flows found</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
