import type {Route} from "../+types/home";
import {useEffect, useState, useRef} from "react";
import api from "~/lib/api";
import type {Flo} from "~/types";
import {Link, useSearchParams, useNavigate} from "react-router";
import Container from "~/components/container";
import "./index.css"
import Modal from "~/components/modal";
import ImportFlowModal from "~/components/importFlow";
import SearchBar from "~/components/searchBar";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc"
import relativeTime from "dayjs/plugin/relativeTime"
import {Tooltip} from 'react-tooltip'
import {toast} from 'react-toastify'
import {CompletionStateValue, ExecuteState, ExecutionStateValue} from "~/components/executionState";
import useConfig from "~/components/config";
import {PaginationControls} from "~/components/paginationControls";
import {useAuth} from "~/context/auth/use";
import useCookieToken from "~/components/cookie";
import {useOrganisation} from "~/context/organisation/use";
import {generateExportWrapper, downloadAsJson, downloadAsZip} from "~/lib/export";
import { Icon } from "~/components/icons/Icon";

dayjs.extend(relativeTime);
dayjs.extend(utc);

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Flows" },
        { name: "description", content: "Get in the Flo" },
    ];
}

const config = useConfig();
const API_URL = config("AUTOMATE_API_URL");

export default function Flows() {
    const navigate = useNavigate();
    const [ searchParams, setSearchParams ] = useSearchParams();
    const [ flos, setFlos ] = useState<Flo[]>();
    const [ totalFloCount, setTotalFloCount ] = useState<number>(0);
    const [ isLoading, setIsLoading ] = useState<boolean>(false);

    const [ deleteModalVisible, setDeleteModalVisible ] = useState<boolean>(false);
    const [ deleteFloID, setDeleteFloID ] = useState<string | undefined>()

    const [ search, setSearch ] = useState<string>(searchParams.get("search"))
    const [ isTriggering, setIsTriggering ] = useState<boolean>(false);
    const [ currentTrigger, setCurrentTrigger ] = useState<string>();

    const [ offset, setOffset ] = useState<number>(0);
    const [ limit, setLimit ] = useState<number>(10);
    const [ disableRightPagination, setDisableRightPagination ] = useState<boolean>(false);

    const controller = new AbortController();

    const auth = useAuth();
    const token = useCookieToken();
    const { currentOrg } = useOrganisation();

    const [refreshKey, setRefreshKey] = useState<number>(0);
    const [favourites, setFavourites] = useState<Set<string>>(new Set());
    const [selectedFlows, setSelectedFlows] = useState<Set<string>>(new Set());
    const [isExporting, setIsExporting] = useState(false);
    const [importModalVisible, setImportModalVisible] = useState(false);
    const [searchExpanded, setSearchExpanded] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const fetchFavourites = () => {
        api.get(API_URL + '/api/v1/favourite', {
            headers: { Authorization: "Bearer " + token }
        })
            .then(res => {
                if (res.data && Array.isArray(res.data)) {
                    setFavourites(new Set(res.data));
                }
            })
            .catch(() => setFavourites(new Set()));
    };

    useEffect(() => {
        if (token) fetchFavourites();
    }, [token]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenuId(null);
            }
        };
        if (openMenuId) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openMenuId]);

    const toggleFavourite = (floId: string) => {
        const isFav = favourites.has(floId);
        // Optimistic update
        setFavourites(prev => {
            const next = new Set(prev);
            if (isFav) { next.delete(floId); } else { next.add(floId); }
            return next;
        });

        if (isFav) {
            api.delete(API_URL + '/api/v1/favourite/' + floId, {
                headers: { Authorization: "Bearer " + token }
            }).catch(() => fetchFavourites());
        } else {
            api.post(API_URL + '/api/v1/favourite/' + floId, null, {
                headers: { Authorization: "Bearer " + token }
            }).catch(() => fetchFavourites());
        }
    };

    useEffect(() => {
        const config = useConfig();
        let url = config("AUTOMATE_API_URL") + '/api/v1/flo';

        if (search && search.length > 2) {
            url += "?search=" + search
        }

        // TODO: Wrap this in better pagination controls
        if (url.indexOf('?') == -1) {
            url += "?"
        } else {
            url += "&"
        }
        url += "offset=" + offset + "&limit=" + limit;

        setIsLoading(true);

        api.get(url, {
            signal: controller.signal,
            headers: {
                "Authorization": "Bearer " + token,
            }
        })
            .then(response => {
                if (response) {
                    setTotalFloCount(+response.headers["x-total-items"]);
                    setFlos(response.data);

                    if (response.data.length < limit) {
                        setDisableRightPagination(true);
                    } else {
                        setDisableRightPagination(false);
                    }
                }
            })
            .catch(error => {
                console.error(error);
            })
            .finally(() => {
                setIsLoading(false);
            })
    }, [search, offset, limit, refreshKey]);

    function deleteFlo(id : string) {
        setDeleteFloID(id);
        setDeleteModalVisible(true);
    }

    function handleUpdateSearch(term) {
        setSearch(term);
    }

    function confirmDeleteFlo() {
        if (deleteFloID) {
            api.delete(API_URL + '/api/v1/flo/' + deleteFloID, {
                headers: { Authorization: "Bearer " + token }
            })
                .then(() => {
                    toast.success("Flow archived");
                    refreshFlows();
                })
                .catch(error => {
                    console.error(error);
                    toast.error("Failed to delete flow");
                })
        }
        setDeleteModalVisible(false)
    }

    function formatDate(date) {
        if (!date) {
            return "";
        }

        return dayjs.utc(date).fromNow();
        // return date;
    }

    function friendlyDuration(ms?: number): string {
        if (!ms || ms === 0) return "";
        if (ms < 1000) return ms + "ms";
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return seconds + "s";
        const minutes = Math.floor(seconds / 60);
        const remainSec = seconds % 60;
        if (minutes < 60) return remainSec > 0 ? `${minutes}m ${remainSec}s` : `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        const remainMin = minutes % 60;
        return remainMin > 0 ? `${hours}h ${remainMin}m` : `${hours}h`;
    }

    function formatDateString(date) {
        if (!date) {
            return "Never Run";
        }

        return dayjs.utc(date).local().format("D MMM YYYY H:mm:ss");
    }

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

    function handlePageChange(offset: number, limit: number) {
        console.log("handlePageChange", offset, limit);
        setOffset(offset * limit);
        setLimit(limit);
    }

    const toggleSelectFlow = (floId: string) => {
        setSelectedFlows(prev => {
            const next = new Set(prev);
            if (next.has(floId)) { next.delete(floId); } else { next.add(floId); }
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (!flos) return;
        if (selectedFlows.size === flos.length) {
            setSelectedFlows(new Set());
        } else {
            setSelectedFlows(new Set(flos.map(f => f.id)));
        }
    };

    const exportSingleFlow = async (flo: Flo) => {
        try {
            setIsExporting(true);
            const response = await api.get(API_URL + "/api/v1/flo/" + flo.id, {
                headers: { Authorization: "Bearer " + token },
            });
            const fullFlo = response.data;
            const authorEmail = auth?.user?.email_address || "";
            const wrapper = await generateExportWrapper({
                id: fullFlo.id,
                name: fullFlo.name,
                scale: fullFlo.scale,
                x: fullFlo.x,
                y: fullFlo.y,
                revision: fullFlo.revision?.data || null,
                environment_name: fullFlo.environment_name,
            }, authorEmail);
            const safeName = flo.name.replace(/[^a-zA-Z0-9_\-\s]/g, "").replace(/\s+/g, "_").toLowerCase();
            downloadAsJson(wrapper, `${safeName}.flomation.json`);
            toast.success("Flow exported successfully");
        } catch (err) {
            console.error("Export failed:", err);
            toast.error("Failed to export flow");
        } finally {
            setIsExporting(false);
        }
    };

    const duplicateFlow = async (flo: Flo) => {
        try {
            // Fetch the full flow with revision data
            const response = await api.get(API_URL + "/api/v1/flo/" + flo.id, {
                headers: { Authorization: "Bearer " + token },
            });
            const fullFlo = response.data;

            // Create a new flow with "(Copy)" suffix
            const createRes = await api.post(API_URL + "/api/v1/flo", {
                name: fullFlo.name + " (Copy)",
            }, {
                headers: { Authorization: "Bearer " + token },
            });
            const newFlo = createRes.data;

            // Copy the revision data to the new flow
            if (fullFlo.revision?.data) {
                await api.post(API_URL + "/api/v1/flo/" + newFlo.id + "/revision", {
                    data: fullFlo.revision.data,
                }, {
                    headers: { Authorization: "Bearer " + token },
                });
            }

            // Navigate to the editor for the new flow
            navigate("/flo/" + newFlo.id);
        } catch (err) {
            console.error("Duplicate failed:", err);
            toast.error("Failed to duplicate flow");
        }
    };

    const exportSelectedFlows = async () => {
        if (selectedFlows.size === 0) return;
        try {
            setIsExporting(true);
            const ids = Array.from(selectedFlows);

            if (ids.length === 1) {
                const flo = flos?.find(f => f.id === ids[0]);
                if (flo) await exportSingleFlow(flo);
                return;
            }

            const response = await api.post(API_URL + "/api/v1/flo/export", { ids }, {
                headers: { Authorization: "Bearer " + token },
            });
            const exportedFlos = response.data;
            const authorEmail = auth?.user?.email_address || "";

            const wrappers = await Promise.all(
                exportedFlos.map((flo: any) =>
                    generateExportWrapper({
                        id: flo.id,
                        name: flo.name,
                        scale: flo.scale,
                        x: flo.x,
                        y: flo.y,
                        revision: flo.revision || null,
                        environment_name: flo.environment_name,
                    }, authorEmail)
                )
            );

            const timestamp = dayjs().format("YYYYMMDD_HHmmss");
            await downloadAsZip(wrappers, `flomation_export_${timestamp}.flomation.zip`);
            toast.success(`Exported ${wrappers.length} flows`);
            setSelectedFlows(new Set());
        } catch (err) {
            console.error("Export failed:", err);
            toast.error("Failed to export flows");
        } finally {
            setIsExporting(false);
        }
    };

    const refreshFlows = () => {
        setOffset(0);
        setRefreshKey(k => k + 1);
    };

    const createNewFlo = () => {
        api.post(API_URL + '/api/v1/flo', { name: "Untitled Flo" }, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: "Bearer " + token,
            }
        })
            .then(response => {
                if (response) {
                    navigate("/flo/" + response.data.id);
                }
            })
            .catch(error => {
                console.error(error);
                toast.error("Failed to create flow");
            });
    };

    return (
        <Container>
            <>
                <div className={"header"}>Flows</div>

                <div className="flows-action-bar">
                    <div className="flows-action-bar-search">
                        <SearchBar value={search} onChange={handleUpdateSearch} placeholder="Search flows..." onExpandChange={setSearchExpanded} />
                    </div>

                    {!searchExpanded && (
                        <>
                            <div className="flows-action-bar-divider" />

                            <div className="flows-action-bar-actions">
                                <button className="flows-action-btn flows-action-btn--primary" onClick={createNewFlo} data-tooltip-id="new-tip" data-tooltip-content="Create new flow" data-tooltip-place="bottom">
                                    <Icon name="plus" /><span>New</span>
                                </button>
                                <Tooltip id="new-tip" />

                                <button className="flows-action-btn" onClick={() => setImportModalVisible(true)} data-tooltip-id="import-tip" data-tooltip-content="Import flow from file" data-tooltip-place="bottom">
                                    <Icon name="file-import" /><span>Import</span>
                                </button>
                                <Tooltip id="import-tip" />

                                <button
                                    className={`flows-action-btn ${selectedFlows.size > 0 ? '' : 'flows-action-btn--disabled'}`}
                                    onClick={exportSelectedFlows}
                                    disabled={selectedFlows.size === 0 || isExporting}
                                    data-tooltip-id="export-tip"
                                    data-tooltip-content={selectedFlows.size > 0 ? `Export ${selectedFlows.size} flow${selectedFlows.size > 1 ? 's' : ''}` : 'Select flows to export'}
                                    data-tooltip-place="bottom"
                                >
                                    {isExporting ? <Icon name="spinner" spin /> : <Icon name="file-export" />}
                                    <span>Export{selectedFlows.size > 0 ? ` (${selectedFlows.size})` : ''}</span>
                                </button>
                                <Tooltip id="export-tip" />
                            </div>
                        </>
                    )}
                </div>

                <>

                    {flos && flos.length > 0 && favourites.size > 0 && (
                        <div className={"favourites-section"}>
                            <div className={"favourites-header"}>Favourites</div>
                            <div className={"favourites-list"}>
                                {flos.filter(f => favourites.has(f.id)).map(flo => (
                                    <Link key={flo.id} to={"/flo/" + flo.id} className={"favourite-card"}>
                                        <Icon name="star-solid" className={"favourite-star"} />
                                        <div className={"favourite-name"}>{flo.name}</div>
                                        {flo.last_execution && (
                                            <ExecuteState state={flo.last_execution.execution_status || ExecutionStateValue.created} completionState={flo.last_execution.completion_status || CompletionStateValue.unknown} />
                                        )}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {isLoading && !flos && (
                        <div className={"loading-container"}>
                            <Icon name="spinner" spin />
                        </div>
                    )}

                    {flos && flos.length > 0 && (
                        <div className="flow-cards" style={isLoading ? {opacity: 0.5, pointerEvents: 'none'} : undefined}>
                            {flos.map(flo => (
                                <div key={flo.id} className="flow-card">
                                    <label className="flo-checkbox flow-card-checkbox" onClick={e => e.stopPropagation()}>
                                        <input type="checkbox" checked={selectedFlows.has(flo.id)} onChange={() => toggleSelectFlow(flo.id)} />
                                        <span className="flo-checkbox-box" />
                                    </label>

                                    <div className="flow-card-body" onClick={() => navigate("/flo/" + flo.id)}>
                                        <div className="flow-card-header">
                                            <span className="fav-toggle" onClick={e => { e.stopPropagation(); toggleFavourite(flo.id); }}>
                                                <Icon name={favourites.has(flo.id)? "star-solid" : "star-outline"} className={favourites.has(flo.id) ? "fav-active" : "fav-inactive"} />
                                            </span>
                                            <span className="flow-card-name">{flo.name}</span>
                                            {flo.has_validation_errors && (
                                                <>
                                                    <Icon name="triangle-exclamation" className="flow-card-warning" data-tooltip-id={"validation-" + flo.id} data-tooltip-content="Required fields are incomplete" data-tooltip-place="right" />
                                                    <Tooltip id={"validation-" + flo.id} />
                                                </>
                                            )}
                                            {flo.environment_id && (
                                                <span className="environment-label" onClick={e => e.stopPropagation()}><Link to={"/environment/" + flo.environment_id}>{flo.environment_name}</Link></span>
                                            )}
                                        </div>

                                        <div className="flow-card-meta">
                                            {flo.recent_executions && flo.recent_executions.length > 0 && (
                                                <div className="flo-recent-dots" onClick={e => e.stopPropagation()}>
                                                    {flo.recent_executions.map((exec, i) => (
                                                        <Link key={exec.id} to={"/execution/" + exec.id} className={`flo-dot flo-dot--${exec.execution_status === 'executed' ? exec.completion_status : exec.execution_status}`} data-tooltip-id={`dot-${flo.id}-${i}`} data-tooltip-content={exec.execution_status === 'executed' ? exec.completion_status : exec.execution_status} data-tooltip-place="bottom" />
                                                    ))}
                                                    {flo.recent_executions.map((exec, i) => (
                                                        <Tooltip key={`tip-${i}`} id={`dot-${flo.id}-${i}`} />
                                                    ))}
                                                </div>
                                            )}
                                            {flo.last_run && (
                                                <span className="flow-card-detail" data-tooltip-id={"tooltip-time-" + flo.id} data-tooltip-content={formatDateString(flo.last_run)} data-tooltip-place="bottom">
                                                    {formatDate(flo.last_run)}
                                                </span>
                                            )}
                                            <Tooltip id={"tooltip-time-" + flo.id} />
                                            {flo.last_execution?.duration && (
                                                <span className="flow-card-detail">{friendlyDuration(flo.last_execution.duration)}</span>
                                            )}
                                            {flo.execution_count > 0 && (
                                                <span className="flow-card-detail">{flo.execution_count} run{flo.execution_count !== 1 ? 's' : ''}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flow-card-actions" onClick={e => e.stopPropagation()}>
                                        <button
                                            className="flo-run-btn"
                                            disabled={flo.has_validation_errors}
                                            onClick={() => { if (!flo.has_validation_errors) triggerFlo(flo.id, 'default'); }}
                                            data-tooltip-id={"trigger-" + flo.id}
                                            data-tooltip-content={flo.has_validation_errors ? "Complete all required fields" : "Run"}
                                            data-tooltip-place="bottom"
                                        >
                                            {flo.triggers?.some(e => e.name === "Default Trigger") && (
                                                currentTrigger == flo.id
                                                    ? <Icon name="spinner" spin />
                                                    : <Icon name="play" />
                                            )}
                                        </button>
                                        <Tooltip id={"trigger-" + flo.id} />

                                        <div className="flo-more-menu-wrap" ref={openMenuId === flo.id ? menuRef : undefined}>
                                            <button className="flo-more-btn" onClick={() => setOpenMenuId(openMenuId === flo.id ? null : flo.id)}>
                                                <Icon name="ellipsis-vertical" />
                                            </button>
                                            {openMenuId === flo.id && (
                                                <div className="flo-more-dropdown">
                                                    <Link className="flo-more-item" to={"/flo/" + flo.id} onClick={() => setOpenMenuId(null)}>
                                                        <Icon name="pencil" /> Edit
                                                    </Link>
                                                    <button className="flo-more-item" onClick={() => { duplicateFlow(flo); setOpenMenuId(null); }}>
                                                        <Icon name="copy" /> Duplicate
                                                    </button>
                                                    <button className="flo-more-item" onClick={() => { exportSingleFlow(flo); setOpenMenuId(null); }}>
                                                        <Icon name="file-export" /> Export
                                                    </button>
                                                    <button className="flo-more-item flo-more-item--danger" onClick={() => { deleteFlo(flo.id); setOpenMenuId(null); }}>
                                                        <Icon name="trash" /> Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <PaginationControls onPageChange={handlePageChange} disableRightPagination={disableRightPagination} totalCount={totalFloCount}/>
                        </div>
                    )}
                </>
            </>

            {deleteModalVisible && (
                <Modal
                    label={"Delete Flow"}
                    footerMessage={"This action cannot be undone"}
                    visible={true}
                    canDismiss={true}
                    onDismiss={() => {setDeleteModalVisible(false)}}
                    actions={[{
                        label: "Delete",
                        primary: false,
                        variant: 'danger',
                        onClick: () => {confirmDeleteFlo()},
                    }]}
                >
                    Are you sure you want to delete this flow? All revisions, triggers and execution history will be permanently removed.
                </Modal>
            )}

            <ImportFlowModal
                visible={importModalVisible}
                onDismiss={() => setImportModalVisible(false)}
                onImported={refreshFlows}
            />

        </Container>

    )
}