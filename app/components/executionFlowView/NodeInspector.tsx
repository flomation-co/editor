import React from 'react';
import type { NodeStatus } from "~/types";
import { useState } from "react";
import { Icon } from "~/components/icons/Icon";
// isSensitive (key-name + value) lives in lib/secretDetection so this
// surface stays in lock-step with the property-menu warning. Adding
// a new pattern in one place is enough — both render-time
// obfuscation here and edit-time warning in VariableInput pick it
// up together.
import { isSensitive } from "~/lib/secretDetection";

type NodeInspectorProps = {
    nodeId: string;
    status: NodeStatus;
    iterations?: NodeStatus[];
    currentIteration?: number;
    onIterationChange?: (index: number) => void;
    onClose: () => void;
};

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
//
// Detection precedence — earlier wins:
//   1. data: URI prefix (data:image/, data:application/pdf, etc.)
//   2. Base64 magic-byte signatures — work regardless of the key name. PDF
//      ("JVBERi0…" = "%PDF-1."), PNG ("iVBOR"), JPEG ("/9j/"), GIF, WebP.
//   3. Key-name heuristics — used for formats without a reliable base64
//      signature (audio, video) or as a fallback for PDF when the header
//      wasn't sniffable.
function detectMedia(key: string, value: string): { type: 'audio' | 'image' | 'video' | 'pdf' | 'gpx' | null; mimeType: string } {
    const lk = key.toLowerCase();

    // 1. Data URI prefix
    if (value.startsWith('data:audio/')) return { type: 'audio', mimeType: value.split(';')[0].replace('data:', '') };
    if (value.startsWith('data:image/')) return { type: 'image', mimeType: value.split(';')[0].replace('data:', '') };
    if (value.startsWith('data:video/')) return { type: 'video', mimeType: value.split(';')[0].replace('data:', '') };
    if (value.startsWith('data:application/pdf')) return { type: 'pdf', mimeType: 'application/pdf' };

    // 2. Raw base64 magic bytes — fires regardless of key name
    if (value.length > 200 && /^[A-Za-z0-9+/]/.test(value)) {
        if (value.startsWith('JVBERi0')) return { type: 'pdf', mimeType: 'application/pdf' };
        if (value.startsWith('iVBOR')) return { type: 'image', mimeType: 'image/png' };
        if (value.startsWith('/9j/')) return { type: 'image', mimeType: 'image/jpeg' };
        if (value.startsWith('R0lGOD')) return { type: 'image', mimeType: 'image/gif' };
        if (value.startsWith('UklGR')) return { type: 'image', mimeType: 'image/webp' };
    }

    // 2a. Plain-text formats with obvious signatures
    if (value.length > 50 && value.trimStart().startsWith('<?xml') && value.includes('<gpx')) {
        return { type: 'gpx', mimeType: 'application/gpx+xml' };
    }

    // 3. Key-name heuristics for formats whose base64 prefix is too variable
    //    (audio/video codecs differ wildly) or as a fallback.
    if (lk.includes('audio') || lk.includes('voice') || lk.includes('speech') || lk.includes('tts')) {
        if (lk.includes('base64') || (value.length > 200 && /^[A-Za-z0-9+/=]/.test(value))) {
            return { type: 'audio', mimeType: lk.includes('ogg') ? 'audio/ogg' : 'audio/mpeg' };
        }
    }
    if (lk.includes('video')) {
        if (lk.includes('base64') || (value.length > 200 && /^[A-Za-z0-9+/=]/.test(value))) {
            return { type: 'video', mimeType: 'video/mp4' };
        }
    }
    if (lk.includes('image') || lk.includes('photo') || lk.includes('screenshot') || lk.includes('thumbnail')) {
        if (lk.includes('base64') || (value.length > 200 && /^[A-Za-z0-9+/=]/.test(value))) {
            return { type: 'image', mimeType: 'image/png' };
        }
    }
    if (lk.includes('pdf')) {
        return { type: 'pdf', mimeType: 'application/pdf' };
    }
    if (lk.includes('gpx')) {
        return { type: 'gpx', mimeType: 'application/gpx+xml' };
    }

    return { type: null, mimeType: '' };
}

// extensionFor returns a file extension suitable for the download attribute
// so saved files open in the right viewer without manual renaming.
function extensionFor(mimeType: string): string {
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType === 'application/gpx+xml') return 'gpx';
    if (mimeType === 'image/png') return 'png';
    if (mimeType === 'image/jpeg') return 'jpg';
    if (mimeType === 'image/gif') return 'gif';
    if (mimeType === 'image/webp') return 'webp';
    if (mimeType === 'audio/mpeg') return 'mp3';
    if (mimeType === 'audio/ogg') return 'ogg';
    if (mimeType === 'video/mp4') return 'mp4';
    return 'bin';
}

function MediaPlayer({ type, mimeType, data, keyName }: { type: 'audio' | 'image' | 'video' | 'pdf' | 'gpx'; mimeType: string; data: string; keyName: string }) {
    // GPX is text — the value is the raw XML, not base64. Build a UTF-8
    // data URL so the download preserves Unicode characters like accented
    // place names. Sizing uses byte length of the encoded UTF-8.
    const isText = type === 'gpx';
    const downloadHref = isText
        ? `data:${mimeType};charset=utf-8,${encodeURIComponent(data)}`
        : (data.startsWith('data:') ? data : `data:${mimeType};base64,${data}`);
    const base64 = downloadHref;
    const sizeKB = isText
        ? Math.round(new TextEncoder().encode(data).length / 1024)
        : Math.round((data.length * 3) / 4 / 1024);
    const filename = `${keyName || 'output'}.${extensionFor(mimeType)}`;

    const downloadLabel = type === 'gpx' ? 'Download GPX' : 'Download';
    const downloadRow = (
        <div className="ni-media-footer">
            <a className="ni-download-btn" href={downloadHref} download={filename}>
                <Icon name="file-arrow-down" /> {downloadLabel}
            </a>
            <span className="ni-hint">{mimeType} ({sizeKB} KB)</span>
        </div>
    );

    if (type === 'audio') {
        // Key on base64 hash to force re-mount when iteration changes —
        // browsers cache <audio> sources and ignore src attribute updates.
        const audioKey = data.slice(-32);
        return (
            <div className="ni-media">
                <audio key={audioKey} controls preload="metadata" style={{ width: '100%', maxWidth: 360, height: 40 }}>
                    <source src={base64} type={mimeType} />
                </audio>
                {downloadRow}
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
                {downloadRow}
            </div>
        );
    }

    if (type === 'video') {
        return (
            <div className="ni-media">
                <video controls preload="metadata" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 6 }}>
                    <source src={base64} type={mimeType} />
                </video>
                {downloadRow}
            </div>
        );
    }

    if (type === 'pdf') {
        // <embed> renders the PDF inline using the browser's native viewer.
        // data: URIs work in Chrome/Safari/Firefox for embedded PDFs;
        // mobile Safari falls through to a placeholder + the download
        // button as a fallback.
        return (
            <div className="ni-media">
                <embed
                    src={base64}
                    type="application/pdf"
                    style={{ width: '100%', height: 480, borderRadius: 6, marginTop: 4, border: '1px solid rgba(255,255,255,0.08)' }}
                />
                {downloadRow}
            </div>
        );
    }

    if (type === 'gpx') {
        // GPX is text — show a scrollable XML preview and the download
        // button. Truncation prevents very long routes (1000s of trkpt
        // lines) from dominating the inspector; the full document is
        // still saved via Download.
        const preview = data.length > 1200 ? data.slice(0, 1200) + '\n…' : data;
        return (
            <div className="ni-media">
                <pre className="ni-text-preview">{preview}</pre>
                {downloadRow}
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

        // Detect and render media content (audio, image, video, pdf)
        if (keyName && parsed.length > 100) {
            const media = detectMedia(keyName, parsed);
            if (media.type) {
                return <MediaPlayer type={media.type} mimeType={media.mimeType} data={parsed} keyName={keyName} />;
            }
        }

        if (parsed.length > 200 && depth > 1) {
            return <span className="ni-val ni-val--string">{parsed.slice(0, 197)}...</span>;
        }

        // Multi-line strings — typically code, logs, or structured
        // text — render as a line-numbered monospace block at the
        // top level. The "Line 88:17" callouts in script error
        // messages line up cleanly against the gutter, which is the
        // whole point of doing this at the inspector layer.
        if (depth === 0 && parsed.includes('\n')) {
            const lines = parsed.split('\n');
            if (lines.length >= 2) {
                return (
                    <div className="ni-code-block">
                        <div className="ni-code-gutter" aria-hidden="true">
                            {lines.map((_, i) => (
                                <div key={i} className="ni-code-line-no">{i + 1}</div>
                            ))}
                        </div>
                        <pre className="ni-code-content">
                            {lines.map((line, i) => (
                                <div key={i} className="ni-code-line">{line || '​'}</div>
                            ))}
                        </pre>
                    </div>
                );
            }
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
