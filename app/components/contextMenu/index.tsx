import "./index.css"

import React, {useEffect, useMemo, useState} from "react";
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'

import {library} from '@fortawesome/fontawesome-svg-core'
import {fas} from '@fortawesome/free-solid-svg-icons'
import {fab} from '@fortawesome/free-brands-svg-icons'
import type { PluginDefinition, PluginCategory } from "~/types";
import { NodeCategoryType } from "~/types";

type ContextMenuProps = {
    visible: boolean
    x?: number;
    y?: number;
    isMobile?: boolean;
    onNodeAdd?: (nodeType: string) => void;
    onClose?: () => void;
    plugins: PluginDefinition[];
}

enum Page {
    Root = 0,
    Triggers,
    Processing,
    Outputs,
    Conditional,
    Loop
}

// RG: PERFORMANCE IMPROVEMENT: add the fontawesome icons to the library outside of the node so not to re-add on every render
library.add(fab, fas);

type SubGroup = {
    key: string;
    name: string;
    icon: string;
    description: string;
    actions: PluginDefinition[];
}

type CategoryGroup = {
    category: PluginCategory;
    actions: PluginDefinition[];
    subGroups: SubGroup[];
}

const ContextMenu = (props: ContextMenuProps) => {
    const [ currentPage, setCurrentPage ] = useState<Page>(Page.Root)
    const [ searchTerm, setSearchTerm ] = useState<string>("");
    const [ expandedGroup, setExpandedGroup ] = useState<string | null>(null);
    const [ expandedSubGroup, setExpandedSubGroup ] = useState<string | null>(null);

    const handleNodeClick = (name: string) => {
        if (props.onNodeAdd) {
            props.onNodeAdd(name);
        }
    }

    const onSearchChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(evt.target.value.toLowerCase());
    }

    useEffect(() => {
        if (!props.visible) {
            setSearchTerm("");
            setCurrentPage(Page.Root);
            setExpandedGroup(null);
            setExpandedSubGroup(null);
        }
    }, [props.visible]);

    // Reset expanded group when changing pages
    useEffect(() => {
        setExpandedGroup(null);
        setExpandedSubGroup(null);
    }, [currentPage]);

    // Group plugins by category for a given node type, with optional sub-groups
    const getGroupedPlugins = (nodeType: NodeCategoryType): CategoryGroup[] => {
        if (!props.plugins) return [];

        const filtered = Object.keys(props.plugins)
            .map(k => props.plugins[k])
            .filter(p => p.type === nodeType);

        const groupMap = new Map<string, CategoryGroup>();

        for (const plugin of filtered) {
            const key = plugin.category?.key || "other";
            if (!groupMap.has(key)) {
                groupMap.set(key, {
                    category: plugin.category || { key: "other", name: "Other", icon: "puzzle-piece", description: "" },
                    actions: [],
                    subGroups: []
                });
            }
            const group = groupMap.get(key)!;

            const subKey = plugin.category?.sub_key;
            if (subKey) {
                let subGroup = group.subGroups.find(sg => sg.key === subKey);
                if (!subGroup) {
                    subGroup = {
                        key: subKey,
                        name: plugin.category?.sub_name || subKey,
                        icon: plugin.category?.sub_icon || group.category.icon,
                        description: plugin.category?.sub_description || "",
                        actions: []
                    };
                    group.subGroups.push(subGroup);
                }
                subGroup.actions.push(plugin);
            } else {
                group.actions.push(plugin);
            }
        }

        // Sort groups and sub-groups alphabetically
        const result = Array.from(groupMap.values()).sort((a, b) =>
            a.category.name.localeCompare(b.category.name)
        );
        for (const group of result) {
            group.subGroups.sort((a, b) => a.name.localeCompare(b.name));
        }
        return result;
    }

    // Get all plugins matching search across all types
    const getSearchResults = (): PluginDefinition[] => {
        if (!props.plugins || !searchTerm) return [];
        return Object.keys(props.plugins)
            .map(k => props.plugins[k])
            .filter(p =>
                p.name.toLowerCase().includes(searchTerm) ||
                p.description.toLowerCase().includes(searchTerm) ||
                (p.category?.name.toLowerCase().includes(searchTerm))
            );
    }

    const renderActionItem = (nt: PluginDefinition) => (
        <div className={"context-node-type context-node-action"} onClick={() => handleNodeClick(nt.id)} key={nt.id}>
            <div className={"node-type-icon-column"}>
                <FontAwesomeIcon icon={["fa-solid" as any, ("fa-" + nt.icon) as any]} size={"lg"}/>
            </div>
            <div className={"node-type-text-column"}>
                <div className={"node-type-title"}>
                    {nt.name}
                </div>
                <div className={"node-type-description"}>
                    {nt.description}
                </div>
            </div>
        </div>
    );

    const renderSubGroup = (subGroup: SubGroup) => {
        const isExpanded = expandedSubGroup === subGroup.key;
        const actionCount = subGroup.actions.length;

        return (
            <div key={subGroup.key} className={"context-sub-group"}>
                <div
                    className={`context-node-type context-sub-header ${isExpanded ? "expanded" : ""}`}
                    onClick={() => setExpandedSubGroup(isExpanded ? null : subGroup.key)}
                >
                    <div className={"node-type-icon-column"}>
                        {subGroup.icon && (
                            <FontAwesomeIcon icon={["fas", ("fa-" + subGroup.icon) as any]} size={"lg"}/>
                        )}
                    </div>
                    <div className={"node-type-text-column"}>
                        <div className={"node-type-title"}>
                            {subGroup.name}
                            <span className={"category-count"}>{actionCount}</span>
                        </div>
                        {subGroup.description && (
                            <div className={"node-type-description"}>
                                {subGroup.description}
                            </div>
                        )}
                    </div>
                    <div className={"category-chevron"}>
                        <FontAwesomeIcon icon={["fas", isExpanded ? "chevron-down" : "chevron-right"]} size={"sm"}/>
                    </div>
                </div>
                {isExpanded && (
                    <div className={"context-category-actions"}>
                        {subGroup.actions.map(renderActionItem)}
                    </div>
                )}
            </div>
        );
    };

    const renderCategoryGroup = (group: CategoryGroup) => {
        const isExpanded = expandedGroup === group.category.key;
        const totalCount = group.actions.length + group.subGroups.reduce((sum, sg) => sum + sg.actions.length, 0);

        return (
            <div key={group.category.key} className={"context-category-group"}>
                <div
                    className={`context-node-type context-category-header ${isExpanded ? "expanded" : ""}`}
                    onClick={() => {
                        setExpandedGroup(isExpanded ? null : group.category.key);
                        setExpandedSubGroup(null);
                    }}
                >
                    <div className={"node-type-icon-column"}>
                        <FontAwesomeIcon icon={["fas", ("fa-" + group.category.icon) as any]} size={"xl"}/>
                    </div>
                    <div className={"node-type-text-column"}>
                        <div className={"node-type-title"}>
                            {group.category.name}
                            <span className={"category-count"}>{totalCount}</span>
                        </div>
                        <div className={"node-type-description"}>
                            {group.category.description}
                        </div>
                    </div>
                    <div className={"category-chevron"}>
                        <FontAwesomeIcon icon={["fas", isExpanded ? "chevron-down" : "chevron-right"]} size={"sm"}/>
                    </div>
                </div>
                {isExpanded && (
                    <div className={"context-category-actions"}>
                        {group.actions.map(renderActionItem)}
                        {group.subGroups.map(renderSubGroup)}
                    </div>
                )}
            </div>
        );
    };

    const renderGroupedPage = (nodeType: NodeCategoryType) => {
        const groups = getGroupedPlugins(nodeType);

        // If there's only one group, expand it automatically
        if (groups.length === 1 && expandedGroup === null) {
            // Use a flat list instead of nesting for single groups
            return groups[0].actions.map(renderActionItem);
        }

        return groups.map(renderCategoryGroup);
    };

    const positionStyle = (!props.isMobile && props.x !== undefined && props.y !== undefined)
        ? { top: props.y + "px", left: props.x + "px" }
        : {};

    return (
        <>
            {props.visible && (
                <div className={"context-menu"} style={positionStyle} onClick={(e) => e.stopPropagation()}>
                    <div className={"context-menu-header"}>
                        <input placeholder={"Search for Trigger, Action or Output..."} onChange={onSearchChange} autoFocus />
                        <button className={"context-menu-close"} onClick={props.onClose}>
                            <FontAwesomeIcon icon={["fas", "xmark"]} />
                        </button>
                    </div>
                    {currentPage != Page.Root && !searchTerm && (
                        <div className={"context-node-type"} onClick={() => setCurrentPage(Page.Root)} key={"back"}>
                            <div className={"node-type-icon-column"}>
                                <FontAwesomeIcon icon={["fas", "arrow-left"]} size={"2xl"}/>
                            </div>
                            <div className={"node-type-text-column"}>
                                <div className={"node-type-description"}>
                                    Go back...
                                </div>
                            </div>
                        </div>
                    )}
                    <div className={"context-node-type-list"}>
                        {/* Search results */}
                        {searchTerm && (
                            <>
                                {getSearchResults().map(renderActionItem)}
                                {getSearchResults().length === 0 && (
                                    <div className={"context-no-results"}>
                                        No actions found
                                    </div>
                                )}
                            </>
                        )}

                        {/* Root menu */}
                        {!searchTerm && currentPage == Page.Root && (
                            <>
                                <div className={"context-node-type"} onClick={() => setCurrentPage(Page.Triggers)} key={"triggers"}>
                                    <div className={"node-type-icon-column"}>
                                        <FontAwesomeIcon icon={["fas", "bolt-lightning"]} size={"2xl"}/>
                                    </div>
                                    <div className={"node-type-text-column"}>
                                        <div className={"node-type-title"}>
                                            Triggers
                                        </div>
                                        <div className={"node-type-description"}>
                                            Start a Flow
                                        </div>
                                    </div>
                                </div>
                                <div className={"context-node-type"} onClick={() => setCurrentPage(Page.Processing)} key={"actions"}>
                                    <div className={"node-type-icon-column"}>
                                        <FontAwesomeIcon icon={["fas", "microchip"]} size={"2xl"}/>
                                    </div>
                                    <div className={"node-type-text-column"}>
                                        <div className={"node-type-title"}>
                                            Actions
                                        </div>
                                        <div className={"node-type-description"}>
                                            Do something
                                        </div>
                                    </div>
                                </div>
                                <div className={"context-node-type"} onClick={() => setCurrentPage(Page.Outputs)} key={"outputs"}>
                                    <div className={"node-type-icon-column"}>
                                        <FontAwesomeIcon icon={["fas", "location-arrow"]} size={"2xl"}/>
                                    </div>
                                    <div className={"node-type-text-column"}>
                                        <div className={"node-type-title"}>
                                            Outputs
                                        </div>
                                        <div className={"node-type-description"}>
                                            Send data somewhere else to be used
                                        </div>
                                    </div>
                                </div>
                                <div className={"context-node-type"} onClick={() => setCurrentPage(Page.Conditional)} key={"conditionals"}>
                                    <div className={"node-type-icon-column"}>
                                        <FontAwesomeIcon icon={["fas", "code-branch"]} size={"2xl"}/>
                                    </div>
                                    <div className={"node-type-text-column"}>
                                        <div className={"node-type-title"}>
                                            Conditionals
                                        </div>
                                        <div className={"node-type-description"}>
                                            Control Flow based on dynamic conditions
                                        </div>
                                    </div>
                                </div>
                                <div className={"context-node-type"} onClick={() => setCurrentPage(Page.Loop)} key={"looping"}>
                                    <div className={"node-type-icon-column"}>
                                        <FontAwesomeIcon icon={["fas", "recycle"]} size={"2xl"}/>
                                    </div>
                                    <div className={"node-type-text-column"}>
                                        <div className={"node-type-title"}>
                                            Looping
                                        </div>
                                        <div className={"node-type-description"}>
                                            Iterate within Flows via looping
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Category pages with nested groups */}
                        {!searchTerm && currentPage == Page.Triggers && renderGroupedPage(NodeCategoryType.Trigger)}
                        {!searchTerm && currentPage == Page.Processing && renderGroupedPage(NodeCategoryType.Processing)}
                        {!searchTerm && currentPage == Page.Outputs && renderGroupedPage(NodeCategoryType.Output)}
                        {!searchTerm && currentPage == Page.Conditional && renderGroupedPage(NodeCategoryType.Conditional)}
                        {!searchTerm && currentPage == Page.Loop && renderGroupedPage(NodeCategoryType.Loop)}
                    </div>
                </div>
            )}
        </>
    );
};
export default ContextMenu;
