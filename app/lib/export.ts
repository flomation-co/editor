import JSZip from "jszip";
import type { Flo, FlomationExport } from "~/types";

async function computeSHA256(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const buffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function generateExportWrapper(
    flo: { id: string; name: string; scale?: number; x?: number; y?: number; revision?: object | null; environment_name?: string },
    authorEmail: string
): Promise<FlomationExport> {
    const flowData = {
        name: flo.name,
        scale: flo.scale ?? 1.0,
        x: flo.x ?? 0,
        y: flo.y ?? 0,
        revision: flo.revision ?? null,
    };

    const flowDataJSON = JSON.stringify(flowData);
    const hash = await computeSHA256(flowDataJSON);

    return {
        flomation_export: {
            version: 1,
            exported_at: new Date().toISOString(),
            source_flow_id: flo.id,
            source_flow_name: flo.name,
            author_email: authorEmail,
            environment_name: flo.environment_name,
            hash,
        },
        flow_data: flowData,
    };
}

export function downloadAsJson(wrapper: FlomationExport, filename: string) {
    const json = JSON.stringify(wrapper, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function downloadAsZip(wrappers: FlomationExport[], filename: string) {
    const zip = new JSZip();

    for (const wrapper of wrappers) {
        const safeName = wrapper.flomation_export.source_flow_name
            .replace(/[^a-zA-Z0-9_\-\s]/g, "")
            .replace(/\s+/g, "_")
            .toLowerCase();
        const json = JSON.stringify(wrapper, null, 2);
        zip.file(`${safeName}.flomation.json`, json);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export type ParsedImportFile = {
    wrappers: FlomationExport[];
    errors: string[];
};

async function validateWrapper(wrapper: FlomationExport): Promise<string | null> {
    if (!wrapper.flomation_export || !wrapper.flow_data) {
        return "Invalid file structure: missing flomation_export or flow_data";
    }

    if (!wrapper.flomation_export.version) {
        return "Invalid file: missing export version";
    }

    if (!wrapper.flomation_export.hash) {
        return "Invalid file: missing integrity hash";
    }

    const flowDataJSON = JSON.stringify(wrapper.flow_data);
    const computedHash = await computeSHA256(flowDataJSON);

    if (computedHash !== wrapper.flomation_export.hash) {
        return "Integrity check failed: file may have been tampered with";
    }

    return null;
}

export async function parseImportFile(file: File): Promise<ParsedImportFile> {
    const wrappers: FlomationExport[] = [];
    const errors: string[] = [];

    if (file.name.endsWith(".flomation.zip") || file.name.endsWith(".zip")) {
        try {
            const zip = new JSZip();
            const contents = await zip.loadAsync(file);
            const fileEntries = Object.values(contents.files).filter(f => !f.dir && f.name.endsWith(".json"));

            for (const entry of fileEntries) {
                try {
                    const text = await entry.async("text");
                    const wrapper = JSON.parse(text) as FlomationExport;
                    const error = await validateWrapper(wrapper);
                    if (error) {
                        errors.push(`${entry.name}: ${error}`);
                    } else {
                        wrappers.push(wrapper);
                    }
                } catch {
                    errors.push(`${entry.name}: failed to parse JSON`);
                }
            }
        } catch {
            errors.push("Failed to read ZIP file");
        }
    } else {
        try {
            const text = await file.text();
            const wrapper = JSON.parse(text) as FlomationExport;
            const error = await validateWrapper(wrapper);
            if (error) {
                errors.push(error);
            } else {
                wrappers.push(wrapper);
            }
        } catch {
            errors.push("Failed to parse JSON file");
        }
    }

    return { wrappers, errors };
}
