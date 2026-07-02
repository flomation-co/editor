import "./index.css"
import { uuidv4 } from "~/lib/uuid";
import "./nodes.css"
import type {Flo, Environment, Property, Secret} from "~/types";
import type {VariableItem} from "~/components/propertyMenu/variableInput";
import {useState, useCallback, useEffect, useMemo, useRef} from "react";

import { Icon } from "~/components/icons/Icon";

import api from "~/lib/api";
import { detectSecret } from "~/lib/secretDetection";
import { ValidationProvider, type ValidationProblem } from "~/components/editor/validationContext";
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
import GroupNode from "~/components/editor/groupNode";
import { getLayoutedElements } from "~/components/editor/autoLayout";

// Internal node type for the visual grouping primitive. Picked
// short so it doesn't collide with any plugin name produced by the
// API manifest (every real plugin uses a "category/name" shape).
const GROUP_NODE_TYPE = "group";

// orderParentsFirst rearranges a node array so every node carrying
// a parentId appears AFTER its parent. React Flow v12 requires this
// invariant or it silently fails to render the child — a particularly
// nasty bug because the underlying state is correct, only the
// rendered DOM is missing. We apply this defensively at load time
// (a flow saved with the wrong order self-heals on reopen) and at
// reparent time (a freshly-dropped child gets sorted into place).
function orderParentsFirst(nodes: any[]): any[] {
    const byId = new Map<string, any>();
    for (const n of nodes) byId.set(n.id, n);

    const out: any[] = [];
    const placed = new Set<string>();

    // depth-first walk so a chain of nested parents (group inside
    // group, if we ever support that) still terminates correctly.
    const visit = (n: any) => {
        if (placed.has(n.id)) return;
        if (n.parentId && byId.has(n.parentId) && !placed.has(n.parentId)) {
            visit(byId.get(n.parentId));
        }
        out.push(n);
        placed.add(n.id);
    };
    for (const n of nodes) visit(n);
    return out;
}
import {NodeCategoryType, useDebounce} from "~/types";
import PropertyMenu from "~/components/propertyMenu";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import { EnvironmentContext } from "~/contexts/EnvironmentContext";
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

    const [ settingsDropdownOpen, setSettingsDropdownOpen ] = useState<boolean>(false);
    const settingsDropdownRef = useRef<HTMLDivElement>(null);
    const [ envSearch, setEnvSearch ] = useState<string | null>(null);
    const [ envListOpen, setEnvListOpen ] = useState<boolean>(false);
    const [ notifySuccess, setNotifySuccess ] = useState<boolean>(false);
    const [ notifyFailure, setNotifyFailure ] = useState<boolean>(false);
    const [ notificationEmails, setNotificationEmails ] = useState<string>('');
    const [ maxConcurrent, setMaxConcurrent ] = useState<number | null>(null);

    const [ isTriggering, setIsTriggering ] = useState<boolean>(false);
    const [ currentTrigger, setCurrentTrigger ] = useState<string>();
    const [ triggerInputModal, setTriggerInputModal ] = useState<{floId: string; triggerId: string; inputs: any[]} | null>(null);
    const [ triggerInputValues, setTriggerInputValues ] = useState<Record<string, string>>({});

    const [ propertyMenuVisible, setPropertyMenuVisible ] = useState<boolean>(false);
    const [ propertyMenuXLocation, setPropertyMenuXLocation ] = useState<number>(0);
    const [ propertyMenuYLocation, setPropertyMenuYLocation ] = useState<number>(0);
    const [ propertyNode, setPropertyNode ] = useState(null);
    const [ propertyExpanded, setPropertyExpanded ] = useState(false);
    const clipboardRef = useRef<any[]>([]);

    const token = useCookieToken();

    function handleWindowSizeChange() {
        setWidth(window.innerWidth);
    }

    // Copy/Paste keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't intercept when a text field is focused
            const tag = (document.activeElement?.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || (document.activeElement as HTMLElement)?.isContentEditable) {
                return;
            }

            if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
                const selected = nodes.filter((n: any) => n.selected);
                if (selected.length > 0) {
                    clipboardRef.current = selected.map((n: any) => ({
                        ...n,
                        data: JSON.parse(JSON.stringify(n.data)),
                    }));
                    toast.success(`Copied ${selected.length} node${selected.length > 1 ? 's' : ''}`);
                }
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
                if (clipboardRef.current.length > 0) {
                    const offset = 50;
                    const newNodes = clipboardRef.current.map((n: any) => {
                        const newId = '' + uuidv4() + '';
                        return {
                            ...n,
                            id: newId,
                            position: { x: n.position.x + offset, y: n.position.y + offset },
                            data: { ...JSON.parse(JSON.stringify(n.data)), id: newId },
                            selected: false,
                        };
                    });
                    setNodes((nds: any[]) => nds.map(n => ({ ...n, selected: false })).concat(newNodes));
                    toast.success(`Pasted ${newNodes.length} node${newNodes.length > 1 ? 's' : ''}`);
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [nodes]);

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

    // Reload secrets / properties / credentials for the current
    // environment. Extracted into a stable callback so the variable
    // picker can re-trigger it via the EnvironmentContext after the
    // user creates a new entry on the Environment page in another
    // tab. Three parallel GETs (deduped from prior inline useEffect).
    const refreshEnvironmentVariables = useCallback(() => {
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
            api.get(API_URL + "/api/v1/environment/" + environment + "/credential", {
                headers: { "Authorization": "Bearer " + token }
            }).catch(() => ({ data: [] })),
        ]).then(([propsRes, secretsRes, credsRes]) => {
            const properties = propsRes.data || [];
            const secrets = secretsRes.data || [];
            const credentials = credsRes.data || [];

            properties.forEach((p: Property) => {
                items.push({ name: p.name, category: "env" });
            });
            secrets.forEach((s: Secret) => {
                items.push({ name: s.name, category: "secrets" });
            });
            credentials.forEach((c: any) => {
                // Surface every credential regardless of status. A pending
                // credential (OAuth not yet completed) used to be hidden,
                // which made users think their newly-created credential
                // had vanished. The picker dropdown badges non-active
                // credentials so the state is visible at the point of
                // selection. Action runtime will still fail loudly if
                // they pick a pending one and run the flow.
                if (c.name) {
                    items.push({
                        name: c.name,
                        category: "credentials",
                        source: c.provider_name || c.provider_slug,
                        status: c.status,
                    });
                }
            });

            setEnvVariables(items);
        });
    }, [environment, token]);

    useEffect(() => {
        refreshEnvironmentVariables();
    }, [refreshEnvironmentVariables]);

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
                    const rawLoadedNodes = response.data.revision ? response.data.revision.data.nodes : initialNodes;
                    // Defensive ordering pass — see orderParentsFirst
                    // for the React Flow v12 invariant this protects.
                    const loadedNodes = orderParentsFirst(rawLoadedNodes);
                    setEdges(loadedEdges);
                    setNodes(loadedNodes);
                    lastSavedHashRef.current = JSON.stringify({ nodes: loadedNodes, edges: loadedEdges });
                    setName(response.data ? response.data.name : "Untitled Flo");
                    setEnvironment(response.data ? response.data.environment_id : null);
                    setNotifySuccess(response.data?.notify_on_success || false);
                    setNotifyFailure(response.data?.notify_on_failure || false);
                    setNotificationEmails(response.data?.notification_emails || '');
                    setMaxConcurrent(response.data?.max_concurrent_executions || null);
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
            const nodeId = '' + uuidv4() + '';
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
            flo.notify_on_success = notifySuccess;
            flo.notify_on_failure = notifyFailure;
            flo.notification_emails = notificationEmails || undefined;
        }
    }, [ notifySuccess, notifyFailure, notificationEmails ])

    useEffect(() => {
        if (flo) {
            flo.max_concurrent_executions = maxConcurrent || undefined;
        }
    }, [ maxConcurrent ])

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
    }, [ name, viewport, environment, notifySuccess, notifyFailure, notificationEmails, maxConcurrent ]);

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
        (params) => {
            setEdges((eds) => addEdge(params, eds));

            // Auto-populate empty inputs on target node when parent output names match
            const sourceNode = nodes.find((n: any) => n.id === params.source);
            if (!sourceNode?.data?.config?.outputs) return;

            const parentOutputs = sourceNode.data.config.outputs;

            setNodes((nds: any[]) => nds.map(n => {
                if (n.id !== params.target || !n.data?.config?.inputs) return n;

                let changed = false;
                const updatedInputs = n.data.config.inputs.map((inp: any) => {
                    if (inp.value && String(inp.value).trim() !== '') return inp;
                    const match = parentOutputs.find((o: any) => o.name === inp.name);
                    if (match) {
                        changed = true;
                        return { ...inp, value: '${' + match.name + '}' };
                    }
                    return inp;
                });

                if (!changed) return n;
                return { ...n, data: { ...n.data, config: { ...n.data.config, inputs: updatedInputs } } };
            }));
        },
        [setEdges, nodes, setNodes],
    );

    const onNodesChange = useCallback(
        (params) => setNodes((nds) => applyNodeChanges(params, nds)),
        [setNodes],
    );

    const onEdgesChange = useCallback(
        (params) => setEdges((eds) => applyEdgeChanges(params, eds)),
        [setEdges],
    );

    const onEdgeDoubleClick = useCallback((event: any, edge: any) => {
        setEdges((eds: any[]) => eds.map(e => {
            if (e.id === edge.id) {
                const isDisabled = e.data?.disabled ?? false;
                return {
                    ...e,
                    animated: !isDisabled ? false : undefined,
                    style: !isDisabled ? { stroke: 'rgba(255,255,255,0.15)', strokeDasharray: '5 5' } : undefined,
                    data: { ...e.data, disabled: !isDisabled },
                };
            }
            return e;
        }));
    }, [setEdges]);

    const onInit = useCallback((rf) => {
        rf.setViewport(viewport);
        setRfInstance(rf);
    }, [ setRfInstance, viewport ]);

    // Reparent a node when the user drops it into (or out of) a
    // group's bounds. Tier-1 grouping is purely visual but the
    // experience requires this: drop a tool node onto an expanded
    // group and it should "stick" to that group. We do it on drag
    // stop rather than during the drag to avoid fighting React
    // Flow's position updates mid-gesture.
    const onNodeDragStopReparent = useCallback((_event: any, node: any) => {
        if (node.type === GROUP_NODE_TYPE) return; // groups never get reparented onto other groups

        // Find any expanded group whose flow-space bounds contain
        // the dropped node's position. We use the node's TOP-LEFT
        // coordinate as the hit test point; refining to centre or
        // overlap area is possible later but top-left is what users
        // visually drag.
        const candidates = (nodes as any[]).filter(n =>
            n.type === GROUP_NODE_TYPE && n.data?.collapsed === false
        );

        // Read the group's true rendered size from `measured` first
        // (React Flow's authoritative cache after NodeResizer fires),
        // then fall back to style and top-level width/height. The
        // earlier version read only style.width/height — if the user
        // resized via NodeResizer and the new size landed on a
        // different field, the hit-test would still use the original
        // 400×240 box and silently miss drops in the new area.
        const hit = candidates.find(g => {
            const w = g.measured?.width ?? (g.style?.width as number) ?? g.width ?? 400;
            const h = g.measured?.height ?? (g.style?.height as number) ?? g.height ?? 240;
            const gx = g.position.x;
            const gy = g.position.y;
            // Node positions are relative to the parent when parentId
            // is set, so reconstruct absolute coordinates for the
            // currently-parented case.
            let ax = node.position.x;
            let ay = node.position.y;
            if (node.parentId) {
                const parent = (nodes as any[]).find(p => p.id === node.parentId);
                if (parent) {
                    ax += parent.position.x;
                    ay += parent.position.y;
                }
            }
            return ax >= gx && ax <= gx + w && ay >= gy && ay <= gy + h;
        });

        // Compute the next parentId. Three cases:
        //  - landed in a group, wasn't parented to it before → reparent
        //  - landed outside any group, was previously parented → unparent
        //  - no change → bail
        const currentParent: string | undefined = node.parentId;
        const nextParent: string | undefined = hit?.id;
        if (currentParent === nextParent) return;

        setNodes(prev => {
            const rewritten = prev.map((n: any) => {
            if (n.id !== node.id) return n;
            if (nextParent) {
                // React Flow expects child positions to be relative
                // to the parent when parentId is set.
                const parentNode = prev.find((p: any) => p.id === nextParent);
                const px = parentNode?.position.x ?? 0;
                const py = parentNode?.position.y ?? 0;
                // If we already had a parent, n.position was relative
                // to THAT parent — convert to absolute first, then to
                // the new parent's relative space.
                let absX = n.position.x;
                let absY = n.position.y;
                if (currentParent) {
                    const old = prev.find((p: any) => p.id === currentParent);
                    if (old) {
                        absX += old.position.x;
                        absY += old.position.y;
                    }
                }
                // Deliberately NOT setting extent: "parent".
                // The constraint would prevent the user from
                // dragging a child back out of the group — which
                // is the only natural way to remove it without
                // a context-menu affordance. The child still moves
                // with the group because parentId makes positions
                // relative; it just isn't visually clamped.
                return {
                    ...n,
                    parentId: nextParent,
                    position: { x: absX - px, y: absY - py },
                };
            }
            // Unparent: convert relative back to absolute.
            const old = currentParent ? prev.find((p: any) => p.id === currentParent) : undefined;
            const absX = n.position.x + (old?.position.x ?? 0);
            const absY = n.position.y + (old?.position.y ?? 0);
            const { parentId, extent, ...rest } = n;
            return { ...rest, position: { x: absX, y: absY } };
        });

            // React Flow v12 requires children to appear AFTER
            // their parent in the nodes array — otherwise the child
            // node either renders at the wrong coordinates or
            // disappears entirely. When the user drops an existing
            // (older) node onto a freshly-added (newer) group, the
            // child's index is BELOW the parent's, so we reorder
            // here. Only the dragged node needs to move; sibling
            // order between unrelated nodes is preserved.
            if (nextParent) {
                const parentIdx = rewritten.findIndex((n: any) => n.id === nextParent);
                const childIdx = rewritten.findIndex((n: any) => n.id === node.id);
                if (parentIdx >= 0 && childIdx >= 0 && childIdx < parentIdx) {
                    const [child] = rewritten.splice(childIdx, 1);
                    // After splicing the child out, parent's index
                    // is now (parentIdx - 1). Insert child at
                    // (parentIdx - 1 + 1) = parentIdx so the child
                    // sits immediately after its parent.
                    rewritten.splice(parentIdx, 0, child);
                }
            }
            return rewritten;
        });
    }, [ nodes, setNodes ]);

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

        const id ='' + uuidv4() + '';
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
        // Group nodes have no plugin config and therefore no
        // property surface — selecting one shouldn't open the
        // property menu (it would render as an empty wrapper).
        // The group's inline header input handles renaming.
        if (n.nodes.length == 1 && rfInstance && n.nodes[0].type !== GROUP_NODE_TYPE) {
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
            if (node.id !== id) return node;

            // Special case: store trigger input definitions separately from action inputs
            if (property === "__trigger_inputs__") {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        config: {
                            ...node.data.config,
                            trigger_inputs: value,
                        },
                    },
                };
            }

            if (!node.data.config.inputs) return node;
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
            // Group nodes have no plugin config — they store their
            // display name directly on data.label. Normal action
            // nodes store it on data.config.label (the manifest
            // wraps the action definition under config).
            if (node.type === GROUP_NODE_TYPE) {
                return {
                    ...node,
                    data: { ...node.data, label: value },
                };
            }
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
        { name: "system_prompt", category: "flow", source: "Agent / Flow Settings" },
        { name: "agent_id", category: "flow", source: "Agent" },
        { name: "agent_user_id", category: "flow", source: "Agent" },
        { name: "user_id", category: "flow", source: "Agent" },
        { name: "identities", category: "flow", source: "Agent" },
        { name: "conversation_id", category: "flow", source: "Agent" },
        { name: "trigger_source", category: "flow", source: "Agent" },
        { name: "channel_type", category: "flow", source: "Agent Channel" },
        { name: "channel_id", category: "flow", source: "Agent Channel" },
        { name: "thread_id", category: "flow", source: "Agent Channel" },
        { name: "page_access_token", category: "flow", source: "Facebook Messenger" },
    ];

    // Extended user profile fields, surfaced as ${user.X} via the
    // executor's ExecutionContext.UserVariables map. Populated server-
    // side at bootstrap so flows always see the executing user's
    // profile snapshot (and the composed full_name / full_address).
    const USER_VARIABLES: VariableItem[] = [
        { name: "id", category: "user", source: "User Profile" },
        { name: "name", category: "user", source: "User Profile" },
        { name: "email", category: "user", source: "User Profile" },
        { name: "salutation", category: "user", source: "User Profile" },
        { name: "first_name", category: "user", source: "User Profile" },
        { name: "last_name", category: "user", source: "User Profile" },
        { name: "full_name", category: "user", source: "User Profile" },
        { name: "job_title", category: "user", source: "User Profile" },
        { name: "address_line_1", category: "user", source: "User Address" },
        { name: "address_line_2", category: "user", source: "User Address" },
        { name: "city", category: "user", source: "User Address" },
        { name: "region", category: "user", source: "User Address" },
        { name: "postcode", category: "user", source: "User Address" },
        { name: "country", category: "user", source: "User Address" },
        { name: "full_address", category: "user", source: "User Address" },
    ];

    // Canonical trigger data variables injected by Launch when an agent
    // receives a message via any channel (Slack, Telegram, webhook, or
    // commitment wake-up). These are auto-wired from trigger node outputs.
    // projectCodeNodeOutputs reads the user-declared "Outputs"
    // key/value array on a Python / JavaScript code node and adds
    // each declared key to the supplied items list. The same shape
    // the runtime executor uses (actions/script/common.go:
    // BuildOutputs) so editor autocomplete matches runtime exactly.
    //
    // Accepts the raw input value (which may be a string-encoded
    // JSON, an array of {key,value} objects, or undefined) and a
    // source label for display in the picker dropdown.
    const projectCodeNodeOutputs = (
        rawValue: any,
        items: VariableItem[],
        sourceLabel: string,
    ) => {
        if (!rawValue) return;
        let parsed: any = rawValue;
        if (typeof rawValue === 'string') {
            try { parsed = JSON.parse(rawValue); } catch { return; }
        }
        if (!Array.isArray(parsed)) return;
        for (const row of parsed) {
            if (!row || typeof row !== 'object') continue;
            const name = (row.key || row.name || '').toString().trim();
            if (!name) continue;
            items.push({ name, category: "input", source: sourceLabel });
        }
    };

    const AGENT_TRIGGER_VARIABLES: VariableItem[] = [
        { name: "content", category: "input", source: "Agent Channel" },
        { name: "sender", category: "input", source: "Agent Channel" },
        { name: "channel_type", category: "input", source: "Agent Channel" },
        { name: "channel_id", category: "input", source: "Agent Channel" },
        { name: "thread_id", category: "input", source: "Agent Channel" },
        { name: "user_id", category: "input", source: "Agent Channel" },
        { name: "user_name", category: "input", source: "Agent Channel" },
        { name: "message_id", category: "input", source: "Agent Channel" },
        { name: "trigger_source", category: "input", source: "Agent Channel" },
        { name: "commitment_id", category: "input", source: "Commitment" },
    ];

    // Derive parent node outputs for the selected property node
    const allVariables = useMemo<VariableItem[]>(() => {
        const items: VariableItem[] = [...FLOW_VARIABLES, ...USER_VARIABLES, ...AGENT_TRIGGER_VARIABLES, ...envVariables];

        // Add ${var.X} variables from Set Variable nodes in the flow
        for (const n of nodes as any[]) {
            if (n.type === 'common/set_variable' || n.data?.label === 'common/set_variable') {
                const nameInput = n.data?.config?.inputs?.find((i: any) => i.name === 'name');
                if (nameInput?.value && typeof nameInput.value === 'string' && nameInput.value.trim()) {
                    items.push({ name: nameInput.value.trim(), category: "var", source: "Variable" });
                }
            }

            // Add trigger_inputs from Manual Trigger as ${trigger.X} variables
            if (n.type === 'trigger/manual' || n.data?.label === 'trigger/manual') {
                const triggerInputs = n.data?.config?.trigger_inputs;
                if (Array.isArray(triggerInputs)) {
                    for (const ti of triggerInputs) {
                        if (ti.name && ti.name.trim()) {
                            items.push({ name: ti.name.trim(), category: "trigger", source: "Manual Trigger" });
                        }
                    }
                }
            }

            // Add form fields from Form Trigger as available variables
            if (n.type === 'trigger/form' || n.data?.label === 'trigger/form') {
                const formDefInput = n.data?.config?.inputs?.find((i: any) => i.name === 'form_definition');
                if (formDefInput?.value) {
                    try {
                        const formDef = typeof formDefInput.value === 'string'
                            ? JSON.parse(formDefInput.value)
                            : formDefInput.value;
                        if (formDef?.pages) {
                            for (const page of formDef.pages) {
                                if (Array.isArray(page.components)) {
                                    for (const comp of page.components) {
                                        if (comp.name && comp.name.trim()) {
                                            items.push({
                                                name: comp.name.trim(),
                                                category: "input",
                                                source: comp.label || "Form Field",
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    } catch {
                        // Invalid form definition JSON — skip
                    }
                }
            }

            // Add user-declared outputs from code nodes (Python /
            // JavaScript) as available variables. The "outputs" input
            // is a key/value array — each row's Key becomes a top-
            // level output name on the node, mirroring exactly what
            // the executor produces at runtime (see
            // actions/script/common.go: BuildOutputs).
            const isCodeNode =
                n.data?.label === 'script/python' || n.data?.label === 'script/javascript' ||
                n.type === 'script/python' || n.type === 'script/javascript';
            if (isCodeNode) {
                const outDecl = n.data?.config?.inputs?.find((i: any) => i.name === 'outputs');
                const sourceLabel = n.data?.label === 'script/python' ? 'Python Output' : 'JavaScript Output';
                projectCodeNodeOutputs(outDecl?.value, items, sourceLabel);
            }
        }

        if (!propertyNode || !plugins) return items;

        // Conditional node types that pass through their parent outputs
        // to child branches (if, switch, loop). The editor mirrors the
        // executor's pass-through behaviour by walking up through these
        // nodes to find upstream outputs for autocomplete.
        const passThroughTypes = new Set([4, 5, 6]); // conditional, loop, switch

        // Collect outputs from parent nodes, walking through conditionals
        // to find grandparent outputs that pass through.
        // Collected separately so we can surface them at the TOP of the picker
        // (they're what users almost always want) rather than appended after
        // the global flow/user/secret/env variables.
        const parentItems: VariableItem[] = [];
        const seen = new Set<string>();
        const collectParentOutputs = (nodeId: string) => {
            if (seen.has(nodeId)) return;
            seen.add(nodeId);

            const parentIds = edges
                .filter((e) => e.target === nodeId)
                .map((e) => e.source);

            for (const parentId of parentIds) {
                const parentNode = nodes.find((n: any) => n.id === parentId) as any;
                if (!parentNode?.data?.config) continue;

                const parentActionName = parentNode.data.config.name || parentNode.type;
                const parentUserLabel = parentNode.data.config.label;
                const parentNodeName = parentUserLabel || parentActionName;
                const parentType = parentNode.data?.config?.type;
                if (parentNode.data.config.outputs) {
                    for (const output of parentNode.data.config.outputs) {
                        if (output.name) {
                            parentItems.push({
                                name: output.name,
                                insertName: parentId + "." + output.name,
                                category: "input",
                                source: parentNodeName,
                            });
                        }
                    }
                }

                // If this parent is a conditional/switch/loop, also walk
                // up to its parents since it passes their outputs through
                if (passThroughTypes.has(parentType)) {
                    collectParentOutputs(parentId);
                }

                // Sub-flow cross-reference: when we reach a Begin Sub-Flow
                // node, find all Invoke Sub-Flow nodes that call this sub-flow
                // and walk up from their ancestors too.
                if (parentNode.data?.label === 'subflow/begin') {
                    const beginName = parentNode.data?.config?.inputs?.find(
                        (i: any) => i.name === 'name'
                    )?.value;
                    if (beginName) {
                        for (const n of nodes as any[]) {
                            if (n.data?.label !== 'subflow/invoke') continue;
                            const invokeName = n.data?.config?.inputs?.find(
                                (i: any) => i.name === 'sub_flow_name'
                            )?.value;
                            if (invokeName === beginName) {
                                collectParentOutputs(n.id);
                            }
                        }
                    }
                }
            }
        };

        collectParentOutputs(propertyNode.id);

        // Connected upstream-node outputs first, then the global variables.
        return [...parentItems, ...items];
    }, [envVariables, propertyNode, edges, nodes, plugins]);

    // validationProblems is the single source of truth for "is this
    // flow runnable" across the whole editor surface:
    //   - executionBlocked (Execute button + handleExecuteClick gate)
    //   - executionBlockedReason (Execute button tooltip)
    //   - customNode rendering (per-node red/amber outline + tooltip)
    //
    // Each entry is keyed by node id and carries the highest-severity
    // problem on that node. Severity ordering: secret > unresolved
    // > required. A node with multiple problems shows only the
    // worst, on the principle that you fix the security issue before
    // worrying about a missing field.
    const validationProblems = useMemo<Map<string, ValidationProblem>>(() => {
        const validPrefixes = ['secrets.', 'secret.', 'env.', 'flow.', 'var.', 'loop.', 'trigger.', 'credentials.', 'user.'];
        // Prefixes that are always valid (runtime variables, not environment-dependent).
        // ${user.X} populates from the executing user's profile at execution
        // bootstrap — the editor has no way to "preview" the values, but
        // they're always resolvable at runtime so they should never block
        // manual execution.
        const runtimePrefixes = ['flow.', 'var.', 'loop.', 'trigger.', 'credentials.', 'user.'];

        const isInputVisible = (input: any, allInputs: any[]) => {
            if (!input.visible_when) return true;
            const ref = allInputs.find((x: any) => x.name === input.visible_when.field);
            const refValue = ref?.value ?? '';
            return input.visible_when.values.includes(refValue);
        };

        const problems = new Map<string, ValidationProblem>();
        const labelOf = (node: any) => node.data?.label || node.type || node.id;

        // Helper to record a problem at the right severity. Already-
        // present higher-severity problems win, so this is safe to
        // call in any order.
        const record = (nodeId: string, candidate: ValidationProblem) => {
            const rank = { required: 0, unresolved: 1, secret: 2 } as const;
            const existing = problems.get(nodeId);
            if (!existing || rank[candidate.kind] > rank[existing.kind]) {
                problems.set(nodeId, candidate);
            }
        };

        nodes.forEach((node: any) => {
            const inputs = node.data?.config?.inputs;
            if (!inputs) return;

            // Literal secrets are checked on EVERY node including
            // triggers — there's no situation where pasting a
            // hardcoded token into any field is OK.
            for (const i of inputs) {
                if (typeof i.value === 'string' && detectSecret(i.value)) {
                    record(node.id, {
                        kind: "secret",
                        fieldName: i.name,
                        fieldLabel: i.label || i.name,
                        detail: `"${i.label || i.name}" on ${labelOf(node)} looks like a literal secret — store it in environment secrets and reference it as \${secrets.NAME} before executing.`,
                    });
                }
            }

            // Skip required-field validation for trigger nodes — their inputs are provided at execution time
            const isTrigger = node.type?.startsWith("trigger/") || node.data?.label?.startsWith("trigger/");
            if (isTrigger) return;

            // Required-field check
            for (const i of inputs) {
                if (!i.required) continue;
                if (!isInputVisible(i, inputs)) continue;
                if (!i.value || (typeof i.value === 'string' && i.value.trim() === '')) {
                    record(node.id, {
                        kind: "required",
                        fieldName: i.name,
                        fieldLabel: i.label || i.name,
                        detail: `Required field "${i.label || i.name}" on ${labelOf(node)} is empty.`,
                    });
                }
            }

            // Build the full set of valid variables for this specific node
            // by walking ancestors (same logic as allVariables, but per-node)
            const nodeVarNames = new Set<string>();
            const seenNodes = new Set<string>();
            const walkParents = (nid: string) => {
                if (seenNodes.has(nid)) return;
                seenNodes.add(nid);
                const pIds = edges.filter((e: any) => e.target === nid).map((e: any) => e.source);
                for (const pid of pIds) {
                    const pn = nodes.find((n: any) => n.id === pid) as any;
                    if (!pn?.data?.config) continue;
                    if (pn.data.config.outputs) {
                        for (const o of pn.data.config.outputs) {
                            if (o.name) {
                                nodeVarNames.add(o.name);
                                nodeVarNames.add(pid + "." + o.name);
                            }
                        }
                    }
                    if (pn.data.config.trigger_inputs) {
                        for (const ti of pn.data.config.trigger_inputs) {
                            if (ti.name) nodeVarNames.add(ti.name);
                        }
                    }
                    // Add form fields from Form Trigger
                    if (pn.data?.label === 'trigger/form' || pn.type === 'trigger/form') {
                        const fdInput = pn.data?.config?.inputs?.find((i: any) => i.name === 'form_definition');
                        if (fdInput?.value) {
                            try {
                                const fd = typeof fdInput.value === 'string' ? JSON.parse(fdInput.value) : fdInput.value;
                                if (fd?.pages) {
                                    for (const pg of fd.pages) {
                                        if (Array.isArray(pg.components)) {
                                            for (const c of pg.components) {
                                                if (c.name) nodeVarNames.add(c.name);
                                            }
                                        }
                                    }
                                }
                            } catch { /* skip */ }
                        }
                    }
                    // Add user-declared outputs from Python /
                    // JavaScript code nodes. Same shape as the
                    // global autocomplete projection — kept in sync
                    // by both call-sites going through the same
                    // helper. Without this, downstream nodes that
                    // reference a code-node's declared output would
                    // fail required-field validation even though
                    // the variable IS resolvable at runtime.
                    if (
                        pn.data?.label === 'script/python' || pn.data?.label === 'script/javascript' ||
                        pn.type === 'script/python' || pn.type === 'script/javascript'
                    ) {
                        const outDecl = pn.data?.config?.inputs?.find((i: any) => i.name === 'outputs');
                        const stagingItems: VariableItem[] = [];
                        projectCodeNodeOutputs(outDecl?.value, stagingItems, 'Code');
                        for (const it of stagingItems) {
                            nodeVarNames.add(it.name);
                            nodeVarNames.add(pid + "." + it.name);
                        }
                    }
                    // Walk through pass-through nodes (conditional, loop, switch)
                    // and sub-flow invoke nodes to find upstream outputs
                    const pt = pn.data?.config?.type;
                    if (pt === 4 || pt === 5 || pt === 6 || pn.data?.label === 'subflow/invoke') {
                        walkParents(pid);
                    }
                    // Sub-flow cross-reference: when we reach a Begin Sub-Flow,
                    // find Invoke nodes that call this sub-flow and walk their ancestors
                    if (pn.data?.label === 'subflow/begin') {
                        const beginName = pn.data?.config?.inputs?.find(
                            (i: any) => i.name === 'name'
                        )?.value;
                        if (beginName) {
                            for (const n of nodes as any[]) {
                                if ((n as any).data?.label !== 'subflow/invoke') continue;
                                const invokeName = (n as any).data?.config?.inputs?.find(
                                    (i: any) => i.name === 'sub_flow_name'
                                )?.value;
                                if (invokeName === beginName) {
                                    walkParents((n as any).id);
                                }
                            }
                        }
                    }
                }
            };
            walkParents(node.id);

            // refRoot strips path/bracket segments to the
            // validatable "namespace.name" prefix. The executor's
            // ParseReference + ResolvePath let users drill into
            // structured outputs (e.g. ${nodeId.body.items[0].id} or
            // ${flow.user.profile.email}). The editor's validator
            // only checks that the ROOT exists — the path is opaque
            // and resolved at runtime; typos there surface as empty
            // substitutions, not editor red squiggles.
            const refRoot = (name: string): string => {
                const cleaned = name.replace(/\[[^\]]*\]/g, "");
                const parts = cleaned.split(".").filter(p => p.length > 0);
                if (parts.length <= 2) return cleaned;
                return parts.slice(0, 2).join(".");
            };

            for (const i of inputs) {
                if (!isInputVisible(i, inputs)) continue;
                if (typeof i.value !== 'string') continue;
                const refs = i.value.match(/\$\{([^{}]+)\}/g);
                if (!refs) continue;
                for (const ref of refs) {
                    const name = ref.slice(2, -1);
                    const root = refRoot(name);
                    // Runtime variables (flow, var, loop, trigger) are always valid
                    if (runtimePrefixes.some(p => root.startsWith(p))) continue;
                    // Environment-dependent variables (secrets, env) must exist
                    // in the current environment's variables list
                    if (validPrefixes.some(p => root.startsWith(p))) {
                        const known = allVariables.some(v => `${v.category}.${v.name}` === root ||
                            (v.category === 'secrets' && `secret.${v.name}` === root));
                        if (!known) {
                            record(node.id, {
                                kind: "unresolved",
                                fieldName: i.name,
                                fieldLabel: i.label || i.name,
                                detail: `Field "${i.label || i.name}" on ${labelOf(node)} references \${${name}} but ${root} doesn't exist in this environment.`,
                            });
                        }
                        continue;
                    }
                    if (nodeVarNames.has(root)) continue;
                    // Truly unresolvable — name doesn't match any
                    // namespace, any parent output, or any ancestor
                    // scoped reference. Most common cause is a typo
                    // or a stale ${input.X} that should have been a
                    // bare ${X}.
                    record(node.id, {
                        kind: "unresolved",
                        fieldName: i.name,
                        fieldLabel: i.label || i.name,
                        detail: `Field "${i.label || i.name}" on ${labelOf(node)} references \${${name}} but nothing in the flow produces that output.`,
                    });
                }
            }
        });
        return problems;
    }, [nodes, edges, allVariables]);

    // Pick the highest-severity problem across the whole flow for
    // the Execute button tooltip + the handleExecuteClick gate.
    // Severity rank lifted from the same ordering the validation
    // map uses internally: secret > unresolved > required.
    const firstProblem = useMemo<ValidationProblem | null>(() => {
        const rank = { required: 0, unresolved: 1, secret: 2 } as const;
        let best: ValidationProblem | null = null;
        for (const p of validationProblems.values()) {
            if (!best || rank[p.kind] > rank[best.kind]) best = p;
        }
        return best;
    }, [validationProblems]);

    const executionBlocked = firstProblem !== null;
    const executionBlockedReason = firstProblem
        ? firstProblem.detail
        : "Execute Flo";

    const defaultEdgeOptions = useMemo(() => {
        return {
            type: "simplebezier",
        }
    }, []);

    // Hover-to-focus state for the edge-dimming UX. When a node is
    // hovered, edges that touch it get the flo-edge-highlighted class
    // and pop to full opacity; everything else stays at the muted
    // baseline defined in index.css. Tracked on the editor root so
    // the displayEdges memo below can react without each node
    // bubbling state through.
    const [ hoveredNodeId, setHoveredNodeId ] = useState<string | null>(null);

    const onNodeMouseEnter = useCallback((_event: unknown, node: { id: string }) => {
        setHoveredNodeId(node.id);
    }, []);

    const onNodeMouseLeave = useCallback(() => {
        setHoveredNodeId(null);
    }, []);

    // collapsedGroups is the set of group node IDs that are currently
    // collapsed. Every group node carries its own `data.collapsed`
    // flag; this memo flattens that into a Set so the display memos
    // can answer "is this node inside a collapsed group?" in O(1).
    const collapsedGroups = useMemo(() => {
        const s = new Set<string>();
        for (const n of nodes as any[]) {
            if (n.type === GROUP_NODE_TYPE && n.data?.collapsed !== false) {
                s.add(n.id);
            }
        }
        return s;
    }, [nodes]);

    // displayNodes hides children that belong to a collapsed group.
    // The group's own dimensions are swapped on the source node by
    // GroupNode's toggle handler (which also stashes the expanded
    // size in data.expandedWidth/Height for restoration on expand),
    // so no dimension override is needed here.
    const displayNodes = useMemo(() => {
        if (collapsedGroups.size === 0) return nodes;
        return (nodes as any[]).map(n => {
            if (n.parentId && collapsedGroups.has(n.parentId)) {
                return { ...n, hidden: true };
            }
            return n;
        });
    }, [nodes, collapsedGroups]);

    // displayEdges is the edges array we hand to ReactFlow. Three
    // transformations layered on top of the canonical edges:
    //   1) When a group is collapsed, any edge touching a hidden
    //      child gets its endpoint(s) rewritten to point at the
    //      group node itself so the wire visually terminates at the
    //      collapsed pill instead of vanishing. Edges fully inside a
    //      collapsed group disappear entirely — they would render as
    //      a self-loop on the group, which is noise.
    //   2) The hover-focus highlight class is added to edges that
    //      touch the hovered node.
    //   3) Everything else passes through by reference so React Flow
    //      doesn't re-render for a no-op.
    const displayEdges = useMemo(() => {
        if (collapsedGroups.size === 0 && !hoveredNodeId) return edges;

        // Build a child→groupId map so we can look up a hidden
        // node's enclosing group in O(1) when rewriting endpoints.
        const childToGroup = new Map<string, string>();
        if (collapsedGroups.size > 0) {
            for (const n of nodes as any[]) {
                if (n.parentId && collapsedGroups.has(n.parentId)) {
                    childToGroup.set(n.id, n.parentId);
                }
            }
        }

        const out: any[] = [];
        for (const e of edges as any[]) {
            const sourceGroup = childToGroup.get(e.source);
            const targetGroup = childToGroup.get(e.target);

            // Both endpoints inside the same collapsed group — drop
            // the edge entirely; it's an internal wire.
            if (sourceGroup && targetGroup && sourceGroup === targetGroup) {
                continue;
            }

            let rewritten = e;
            if (sourceGroup || targetGroup) {
                rewritten = {
                    ...e,
                    source: sourceGroup ?? e.source,
                    sourceHandle: sourceGroup ? "out" : e.sourceHandle,
                    target: targetGroup ?? e.target,
                    targetHandle: targetGroup ? "in" : e.targetHandle,
                };
            }

            if (hoveredNodeId) {
                const touches = rewritten.source === hoveredNodeId || rewritten.target === hoveredNodeId;
                if (touches) {
                    const existing = rewritten.className ? rewritten.className + " " : "";
                    rewritten = { ...rewritten, className: existing + "flo-edge-highlighted" };
                }
            }
            out.push(rewritten);
        }
        return out;
    }, [edges, nodes, collapsedGroups, hoveredNodeId]);

    const nodeTypes = useMemo(() => {
        if (plugins) {
            let types: Record<string, any> = {};

            types["input"] = CustomNode;
            types[GROUP_NODE_TYPE] = GroupNode;

            Object.keys(plugins).forEach((k) => {
                types[k] = CustomNode
            })

            return types;
        }
    }, [ plugins ]);

    const toggleSnapToGrid = useCallback(() => {
        setSnapToGrid(!snapToGrid)
    }, [ snapToGrid ])

    // Drop a fresh empty group node onto the canvas. The user can
    // then expand it and drag existing nodes into its bounds to
    // parent them, or wire its handles to neighbours and drop nodes
    // inside later. We start expanded by default so the user can
    // immediately see the working surface they just created.
    const addGroup = useCallback(() => {
        const id = "" + uuidv4();
        const graphElement = document.querySelector('.react-flow');
        const rect = graphElement?.getBoundingClientRect();
        const centreX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
        const centreY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
        const position = rfInstance
            ? rfInstance.screenToFlowPosition({ x: centreX, y: centreY })
            : { x: 0, y: 0 };

        const newGroup: any = {
            id,
            type: GROUP_NODE_TYPE,
            position: { x: position.x - 200, y: position.y - 120 },
            // Fixed initial footprint that's roomy enough to drop a
            // handful of nodes into without immediately resizing.
            // Users can drag the bottom-right corner to resize later
            // once we ship that feature.
            style: { width: 400, height: 240 },
            data: { id, label: "Group", collapsed: false },
            sourcePosition: "right",
            targetPosition: "left",
        };
        setNodes(nds => nds.concat(newGroup));
    }, [ rfInstance, setNodes ]);

    // Auto-arrange the flow using a Dagre layered layout. Particularly
    // valuable for agent flows where dozens of tool nodes radiate from
    // the AI node and end up in a starburst — Dagre rearranges them
    // into a clean left-to-right fan that's actually readable. After
    // the layout settles we fitView so the user immediately sees the
    // result rather than panning to wherever the nodes ended up.
    const autoArrange = useCallback(() => {
        const { nodes: laidOut } = getLayoutedElements(nodes, edges);
        setNodes(laidOut);
        // Give React Flow a tick to paint the new positions before
        // we ask it to fit them in the viewport.
        setTimeout(() => {
            if (rfInstance) {
                rfInstance.fitView({ padding: 0.2, duration: 400 });
            }
        }, 50);
    }, [ nodes, edges, setNodes, rfInstance ])

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
    }

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(e.target as Node)) {
                setSettingsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    function getManualTriggerInputs(): any[] {
        const manualNode = nodes.find(n => n.type === "trigger/manual");
        if (!manualNode?.data) return [];
        const config = (manualNode.data as any).config;
        if (!config?.trigger_inputs) return [];
        return (config.trigger_inputs as any[]).filter((i: any) => i.name && i.name !== "");
    }

    function handleExecuteClick() {
        if (!id || isTriggering || executionBlocked) return;
        const inputs = getManualTriggerInputs();
        if (inputs.length > 0) {
            // Pre-fill with default values
            const defaults: Record<string, string> = {};
            inputs.forEach((i: any) => { if (i.value) defaults[i.name] = String(i.value); });
            setTriggerInputValues(defaults);
            setTriggerInputModal({floId: id, triggerId: "default", inputs});
        } else {
            triggerFlo(id, "default", null);
        }
    }

    function handleTriggerInputSubmit() {
        if (!triggerInputModal) return;
        // Validate required fields
        const missing = triggerInputModal.inputs.filter((i: any) => i.required && !triggerInputValues[i.name]?.trim());
        if (missing.length > 0) {
            toast.error(`Please fill in: ${missing.map((i: any) => i.label || i.name).join(", ")}`);
            return;
        }
        triggerFlo(triggerInputModal.floId, triggerInputModal.triggerId, triggerInputValues);
        setTriggerInputModal(null);
    }

    function triggerFlo(flo_id: string, trigger_id: string, data: Record<string, string> | null) {
        if (isTriggering) {
            return
        }

        setIsTriggering(true)
        setCurrentTrigger(flo_id)

        api.post(API_URL + "/api/v1/flo/" + flo_id + "/trigger/" + trigger_id + "/execute", data, {
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
        <EnvironmentContext.Provider value={{
            environmentId: environment || null,
            refreshVariables: refreshEnvironmentVariables,
        }}>
            <Container noPadding={true}>
                {(!flo || !plugins) && (
                    <div className={"loading-container"}>
                        <Icon name="truck-ramp-box" />&nbsp;<span>Loading...</span>
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
                            <div className={"flo-editor-property-action-section"}>
                                <div className={"flo-editor-env-dropdown"} ref={settingsDropdownRef}>
                                    <button
                                        className={"flo-editor-env-button"}
                                        onClick={() => setSettingsDropdownOpen(!settingsDropdownOpen)}
                                        data-tooltip-id={"tooltip-settings"}
                                        data-tooltip-content={"Flow Settings"}
                                        data-tooltip-place={"bottom"}
                                    >
                                        <Icon name="gear" className={"flo-editor-env-icon"} />
                                        <span className={"flo-editor-env-label"}>Settings</span>
                                        <Icon name="chevron-down" className={"flo-editor-env-chevron"} />
                                        <Tooltip id={"tooltip-settings"} />
                                    </button>
                                    {settingsDropdownOpen && (
                                        <div className={"flo-editor-env-menu flo-settings-panel"}>
                                            <div className="flo-settings-header">Flow Settings</div>

                                            {environments && (
                                                <div className="flo-settings-section" onClick={e => e.stopPropagation()}>
                                                    <div className="flo-settings-section-label">Environment</div>
                                                    <div className="flo-settings-env-search">
                                                        <input
                                                            type="text"
                                                            className="flo-settings-env-input"
                                                            placeholder="Search environments..."
                                                            value={envSearch !== null ? envSearch : (environment ? environments.find(e => e.id === environment)?.name || '' : '')}
                                                            onFocus={() => { setEnvSearch(''); setEnvListOpen(true); }}
                                                            onBlur={() => setTimeout(() => { setEnvSearch(null); setEnvListOpen(false); }, 150)}
                                                            onChange={e => setEnvSearch(e.target.value)}
                                                        />
                                                        {envListOpen && (
                                                            <div className="flo-settings-env-list">
                                                                <div
                                                                    className={`flo-settings-env-option ${!environment ? "active" : ""}`}
                                                                    onMouseDown={() => selectEnvironment(null)}
                                                                >
                                                                    No Environment
                                                                </div>
                                                                {environments
                                                                    .filter(env => !envSearch || env.name.toLowerCase().includes(envSearch.toLowerCase()))
                                                                    .map(env => (
                                                                        <div
                                                                            key={env.id}
                                                                            className={`flo-settings-env-option ${env.id === environment ? "active" : ""}`}
                                                                            onMouseDown={() => selectEnvironment(env.id)}
                                                                        >
                                                                            {env.name}
                                                                        </div>
                                                                    ))
                                                                }
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flo-settings-section" onClick={e => e.stopPropagation()}>
                                                <div className="flo-settings-section-label">Notifications</div>
                                                <label className="flo-notify-toggle">
                                                    <input
                                                        type="checkbox"
                                                        checked={notifySuccess}
                                                        onChange={e => setNotifySuccess(e.target.checked)}
                                                    />
                                                    <span className="flo-notify-toggle-label">Notify on success</span>
                                                </label>
                                                <label className="flo-notify-toggle">
                                                    <input
                                                        type="checkbox"
                                                        checked={notifyFailure}
                                                        onChange={e => setNotifyFailure(e.target.checked)}
                                                    />
                                                    <span className="flo-notify-toggle-label">Notify on failure</span>
                                                </label>
                                                <div style={{ marginTop: 8 }}>
                                                    <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 4 }}>
                                                        Recipient emails (comma-separated)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        className="flo-notify-email-input"
                                                        value={notificationEmails}
                                                        onChange={e => setNotificationEmails(e.target.value)}
                                                        placeholder="Leave empty to notify flow author"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flo-settings-section" onClick={e => e.stopPropagation()}>
                                                <div className="flo-settings-section-label">Concurrency</div>
                                                <label className="flo-notify-toggle">
                                                    <input
                                                        type="checkbox"
                                                        checked={maxConcurrent !== null}
                                                        onChange={e => setMaxConcurrent(e.target.checked ? 1 : null)}
                                                    />
                                                    <span className="flo-notify-toggle-label">Limit concurrent executions</span>
                                                </label>
                                                {maxConcurrent !== null && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                                        <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                                                            Max executions
                                                        </label>
                                                        <input
                                                            type="number"
                                                            className="flo-settings-number-input"
                                                            min={1}
                                                            value={maxConcurrent}
                                                            onChange={e => {
                                                                const val = parseInt(e.target.value, 10);
                                                                if (!isNaN(val) && val >= 1) setMaxConcurrent(val);
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className={"flo-editor-action-divider"}></div>
                            </div>
                            <div className={"flo-editor-property-action-section"}>
                                <div className={"flo-editor-action-button"} onClick={showAddNode} data-tooltip-id={"tooltip-action-add-node"} data-tooltip-content={"Add Node"} data-tooltip-place={"bottom"}>
                                    <Icon name="plus" /> <span>Add Node</span>
                                    <Tooltip id={"tooltip-action-add-node"} />
                                </div>
                                <div className={"flo-editor-action-button"} onClick={addGroup} data-tooltip-id={"tooltip-action-add-group"} data-tooltip-content={"Drop an empty group onto the canvas — drag nodes inside, then collapse to tidy"} data-tooltip-place={"bottom"}>
                                    <Icon name="object-group" /> <span>Add Group</span>
                                    <Tooltip id={"tooltip-action-add-group"} />
                                </div>
                                <div className={"flo-editor-action-divider"}></div>
                                <div className={snapToGrid ? "flo-editor-action-button flo-editor-action-button-enabled" : "flo-editor-action-button"} onClick={toggleSnapToGrid} data-tooltip-id={"tooltip-action-toggle-snap-to-grid"} data-tooltip-content={"Toggle Snap to Grid"} data-tooltip-place={"bottom"}>
                                    <Icon name="grid" /> <span>Snap to Grid</span>
                                    <Tooltip id={"tooltip-action-toggle-snap-to-grid"} />
                                </div>
                                <div className={"flo-editor-action-button"} onClick={autoArrange} data-tooltip-id={"tooltip-action-auto-arrange"} data-tooltip-content={"Auto-arrange nodes — collapses tool starbursts into a clean left-to-right layout"} data-tooltip-place={"bottom"}>
                                    <Icon name="diagram-project" /> <span>Auto-arrange</span>
                                    <Tooltip id={"tooltip-action-auto-arrange"} />
                                </div>
                                <div className={showMiniMap ? "flo-editor-action-button flo-editor-action-button-enabled" : "flo-editor-action-button"} onClick={toggleShowMiniMap} data-tooltip-id={"tooltip-action-toggle-minimap"} data-tooltip-content={"Toggle Minimap"} data-tooltip-place={"bottom"}>
                                    <Icon name="map" /> <span>Minimap</span>
                                    <Tooltip id={"tooltip-action-toggle-minimap"} />
                                </div>
                                <div className={"flo-editor-action-divider"}></div>
                            </div>
                            <div className={"flo-editor-property-action-section"}>
                                {id && (
                                    <a
                                        onClick={handleExecuteClick}
                                        className={`flo-editor-property-action-button${executionBlocked ? ' flo-editor-property-action-button--disabled' : ''}`}
                                        data-tooltip-id={"tooltip-action-execute"}
                                        data-tooltip-content={executionBlockedReason}
                                        data-tooltip-place={"bottom"}
                                    >
                                        <Icon name="play" /> <span className={"hide-sm"}>Execute Flo</span>
                                        <Tooltip id={"tooltip-action-execute"} />
                                    </a>
                                )}
                            </div>
                        </div>
                        <div className={"flo-editor"}>
                            <div className={"flo-editor-graph"} ref={graphRef}>
                                <ReactFlowProvider>
                                    <ValidationProvider value={validationProblems}>
                                    <ReactFlow
                                        onClick={(e) => {onContextMenuClose(e); setDragging(false)}}
                                        onContextMenu={onContextMenuOpen}
                                        colorMode="dark"
                                        nodes={displayNodes}
                                        edges={displayEdges}
                                        onNodesChange={onNodesChange}
                                        onEdgesChange={onEdgesChange}
                                        onEdgeDoubleClick={onEdgeDoubleClick}
                                        onConnect={onConnect}
                                        onInit={onInit}
                                        onMove={() => {debouncedMove()}}
                                        onMoveStart={() => {setDragging(true)}}
                                        onMoveEnd={() => {setDragging(false)}}
                                        onNodeDragStart={() => {setPropertyMenuVisible(false); setMenuVisible(false); setDragging(true)}}
                                        onNodeDragStop={(e, node) => {setMenuVisible(false); setDragging(false); onNodeDragStopReparent(e, node);}}
                                        onNodeMouseEnter={onNodeMouseEnter}
                                        onNodeMouseLeave={onNodeMouseLeave}
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
                                    </ValidationProvider>
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
                                    <div className={propertyExpanded ? "property-menu-expanded-wrap" : ""}>
                                        <PropertyMenu
                                            node={propertyNode}
                                            variables={allVariables}
                                            triggers={flo?.triggers}
                                            environmentId={environment || undefined}
                                            actionDefinitions={plugins}
                                            onValueChange={onValueChange}
                                            onNameChange={onNameChange}
                                            onDismiss={() => {
                                                setPropertyMenuVisible(false);
                                                setPropertyNode(null);
                                                setDragging(false);
                                                setPropertyExpanded(false);
                                                setNodes((nds: any[]) => nds.map(n => ({...n, selected: false})));
                                            }}
                                            onNodeDelete={onNodeDelete}
                                            expanded={propertyExpanded}
                                            onToggleExpand={() => setPropertyExpanded(prev => !prev)}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={"flo-editor-status"}>
                            {status}
                        </div>
                    </div>
                )}
            {triggerInputModal && (
                <div className="trigger-input-overlay" onClick={(e) => { if (e.target === e.currentTarget) setTriggerInputModal(null); }}>
                    <div className="trigger-input-modal">
                        <div className="trigger-input-header">
                            <div className="trigger-input-title">Execute Flow</div>
                            <div className="trigger-input-subtitle">Provide values for the trigger inputs below</div>
                        </div>
                        <div className="trigger-input-body">
                            {triggerInputModal.inputs.map((input: any) => (
                                <div key={input.name} className="trigger-input-field">
                                    <label className="trigger-input-label">
                                        {input.label || input.name}
                                        {input.required && <span className="trigger-input-required">*</span>}
                                    </label>
                                    {input.type === "text" ? (
                                        <textarea
                                            className="trigger-input-textarea"
                                            value={triggerInputValues[input.name] || ""}
                                            onChange={(e) => setTriggerInputValues(prev => ({...prev, [input.name]: e.target.value}))}
                                            placeholder={input.placeholder || ""}
                                            rows={3}
                                        />
                                    ) : input.type === "boolean" ? (
                                        <label className="trigger-input-checkbox-row">
                                            <input
                                                type="checkbox"
                                                checked={triggerInputValues[input.name] === "true"}
                                                onChange={(e) => setTriggerInputValues(prev => ({...prev, [input.name]: e.target.checked ? "true" : "false"}))}
                                            />
                                            <span>{input.placeholder || "Enabled"}</span>
                                        </label>
                                    ) : input.options && input.options.length > 0 ? (
                                        <select
                                            className="trigger-input-select"
                                            value={triggerInputValues[input.name] || ""}
                                            onChange={(e) => setTriggerInputValues(prev => ({...prev, [input.name]: e.target.value}))}
                                        >
                                            <option value="">Select...</option>
                                            {input.options.map((opt: any) => (
                                                <option key={opt.value || opt.name} value={opt.value || opt.name}>{opt.name || opt.value}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            className="trigger-input-text"
                                            type={input.type === "integer" ? "number" : "text"}
                                            value={triggerInputValues[input.name] || ""}
                                            onChange={(e) => setTriggerInputValues(prev => ({...prev, [input.name]: e.target.value}))}
                                            placeholder={input.placeholder || ""}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="trigger-input-footer">
                            <button className="trigger-input-btn trigger-input-btn--cancel" onClick={() => setTriggerInputModal(null)}>Cancel</button>
                            <button className="trigger-input-btn trigger-input-btn--execute" onClick={handleTriggerInputSubmit} disabled={isTriggering}>
                                <Icon name="play" /> {isTriggering ? "Executing..." : "Execute"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </Container>
        </EnvironmentContext.Provider>
    )
}