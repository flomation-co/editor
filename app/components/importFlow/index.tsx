import { useState, useRef, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileImport, faSpinner, faCircleCheck, faCircleXmark } from "@fortawesome/free-solid-svg-icons";
import { toast } from "react-toastify";
import api from "~/lib/api";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import { parseImportFile } from "~/lib/export";
import type { FlomationExport } from "~/types";
import dayjs from "dayjs";
import "./index.css";

type ImportFlowModalProps = {
    visible: boolean;
    onDismiss: () => void;
    onImported: () => void;
};

const config = useConfig();
const API_URL = config("AUTOMATE_API_URL");

export default function ImportFlowModal({ visible, onDismiss, onImported }: ImportFlowModalProps) {
    const token = useCookieToken();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [parsedWrappers, setParsedWrappers] = useState<FlomationExport[]>([]);
    const [errors, setErrors] = useState<string[]>([]);

    const handleFile = useCallback(async (file: File) => {
        setLoading(true);
        setParsedWrappers([]);
        setErrors([]);

        const result = await parseImportFile(file);
        setParsedWrappers(result.wrappers);
        setErrors(result.errors);
        setLoading(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const handleImport = async () => {
        if (parsedWrappers.length === 0) return;

        setImporting(true);
        let successCount = 0;

        for (const wrapper of parsedWrappers) {
            try {
                await api.post(API_URL + "/api/v1/flo/import", wrapper, {
                    headers: { Authorization: "Bearer " + token },
                });
                successCount++;
            } catch (err) {
                console.error("Import failed:", err);
                setErrors(prev => [...prev, `Failed to import "${wrapper.flomation_export.source_flow_name}"`]);
            }
        }

        setImporting(false);

        if (successCount > 0) {
            toast.success(`Successfully imported ${successCount} flow${successCount > 1 ? "s" : ""}`);
            onImported();
            onDismiss();
        }
    };

    const reset = () => {
        setParsedWrappers([]);
        setErrors([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    if (!visible) return null;

    return (
        <div className="import-modal-overlay" onClick={onDismiss}>
            <div className="import-modal" onClick={e => e.stopPropagation()}>
                <div className="import-modal-header">
                    <h3>Import Flow</h3>
                    <button className="import-modal-close" onClick={onDismiss}>&times;</button>
                </div>

                <div className="import-modal-body">
                    <div
                        className={`import-drop-zone ${dragOver ? "drag-over" : ""}`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                    >
                        <div className="import-drop-zone-icon">
                            <FontAwesomeIcon icon={faFileImport} />
                        </div>
                        <div className="import-drop-zone-text">
                            Drop a file here or click to browse
                        </div>
                        <div className="import-drop-zone-hint">
                            Accepts .flomation.json or .flomation.zip
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="import-file-input"
                            accept=".json,.zip"
                            onChange={handleFileInput}
                        />
                    </div>

                    {loading && (
                        <div className="import-loading">
                            <FontAwesomeIcon icon={faSpinner} spin />
                            Validating file...
                        </div>
                    )}

                    {parsedWrappers.length > 0 && (
                        <div className="import-preview">
                            {parsedWrappers.map((w, i) => (
                                <div key={i} className="import-preview-item">
                                    <div className="import-preview-name">{w.flomation_export.source_flow_name}</div>
                                    <div className="import-preview-meta">
                                        <span>
                                            <FontAwesomeIcon icon={faCircleCheck} className="import-hash-valid" />
                                            Integrity verified
                                        </span>
                                        {w.flomation_export.author_email && (
                                            <span>By: {w.flomation_export.author_email}</span>
                                        )}
                                        {w.flomation_export.exported_at && (
                                            <span>Exported: {dayjs(w.flomation_export.exported_at).format("D MMM YYYY HH:mm")}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {errors.length > 0 && (
                        <div className="import-errors">
                            {errors.map((err, i) => (
                                <div key={i} className="import-error-item">
                                    <FontAwesomeIcon icon={faCircleXmark} style={{ marginRight: 6 }} />
                                    {err}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="import-modal-footer">
                    {parsedWrappers.length > 0 && (
                        <button className="import-btn-cancel" onClick={reset}>Clear</button>
                    )}
                    <button className="import-btn-cancel" onClick={onDismiss}>Cancel</button>
                    <button
                        className="import-btn-primary"
                        disabled={parsedWrappers.length === 0 || importing}
                        onClick={handleImport}
                    >
                        {importing ? (
                            <><FontAwesomeIcon icon={faSpinner} spin /> Importing...</>
                        ) : (
                            <>Import {parsedWrappers.length > 0 ? `${parsedWrappers.length} Flow${parsedWrappers.length > 1 ? "s" : ""}` : ""}</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
