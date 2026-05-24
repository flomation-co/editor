import React, { useState, useEffect, useRef } from "react";
import api from "~/lib/api";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import { Icon } from "~/components/icons/Icon";
import "./index.css";

type FacebookPage = {
    id: string;
    name: string;
    category: string;
};

type Props = {
    nodeId: string;
    name: string;
    label?: string;
    value?: string;
    required?: boolean;
    /** The credential name (e.g. "FB_ANDY") used to resolve the token server-side */
    credentialName?: string;
    /** The environment ID to look up the credential from */
    environmentId?: string;
    onValueChange?: (property: string, value: string) => void;
};

export default function FacebookPageProperty(props: Props) {
    const config = useConfig();
    const token = useCookieToken();

    const [pages, setPages] = useState<FacebookPage[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [selectedId, setSelectedId] = useState(props.value || "");
    const [selectedName, setSelectedName] = useState("");
    const [error, setError] = useState("");
    const ref = useRef<HTMLDivElement>(null);

    const fetchPages = () => {
        if (!props.environmentId || !props.credentialName) {
            setError("Set an environment and Facebook credential first");
            return;
        }

        setLoading(true);
        setError("");

        const url = config("AUTOMATE_API_URL");
        api.get(`${url}/api/v1/environment/${props.environmentId}/facebook-pages/${encodeURIComponent(props.credentialName)}`, {
            headers: { Authorization: "Bearer " + token },
        })
            .then(res => {
                const data = res?.data || {};
                if (data.error) {
                    setError(data.error);
                    setPages([]);
                    return;
                }
                const list: FacebookPage[] = data.pages || [];
                setPages(list);
                if (selectedId) {
                    const match = list.find(p => p.id === selectedId);
                    if (match) setSelectedName(match.name);
                }
                if (list.length > 0 && !selectedId) {
                    setOpen(true);
                }
            })
            .catch(() => setError("Failed to fetch pages"))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        setSelectedId(props.value || "");
        setSelectedName("");
    }, [props.nodeId]);

    // Auto-fetch when environment and credential are available
    useEffect(() => {
        if (props.environmentId && props.credentialName) {
            fetchPages();
        }
    }, [props.environmentId, props.credentialName]);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const selectPage = (page: FacebookPage) => {
        setSelectedId(page.id);
        setSelectedName(page.name);
        setOpen(false);
        if (props.onValueChange) {
            props.onValueChange(props.name, page.id);
        }
    };

    return (
        <div className="property-menu-input-row fb-page-property" ref={ref}>
            <div className="property-menu-input-name">
                {props.label || "Facebook Page"}
                {props.required && <span className="property-menu-required"> *</span>}
            </div>

            <div className="fb-page-selector" onClick={() => {
                if (pages.length > 0) setOpen(!open);
                else fetchPages();
            }}>
                <div className="fb-page-selected">
                    {loading ? (
                        <span className="fb-page-loading"><Icon name="spinner" spin /> Loading pages...</span>
                    ) : selectedName ? (
                        <span>{selectedName}</span>
                    ) : selectedId ? (
                        <span className="fb-page-id">{selectedId}</span>
                    ) : (
                        <span className="fb-page-placeholder">Click to load pages...</span>
                    )}
                </div>
                <Icon name="chevron-down" className="fb-page-chevron" />
            </div>

            {error && (
                <div className="fb-page-error">{error}</div>
            )}

            {open && pages.length > 0 && (
                <div className="fb-page-dropdown">
                    {pages.map(page => (
                        <div
                            key={page.id}
                            className={`fb-page-option ${page.id === selectedId ? "fb-page-option--selected" : ""}`}
                            onClick={() => selectPage(page)}
                        >
                            <div className="fb-page-option-name">{page.name}</div>
                            <div className="fb-page-option-meta">
                                {page.category && <span>{page.category}</span>}
                                <span className="fb-page-option-id">{page.id}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
