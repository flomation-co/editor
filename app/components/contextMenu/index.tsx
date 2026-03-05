import "./index.css"

import React, {useEffect, useState} from "react";
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'

import {library} from '@fortawesome/fontawesome-svg-core'
import {fas} from '@fortawesome/free-solid-svg-icons'
import {fab} from '@fortawesome/free-brands-svg-icons'
import type { PluginDefinition } from "~/types";
import { NodeCategoryType } from "~/types";

type ContextMenuProps = {
    visible: boolean
    x?: number;
    y?: number;
    onNodeAdd?: (nodeType: string) => void;
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

const ContextMenu = (props: ContextMenuProps) => {
    const [ currentPage, setCurrentPage ] = useState<Page>(Page.Root)
    const [ searchTerm, setSearchTerm ] = useState<string>("");

    const handleNodeClick = (name: string) => {
        if (props.onNodeAdd) {
            props.onNodeAdd(name);
        }
    }

    const onSearchChange = (evt) => {
        setSearchTerm(evt.target.value.toLowerCase());
    }

    useEffect(() => {
        if (!props.visible) {
            setSearchTerm("");
            setCurrentPage(Page.Root);
        }
    }, [props.visible]);

    return (
        <>
            {props.visible && (
                <div className={"context-menu"} style={{top: props.y + "px", left: props.x + "px"}} >
                    <input placeholder={"Search for Trigger, Action or Output..."} onChange={onSearchChange} />
                    {currentPage != Page.Root && (
                        <div className={"context-node-type"} onClick={() => setCurrentPage(Page.Root)} key={"triggers"}>
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

                        {(searchTerm || currentPage == Page.Triggers) && (
                            <>
                                {props.plugins && Object.keys(props.plugins).map((k) => {
                                    const nt = props.plugins[k];
                                    if (nt.type != NodeCategoryType.Trigger) {
                                        return
                                    }

                                    if (!searchTerm || (nt.name.toLowerCase().includes(searchTerm) || nt.description.toLowerCase().includes(searchTerm))) {
                                        return (
                                            <div className={"context-node-type"} onClick={() => handleNodeClick(nt.id)} key={nt.id}>
                                                <div className={"node-type-icon-column"}>
                                                    <FontAwesomeIcon icon={["fa-solid", "fa-" + nt.icon]} size={"2xl"}/>
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
                                        )
                                    }
                                })}
                            </>
                        )}
                        {(searchTerm || currentPage == Page.Processing) && (
                            <>
                                {props.plugins && Object.keys(props.plugins).map((k) => {
                                    const nt = props.plugins[k];
                                    if (nt.type != NodeCategoryType.Processing) {
                                        return
                                    }

                                    if (!searchTerm || (nt.name.toLowerCase().includes(searchTerm) || nt.description.toLowerCase().includes(searchTerm))) {
                                        return (
                                            <div className={"context-node-type"} onClick={() => handleNodeClick(nt.id)} key={nt.id}>
                                                <div className={"node-type-icon-column"}>
                                                    <FontAwesomeIcon icon={["fa-solid", "fa-" + nt.icon]} size={"2xl"}/>
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
                                        )
                                    }
                                })}
                            </>
                        )}
                        {(searchTerm || currentPage == Page.Outputs) && (
                            <>
                                {props.plugins && Object.keys(props.plugins).map((k) => {
                                    const nt = props.plugins[k];
                                    if (nt.type != NodeCategoryType.Output) {
                                        return
                                    }

                                    if (!searchTerm || (nt.name.toLowerCase().includes(searchTerm) || nt.description.toLowerCase().includes(searchTerm))) {
                                        return (
                                            <div className={"context-node-type"} onClick={() => handleNodeClick(nt.id)} key={nt.id}>
                                                <div className={"node-type-icon-column"}>
                                                    <FontAwesomeIcon icon={["fa-solid", "fa-" + nt.icon]} size={"2xl"}/>
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
                                        )
                                    }
                                })}
                            </>
                        )}
                        {(searchTerm || currentPage == Page.Conditional) && (
                            <>
                                {props.plugins && Object.keys(props.plugins).map((k) => {
                                    const nt = props.plugins[k];
                                    if (nt.type != NodeCategoryType.Conditional) {
                                        return
                                    }

                                    if (!searchTerm || (nt.name.toLowerCase().includes(searchTerm) || nt.description.toLowerCase().includes(searchTerm))) {
                                        return (
                                            <div className={"context-node-type"} onClick={() => handleNodeClick(nt.id)} key={nt.id}>
                                                <div className={"node-type-icon-column"}>
                                                    <FontAwesomeIcon icon={["fa-solid", "fa-" + nt.icon]} size={"2xl"}/>
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
                                        )
                                    }
                                })}
                            </>
                        )}
                        {(searchTerm || currentPage == Page.Loop) && (
                            <>
                                {props.plugins && Object.keys(props.plugins).map((k) => {
                                    const nt = props.plugins[k];
                                    if (nt.type != NodeCategoryType.Loop) {
                                        return
                                    }

                                    if (!searchTerm || (nt.name.toLowerCase().includes(searchTerm) || nt.description.toLowerCase().includes(searchTerm))) {
                                        return (
                                            <div className={"context-node-type"} onClick={() => handleNodeClick(nt.id)} key={nt.id}>
                                                <div className={"node-type-icon-column"}>
                                                    <FontAwesomeIcon icon={["fa-solid", "fa-" + nt.icon]} size={"2xl"}/>
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
                                        )
                                    }
                                })}
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};
export default ContextMenu;