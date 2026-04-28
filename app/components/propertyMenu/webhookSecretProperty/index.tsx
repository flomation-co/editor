import React, { useState, useEffect } from "react";
import { Icon } from "~/components/icons/Icon";
import "./index.css";

interface WebhookSecretPropertyProps {
    nodeId: string;
    name: string;
    label: string;
    value: string;
    onValueChange: (name: string, value: string) => void;
}

function generateToken(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

export default function WebhookSecretProperty({ nodeId, name, label, value, onValueChange }: WebhookSecretPropertyProps) {
    const [localValue, setLocalValue] = useState(value || "");
    const [copied, setCopied] = useState(false);

    // Sync from parent prop
    useEffect(() => {
        if (value && value !== localValue) {
            setLocalValue(value);
        }
    }, [value]);

    // Auto-generate a token if none exists
    useEffect(() => {
        if (!localValue) {
            const token = generateToken();
            setLocalValue(token);
            onValueChange(name, token);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleChange = (newValue: string) => {
        setLocalValue(newValue);
        onValueChange(name, newValue);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(localValue);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleRegenerate = () => {
        const token = generateToken();
        setLocalValue(token);
        onValueChange(name, token);
    };

    return (
        <div className="property-menu-input-row">
            <div className="property-menu-input-name">{label}</div>
            <div className="webhook-secret-container">
                <input
                    className="webhook-secret-input"
                    type="text"
                    value={localValue}
                    onChange={e => handleChange(e.target.value)}
                    placeholder="Enter or generate a secret token"
                />
                <div className="webhook-secret-actions">
                    <button
                        className="webhook-secret-btn"
                        onClick={handleCopy}
                        title={copied ? "Copied!" : "Copy to clipboard"}
                    >
                        <Icon name={copied ? "check" : "copy"} />
                    </button>
                    <button
                        className="webhook-secret-btn"
                        onClick={handleRegenerate}
                        title="Generate new token"
                    >
                        <Icon name="rotate" />
                    </button>
                </div>
            </div>
        </div>
    );
}
