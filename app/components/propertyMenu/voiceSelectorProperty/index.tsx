import React, { useState, useEffect, useRef } from "react";
import api from "~/lib/api";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import { Icon } from "~/components/icons/Icon";
import "./index.css";

type Voice = {
    voice_id: string;
    name: string;
    category: string;
    labels?: Record<string, string>;
    preview_url?: string;
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

export default function VoiceSelectorProperty(props: Props) {
    const config = useConfig();
    const token = useCookieToken();

    const [voices, setVoices] = useState<Voice[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState(props.value || "");
    const [selectedName, setSelectedName] = useState("");
    const [error, setError] = useState("");
    const [playingId, setPlayingId] = useState<string | null>(null);
    const ref = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const fetchVoices = () => {
        if (!props.apiKeyValue) {
            setError("Enter an ElevenLabs API key first");
            return;
        }

        setLoading(true);
        setError("");

        const apiKey = props.apiKeyValue;

        // If the API key is a variable reference, resolve via our API
        if (apiKey.startsWith("${")) {
            const url = config("AUTOMATE_API_URL");
            api.get(`${url}/api/v1/environment/${props.environmentId}/elevenlabs-voices/${encodeURIComponent(apiKey)}`, {
                headers: { Authorization: "Bearer " + token },
            })
                .then(res => handleVoicesResponse(res?.data?.voices || []))
                .catch(() => setError("Failed to fetch voices via API"))
                .finally(() => setLoading(false));
            return;
        }

        // Direct call to ElevenLabs API (supports CORS)
        fetch("https://api.elevenlabs.io/v1/voices", {
            headers: { "xi-api-key": apiKey },
        })
            .then(res => {
                if (!res.ok) throw new Error(`ElevenLabs returned ${res.status}`);
                return res.json();
            })
            .then(data => handleVoicesResponse(data.voices || []))
            .catch(err => setError(err.message || "Failed to fetch voices"))
            .finally(() => setLoading(false));
    };

    const handleVoicesResponse = (list: Voice[]) => {
        // Sort: user voices first, then by name
        list.sort((a, b) => {
            const aCustom = a.category === "cloned" || a.category === "generated" ? 0 : 1;
            const bCustom = b.category === "cloned" || b.category === "generated" ? 0 : 1;
            if (aCustom !== bCustom) return aCustom - bCustom;
            return a.name.localeCompare(b.name);
        });
        setVoices(list);
        if (selectedId) {
            const match = list.find(v => v.voice_id === selectedId);
            if (match) setSelectedName(match.name);
        }
        if (list.length > 0 && !selectedId) {
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

    const selectVoice = (voice: Voice) => {
        setSelectedId(voice.voice_id);
        setSelectedName(voice.name);
        setOpen(false);
        stopPreview();
        if (props.onValueChange) {
            props.onValueChange(props.name, voice.voice_id);
        }
    };

    const playPreview = (e: React.MouseEvent, voice: Voice) => {
        e.stopPropagation();
        if (playingId === voice.voice_id) {
            stopPreview();
            return;
        }
        stopPreview();
        if (voice.preview_url) {
            const audio = new Audio(voice.preview_url);
            audio.onended = () => setPlayingId(null);
            audio.play();
            audioRef.current = audio;
            setPlayingId(voice.voice_id);
        }
    };

    const stopPreview = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        setPlayingId(null);
    };

    const filteredVoices = search
        ? voices.filter(v => v.name.toLowerCase().includes(search.toLowerCase()))
        : voices;

    const categoryLabel = (cat: string) => {
        switch (cat) {
            case "cloned": return "Cloned";
            case "generated": return "Generated";
            case "premade": return "Premade";
            case "professional": return "Professional";
            default: return cat;
        }
    };

    return (
        <div className="property-menu-input-row voice-selector-property" ref={ref}>
            <div className="property-menu-input-name">
                {props.label || "Voice"}
                {props.required && <span className="property-menu-required"> *</span>}
            </div>

            <div className="voice-selector" onClick={() => {
                if (voices.length > 0) setOpen(!open);
                else fetchVoices();
            }}>
                <div className="voice-selected">
                    {loading ? (
                        <span className="voice-loading"><Icon name="spinner" spin /> Loading voices...</span>
                    ) : selectedName ? (
                        <span>{selectedName}</span>
                    ) : selectedId ? (
                        <span className="voice-id">{selectedId}</span>
                    ) : (
                        <span className="voice-placeholder">Click to load voices...</span>
                    )}
                </div>
                <Icon name="chevron-down" className="voice-chevron" />
            </div>

            {error && (
                <div className="voice-error">{error}</div>
            )}

            {open && voices.length > 0 && (
                <div className="voice-dropdown">
                    <div className="voice-search">
                        <input
                            type="text"
                            placeholder="Search voices..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            autoFocus
                        />
                    </div>
                    <div className="voice-list">
                        {filteredVoices.map(voice => (
                            <div
                                key={voice.voice_id}
                                className={`voice-option ${voice.voice_id === selectedId ? "voice-option--selected" : ""}`}
                                onClick={() => selectVoice(voice)}
                            >
                                <div className="voice-option-main">
                                    <div className="voice-option-name">{voice.name}</div>
                                    <div className="voice-option-meta">
                                        <span className={`voice-category voice-category--${voice.category}`}>
                                            {categoryLabel(voice.category)}
                                        </span>
                                        {voice.labels && Object.entries(voice.labels).slice(0, 3).map(([k, v]) => (
                                            <span key={k} className="voice-label">{v}</span>
                                        ))}
                                    </div>
                                </div>
                                {voice.preview_url && (
                                    <button
                                        className="voice-preview-btn"
                                        onClick={(e) => playPreview(e, voice)}
                                        title="Preview voice"
                                    >
                                        <Icon name={playingId === voice.voice_id ? "stop" : "play"} />
                                    </button>
                                )}
                            </div>
                        ))}
                        {filteredVoices.length === 0 && (
                            <div className="voice-no-results">No voices match "{search}"</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}