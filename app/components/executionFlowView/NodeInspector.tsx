import React from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark, faCheck, faSpinner, faClock } from "@fortawesome/pro-solid-svg-icons";
import type { NodeStatus } from "~/types";

type NodeInspectorProps = {
    nodeId: string;
    status: NodeStatus;
    onClose: () => void;
};

const SENSITIVE_KEYS = /secret|password|key|token|credential|auth/i;

function renderWithBreaks(str: string): React.ReactNode {
    const segments = str.split(/\n|<br\s*\/?>/);
    if (segments.length <= 1) return str;
    return segments.map((seg, i) => (
        <React.Fragment key={i}>
            {i > 0 && <br />}
            {seg}
        </React.Fragment>
    ));
}

function obfuscateValue(key: string, value: any): React.ReactNode {
    if (typeof value === 'string' && value === '********') {
        return '********';
    }
    if (SENSITIVE_KEYS.test(key)) {
        return '********';
    }
    if (typeof value === 'object' && value !== null) {
        return renderWithBreaks(JSON.stringify(value, null, 2));
    }
    return renderWithBreaks(String(value ?? ''));
}

function formatOutputValue(key: string, value: any): React.ReactNode {
    if (typeof value === 'object' && value !== null) {
        return renderWithBreaks(JSON.stringify(value, null, 2));
    }
    return renderWithBreaks(String(value ?? ''));
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
                        <table className="node-inspector-table">
                            <tbody>
                                {Object.entries(status.inputs).map(([key, value]) => (
                                    <tr key={key}>
                                        <td>{key}</td>
                                        <td>{obfuscateValue(key, value)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="node-inspector-empty">No inputs</div>
                    )}
                </div>

                <div className="node-inspector-section">
                    <div className="node-inspector-section-title">Outputs</div>
                    {status.outputs && Object.keys(status.outputs).length > 0 ? (
                        <table className="node-inspector-table">
                            <tbody>
                                {Object.entries(status.outputs).map(([key, value]) => (
                                    <tr key={key}>
                                        <td>{key}</td>
                                        <td>{formatOutputValue(key, value)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="node-inspector-empty">No outputs</div>
                    )}
                </div>
            </div>
        </div>
    );
}
