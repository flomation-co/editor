import React from 'react';
import type { NodeStatus } from "~/types";
import { useState, useEffect, useMemo } from "react";
import { Icon } from "~/components/icons/Icon";
import useCookieToken from "~/components/cookie";
import useConfig from "~/components/config";
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
// parseBlobToken extracts the 32-char hex handle and (optional)
// type/size hints from a flo:blob:HANDLE?size=N&type=mime token.
// Returns null when the string doesn't match — used both by
// detectMedia and the MediaPlayer fetch path.
//
// Shape mirrors the executor's blobstore.go ParseBlobToken so any
// canonical token written by the engine round-trips cleanly. We're
// lenient about the query string (size or type can be absent) but
// strict about the handle being exactly 32 lowercase hex characters.
function parseBlobToken(value: string): { handle: string; mime: string; size: number } | null {
    if (!value.startsWith('flo:blob:')) return null;
    const body = value.slice('flo:blob:'.length);
    const queryStart = body.indexOf('?');
    const handle = queryStart < 0 ? body : body.slice(0, queryStart);
    if (!/^[0-9a-f]{32}$/.test(handle)) return null;
    let mime = '';
    let size = 0;
    if (queryStart >= 0) {
        const params = new URLSearchParams(body.slice(queryStart + 1));
        mime = params.get('type') || '';
        const sizeStr = params.get('size');
        if (sizeStr) {
            const parsed = parseInt(sizeStr, 10);
            if (!isNaN(parsed)) size = parsed;
        }
    }
    return { handle, mime, size };
}

function detectMedia(key: string, value: string): { type: 'audio' | 'image' | 'video' | 'pdf' | 'gpx' | null; mimeType: string } {
    const lk = key.toLowerCase();

    // 0. Blob reference (executor-tokenised output). The mime hint on
    //    the token is canonical because the executor wrote it at
    //    Put() time — we trust it over the key-name heuristics.
    //    The MediaPlayer fetches the actual bytes from the public
    //    /api/v1/blob/:handle endpoint when the data is a token.
    const blob = parseBlobToken(value);
    if (blob) {
        const m = blob.mime || '';
        if (m.startsWith('audio/')) return { type: 'audio', mimeType: m };
        if (m.startsWith('image/')) return { type: 'image', mimeType: m };
        if (m.startsWith('video/')) return { type: 'video', mimeType: m };
        if (m === 'application/pdf') return { type: 'pdf', mimeType: m };
        if (m === 'application/gpx+xml') return { type: 'gpx', mimeType: m };
        // No usable mime hint — fall back to key-name heuristics so a
        // mis-labelled blob still tries to render the right way.
        if (lk.includes('audio') || lk.includes('voice') || lk.includes('speech') || lk.includes('tts')) {
            return { type: 'audio', mimeType: 'audio/mpeg' };
        }
        if (lk.includes('image') || lk.includes('photo') || lk.includes('screenshot') || lk.includes('thumbnail')) {
            return { type: 'image', mimeType: 'image/png' };
        }
        if (lk.includes('video')) {
            return { type: 'video', mimeType: 'video/mp4' };
        }
        // Unknown mime AND key — render as a generic download badge.
        return { type: null, mimeType: '' };
    }

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

// extensionFor returns a file extension suitable for the download attribute so
// saved files open in the right viewer without manual renaming. Known mimes get
// a curated extension; anything else is DERIVED from the mime subtype (e.g.
// video/x-m4v → m4v, image/svg+xml → svg) so a media file never downloads as a
// generic .bin just because its exact subtype wasn't hard-coded.
function extensionFor(mimeType: string): string {
    const known: Record<string, string> = {
        'application/pdf': 'pdf',
        'application/gpx+xml': 'gpx',
        'application/json': 'json',
        'image/png': 'png',
        'image/apng': 'png',
        'image/jpeg': 'jpg',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/svg+xml': 'svg',
        'audio/mpeg': 'mp3',
        'audio/ogg': 'ogg',
        'audio/wav': 'wav',
        'audio/x-wav': 'wav',
        'audio/webm': 'weba',
        'video/mp4': 'mp4',
        'video/x-m4v': 'm4v',
        'video/quicktime': 'mov',
        'video/webm': 'webm',
        'video/x-matroska': 'mkv',
        'video/x-msvideo': 'avi',
    };
    if (known[mimeType]) return known[mimeType];
    // Derive from the subtype: strip an "x-" vendor prefix and any "+suffix"
    // (image/svg+xml → svg). Accept only a short alphanumeric token as an extension.
    const sub = (mimeType.split('/')[1] || '').replace(/^x-/, '').replace(/\+.*$/, '');
    if (/^[a-z0-9]{1,5}$/.test(sub)) return sub;
    return 'bin';
}

// isRenderableMedia answers "would this value display as a media
// player (audio/image/video/pdf/gpx) if we let InspectorValue have
// it?". Used by the inputs/outputs renderer to decide whether the
// secret-mask should suppress the value or step aside so the media
// player can render. Without this, large base64 audio/image/video
// fields get masked as `********` because their values match the
// HIGH_ENTROPY_BASE64 heuristic, even though the user wants to
// inspect/play/download them.
function isRenderableMedia(key: string, value: unknown): boolean {
    if (typeof value !== 'string') return false;
    // Blob tokens are short (~80 chars) but still resolve to playable
    // media — skip the length floor for them. Everything else still
    // needs >100 chars to plausibly be inline base64.
    if (parseBlobToken(value)) return detectMedia(key, value).type !== null;
    if (value.length <= 100) return false;
    return detectMedia(key, value).type !== null;
}

function MediaPlayer({ type, mimeType, data, keyName }: { type: 'audio' | 'image' | 'video' | 'pdf' | 'gpx'; mimeType: string; data: string; keyName: string }) {
    // GPX is text — the value is the raw XML, not base64. Build a UTF-8
    // data URL so the download preserves Unicode characters like accented
    // place names. Sizing uses byte length of the encoded UTF-8.
    const isText = type === 'gpx';

    // Blob tokens have to round-trip through the JWT-protected
    // /api/v1/blob/:handle endpoint — we use the cookie token for
    // auth and the API base URL from runtime config. The browser
    // hands us a Blob directly so we can revoke its URL on unmount
    // the same way as base64-decoded sources.
    //
    // useConfig() returns a fresh getter closure on every render, so
    // we MUST resolve the API URL down to a plain string here and
    // depend on the string (not the closure) in the effect below.
    // Without this, the effect refires every render → revokes its
    // freshly-created blob URL → fires again → infinite loop, and
    // the browser console fills with ERR_FILE_NOT_FOUND on revoked
    // blob: URLs. Same logic applies to any consumer reading from
    // useConfig inside an effect dep array.
    const blobToken = parseBlobToken(data);
    const cookieToken = useCookieToken();
    const getConfig = useConfig();
    const apiURL = getConfig('AUTOMATE_API_URL', '') ?? '';

    // For binary media we ultimately want a blob: URL — large data:
    // URIs in an <a download> attribute fail silently in Chrome and
    // Safari above ~200KB, which is exactly the size of any real TTS
    // audio. The decode itself uses fetch() rather than atob() because
    // fetch is more tolerant of whitespace, line breaks and padding
    // edge cases that base64 strings sometimes pick up in transit.
    //
    // The decode is asynchronous, so this is a useEffect (not useMemo)
    // backed by component state. The cleanup revokes any blob URL we
    // created when the component unmounts or the source data changes.
    const [mediaUrl, setMediaUrl] = useState<string>('');
    const [fetchError, setFetchError] = useState<string>('');
    const [actualSize, setActualSize] = useState<number>(blobToken ? blobToken.size : 0);

    useEffect(() => {
        setFetchError('');

        if (isText) {
            setMediaUrl(`data:${mimeType};charset=utf-8,${encodeURIComponent(data)}`);
            return;
        }
        // Already-formed data URIs (e.g. pasted screenshot) — use
        // directly. The fetch path below would also work but skipping
        // it avoids a tiny async hop for the common case.
        if (data.startsWith('data:')) {
            setMediaUrl(data);
            return;
        }

        let cancelled = false;
        let blobUrl: string | null = null;

        (async () => {
            try {
                let res: Response;
                if (blobToken) {
                    // Blob-token path: fetch from the JWT endpoint and
                    // let the server pin the Content-Type. We override
                    // with the token's mime when the response doesn't
                    // carry one (some proxies strip Content-Type on
                    // streamed responses), so the <audio>/<video>
                    // element gets a usable hint either way.
                    res = await fetch(`${apiURL}/api/v1/blob/${blobToken.handle}`, {
                        headers: cookieToken ? { Authorization: `Bearer ${cookieToken}` } : undefined,
                    });
                    if (!res.ok) {
                        throw new Error(`blob fetch ${res.status}`);
                    }
                } else {
                    // Inline base64 path: fetch() can decode a data:
                    // URI of arbitrary size server-internally and hand
                    // us a Blob — no JS-land memory pressure, no
                    // atob() failure modes around whitespace or padding.
                    res = await fetch(`data:${mimeType};base64,${data}`);
                }
                const blob = await res.blob();
                if (cancelled) return;
                setActualSize(blob.size);
                blobUrl = URL.createObjectURL(blob);
                setMediaUrl(blobUrl);
            } catch (err) {
                console.warn('[MediaPlayer] failed to build blob URL for', keyName, err);
                if (cancelled) return;
                if (blobToken) {
                    // Surface a clear error message; the inline
                    // base64 fallback isn't available for tokens.
                    setFetchError(err instanceof Error ? err.message : String(err));
                } else {
                    // Bad base64 falls back to the raw data URI — the
                    // download and player will likely fail, but at
                    // least we've surfaced *something*.
                    setMediaUrl(`data:${mimeType};base64,${data}`);
                }
            }
        })();

        return () => {
            cancelled = true;
            if (blobUrl) URL.revokeObjectURL(blobUrl);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- blobToken is a derived object, fingerprint via the raw `data` string instead
    }, [data, mimeType, keyName, isText, cookieToken, apiURL]);

    const downloadHref = mediaUrl;
    const base64 = mediaUrl;
    // Size source-of-truth depends on shape: GPX from the text length,
    // blob tokens from the token's `size=` hint (or the fetched blob's
    // size after fetch), inline base64 from the encoded length.
    const sizeKB = isText
        ? Math.round(new TextEncoder().encode(data).length / 1024)
        : blobToken
            ? Math.round(actualSize / 1024)
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

    // Blob token resolution failed: render a clear "unavailable" badge
    // instead of a broken player. This is the diagnostic affordance
    // the user asked for — a failed fetch shouldn't look like raw
    // text or a silently-broken control.
    if (blobToken && fetchError) {
        return (
            <div className="ni-media">
                <div className="ni-media-loading">
                    <Icon name="circle-exclamation" /> Blob unavailable: {fetchError}
                </div>
            </div>
        );
    }

    if (type === 'audio') {
        // Key on the mediaUrl itself. The blob URL is created
        // asynchronously by the effect above, so the first render
        // has mediaUrl="" and the <audio> element tries to load an
        // empty src. Browsers cache that failed load and ignore
        // subsequent src changes — keying on the URL forces a fresh
        // <audio> mount once the blob URL arrives. Empty src skips
        // rendering entirely to avoid that initial failed-load
        // state ever happening.
        if (!mediaUrl) {
            return (
                <div className="ni-media">
                    <div className="ni-media-loading"><Icon name="spinner" spin /> Preparing audio…</div>
                    {downloadRow}
                </div>
            );
        }
        return (
            <div className="ni-media">
                <audio key={mediaUrl} controls preload="metadata" style={{ width: '100%', maxWidth: 360, height: 40 }}>
                    <source src={base64} type={mimeType} />
                </audio>
                {downloadRow}
            </div>
        );
    }

    if (type === 'image') {
        if (!mediaUrl) {
            return (
                <div className="ni-media">
                    <div className="ni-media-loading"><Icon name="spinner" spin /> Preparing image…</div>
                    {downloadRow}
                </div>
            );
        }
        return (
            <div className="ni-media">
                <img
                    key={mediaUrl}
                    src={base64}
                    alt="output"
                    style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 6, marginTop: 4 }}
                />
                {downloadRow}
            </div>
        );
    }

    if (type === 'video') {
        if (!mediaUrl) {
            return (
                <div className="ni-media">
                    <div className="ni-media-loading"><Icon name="spinner" spin /> Preparing video…</div>
                    {downloadRow}
                </div>
            );
        }
        return (
            <div className="ni-media">
                <video key={mediaUrl} controls preload="metadata" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 6 }}>
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

        // Detect and render media content (audio, image, video, pdf).
        // Blob tokens are ~80 chars — shorter than the base64 length
        // floor — so accept them regardless of length. Base64 inline
        // media still needs >100 chars to plausibly be a real payload.
        if (keyName && (parsed.length > 100 || parseBlobToken(parsed))) {
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
                                        {isSensitive(key, value) && !isRenderableMedia(key, value)
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
                                        {isSensitive(key, value) && !isRenderableMedia(key, value)
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
