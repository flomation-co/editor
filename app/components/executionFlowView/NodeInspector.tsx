import React from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark, faCheck, faSpinner, faClock, faChevronRight, faChevronDown } from "@fortawesome/pro-solid-svg-icons";
import type { NodeStatus } from "~/types";
import { useState } from "react";

type NodeInspectorProps = {
    nodeId: string;
    status: NodeStatus;
    onClose: () => void;
};

const SENSITIVE_KEYS = /secret|password|key|token|credential|auth/i;

// Try to parse JSON strings into objects for proper rendering.
// Handles values that were stringified by the old executor.
function maybeParseJson(value: any): any {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
        try { return JSON.parse(trimmed); } catch { /* not JSON */ }
    }
    return value;
}

function InspectorValue({ value, depth = 0 }: { value: any; depth?: number }) {
    const [expanded, setExpanded] = useState(depth < 1);
    const parsed = depth === 0 ? maybeParseJson(value) : value;

    if (parsed === null || parsed === undefined) {
        return <span className="ni-val ni-val--null">null</span>;
    }

    if (typeof parsed === 'boolean') {
        return <span className="ni-val ni-val--bool">{parsed.toString()}</span>;
    }

    if (typeof parsed === 'number') {
        return <span className="ni-val ni-val--number">{parsed}</span>;
    }

    if (typeof parsed === 'string') {
        if (parsed === '********') return <span className="ni-val ni-val--obfuscated">********</span>;
        if (parsed.length > 200 && depth > 1) {
            return <span className="ni-val ni-val--string">{parsed.slice(0, 197)}...</span>;
        }
        return <span className="ni-val ni-val--string">{parsed}</span>;
    }

    if (Array.isArray(parsed)) {
        if (parsed.length === 0) {
            return <span className="ni-val ni-val--empty">[] <span className="ni-hint">empty array</span></span>;
        }
        return (
            <div className="ni-tree">
                <div className="ni-tree-toggle" onClick={() => setExpanded(!expanded)}>
                    <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} className="ni-chevron" />
                    <span className="ni-type-badge ni-type-badge--array">Array</span>
                    <span className="ni-hint">{parsed.length} {parsed.length === 1 ? 'item' : 'items'}</span>
                </div>
                {expanded && (
                    <div className="ni-tree-children">
                        {parsed.map((item: any, i: number) => (
                            <div key={i} className="ni-tree-row">
                                <span className="ni-tree-key ni-tree-key--index">{i}</span>
                                <InspectorValue value={item} depth={depth + 1} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    if (typeof parsed === 'object') {
        const keys = Object.keys(parsed);
        if (keys.length === 0) {
            return <span className="ni-val ni-val--empty">{'{}'} <span className="ni-hint">empty object</span></span>;
        }
        return (
            <div className="ni-tree">
                <div className="ni-tree-toggle" onClick={() => setExpanded(!expanded)}>
                    <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} className="ni-chevron" />
                    <span className="ni-type-badge ni-type-badge--object">Object</span>
                    <span className="ni-hint">{keys.length} {keys.length === 1 ? 'property' : 'properties'}</span>
                </div>
                {expanded && (
                    <div className="ni-tree-children">
                        {keys.map(k => (
                            <div key={k} className="ni-tree-row">
                                <span className="ni-tree-key">{k}</span>
                                <InspectorValue value={parsed[k]} depth={depth + 1} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return <span className="ni-val">{String(parsed)}</span>;
}

export default function NodeInspector({ nodeId, status, onClose }: NodeInspectorProps) {
    const statusLabel = status.status.charAt(0).toUpperCase() + status.status.slice(1);
    const badgeClass = `node-inspector-badge node-inspector-badge--${status.status}`;

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="node-inspector-overlay" onClick={handleOverlayClick}>
            <div className="node-inspector">
                <div className="node-inspector-header">
                    <div>
                        <div className="node-inspector-title">{status.label || nodeId}</div>
                        <div className="node-inspector-subtitle">{status.action}</div>
                    </div>
                    <button className="node-inspector-close" onClick={onClose}>
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                <div className="node-inspector-meta">
                    <span className={badgeClass}>
                        {status.status === 'success' && <FontAwesomeIcon icon={faCheck} />}
                        {status.status === 'failed' && <FontAwesomeIcon icon={faXmark} />}
                        {status.status === 'running' && <FontAwesomeIcon icon={faSpinner} spin />}
                        {statusLabel}
                    </span>
                    {status.duration_ms !== undefined && status.duration_ms > 0 && (
                        <span className="node-inspector-badge node-inspector-badge--duration">
                            <FontAwesomeIcon icon={faClock} />
                            {status.duration_ms}ms
                        </span>
                    )}
                </div>

                {status.error && (
                    <div className="node-inspector-section">
                        <div className="node-inspector-section-title">Error</div>
                        <div className="node-inspector-error">{status.error}</div>
                    </div>
                )}

                <div className="node-inspector-section">
                    <div className="node-inspector-section-title">Inputs</div>
                    {status.inputs && Object.keys(status.inputs).length > 0 ? (
                        <div className="ni-entries">
                            {Object.entries(status.inputs).map(([key, value]) => (
                                <div key={key} className="ni-entry">
                                    <div className="ni-entry-key">{key}</div>
                                    <div className="ni-entry-value">
                                        {SENSITIVE_KEYS.test(key) || value === '********'
                                            ? <span className="ni-val ni-val--obfuscated">********</span>
                                            : <InspectorValue value={value} />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="node-inspector-empty">No inputs</div>
                    )}
                </div>

                <div className="node-inspector-section">
                    <div className="node-inspector-section-title">Outputs</div>
                    {status.outputs && Object.keys(status.outputs).length > 0 ? (
                        <div className="ni-entries">
                            {Object.entries(status.outputs).map(([key, value]) => (
                                <div key={key} className="ni-entry">
                                    <div className="ni-entry-key">{key}</div>
                                    <div className="ni-entry-value">
                                        <InspectorValue value={value} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="node-inspector-empty">No outputs</div>
                    )}
                </div>
            </div>
        </div>
    );
}
