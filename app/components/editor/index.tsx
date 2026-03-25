import "./index.css"
import "./nodes.css"
import type {Flo, Environment, Property, Secret} from "~/types";
import type {VariableItem} from "~/components/propertyMenu/variableInput";
import {useState, useCallback, useEffect, useMemo, useRef} from "react";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import api from "~/lib/api";
import {toast} from "react-toastify";

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
import {faChevronDown, faGrid, faMap, faPlus, faWrench} from "@fortawesome/pro-solid-svg-icons";
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
    const menuXRef = useRef<number>(0);
    const menuYRef = useRef<number>(0);
    const [ snapToGrid, setSnapToGrid ] = useState<boolean>(true);
    const [ showMiniMap, setShowMiniMap ] = useState<boolean>(true);
    const [ needsUpdate, setNeedsUpdate ] = useState<boolean>(false);
    const [ plugins, setPlugins ] = useState(null);
    const [ dragging, setDragging ] = useState<boolean>(false);
    const [ width, setWidth ] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 0);
    const [ isMobile, setIsMobile ] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth <= 768 : true);

    const [ environments, setEnvironments ] = useState<Environment[]>();
    const [ envVariables, setEnvVariables ] = useState<VariableItem[]>([]);
    const [ envDropdownOpen, setEnvDropdownOpen ] = useState<boolean>(false);
    const envDropdownRef = useRef<HTMLDivElement>(null);

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
        api.get(API_URL + "/api/v1/environment", {
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
        if (!environment) {
            setEnvVariables([]);
            return;
        }

        const items: VariableItem[] = [];

        Promise.all([
            api.get(API_URL + "/api/v1/environment/" + environment + "/property", {
                headers: { "Authorization": "Bearer " + token }
            }).catch(() => ({ data: [] })),
            api.get(API_URL + "/api/v1/environment/" + environment + "/secret", {
                headers: { "Authorization": "Bearer " + token }
            }).catch(() => ({ data: [] })),
        ]).then(([propsRes, secretsRes]) => {
            const properties = propsRes.data || [];
            const secrets = secretsRes.data || [];

            properties.forEach((p: Property) => {
                items.push({ name: p.name, category: "env" });
            });
            secrets.forEach((s: Secret) => {
                items.push({ name: s.name, category: "secrets" });
            });

            setEnvVariables(items);
        });
    }, [environment]);

    useEffect(() => {
        api.get(API_URL + "/api/v1/action", {
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
            api.get(API_URL + '/api/v1/flo/' + id, {
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
                    const loadedEdges = response.data.revision ? response.data.revision.data.edges : initialEdges;
                    const loadedNodes = response.data.revision ? response.data.revision.data.nodes : initialNodes;
                    setEdges(loadedEdges);
                    setNodes(loadedNodes);
                    lastSavedHashRef.current = JSON.stringify({ nodes: loadedNodes, edges: loadedEdges });
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
        if (flo && !flo.revision && plugins && plugins["trigger/manual"] && nodes.length === 0) {
            const nodeId = '' + self.crypto.randomUUID() + '';
            setNodes([{
                id: nodeId,
                position: { x: 250, y: 200 },
                data: { id: nodeId, label: "trigger/manual", config: plugins["trigger/manual"] },
                type: "trigger/manual",
                sourcePosition: 'right',
                targetPosition: 'left'
            }]);
        }
    }, [flo, plugins]);

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
            api.post(API_URL + '/api/v1/flo/' + flo.id, flo, {
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
    const lastSavedHashRef = useRef<string>("");

    useEffect(() => {
        setNeedsUpdate(true);

        if (flo && !dragging) {
            // Hash current state to avoid saving unchanged revisions
            const currentHash = JSON.stringify({ nodes, edges });
            if (currentHash === lastSavedHashRef.current) {
                setStatus("Up to Date");
                return;
            }

            setStatus("Updating...");

            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }

            saveTimerRef.current = setTimeout(() => {
                api.post(API_URL + '/api/v1/flo/' + flo.id + '/revision', {
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
                        lastSavedHashRef.current = currentHash;
                        setStatus("Up to Date");
                        // Re-fetch flow to get updated triggers
                        api.get(API_URL + '/api/v1/flo/' + flo.id, {
                            headers: { "Authorization": "Bearer " + token }
                        }).then(res => {
                            if (res.data?.triggers) {
                                setFlo(prev => prev ? {...prev, triggers: res.data.triggers} : prev);
                            }
                        }).catch(() => {});
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

    const graphRef = useRef<HTMLDivElement>(null);

    const onContextMenuOpen = useCallback((e) => {
        if (e) {
            e.preventDefault();
            menuXRef.current = e.clientX;
            menuYRef.current = e.clientY;

            const rect = graphRef.current?.getBoundingClientRect();
            if (rect) {
                const menuWidth = 320;
                const menuHeight = 400;
                let x = e.clientX - rect.left;
                let y = e.clientY - rect.top;

                if (x + menuWidth > rect.width) x = rect.width - menuWidth;
                if (y + menuHeight > rect.height) y = rect.height - menuHeight;
                if (x < 0) x = 0;
                if (y < 0) y = 0;

                setMenuXLocation(x);
                setMenuYLocation(y);
            } else {
                setMenuXLocation(e.clientX);
                setMenuYLocation(e.clientY);
            }
        }

        setMenuVisible(true);
    }, []);

    const onNodeAdd = useCallback((nodeType: string) => {
        setMenuVisible(false);

        // Enforce single Manual Trigger
        if (nodeType === "trigger/manual") {
            const hasManual = nodes.some(n => n.type === "trigger/manual");
            if (hasManual) {
                toast.warning("Only one Manual Trigger is allowed per flow");
                return;
            }
        }

        const cfg = plugins[nodeType];
        console.log("New Node", nodeType, cfg);
        if (!cfg) {
            console.error("unable to find plugin config");
            return;
        }

        const mx = menuXRef.current;
        const my = menuYRef.current;

        const graphElement = document.querySelector('.react-flow');
        const rect = graphElement?.getBoundingClientRect();
        const centreX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
        const centreY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;

        const nodePosition = rfInstance.screenToFlowPosition({
            x: mx || centreX,
            y: my || centreY
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
    }, [ rfInstance ]);


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

    const onNodeDelete = useCallback((id: string) => {
        setNodes((nds) => nds.filter((node) => node.id !== id));
        setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
        setPropertyMenuVisible(false);
        setPropertyNode(null);
    }, [setNodes, setEdges]);

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

    // Static flow-level variables resolved at execution time
    const FLOW_VARIABLES: VariableItem[] = [
        { name: "flow_id", category: "flow", source: "Execution" },
        { name: "execution_id", category: "flow", source: "Execution" },
        { name: "sequence", category: "flow", source: "Execution" },
        { name: "author_id", category: "flow", source: "Execution" },
        { name: "organisation_id", category: "flow", source: "Execution" },
        { name: "runner_id", category: "flow", source: "Execution" },
        { name: "start_time", category: "flow", source: "Execution" },
        { name: "trigger_type", category: "flow", source: "Execution" },
        { name: "author_email", category: "flow", source: "Execution" },
        { name: "triggerer_email", category: "flow", source: "Execution" },
    ];

    // Derive parent node outputs for the selected property node
    const allVariables = useMemo<VariableItem[]>(() => {
        const items: VariableItem[] = [...FLOW_VARIABLES, ...envVariables];

        if (!propertyNode || !plugins) return items;

        // Find parent nodes via edges
        const parentNodeIds = edges
            .filter((e) => e.target === propertyNode.id)
            .map((e) => e.source);

        for (const parentId of parentNodeIds) {
            const parentNode = nodes.find((n) => n.id === parentId);
            if (!parentNode?.data?.config?.outputs) continue;

            const parentLabel = parentNode.data.config.label || parentNode.data.config.name || parentNode.type;

            for (const output of parentNode.data.config.outputs) {
                if (output.name) {
                    items.push({
                        name: output.name,
                        category: "input",
                        source: parentLabel,
                    });
                }
            }
        }

        return items;
    }, [envVariables, propertyNode, edges, nodes, plugins]);

    const hasValidationErrors = useMemo(() => {
        const validPrefixes = ['secrets.', 'secret.', 'env.', 'flow.', 'var.', 'loop.'];

        return nodes.some((node: any) => {
            const inputs = node.data?.config?.inputs;
            if (!inputs) return false;

            // Check required fields
            const hasRequiredEmpty = inputs.some((i: any) => i.required && (!i.value || (typeof i.value === 'string' && i.value.trim() === '')));
            if (hasRequiredEmpty) return true;

            // Check for invalid variable substitutions
            const parentIds = edges.filter((e: any) => e.target === node.id).map((e: any) => e.source);
            const parentOutputNames = new Set<string>();
            for (const pid of parentIds) {
                const pn = nodes.find((n: any) => n.id === pid);
                if (pn?.data?.config?.outputs) {
                    for (const o of pn.data.config.outputs) {
                        if (o.name) parentOutputNames.add(o.name);
                    }
                }
            }

            return inputs.some((i: any) => {
                if (typeof i.value !== 'string') return false;
                const refs = i.value.match(/\$\{([^{}]+)\}/g);
                if (!refs) return false;
                return refs.some((ref: string) => {
                    const name = ref.slice(2, -1);
                    if (validPrefixes.some(p => name.startsWith(p))) return false;
                    if (parentOutputNames.has(name)) return false;
                    return true; // unresolvable variable
                });
            });
        });
    }, [nodes, edges]);

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
        menuXRef.current = 0;
        menuYRef.current = 0;

        const rect = graphRef.current?.getBoundingClientRect();
        if (rect) {
            setMenuXLocation(rect.width / 2 - 160);
            setMenuYLocation(rect.height / 3);
        } else {
            setMenuXLocation(0);
            setMenuYLocation(0);
        }

        onContextMenuOpen(null);
    }, [])

    const selectEnvironment = (envId: string | null) => {
        setEnvironment(envId);
        setEnvDropdownOpen(false);
    }

    // Close env dropdown on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (envDropdownRef.current && !envDropdownRef.current.contains(e.target as Node)) {
                setEnvDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    function triggerFlo(flo_id: string, trigger_id: string) {
        if (isTriggering) {
            return
        }

        setIsTriggering(true)
        setCurrentTrigger(flo_id)

        api.post(API_URL + "/api/v1/flo/" + flo_id + "/trigger/" + trigger_id + "/execute", null, {
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
                                    <div className={"flo-editor-env-dropdown"} ref={envDropdownRef}>
                                        <button className={"flo-editor-env-button"} onClick={() => setEnvDropdownOpen(!envDropdownOpen)}>
                                            <FontAwesomeIcon icon={faWrench} className={"flo-editor-env-icon"} />
                                            <span className={"flo-editor-env-label"}>{flo.environment_id ? environments.find(e => e.id === flo.environment_id)?.name || "Environment" : "No Environment"}</span>
                                            <FontAwesomeIcon icon={faChevronDown} className={"flo-editor-env-chevron"} />
                                        </button>
                                        {envDropdownOpen && (
                                            <div className={"flo-editor-env-menu"}>
                                                <div
                                                    className={`flo-editor-env-item ${!flo.environment_id ? "active" : ""}`}
                                                    onClick={() => selectEnvironment(null)}
                                                >
                                                    No Environment
                                                </div>
                                                {environments.map(env => (
                                                    <div
                                                        key={env.id}
                                                        className={`flo-editor-env-item ${env.id === flo.environment_id ? "active" : ""}`}
                                                        onClick={() => selectEnvironment(env.id)}
                                                    >
                                                        {env.name}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
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
                                    <a
                                        onClick={() => { if (!hasValidationErrors) triggerFlo(id, 'default') }}
                                        className={`flo-editor-property-action-button${hasValidationErrors ? ' flo-editor-property-action-button--disabled' : ''}`}
                                        data-tooltip-id={"tooltip-action-execute"}
                                        data-tooltip-content={hasValidationErrors ? "Complete all required fields before executing" : "Execute Flo"}
                                        data-tooltip-place={"bottom"}
                                    >
                                        <FontAwesomeIcon icon={faPlay}/> <span className={"hide-sm"}>Execute Flo</span>
                                        <Tooltip id={"tooltip-action-execute"} />
                                    </a>
                                )}
                            </div>
                        </div>
                        <div className={"flo-editor"}>
                            <div className={"flo-editor-graph"} ref={graphRef}>
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
                                        onMove={() => {debouncedMove()}}
                                        onMoveStart={() => {setDragging(true)}}
                                        onMoveEnd={() => {setDragging(false)}}
                                        onNodeDragStart={() => {setPropertyMenuVisible(false); setMenuVisible(false); setDragging(true)}}
                                        onNodeDragStop={() => {setMenuVisible(false); setDragging(false)}}
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
                                        x={menuXLocation}
                                        y={menuYLocation}
                                        isMobile={isMobile}
                                        onNodeAdd={onNodeAdd}
                                        onClose={() => setMenuVisible(false)}
                                        plugins={plugins}
                                    />
                                )}


                               {propertyMenuVisible && (
                                    <PropertyMenu
                                        node={propertyNode}
                                        variables={allVariables}
                                        triggers={flo?.triggers}
                                        onValueChange={onValueChange}
                                        onNameChange={onNameChange}
                                        onDismiss={() => {console.log("Dismiss"); setPropertyMenuVisible(false); setPropertyNode(null); setDragging(false);}}
                                        onNodeDelete={onNodeDelete}
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