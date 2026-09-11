import "./index.css"

import React, {useEffect, useMemo, useState} from "react";
import { Icon } from "~/components/icons/Icon";
import type { PluginDefinition } from "~/types";
import { buildGroups, CLOUD_GROUP, POPULAR_ACTION_IDS } from "./groups";
import type { Group, Service } from "./groups";

type ContextMenuProps = {
    visible: boolean
    x?: number;
    y?: number;
    isMobile?: boolean;
    onNodeAdd?: (nodeType: string) => void;
    onClose?: () => void;
    // Either shape: the API hands back an object keyed by action id, callers in
    // tests and previews pass an array. Normalised on the way in.
    plugins: PluginDefinition[] | Record<string, PluginDefinition> | null;
}

// Where the browse is standing. Search cuts across all three.
type View =
    | { level: "home" }
    | { level: "group"; group: string }
    | { level: "service"; group: string; service: string };

// ── Fuzzy search ──────────────────────────────────────────────────────────
// A lightweight scored fuzzy matcher (no dependency — the action set is small
// enough that per-keystroke scoring is trivial). fuzzyScore returns 0 for no
// match, or a 0..1 relevance score: an exact substring scores highest (1.0 for
// a prefix, ~0.95 at a word boundary, 0.8 mid-string); a looser subsequence
// match (the query characters appearing in order, e.g. "gche" -> "git/checkout")
// scores below that, rewarding consecutive runs and word-start hits.
const WORD_BOUNDARY = /[\s\-_/.]/;

// One character subsequence-matches 100% of a 3,660-action catalogue and two
// still matches 97%, so the first useful query length is two AND the result set
// has to be bounded. Without the cap the menu rendered thousands of rows per
// keystroke, which is what made it feel broken rather than merely broad.
const SEARCH_MIN_CHARS = 2;
const SEARCH_RESULT_LIMIT = 50;
const SEARCH_DEBOUNCE_MS = 120;

const fuzzyScore = (needle: string, haystack: string): number => {
    if (!needle || !haystack) return 0;
    const h = haystack.toLowerCase();
    const n = needle.toLowerCase();

    // Exact substring — the strongest signal.
    const idx = h.indexOf(n);
    if (idx !== -1) {
        if (idx === 0) return 1.0;                        // prefix
        if (WORD_BOUNDARY.test(h[idx - 1])) return 0.95;  // start of a word
        return 0.8;                                       // mid-string
    }

    // Subsequence match — every query character must appear, in order.
    let ni = 0, run = 0, score = 0;
    for (let hi = 0; hi < h.length && ni < n.length; hi++) {
        if (h[hi] === n[ni]) {
            run += 1;
            let charScore = 1 + run * 0.5;                                   // reward runs
            if (hi === 0 || WORD_BOUNDARY.test(h[hi - 1])) charScore += 1;   // word start
            score += charScore;
            ni += 1;
        } else {
            run = 0;
        }
    }
    if (ni < n.length) return 0;                          // not all chars matched
    // Normalise below the exact-substring band so substring matches always win.
    return Math.min(score / (n.length * 3), 0.7);
};

// scorePlugin ranks a plugin against the query across name, label, category and
// description. Field weights make a name hit outrank a category hit, which
// outranks a description hit; the best-scoring field wins (max), so a match in
// ANY of those fields surfaces the action.
const scorePlugin = (p: PluginDefinition, query: string): number => Math.max(
    3.0 * fuzzyScore(query, p.name),
    3.0 * fuzzyScore(query, p.label || ""),
    1.8 * fuzzyScore(query, p.category?.name || ""),
    1.8 * fuzzyScore(query, p.category?.sub_name || ""),
    1.8 * fuzzyScore(query, p.category?.sub_sub_name || ""),
    // Descriptions are weighted low deliberately. They are written for the AI
    // (see the AI-native action pattern), so they are long, prose-like, and
    // subsequence-match almost anything: at weight 1.0 a search for "send"
    // pulled in 2,612 of 3,660 actions. Low enough to break a tie, not to
    // create a result.
    0.9 * fuzzyScore(query, p.summary || ""),
    0.35 * fuzzyScore(query, p.description || ""),
);

const ContextMenu = (props: ContextMenuProps) => {
    const [ view, setView ] = useState<View>({ level: "home" });
    const [ searchInput, setSearchInput ] = useState<string>("");
    const [ searchTerm, setSearchTerm ] = useState<string>("");

    // The API returns the action catalogue as an OBJECT keyed by action id, not
    // an array — despite the prop's type. Normalise both shapes: reading it as
    // an array put a non-iterable into buildGroups and every right-click threw
    // "e is not iterable".
    const plugins = useMemo(() => {
        const source: unknown = props.plugins;
        if (Array.isArray(source)) return source as PluginDefinition[];
        if (source && typeof source === "object") return Object.values(source) as PluginDefinition[];
        return [];
    }, [props.plugins]);

    // Grouping walks the whole catalogue, so do it once per plugin set rather
    // than on every keystroke or navigation.
    const groups = useMemo(() => buildGroups(plugins), [plugins]);
    const totalActions = useMemo(
        () => groups.reduce((total, group) => total + group.count, 0),
        [groups],
    );
    const serviceOfAction = useMemo(() => {
        const map = new Map<string, string>();
        for (const group of groups) {
            for (const service of group.services) {
                for (const action of service.actions) map.set(action.id, service.name);
            }
        }
        return map;
    }, [groups]);

    const popular = useMemo(() => {
        const byId = new Map(plugins.map(p => [p.id, p]));
        return POPULAR_ACTION_IDS.map(id => byId.get(id)).filter((p): p is PluginDefinition => !!p);
    }, [plugins]);

    const currentGroup: Group | undefined = view.level === "home"
        ? undefined
        : groups.find(g => g.name === view.group);
    const currentService: Service | undefined = view.level === "service"
        ? currentGroup?.services.find(s => s.key === view.service)
        : undefined;

    const handleNodeClick = (name: string) => {
        if (props.onNodeAdd) {
            props.onNodeAdd(name);
        }
    }

    const onSearchChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
        setSearchInput(evt.target.value);
    }

    // Scoring runs over every action across six fields, so a keystroke costs
    // roughly 22,000 comparisons. Debounce so holding a key does not queue one
    // pass per character.
    useEffect(() => {
        const id = setTimeout(() => setSearchTerm(searchInput.trim().toLowerCase()), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(id);
    }, [searchInput]);

    useEffect(() => {
        if (!props.visible) {
            setSearchInput("");
            setSearchTerm("");
            setView({ level: "home" });
        }
    }, [props.visible]);

    // Get all plugins matching the search — a fuzzy match across name, label,
    // category and description, ranked most-relevant first.
    const getSearchResults = (): PluginDefinition[] => {
        if (searchTerm.length < SEARCH_MIN_CHARS) return [];
        return plugins
            .map(p => ({p, score: scorePlugin(p, searchTerm)}))
            .filter(x => x.score > 0)
            // Ties broken by name so the list stops reshuffling between
            // keystrokes — unstable order is most of what "flaky" meant.
            .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name))
            .slice(0, SEARCH_RESULT_LIMIT)
            .map(x => x.p);
    }

    // An action row. Search shows the service it belongs to, because a result
    // list cut from fourteen shelves is otherwise unplaceable — "Create Record"
    // means nothing until you know it is Airtable's.
    // compact drops the description line. The shortcuts at the top of the menu
    // are recognised by name, and at two lines each the six of them filled the
    // whole 500px panel, leaving the shelves below the fold — which defeats the
    // point of opening on them.
    const renderActionItem = (nt: PluginDefinition, withService = false, compact = false) => (
        <div
            className={`context-node-type context-node-action${compact ? " context-node-action--compact" : ""}`}
            onClick={() => handleNodeClick(nt.id)}
            key={nt.id}
        >
            <div className={"node-type-icon-column"}>
                <Icon name={nt.icon} size="1.25em" />
            </div>
            <div className={"node-type-text-column"}>
                <div className={"node-type-title"}>
                    {nt.name}
                    {withService && serviceOfAction.get(nt.id) && (
                        <span className={"context-service-chip"}>{serviceOfAction.get(nt.id)}</span>
                    )}
                </div>
                {!compact && (
                    <div className={"node-type-description"}>
                        {nt.summary || nt.description}
                    </div>
                )}
            </div>
        </div>
    );

    const renderServiceRow = (group: Group, service: Service) => (
        <div
            className={"context-node-type context-service-row"}
            key={service.key}
            onClick={() => setView({ level: "service", group: group.name, service: service.key })}
        >
            <div className={"node-type-icon-column"}>
                <Icon name={service.icon} size="1.25em" />
            </div>
            <div className={"node-type-text-column"}>
                <div className={"node-type-title"}>
                    {service.name}
                    <span className={"category-count"}>{service.actions.length}</span>
                </div>
                {service.description && (
                    <div className={"node-type-description"}>{service.description}</div>
                )}
            </div>
            <div className={"category-chevron"}>
                <Icon name="chevron-right" size="0.875em" />
            </div>
        </div>
    );

    const renderGroupTile = (group: Group) => (
        <button
            type="button"
            className={`context-group-tile ${group.name === CLOUD_GROUP ? "demoted" : ""}`}
            key={group.name}
            onClick={() => setView({ level: "group", group: group.name })}
        >
            <span className={"context-group-tile-icon"}>
                <Icon name={group.icon} size="1.125em" />
            </span>
            <span className={"context-group-tile-text"}>
                <span className={"context-group-tile-name"}>{group.name}</span>
                <span className={"context-group-tile-count"}>
                    {group.count.toLocaleString()} action{group.count === 1 ? "" : "s"}
                </span>
            </span>
        </button>
    );

    const renderBreadcrumbs = () => {
        if (searchTerm) {
            return (
                <div className={"context-crumbs"}>
                    <span className={"context-crumb here"}>Results for &ldquo;{searchInput.trim()}&rdquo;</span>
                </div>
            );
        }
        return (
            <div className={"context-crumbs"}>
                <button
                    type="button"
                    className={`context-crumb ${view.level === "home" ? "here" : ""}`}
                    onClick={() => setView({ level: "home" })}
                    disabled={view.level === "home"}
                >
                    Browse
                </button>
                {currentGroup && (
                    <>
                        <span className={"context-crumb-sep"}>
                            <Icon name="chevron-right" size="0.625em" />
                        </span>
                        <button
                            type="button"
                            className={`context-crumb ${view.level === "group" ? "here" : ""}`}
                            onClick={() => setView({ level: "group", group: currentGroup.name })}
                            disabled={view.level === "group"}
                        >
                            {currentGroup.name}
                        </button>
                    </>
                )}
                {currentService && (
                    <>
                        <span className={"context-crumb-sep"}>
                            <Icon name="chevron-right" size="0.625em" />
                        </span>
                        <span className={"context-crumb here"}>{currentService.name}</span>
                    </>
                )}
            </div>
        );
    };

    const positionStyle = (!props.isMobile && props.x !== undefined && props.y !== undefined)
        ? { top: props.y + "px", left: props.x + "px" }
        : {};

    const searchResults = searchTerm ? getSearchResults() : [];

    return (
        <>
            {props.visible && (
                <div className={"context-menu"} style={positionStyle} onClick={(e) => e.stopPropagation()}>
                    <div className={"context-menu-header"}>
                        <input placeholder={"Search actions..."} value={searchInput} onChange={onSearchChange} autoFocus />
                        <button className={"context-menu-close"} onClick={props.onClose}>
                            <Icon name="xmark" />
                        </button>
                    </div>

                    {renderBreadcrumbs()}

                    <div className={"context-node-type-list"}>
                        {/* Search cuts across every shelf. */}
                        {searchTerm && (
                            <>
                                {searchResults.map(p => renderActionItem(p, true))}
                                {searchResults.length === 0 && (
                                    <div className={"context-no-results"}>
                                        {searchTerm.length < SEARCH_MIN_CHARS
                                            ? "Keep typing — one character matches almost everything."
                                            : "No actions found"}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Home: a few shortcuts, then the shelves. */}
                        {!searchTerm && view.level === "home" && (
                            <>
                                {popular.length > 0 && (
                                    <>
                                        <div className={"context-section-title"}>Popular</div>
                                        {popular.map(p => renderActionItem(p, true, true))}
                                    </>
                                )}
                                <div className={"context-section-title"}>Browse by service</div>
                                <div className={"context-group-tiles"}>
                                    {groups.map(renderGroupTile)}
                                </div>
                            </>
                        )}

                        {/* A shelf: the services on it. */}
                        {!searchTerm && view.level === "group" && currentGroup && (
                            <>
                                {currentGroup.blurb && (
                                    <div className={"context-group-blurb"}>{currentGroup.blurb}</div>
                                )}
                                {currentGroup.services.map(service => renderServiceRow(currentGroup, service))}
                            </>
                        )}

                        {/* A service: its actions. */}
                        {!searchTerm && view.level === "service" && currentService && (
                            currentService.actions.map(p => renderActionItem(p))
                        )}
                    </div>
                </div>
            )}
        </>
    );
};
export default ContextMenu;
