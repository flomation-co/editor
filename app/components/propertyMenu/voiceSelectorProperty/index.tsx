import React, { useState, useEffect, useRef } from "react";
import api from "~/lib/api";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import { Icon } from "~/components/icons/Icon";
import "./index.css";

// ─── Types ────────────────────────────────────────────────────────────

// Voice is shared between the user's library and the marketplace —
// the latter adds public_owner_id (the cloner) plus some descriptive
// labels. Optional fields keep one component happy with both shapes.
type Voice = {
    voice_id: string;
    name: string;
    category: string;
    labels?: Record<string, string>;
    preview_url?: string;
    description?: string;
    public_owner_id?: string;
    cloned_by_count?: number;
    liked_by_count?: number;
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

type SourceTab = "library" | "marketplace";

const SHARED_PAGE_SIZE = 30;

// ─── Component ────────────────────────────────────────────────────────

export default function VoiceSelectorProperty(props: Props) {
    const config = useConfig();
    const token = useCookieToken();

    // Source tabs: "library" = Your Library (premade + cloned),
    // "marketplace" = the public Voice Library that Claude Desktop's
    // recommendations almost certainly come from. The marketplace
    // tab requires an extra Add step before a voice can be used in
    // a TTS action — the action's API only accepts voice_ids that
    // exist in the user's own library.
    const [tab, setTab] = useState<SourceTab>("library");

    // Your Library state
    const [libraryVoices, setLibraryVoices] = useState<Voice[]>([]);
    const [libraryLoading, setLibraryLoading] = useState(false);
    const [libraryError, setLibraryError] = useState("");

    // Marketplace state — separate so switching tabs doesn't churn
    // the other side's data.
    const [marketVoices, setMarketVoices] = useState<Voice[]>([]);
    const [marketLoading, setMarketLoading] = useState(false);
    const [marketError, setMarketError] = useState("");
    const [marketHasMore, setMarketHasMore] = useState(false);
    const [marketPage, setMarketPage] = useState(0);
    const [marketSearch, setMarketSearch] = useState("");
    const [addingVoiceId, setAddingVoiceId] = useState<string | null>(null);

    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState(props.value || "");
    const [selectedName, setSelectedName] = useState("");
    const [playingId, setPlayingId] = useState<string | null>(null);
    const ref = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // ─── Your Library fetch ──────────────────────────────────────────

    const fetchLibrary = () => {
        if (!props.apiKeyValue) {
            setLibraryError("Enter an ElevenLabs API key first");
            return;
        }
        setLibraryLoading(true);
        setLibraryError("");

        const apiKey = props.apiKeyValue;

        // Variable reference → go through our API so the secret
        // never leaves the server.
        if (apiKey.startsWith("${")) {
            const url = config("AUTOMATE_API_URL");
            api.get(`${url}/api/v1/environment/${props.environmentId}/elevenlabs-voices/${encodeURIComponent(apiKey)}`, {
                headers: { Authorization: "Bearer " + token },
            })
                .then(res => handleLibraryResponse(res?.data?.voices || []))
                .catch(() => setLibraryError("Failed to fetch voices via API"))
                .finally(() => setLibraryLoading(false));
            return;
        }

        // Plain key — direct CORS call to ElevenLabs.
        fetch("https://api.elevenlabs.io/v1/voices", {
            headers: { "xi-api-key": apiKey },
        })
            .then(res => {
                if (!res.ok) throw new Error(`ElevenLabs returned ${res.status}`);
                return res.json();
            })
            .then(data => handleLibraryResponse(data.voices || []))
            .catch(err => setLibraryError(err.message || "Failed to fetch voices"))
            .finally(() => setLibraryLoading(false));
    };

    const handleLibraryResponse = (list: Voice[]) => {
        list.sort((a, b) => {
            const aCustom = a.category === "cloned" || a.category === "generated" ? 0 : 1;
            const bCustom = b.category === "cloned" || b.category === "generated" ? 0 : 1;
            if (aCustom !== bCustom) return aCustom - bCustom;
            return a.name.localeCompare(b.name);
        });
        setLibraryVoices(list);
        if (selectedId) {
            const match = list.find(v => v.voice_id === selectedId);
            if (match) setSelectedName(match.name);
        }
        if (list.length > 0 && !selectedId) setOpen(true);
    };

    // ─── Marketplace fetch ───────────────────────────────────────────

    // Plain API keys can't hit /v1/shared-voices directly via CORS
    // because ElevenLabs blocks the endpoint from browser origins.
    // We require the proxy path (variable reference) for marketplace
    // access — surface that clearly to the user rather than failing
    // silently with a CORS error.
    const fetchMarketplace = (resetPage: boolean) => {
        if (!props.apiKeyValue) {
            setMarketError("Enter an ElevenLabs API key first");
            return;
        }
        if (!props.apiKeyValue.startsWith("${")) {
            setMarketError("Marketplace browsing requires the API key to come from environment secrets — switch the api_key input to a ${secrets.X} variable.");
            return;
        }
        setMarketLoading(true);
        setMarketError("");

        const page = resetPage ? 0 : marketPage;
        const url = config("AUTOMATE_API_URL");
        const params = new URLSearchParams();
        params.set("page_size", String(SHARED_PAGE_SIZE));
        params.set("page", String(page));
        if (marketSearch) params.set("search", marketSearch);

        api.get(
            `${url}/api/v1/environment/${props.environmentId}/elevenlabs-shared-voices/${encodeURIComponent(props.apiKeyValue)}?${params.toString()}`,
            { headers: { Authorization: "Bearer " + token } },
        )
            .then(res => {
                const data = res?.data || {};
                // The API always returns 200 — surface upstream
                // errors that are embedded in the body so the user
                // sees the actual reason rather than an empty list.
                if (data.error) {
                    setMarketError(data.error);
                    return;
                }
                const newVoices: Voice[] = data.voices || [];
                setMarketVoices(prev => resetPage ? newVoices : [...prev, ...newVoices]);
                setMarketHasMore(Boolean(data.has_more));
                setMarketPage(page + 1);
            })
            .catch(err => {
                // Distinguish network/route failures from upstream
                // errors. The most common cause during rollout is the
                // API process not having been restarted to pick up
                // the new route — 404 surfaces here.
                const status = err?.response?.status;
                const body = err?.response?.data?.error;
                if (status === 404) {
                    setMarketError("Marketplace endpoint not found — has the API been restarted to pick up the new route?");
                } else if (body) {
                    setMarketError(body);
                } else if (err?.message) {
                    setMarketError(`Failed to fetch marketplace voices: ${err.message}`);
                } else {
                    setMarketError("Failed to fetch marketplace voices");
                }
            })
            .finally(() => setMarketLoading(false));
    };

    // ─── Add a marketplace voice to the library ──────────────────────

    const addToLibrary = (voice: Voice) => {
        if (!voice.public_owner_id) {
            setMarketError("Voice is missing owner metadata; cannot add");
            return;
        }
        setAddingVoiceId(voice.voice_id);
        setMarketError("");

        const url = config("AUTOMATE_API_URL");
        api.post(
            `${url}/api/v1/environment/${props.environmentId}/elevenlabs-add-voice/${encodeURIComponent(props.apiKeyValue!)}`,
            {
                public_user_id: voice.public_owner_id,
                voice_id: voice.voice_id,
                new_name: voice.name,
            },
            { headers: { Authorization: "Bearer " + token } },
        )
            .then(res => {
                // ElevenLabs returns the voice_id of the newly-added
                // voice in the user's library. The marketplace voice_id
                // is the ORIGINAL; the new copy gets its own ID.
                const newVoiceId = res?.data?.voice_id || voice.voice_id;
                // Refresh library + jump tabs + auto-select the new
                // voice so the user immediately sees a successful add.
                setTab("library");
                setLibraryVoices([]); // force refetch
                setSelectedId(newVoiceId);
                setSelectedName(voice.name);
                if (props.onValueChange) {
                    props.onValueChange(props.name, newVoiceId);
                }
            })
            .catch(err => {
                setMarketError(err?.response?.data?.error || "Failed to add voice to library");
            })
            .finally(() => setAddingVoiceId(null));
    };

    // ─── Lifecycle ───────────────────────────────────────────────────

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

    // Lazy-load on first switch into the marketplace tab so we don't
    // burn the API call when the user hasn't actually clicked over.
    useEffect(() => {
        if (open && tab === "marketplace" && marketVoices.length === 0 && !marketLoading) {
            fetchMarketplace(true);
        }
    }, [open, tab]);

    // Debounced live search — refetch the marketplace 350ms after the
    // user stops typing. Avoids hammering the API on every keystroke
    // while still feeling responsive. The placeholder no longer says
    // "press Enter" because Enter and typing both work now.
    //
    // We deliberately omit `marketLoading` from the deps — if a fetch
    // is already in flight, the next debounce tick will simply launch
    // a fresh one when this fires; the old one's response just sets
    // state that the new fetch immediately overwrites. ElevenLabs is
    // fast enough that this race is invisible.
    useEffect(() => {
        if (!open || tab !== "marketplace") return;
        // Don't fire the initial empty-string search again on tab
        // entry; the lazy-load effect already handled it.
        const initial = marketSearch === "" && marketVoices.length > 0 && marketPage <= 1;
        if (initial) return;
        const t = setTimeout(() => {
            fetchMarketplace(true);
        }, 350);
        return () => clearTimeout(t);
    }, [marketSearch]);

    // Refresh library after an Add (we cleared the list above).
    useEffect(() => {
        if (open && tab === "library" && libraryVoices.length === 0 && !libraryLoading && props.apiKeyValue) {
            fetchLibrary();
        }
    }, [open, tab, libraryVoices.length]);

    // ─── Selection + preview ─────────────────────────────────────────

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

    // ─── Derived view data ───────────────────────────────────────────

    const filteredLibrary = search
        ? libraryVoices.filter(v => v.name.toLowerCase().includes(search.toLowerCase()))
        : libraryVoices;

    const categoryLabel = (cat: string) => {
        switch (cat) {
            case "cloned": return "Cloned";
            case "generated": return "Generated";
            case "premade": return "Premade";
            case "professional": return "Professional";
            case "shared": return "Shared";
            default: return cat;
        }
    };

    const onMarketSearchSubmit = (e: React.FormEvent | React.KeyboardEvent) => {
        e.preventDefault();
        // Reset and refetch on submit; we don't fetch-on-keystroke to
        // avoid hammering the API with partial words.
        fetchMarketplace(true);
    };

    const handleOpenClick = () => {
        if (libraryVoices.length > 0 || marketVoices.length > 0) {
            setOpen(!open);
        } else {
            fetchLibrary();
            setOpen(true);
        }
    };

    // ─── Render ──────────────────────────────────────────────────────

    return (
        <div className="property-menu-input-row voice-selector-property" ref={ref}>
            <div className="property-menu-input-name">
                {props.label || "Voice"}
                {props.required && <span className="property-menu-required"> *</span>}
            </div>

            <div className="voice-selector" onClick={handleOpenClick}>
                <div className="voice-selected">
                    {libraryLoading ? (
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

            {libraryError && tab === "library" && (
                <div className="voice-error">{libraryError}</div>
            )}
            {marketError && tab === "marketplace" && (
                <div className="voice-error">{marketError}</div>
            )}

            {open && (
                <div className="voice-dropdown">
                    {/* Source tabs */}
                    <div className="voice-tabs">
                        <button
                            type="button"
                            className={`voice-tab ${tab === "library" ? "voice-tab--active" : ""}`}
                            onClick={(e) => { e.stopPropagation(); setTab("library"); setSearch(""); }}
                        >
                            <Icon name="bookmark" /> Your Library
                        </button>
                        <button
                            type="button"
                            className={`voice-tab ${tab === "marketplace" ? "voice-tab--active" : ""}`}
                            onClick={(e) => { e.stopPropagation(); setTab("marketplace"); }}
                            title="Browse ElevenLabs public Voice Library"
                        >
                            <Icon name="store" /> Voice Library
                        </button>
                    </div>

                    {/* Library tab */}
                    {tab === "library" && (
                        <>
                            <div className="voice-search">
                                <input
                                    type="text"
                                    placeholder="Search your voices..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                    autoFocus
                                />
                            </div>
                            <div className="voice-list">
                                {libraryVoices.length === 0 && libraryLoading && (
                                    <div className="voice-loading-row"><Icon name="spinner" spin /> Loading…</div>
                                )}
                                {filteredLibrary.map(voice => (
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
                                {!libraryLoading && filteredLibrary.length === 0 && libraryVoices.length > 0 && (
                                    <div className="voice-no-results">No voices match "{search}"</div>
                                )}
                                {!libraryLoading && libraryVoices.length === 0 && !libraryError && (
                                    <div className="voice-no-results">No voices in your library yet — try the Voice Library tab</div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Marketplace tab */}
                    {tab === "marketplace" && (
                        <>
                            <form className="voice-search" onSubmit={onMarketSearchSubmit}>
                                <input
                                    type="text"
                                    placeholder="Search the public Voice Library…"
                                    value={marketSearch}
                                    onChange={e => setMarketSearch(e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                    autoFocus
                                />
                            </form>
                            <div className="voice-list">
                                {marketVoices.length === 0 && marketLoading && (
                                    <div className="voice-loading-row"><Icon name="spinner" spin /> Loading marketplace…</div>
                                )}
                                {marketVoices.map(voice => (
                                    <div
                                        key={`${voice.public_owner_id}-${voice.voice_id}`}
                                        className="voice-option"
                                    >
                                        <div className="voice-option-main">
                                            <div className="voice-option-name">{voice.name}</div>
                                            <div className="voice-option-meta">
                                                <span className="voice-category voice-category--shared">Shared</span>
                                                {voice.labels && Object.entries(voice.labels).slice(0, 4).map(([k, v]) => (
                                                    <span key={k} className="voice-label">{v}</span>
                                                ))}
                                            </div>
                                            {voice.description && (
                                                <div className="voice-option-desc">{voice.description}</div>
                                            )}
                                        </div>
                                        <div className="voice-option-actions">
                                            {voice.preview_url && (
                                                <button
                                                    className="voice-preview-btn"
                                                    onClick={(e) => playPreview(e, voice)}
                                                    title="Preview voice"
                                                >
                                                    <Icon name={playingId === voice.voice_id ? "stop" : "play"} />
                                                </button>
                                            )}
                                            <button
                                                className="voice-add-btn"
                                                disabled={addingVoiceId === voice.voice_id}
                                                onClick={(e) => { e.stopPropagation(); addToLibrary(voice); }}
                                                title="Add this voice to your library so it can be used in TTS actions"
                                            >
                                                {addingVoiceId === voice.voice_id ? (
                                                    <><Icon name="spinner" spin /> Adding…</>
                                                ) : (
                                                    <><Icon name="plus" /> Add</>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {!marketLoading && marketHasMore && (
                                    <button
                                        className="voice-load-more"
                                        onClick={(e) => { e.stopPropagation(); fetchMarketplace(false); }}
                                    >
                                        Load more
                                    </button>
                                )}
                                {!marketLoading && marketVoices.length === 0 && !marketError && (
                                    <div className="voice-no-results">No voices found{marketSearch ? ` for "${marketSearch}"` : ""}</div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
