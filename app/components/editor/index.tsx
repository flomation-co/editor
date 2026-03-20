import "./index.css"
import "./nodes.css"
import type {Flo, Environment} from "~/types";
import {useState, useCallback, useEffect, useMemo, useRef} from "react";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import axios from 'axios';

import Container from "~/components/container";
import ContextMenu from "~/components/contextMenu";

import {
    ReactFlowProvider,
    ReactFlow,
    useNodesState,
    useEdgesState,
    addEdge,
    MiniMap,
    Background,
    BackgroundVariant,
    applyNodeChanges,
    applyEdgeChanges,
    type Node,
    type Edge, useStore,
} from '@xyflow/react';

import CustomNode from "~/components/editor/customNode";
import {NodeCategoryType, useDebounce} from "~/types";
import {faPlay, faTruckRampBox} from "@fortawesome/free-solid-svg-icons";
import PropertyMenu from "~/components/propertyMenu";
import useConfig from "~/components/config";
import {faGrid, faMap, faPlus} from "@fortawesome/pro-solid-svg-icons";
import useCookieToken from "~/components/cookie";
import {useNavigate} from "react-router";
import {Tooltip} from "react-tooltip";

type EditorProps = {
    id? : string
}

const initialNodes : Node[] = [];
const initialEdges : Edge[] = [];
const config = useConfig();
const API_URL = config("AUTOMATE_API_URL");

export function Editor(props : EditorProps) {
    const navigate = useNavigate();

    const [ name, setName ] = useState<string>();
    const [ environment, setEnvironment ] = useState<string | null>();
    const [ viewport, setViewport ] = useState({x: 0, y:0, zoom: 1});
    const [ nameHasFocus, setNameHasFocus ] = useState(false);
    const [ flo, setFlo ] = useState<Flo | null>(null);
    const [ id, setId ] = useState(props.id);
    const [ status, setStatus ] = useState<string>("Up to date");
    const [ nodes, setNodes ] = useNodesState<Node[]>(initialNodes);
    const [ edges, setEdges ] = useEdgesState<Edge[]>(initialEdges);
    const [ rfInstance, setRfInstance ] = useState(null);
    const [ menuVisible, setMenuVisible ] = useState<boolean>(false);
    const [ menuXLocation, setMenuXLocation ] = useState<number>(0);
    const [ menuYLocation, setMenuYLocation ] = useState<number>(0);
    const [ snapToGrid, setSnapToGrid ] = useState<boolean>(false);
    const [ showMiniMap, setShowMiniMap ] = useState<boolean>(true);
    const [ needsUpdate, setNeedsUpdate ] = useState<boolean>(false);
    const [ plugins, setPlugins ] = useState(null);
    const [ dragging, setDragging ] = useState<boolean>(false);
    const [ width, setWidth ] = useState<number>(0);
    const [ isMobile, setIsMobile ] = useState<boolean>(true);

    const [ environments, setEnvironments ] = useState<Environment[]>();

    const [ isTriggering, setIsTriggering ] = useState<boolean>(false);
    const [ currentTrigger, setCurrentTrigger ] = useState<string>();

    const [ propertyMenuVisible, setPropertyMenuVisible ] = useState<boolean>(false);
    const [ propertyMenuXLocation, setPropertyMenuXLocation ] = useState<number>(0);
    const [ propertyMenuYLocation, setPropertyMenuYLocation ] = useState<number>(0);
    const [ propertyNode, setPropertyNode ] = useState(null);

    const token = useCookieToken();

    function handleWindowSizeChange() {
        setWidth(window.innerWidth);
    }

    useEffect(() => {
        if (isMobile) {
            setShowMiniMap(false);
        }
    }, [ isMobile ]);

    useEffect(() => {
        setIsMobile(width <= 768);
    }, [ width ]);

    useEffect(() => {
        window.addEventListener('resize', handleWindowSizeChange);
        return () => {
            window.removeEventListener('resize', handleWindowSizeChange);
        }
    }, []);

    useEffect(() => {
        axios.get(API_URL + "/api/v1/environment", {
            headers: {
                "Authorization": "Bearer " + token
            }
        })
            .then(response => {
                console.log("environments", response.data);
                setEnvironments(response.data);
            })
            .catch(error => {
                console.error("Unable to fetch actions", error);
            })
    }, []);

    useEffect(() => {
        axios.get(API_URL + "/api/v1/action", {
            headers: {
                "Authorization": "Bearer " + token
            }
        })
            .then(response => {
                console.log("actions", response.data);
                setPlugins(response.data);
            })
            .catch(error => {
                console.error("Unable to fetch actions", error);
            })
    }, []);

    useEffect(() => {
        if (id) {
            axios.get(API_URL + '/api/v1/flo/' + id, {
                headers: {
                    "Authorization": "Bearer " + token
                }
            })
                .then(response => {
                    setFlo(response.data);
                    setViewport({
                        x: response.data ? response.data.x : 0,
                        y: response.data ? response.data.y : 0,
                        zoom: response.data ? response.data.scale : 1
                    });
                    setEdges(response.data.revision ? response.data.revision.data.edges : initialEdges);
                    setNodes(response.data.revision ? response.data.revision.data.nodes : initialNodes);
                    setName(response.data ? response.data.name : "Untitled Flo");
                    setEnvironment(response.data ? response.data.environment_id : null);
                    setStatus("Up to date");
                })
                .catch(error => {
                    setStatus("Error! Retrying...");
                    console.error(error);
                })
        }
    }, [id]);

    useEffect(() => {
        if (flo) {
            flo.name = name ? name : "Untitled Flow";
        }
    }, [ name ])

    useEffect(() => {
        if (flo) {
            flo.environment_id = environment ? environment : undefined;
        }
    }, [ environment ])

    useEffect(() => {
        if (flo) {
            flo.x = viewport.x;
            flo.y = viewport.y;
            flo.scale = viewport.zoom;
        }
    }, [ viewport ])

    useEffect(() => {
        if (flo) {
            axios.post(API_URL + '/api/v1/flo/' + flo.id, flo, {
                headers: {
                    'Content-Type': 'application/json',
                    "Authorization": "Bearer " + token
                }
            })
                .then(response => {

                })
                .catch(error => {
                    console.error(error);
                })
        }
    }, [ name, viewport, environment ]);

    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setNeedsUpdate(true);

        if (flo && !dragging) {
            setStatus("Updating...");

            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }

            saveTimerRef.current = setTimeout(() => {
                axios.post(API_URL + '/api/v1/flo/' + flo.id + '/revision', {
                    data: {
                        nodes: nodes,
                        edges: edges
                    },
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        "Authorization": "Bearer " + token,
                    }
                })
                    .then(() => {
                        setStatus("Up to Date");
                    })
                    .catch(error => {
                        console.error(error);
                    })
            }, 500);
        }

        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
        };
    }, [ nodes, edges, flo, dragging ]);

    const handleNameChange = useCallback((e) => {
        setName(e.target.value);
    }, [name]);

    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge(params, eds)),
        [setEdges],
    );

    const onNodesChange = useCallback(
        (params) => setNodes((nds) => applyNodeChanges(params, nds)),
        [setNodes],
    );

    const onEdgesChange = useCallback(
        (params) => setEdges((eds) => applyEdgeChanges(params, eds)),
        [setEdges],
    );

    const onInit = useCallback((rf) => {
        rf.setViewport(viewport);
        setRfInstance(rf);
    }, [ setRfInstance, viewport ]);

    const debouncedMove = useCallback(useDebounce((e) => {
        if (rfInstance) {
            const vp = rfInstance.getViewport();

            setViewport({
                x: vp.x,
                y: vp.y,
                zoom: vp.zoom
            });
        }
    }, 500), [ setViewport, rfInstance ]);

    const onContextMenuOpen = useCallback((e) => {
        if (e) {
            e.preventDefault();
            setMenuXLocation(e.pageX);
            setMenuYLocation(e.pageY);
        }

        setMenuVisible(true);
    }, []);

    const onNodeAdd = useCallback((nodeType: string) => {
        setMenuVisible(false);

        const cfg = plugins[nodeType];
        console.log("New Node", nodeType, cfg);
        if (!cfg) {
            console.error("unable to find plugin config");
            return;
        }

        const graphElement = document.querySelector('.react-flow');
        const rect = graphElement?.getBoundingClientRect();
        const centreX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
        const centreY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;

        const nodePosition = rfInstance.screenToFlowPosition({
            x: menuXLocation || centreX,
            y: menuYLocation || centreY
        })

        let pluginType = "custom"
        if (cfg.type == NodeCategoryType.Trigger) {
            pluginType = "input"
        }

        const id ='' + self.crypto.randomUUID() + '';
        const newNode = {
            id: id,
            position: {
                x: nodePosition.x,
                y: nodePosition.y,
            },
            data: {
                id: id,
                label: nodeType,
                config: cfg
            },
            type: nodeType,
            sourcePosition: 'right',
            targetPosition: 'left'
        };

        setNodes((nds) => nds.concat(newNode));
        if (rfInstance) {
            // TODO: Send Revision
        }
    }, [ rfInstance, menuXLocation, menuYLocation ]);


    const onSelectionChange = useCallback((n) => {
        if (n.nodes.length == 1 && rfInstance) {
            setPropertyNode((prev) => {
                if (prev && prev.id === n.nodes[0].id) {
                    return prev;
                }
                return n.nodes[0];
            });
            setPropertyMenuVisible(true);
        } else {
            setPropertyMenuVisible(false);
            setPropertyNode(null);
        }
    }, [ rfInstance ]);

    const onContextMenuClose = useCallback((e) => {
        e.preventDefault();
        setMenuVisible(false);
    }, [ setMenuVisible ])

    const onValueChange = useCallback((id: string, property: string, value: any) => {
        setNodes((prev) => prev.map((node) => {
            if (node.id !== id || !node.data.config.inputs) return node;
            return {
                ...node,
                data: {
                    ...node.data,
                    config: {
                        ...node.data.config,
                        inputs: node.data.config.inputs.map((input) =>
                            input.name === property ? { ...input, value } : input
                        ),
                    },
                },
            };
        }));
    }, [setNodes])

    const onNameChange = useCallback((id: string, value: any) => {
        setNodes((prev) => prev.map((node) => {
            if (node.id !== id) return node;
            return {
                ...node,
                data: {
                    ...node.data,
                    config: {
                        ...node.data.config,
                        label: value,
                    },
                },
            };
        }));
    }, [setNodes])

    const defaultEdgeOptions = useMemo(() => {
        return {
            type: "simplebezier",
        }
    }, []);

    const nodeTypes = useMemo(() => {
        if (plugins) {
            let types = {};

            types["input"] = CustomNode;

            Object.keys(plugins).forEach((k) => {
                types[k] = CustomNode
            })

            return types;
        }
    }, [ plugins ]);

    const toggleSnapToGrid = useCallback(() => {
        setSnapToGrid(!snapToGrid)
    }, [ snapToGrid ])

    const toggleShowMiniMap = useCallback(() => {
        setShowMiniMap(!showMiniMap)
    }, [ showMiniMap ])

    const showAddNode = useCallback(() => {
        setMenuXLocation(0);
        setMenuYLocation(0);
        onContextMenuOpen(null);
    }, [])

    const updateEnvironment = (e) => {
        console.log("Set environment", e.target.value);
        if (e.target.value == "No Environment") {
            setEnvironment(null)
        } else {
            setEnvironment(e.target.value);
        }
    }

    function triggerFlo(flo_id: string, trigger_id: string) {
        if (isTriggering) {
            return
        }

        setIsTriggering(true)
        setCurrentTrigger(flo_id)

        axios.post(API_URL + "/api/v1/flo/" + flo_id + "/trigger/" + trigger_id + "/execute", null, {
            headers: {
                "Authorization": "Bearer " + token,
            }
        })
            .then(response => {
                if (response) {
                    const execution_id = response.data.id;
                    navigate("/execution/" + execution_id);
                }
            })
            .catch(error => {
                console.error(error);
            })
            .finally(() => {
                setIsTriggering(false);
                setCurrentTrigger(null);
            })
    }

    return (
            <Container noPadding={true}>
                {(!flo || !plugins) && (
                    <div className={"loading-container"}>
                        <FontAwesomeIcon icon={faTruckRampBox}/>&nbsp;<span>Loading...</span>
                    </div>
                )}

                {flo && plugins && (
                    <div className={"flo-editor-container"}>
                        <div className={"flo-editor-property"}>
                            <div className={"flo-editor-property-property-section"}>
                                <div className={"flo-editor-property-section"}>
                                    <div className={"flo-editor-property-input-value"}>
                                        <input type={"text"} className={"flo-editor-title-textbox"} value={name} onFocus={() => setNameHasFocus(true)} onBlur={() => setNameHasFocus(false)} onChange={handleNameChange}/>
                                    </div>
                                </div>
                            </div>
                            {environments && (
                                <div className={"flo-editor-property-action-section"}>
                                    <div className={"flo-editor-action-button"} data-tooltip-id={"tooltip-action-set-environment"} data-tooltip-content={"Select Environment"} data-tooltip-place={"bottom"}>
                                        <select id={"flo-environment"} className={"flo-editor-title-textbox"} onChange={updateEnvironment}>
                                            <option value={null} key={"none"} selected={flo.environment_id === null}>No Environment</option>
                                            {environments.map(env => {
                                                return <option value={env.id} key={env.id} selected={env.id === flo.environment_id}>{env.name}</option>
                                            })}
                                        </select>
                                        <Tooltip id={"tooltip-action-set-environment"} />
                                    </div>
                                </div>
                            )}
                            <div className={"flo-editor-property-action-section"}>
                                <div className={"flo-editor-action-button"} onClick={showAddNode} data-tooltip-id={"tooltip-action-add-node"} data-tooltip-content={"Add Node"} data-tooltip-place={"bottom"}>
                                    <FontAwesomeIcon icon={faPlus}/> <span>Add Node</span>
                                    <Tooltip id={"tooltip-action-add-node"} />
                                </div>
                                <div className={"flo-editor-action-divider"}></div>
                                <div className={snapToGrid ? "flo-editor-action-button flo-editor-action-button-enabled" : "flo-editor-action-button"} onClick={toggleSnapToGrid} data-tooltip-id={"tooltip-action-toggle-snap-to-grid"} data-tooltip-content={"Toggle Snap to Grid"} data-tooltip-place={"bottom"}>
                                    <FontAwesomeIcon icon={faGrid}/> <span>Snap to Grid</span>
                                    <Tooltip id={"tooltip-action-toggle-snap-to-grid"} />
                                </div>
                                <div className={showMiniMap ? "flo-editor-action-button flo-editor-action-button-enabled" : "flo-editor-action-button"} onClick={toggleShowMiniMap} data-tooltip-id={"tooltip-action-toggle-minimap"} data-tooltip-content={"Toggle Minimap"} data-tooltip-place={"bottom"}>
                                    <FontAwesomeIcon icon={faMap}/> <span>Minimap</span>
                                    <Tooltip id={"tooltip-action-toggle-minimap"} />
                                </div>
                                <div className={"flo-editor-action-divider"}></div>
                            </div>
                            <div className={"flo-editor-property-action-section"}>
                                {id && (
                                    <a onClick={() => {triggerFlo(id, 'default')}} className={"flo-editor-property-action-button"}>
                                        <FontAwesomeIcon icon={faPlay}/> <span className={"hide-sm"}>Execute Flo</span>
                                    </a>
                                )}
                            </div>
                        </div>
                        <div className={"flo-editor"}>
                            <div className={"flo-editor-graph"}>
                                <ReactFlowProvider>
                                    <ReactFlow
                                        onClick={(e) => {onContextMenuClose(e); setDragging(false)}}
                                        onContextMenu={onContextMenuOpen}
                                        colorMode="dark"
                                        nodes={nodes}
                                        edges={edges}
                                        onNodesChange={onNodesChange}
                                        onEdgesChange={onEdgesChange}
                                        onConnect={onConnect}
                                        onInit={onInit}
                                        onMove={() => {setPropertyMenuVisible(false); debouncedMove()}}
                                        onMoveStart={() => {setPropertyMenuVisible(false); setDragging(true)}}
                                        onMoveEnd={() => {setPropertyMenuVisible(false); setDragging(false)}}
                                        onNodeDragStart={() => {setPropertyMenuVisible(false); setMenuVisible(false); setDragging(true)}}
                                        onNodeDragStop={() => {setPropertyMenuVisible(false); setMenuVisible(false); setDragging(false)}}
                                        onSelectionChange={onSelectionChange}
                                        nodeTypes={nodeTypes}
                                        snapToGrid={snapToGrid}
                                        minZoom={0.1}
                                        defaultEdgeOptions={defaultEdgeOptions}
                                    >
                                        <Background color="#333" variant={BackgroundVariant.Dots} bgColor={"#0a0a0a"} />
                                        <>
                                            {showMiniMap && (
                                                <MiniMap position={"top-left"} />
                                            )}
                                        </>
                                    </ReactFlow>
                                </ReactFlowProvider>
                                {menuVisible && (
                                    <ContextMenu
                                        visible={menuVisible}
                                        onNodeAdd={onNodeAdd}
                                        plugins={plugins}
                                    />
                                )}


                               {propertyMenuVisible && !dragging && (
                                    <PropertyMenu
                                        node={propertyNode}
                                        onValueChange={onValueChange}
                                        onNameChange={onNameChange}
                                        onDismiss={() => {console.log("Dismiss"); setPropertyMenuVisible(false); setPropertyNode(null); setDragging(false);}}
                                    />
                                )}
                            </div>
                        </div>

                        <div className={"flo-editor-status"}>
                            {status}
                        </div>
                    </div>
                )}
            </Container>
    )
}