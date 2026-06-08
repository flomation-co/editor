import React from 'react';
import type { NodeStatus } from "~/types";
import { useState } from "react";
import { Icon } from "~/components/icons/Icon";

type NodeInspectorProps = {
    nodeId: string;
    status: NodeStatus;
    iterations?: NodeStatus[];
    currentIteration?: number;
    onIterationChange?: (index: number) => void;
    onClose: () => void;
};

const SENSITIVE_KEYS = /secret|password|key|token|credential|auth|access_token|refresh_token|api_key|apikey/i;

// Detect values that look like tokens/secrets even if the key doesn't match
const SENSITIVE_VALUE_PATTERNS = [
    /^eyJ[a-zA-Z0-9_-]{20,}\./,          // JWT tokens
    /^(sk|pk|rk)[-_][a-zA-Z0-9]{20,}/,    // Stripe/API keys
    /^xox[bpsa]-[a-zA-Z0-9-]{20,}/,       // Slack tokens
    /^AKIA[A-Z0-9]{16}/,                   // AWS access keys
    /^ghp_[a-zA-Z0-9]{20,}/,              // GitHub PATs
    /^glpat-[a-zA-Z0-9_-]{20,}/,          // GitLab tokens
];

function isSensitiveValue(value: any): boolean {
    if (typeof value !== 'string' || value.length < 20) return false;
    return SENSITIVE_VALUE_PATTERNS.some(p => p.test(value));
}

function isSensitive(key: string, value: any): boolean {
    return SENSITIVE_KEYS.test(key) || value === '********' || isSensitiveValue(value);
}

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

// Detect base64-encoded media from the value and/or the key name.
function detectMedia(key: string, value: string): { type: 'audio' | 'image' | 'video' | null; mimeType: string } {
    const lk = key.toLowerCase();

    // Check by key name patterns
    if (lk.includes('audio') || lk.includes('voice') || lk.includes('speech') || lk.includes('tts')) {
        if (lk.includes('base64') || (value.length > 200 && /^[A-Za-z0-9+/=]/.test(value))) {
            return { type: 'audio', mimeType: lk.includes('ogg') ? 'audio/ogg' : 'audio/mpeg' };
        }
    }
    if (lk.includes('image') || lk.includes('photo') || lk.includes('screenshot') || lk.includes('thumbnail')) {
        if (lk.includes('base64') || (value.length > 200 && /^[A-Za-z0-9+/=]/.test(value))) {
            // Detect format from base64 header
            const mimeType = value.startsWith('/9j/') ? 'image/jpeg'
                : value.startsWith('iVBOR') ? 'image/png'
                : value.startsWith('R0lGOD') ? 'image/gif'
                : value.startsWith('UklGR') ? 'image/webp'
                : 'image/png';
            return { type: 'image', mimeType };
        }
    }
    if (lk.includes('video')) {
        if (lk.includes('base64') || (value.length > 200 && /^[A-Za-z0-9+/=]/.test(value))) {
            return { type: 'video', mimeType: 'video/mp4' };
        }
    }

    // Check by data URI prefix
    if (value.startsWith('data:audio/')) return { type: 'audio', mimeType: value.split(';')[0].replace('data:', '') };
    if (value.startsWith('data:image/')) return { type: 'image', mimeType: value.split(';')[0].replace('data:', '') };
    if (value.startsWith('data:video/')) return { type: 'video', mimeType: value.split(';')[0].replace('data:', '') };

    return { type: null, mimeType: '' };
}

function MediaPlayer({ type, mimeType, data }: { type: 'audio' | 'image' | 'video'; mimeType: string; data: string }) {
    // Strip data URI prefix if present, otherwise assume raw base64
    const base64 = data.startsWith('data:') ? data : `data:${mimeType};base64,${data}`;
    const sizeKB = Math.round((data.length * 3) / 4 / 1024);

    if (type === 'audio') {
        // Key on base64 hash to force re-mount when iteration changes —
        // browsers cache <audio> sources and ignore src attribute updates.
        const audioKey = data.slice(-32);
        return (
            <div className="ni-media">
                <audio key={audioKey} controls preload="metadata" style={{ width: '100%', maxWidth: 360, height: 40 }}>
                    <source src={base64} type={mimeType} />
                </audio>
                <span className="ni-hint">{mimeType} ({sizeKB} KB)</span>
            </div>
        );
    }

    if (type === 'image') {
        return (
            <div className="ni-media">
                <img
                    src={base64}
                    alt="output"
                    style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 6, marginTop: 4 }}
                />
                <span className="ni-hint">{mimeType} ({sizeKB} KB)</span>
            </div>
        );
    }

    if (type === 'video') {
        return (
            <div className="ni-media">
                <video controls preload="metadata" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 6 }}>
                    <source src={base64} type={mimeType} />
                </video>
                <span className="ni-hint">{mimeType} ({sizeKB} KB)</span>
            </div>
        );
    }

    return null;
}

function InspectorValue({ value, depth = 0, keyName = '' }: { value: any; depth?: number; keyName?: string }) {
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

        // Detect and render media content (audio, image, video)
        if (keyName && parsed.length > 100) {
            const media = detectMedia(keyName, parsed);
            if (media.type) {
                return <MediaPlayer type={media.type} mimeType={media.mimeType} data={parsed} />;
            }
        }

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
                    <Icon name={expanded? "chevron-down" : "chevron-right"} className="ni-chevron" />
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
                    <Icon name={expanded? "chevron-down" : "chevron-right"} className="ni-chevron" />
                    <span className="ni-type-badge ni-type-badge--object">Object</span>
                    <span className="ni-hint">{keys.length} {keys.length === 1 ? 'property' : 'properties'}</span>
                </div>
                {expanded && (
                    <div className="ni-tree-children">
                        {keys.map(k => (
                            <div key={k} className="ni-tree-row">
                                <span className="ni-tree-key">{k}</span>
                                {isSensitive(k, parsed[k])
                                    ? <span className="ni-val ni-val--obfuscated">********</span>
                                    : <InspectorValue value={parsed[k]} depth={depth + 1} keyName={k} />}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return <span className="ni-val">{String(parsed)}</span>;
}

// Derive a human-readable action name from the action ID path.
// e.g. "git/checkout" → "Checkout", "string/upper_case" → "Upper Case"
function humaniseActionLabel(label: string): string {
    if (!label) return '';
    const lastSegment = label.includes('/') ? label.split('/').pop()! : label;
    return lastSegment
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

export default function NodeInspector({ nodeId, status, iterations, currentIteration, onIterationChange, onClose }: NodeInspectorProps) {
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
                        <div className="node-inspector-title">{humaniseActionLabel(status.label) || nodeId}</div>
                        <div className="node-inspector-subtitle">{status.label}</div>
                    </div>
                    <button className="node-inspector-close" onClick={onClose}>
                        <Icon name="xmark" />
                    </button>
                </div>

                {iterations && iterations.length > 1 && onIterationChange && currentIteration !== undefined && (
                    <div className="node-inspector-iteration">
                        <button
                            disabled={currentIteration === 0}
                            onClick={() => onIterationChange(currentIteration - 1)}
                        >
                            <Icon name="chevron-left" />
                        </button>
                        <span>Iteration {currentIteration + 1} of {iterations.length}</span>
                        <button
                            disabled={currentIteration === iterations.length - 1}
                            onClick={() => onIterationChange(currentIteration + 1)}
                        >
                            <Icon name="chevron-right" />
                        </button>
                    </div>
                )}

                <div className="node-inspector-meta">
                    <span className={badgeClass}>
                        {status.status === 'success' && <Icon name="check" />}
                        {status.status === 'failed' && <Icon name="xmark" />}
                        {status.status === 'running' && <Icon name="spinner" spin />}
                        {statusLabel}
                    </span>
                    {status.duration_ms !== undefined && status.duration_ms > 0 && (
                        <span className="node-inspector-badge node-inspector-badge--duration">
                            <Icon name="clock" />
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
                                        {isSensitive(key, value)
                                            ? <span className="ni-val ni-val--obfuscated">********</span>
                                            : <InspectorValue value={value} keyName={key} />}
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
                                        {isSensitive(key, value)
                                            ? <span className="ni-val ni-val--obfuscated">********</span>
                                            : <InspectorValue value={value} keyName={key} />}
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
