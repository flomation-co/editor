import React, { useState, useEffect, useRef } from "react";
import api from "~/lib/api";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import { Icon } from "~/components/icons/Icon";

type Model = {
    model_id: string;
    name: string;
    description: string;
    can_do_text_to_speech: boolean;
    can_do_voice_conversion: boolean;
    languages?: { language_id: string; name: string }[];
};

type Props = {
    nodeId: string;
    name: string;
    label?: string;
    value?: string;
    required?: boolean;
    apiKeyValue?: string;
    environmentId?: string;
    onValueChange?: (property: string, value: string) => void;
};

export default function ModelSelectorProperty(props: Props) {
    const config = useConfig();
    const token = useCookieToken();

    const [models, setModels] = useState<Model[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [selectedId, setSelectedId] = useState(props.value || "");
    const [selectedName, setSelectedName] = useState("");
    const [error, setError] = useState("");
    const ref = useRef<HTMLDivElement>(null);

    const fetchModels = () => {
        if (!props.apiKeyValue) {
            setError("Enter an ElevenLabs API key first");
            return;
        }

        setLoading(true);
        setError("");

        const apiKey = props.apiKeyValue;

        if (apiKey.startsWith("${")) {
            const url = config("AUTOMATE_API_URL");
            api.get(`${url}/api/v1/environment/${props.environmentId}/elevenlabs-models/${encodeURIComponent(apiKey)}`, {
                headers: { Authorization: "Bearer " + token },
            })
                .then(res => handleResponse(res?.data || []))
                .catch(() => setError("Failed to fetch models via API"))
                .finally(() => setLoading(false));
            return;
        }

        fetch("https://api.elevenlabs.io/v1/models", {
            headers: { "xi-api-key": apiKey },
        })
            .then(res => {
                if (!res.ok) throw new Error(`ElevenLabs returned ${res.status}`);
                return res.json();
            })
            .then(data => handleResponse(data || []))
            .catch(err => setError(err.message || "Failed to fetch models"))
            .finally(() => setLoading(false));
    };

    const handleResponse = (list: Model[]) => {
        // Filter to TTS-capable models only
        const ttsModels = list.filter(m => m.can_do_text_to_speech);
        setModels(ttsModels);
        if (selectedId) {
            const match = ttsModels.find(m => m.model_id === selectedId);
            if (match) setSelectedName(match.name);
        }
        if (ttsModels.length > 0 && !selectedId) {
            setOpen(true);
        }
    };

    useEffect(() => {
        setSelectedId(props.value || "");
        setSelectedName("");
    }, [props.nodeId]);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const selectModel = (model: Model) => {
        setSelectedId(model.model_id);
        setSelectedName(model.name);
        setOpen(false);
        if (props.onValueChange) {
            props.onValueChange(props.name, model.model_id);
        }
    };

    return (
        <div className="property-menu-input-row voice-selector-property" ref={ref}>
            <div className="property-menu-input-name">
                {props.label || "Model"}
                {props.required && <span className="property-menu-required"> *</span>}
            </div>

            <div className="voice-selector" onClick={() => {
                if (models.length > 0) setOpen(!open);
                else fetchModels();
            }}>
                <div className="voice-selected">
                    {loading ? (
                        <span className="voice-loading"><Icon name="spinner" spin /> Loading models...</span>
                    ) : selectedName ? (
                        <span>{selectedName}</span>
                    ) : selectedId ? (
                        <span className="voice-id">{selectedId}</span>
                    ) : (
                        <span className="voice-placeholder">Click to load models...</span>
                    )}
                </div>
                <Icon name="chevron-down" className="voice-chevron" />
            </div>

            {error && (
                <div className="voice-error">{error}</div>
            )}

            {open && models.length > 0 && (
                <div className="voice-dropdown">
                    <div className="voice-list">
                        {models.map(model => (
                            <div
                                key={model.model_id}
                                className={`voice-option ${model.model_id === selectedId ? "voice-option--selected" : ""}`}
                                onClick={() => selectModel(model)}
                            >
                                <div className="voice-option-main">
                                    <div className="voice-option-name">{model.name}</div>
                                    <div className="voice-option-meta">
                                        {model.languages && model.languages.length > 0 && (
                                            <span className="voice-label">
                                                {model.languages.length === 1
                                                    ? model.languages[0].name
                                                    : `${model.languages.length} languages`}
                                            </span>
                                        )}
                                        <span className="voice-label" style={{ fontFamily: "monospace" }}>
                                            {model.model_id}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
