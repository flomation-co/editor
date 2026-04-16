import "./index.css"
import React, { useState } from "react";
import { Icon } from "~/components/icons/Icon";

type DataInspectorProps = {
    data: any;
    emptyMessage?: string;
};

function getTypeName(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

function getTypeColour(type: string): string {
    switch (type) {
        case 'string': return '#a5d6a7';
        case 'number': return '#90caf9';
        case 'boolean': return '#ce93d8';
        case 'null': return 'rgba(255,255,255,0.25)';
        case 'object': return '#00aa9c';
        case 'array': return '#efd467';
        default: return 'rgba(255,255,255,0.5)';
    }
}

function PropertyValue({ value, depth = 0 }: { value: any; depth?: number }) {
    const [expanded, setExpanded] = useState(depth < 1);

    if (value === null || value === undefined) {
        return <span className="di-val di-val--null">null</span>;
    }

    if (typeof value === 'boolean') {
        return <span className="di-val di-val--bool">{value.toString()}</span>;
    }

    if (typeof value === 'number') {
        return <span className="di-val di-val--number">{value}</span>;
    }

    if (typeof value === 'string') {
        // Try to detect JSON strings and render as structured data
        if (depth === 0) {
            const trimmed = value.trim();
            if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (typeof parsed === 'object' && parsed !== null) {
                        return <PropertyValue value={parsed} depth={depth} />;
                    }
                } catch { /* not JSON, render as string */ }
            }
        }

        if (value.length > 300 && depth > 0) {
            return <span className="di-val di-val--string">"{value.slice(0, 297)}..."</span>;
        }

        // Split on \n and <br> / <br /> tags to render actual line breaks
        const hasBreaks = /\n|<br\s*\/?>/.test(value);
        if (hasBreaks) {
            const segments = value.split(/\n|<br\s*\/?>/);
            return (
                <span className="di-val di-val--string di-val--multiline">
                    "{segments.map((seg, i) => (
                        <React.Fragment key={i}>
                            {i > 0 && <br />}
                            {seg}
                        </React.Fragment>
                    ))}"
                </span>
            );
        }

        if (value.length > 80) {
            return (
                <span className="di-val di-val--string di-val--multiline">
                    "{value}"
                </span>
            );
        }
        return <span className="di-val di-val--string">"{value}"</span>;
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return <span className="di-val di-val--empty">[] <span className="di-type-hint">empty array</span></span>;
        }
        return (
            <div className="di-tree">
                <div className="di-tree-header" onClick={() => setExpanded(!expanded)}>
                    <Icon name={expanded? "chevron-down" : "chevron-right"} className="di-chevron" />
                    <span className="di-type-badge di-type-badge--array">Array</span>
                    <span className="di-count">{value.length} {value.length === 1 ? 'item' : 'items'}</span>
                </div>
                {expanded && (
                    <div className="di-tree-children">
                        {value.map((item, i) => (
                            <PropertyRow key={i} name={String(i)} value={item} depth={depth + 1} isIndex />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    if (typeof value === 'object') {
        const keys = Object.keys(value);
        if (keys.length === 0) {
            return <span className="di-val di-val--empty">{'{}'} <span className="di-type-hint">empty object</span></span>;
        }
        return (
            <div className="di-tree">
                <div className="di-tree-header" onClick={() => setExpanded(!expanded)}>
                    <Icon name={expanded? "chevron-down" : "chevron-right"} className="di-chevron" />
                    <span className="di-type-badge di-type-badge--object">Object</span>
                    <span className="di-count">{keys.length} {keys.length === 1 ? 'property' : 'properties'}</span>
                </div>
                {expanded && (
                    <div className="di-tree-children">
                        {keys.map(k => (
                            <PropertyRow key={k} name={k} value={value[k]} depth={depth + 1} />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return <span className="di-val">{String(value)}</span>;
}

function PropertyRow({ name, value, depth = 0, isIndex = false }: { name: string; value: any; depth?: number; isIndex?: boolean }) {
    const typeName = getTypeName(value);
    const isComplex = typeName === 'object' || typeName === 'array';

    return (
        <div className="di-row">
            <div className="di-row-header">
                <span className={isIndex ? "di-key di-key--index" : "di-key"}>{name}</span>
                <span className="di-type-tag" style={{ color: getTypeColour(typeName) }}>{typeName}</span>
            </div>
            <div className={isComplex ? "di-row-value di-row-value--block" : "di-row-value"}>
                <PropertyValue value={value} depth={depth} />
            </div>
        </div>
    );
}

export default function DataInspector({ data, emptyMessage }: DataInspectorProps) {
    const [copied, setCopied] = useState(false);

    if (data === null || data === undefined) {
        return <div className="di-empty">{emptyMessage || 'No data'}</div>;
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };

    // If data is a flat object, render each key as a row
    if (typeof data === 'object' && !Array.isArray(data)) {
        const keys = Object.keys(data);
        if (keys.length === 0) {
            return <div className="di-empty">{emptyMessage || 'No data'}</div>;
        }

        return (
            <div className="di-container">
                <div className="di-toolbar">
                    <span className="di-toolbar-count">{keys.length} {keys.length === 1 ? 'property' : 'properties'}</span>
                    <button className="di-toolbar-copy" onClick={handleCopy}>
                        <Icon name={copied? "check" : "copy"} /> {copied ? 'Copied' : 'Copy JSON'}
                    </button>
                </div>
                <div className="di-entries">
                    {keys.map(k => (
                        <PropertyRow key={k} name={k} value={data[k]} depth={0} />
                    ))}
                </div>
            </div>
        );
    }

    // For arrays or primitives, wrap in a single value display
    return (
        <div className="di-container">
            <div className="di-toolbar">
                <span className="di-toolbar-count">{getTypeName(data)}</span>
                <button className="di-toolbar-copy" onClick={handleCopy}>
                    <Icon name={copied? "check" : "copy"} /> {copied ? 'Copied' : 'Copy JSON'}
                </button>
            </div>
            <div className="di-entries">
                <PropertyValue value={data} depth={0} />
            </div>
        </div>
    );
}
