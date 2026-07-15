import React, {useEffect, useRef, useState} from "react";
import type {VariableItem} from "~/components/propertyMenu/variableInput";
import VariablePicker from "~/components/propertyMenu/variablePicker";
import useCookieToken from "~/components/cookie";
import useConfig from "~/components/config";
import "./index.css";

type PropertyProps = {
    nodeId: string;
    name: string;
    placeholder: string;
    label: string;
    value: string;
    required?: boolean;
    variables?: VariableItem[];
    onValueChange?: (property: string, value: any) => void;
};

function isVariableRef(val: string): boolean {
    return typeof val === "string" && /^\$\{[\w.-]+}$/.test(val);
}

// parseBlobToken mirrors the executor/API token shape:
// flo:blob:<32-hex>?size=N&type=<url-encoded-mime>. Returns null for anything else.
function parseBlobToken(val: string): { handle: string; mime: string; size: number } | null {
    if (!val || !val.startsWith("flo:blob:")) return null;
    const body = val.slice("flo:blob:".length);
    const q = body.indexOf("?");
    const handle = q < 0 ? body : body.slice(0, q);
    if (!/^[0-9a-f]{32}$/.test(handle)) return null;
    let mime = "";
    let size = 0;
    if (q >= 0) {
        const p = new URLSearchParams(body.slice(q + 1));
        mime = p.get("type") || "";
        size = parseInt(p.get("size") || "0", 10) || 0;
    }
    return {handle, mime, size};
}

function humanSize(bytes: number): string {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FileProperty = (props: PropertyProps) => {
    const [value, setValue] = useState<string>(props.value);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const [fileName, setFileName] = useState("");
    const [thumb, setThumb] = useState("");
    const inputRef = useRef<HTMLInputElement | null>(null);

    const getConfig = useConfig();
    const apiURL = getConfig("AUTOMATE_API_URL", "") ?? "";
    const cookieToken = useCookieToken();

    // Propagate committed value upward; reset local state when the node changes.
    useEffect(() => {
        if (props.onValueChange) props.onValueChange(props.name, value);
    }, [value]);
    useEffect(() => {
        setValue(props.value);
        setFileName("");
        setError("");
    }, [props.nodeId]);

    const token = parseBlobToken(value);
    const isImage = !!token && token.mime.startsWith("image/");

    // Fetch a thumbnail for image assets (JWT-scoped). Revoke the object URL on
    // change/unmount so we don't leak blob: URLs (the NodeInspector loop trap).
    useEffect(() => {
        if (!isImage || !token || !apiURL) {
            setThumb("");
            return;
        }
        let url = "";
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${apiURL}/api/v1/blob/${token.handle}`, {
                    headers: cookieToken ? {Authorization: `Bearer ${cookieToken}`} : undefined,
                });
                if (!res.ok) return;
                const blob = await res.blob();
                if (cancelled) return;
                url = URL.createObjectURL(blob);
                setThumb(url);
            } catch { /* thumbnail is best-effort */ }
        })();
        return () => {
            cancelled = true;
            if (url) URL.revokeObjectURL(url);
        };
    }, [token?.handle, isImage, apiURL, cookieToken]);

    async function upload(file: File) {
        setUploading(true);
        setError("");
        try {
            const body = new FormData();
            body.append("file", file);
            // octet-stream is the safe declared MIME the API always accepts; a
            // real image type gives a nicer stored mime + preview.
            body.append("mime", file.type || "application/octet-stream");
            const res = await fetch(`${apiURL}/api/v1/asset`, {
                method: "POST",
                headers: cookieToken ? {Authorization: `Bearer ${cookieToken}`} : undefined,
                body,
            });
            if (!res.ok) {
                const t = await res.text();
                throw new Error(t || `upload failed (${res.status})`);
            }
            const json = await res.json();
            const tok = json.blob_token as string;
            if (!tok) throw new Error("no token returned");
            setFileName(file.name);
            setValue(tok);
        } catch (e: any) {
            setError(e?.message || "upload failed");
        } finally {
            setUploading(false);
        }
    }

    function onPick(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0];
        if (f) void upload(f);
        e.target.value = ""; // allow re-selecting the same file
    }

    function onDrop(e: React.DragEvent) {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) void upload(f);
    }

    const showPicker = isVariableRef(value);

    return (
        <div className={"property-menu-input-row"} key={props.name}>
            <div className={"property-menu-input-name"}>
                {props.label ? props.label : props.name}
                {props.required && <span className="property-menu-required"> *</span>}
            </div>

            {showPicker ? (
                <VariablePicker
                    value={value}
                    variables={props.variables || []}
                    onSelect={(ref) => setValue(ref)}
                    onClear={() => setValue("")}
                />
            ) : token ? (
                <div className="file-asset-chip">
                    {isImage && thumb ? (
                        <img className="file-asset-thumb" src={thumb} alt="asset"/>
                    ) : (
                        <div className="file-asset-thumb file-asset-thumb--generic">FILE</div>
                    )}
                    <div className="file-asset-meta">
                        <div className="file-asset-name" title={fileName || token.mime}>
                            {fileName || token.mime || "Uploaded file"}
                        </div>
                        <div className="file-asset-sub">
                            {token.mime}{token.size ? ` · ${humanSize(token.size)}` : ""}
                        </div>
                    </div>
                    <div className="file-asset-actions">
                        <button type="button" className="file-asset-btn" onClick={() => inputRef.current?.click()}>Replace</button>
                        <button type="button" className="file-asset-btn file-asset-btn--danger" onClick={() => { setValue(""); setFileName(""); }}>Remove</button>
                    </div>
                </div>
            ) : (
                <div className="variable-mode-row">
                    <div
                        className={`file-asset-drop${uploading ? " file-asset-drop--busy" : ""}`}
                        onClick={() => inputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={onDrop}
                    >
                        {uploading ? "Uploading…" : (props.placeholder || "Click or drop a file to upload")}
                    </div>
                    <VariablePicker
                        value={value}
                        variables={props.variables ?? []}
                        onSelect={(ref) => setValue(ref)}
                        onClear={() => setValue("")}
                    />
                </div>
            )}

            {error && <div className="file-asset-error">{error}</div>}
            <input ref={inputRef} type="file" style={{display: "none"}} onChange={onPick}/>
        </div>
    );
};

export default FileProperty;
