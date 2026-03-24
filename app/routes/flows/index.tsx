import type {Route} from "../+types/home";
import {useEffect, useState, useRef} from "react";
import api from "~/lib/api";
import type {Flo} from "~/types";
import {Link, useSearchParams, useNavigate} from "react-router";
import Container from "~/components/container";
import "./index.css"
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faPencil, faPlay, faTrash, faSpinner, faTriangleExclamation, faStar as faStarSolid, faFileExport, faFileImport, faPlus, faEllipsisVertical} from '@fortawesome/free-solid-svg-icons'
import {faStar as faStarOutline} from '@fortawesome/free-regular-svg-icons'
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
                                    <FontAwesomeIcon icon={faPlus} /><span>New</span>
                                </button>
                                <Tooltip id="new-tip" />

                                <button className="flows-action-btn" onClick={() => setImportModalVisible(true)} data-tooltip-id="import-tip" data-tooltip-content="Import flow from file" data-tooltip-place="bottom">
                                    <FontAwesomeIcon icon={faFileImport} /><span>Import</span>
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
                                    {isExporting ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faFileExport} />}
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
                                        <FontAwesomeIcon icon={faStarSolid} className={"favourite-star"} />
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
                            <FontAwesomeIcon icon={faSpinner} spin />
                        </div>
                    )}

                    {flos && flos.length > 0 && (
                        <>
                            <table className={"flo-table"} style={isLoading ? {opacity: 0.5, pointerEvents: 'none'} : undefined}>
                                <thead className={"flo-table-head"}>
                                <tr>
                                    <th className="flo-checkbox-col">
                                        <label className="flo-checkbox">
                                            <input type="checkbox" checked={flos !== undefined && flos.length > 0 && selectedFlows.size === flos.length} onChange={toggleSelectAll} />
                                            <span className="flo-checkbox-box" />
                                        </label>
                                    </th>
                                    <th>Name</th>
                                    <th className={"table-column-hide-sm"}>Environment</th>
                                    <th className={"table-column-hide-sm"}>Status</th>
                                    <th className={"table-column-hide-sm"}>Last Run</th>
                                    <th className={"table-column-hide-sm"}>Duration</th>
                                    <th className={"table-column-hide-sm"}>Executions</th>
                                    <th className={"table-column-center"}>
                                        <span className={"table-column-hide-sm"}>Actions</span>
                                    </th>
                                </tr>
                                </thead>
                                <tbody>
                                        {flos?.map((flo, index) => {
                                            return (
                                                <tr key={flo.id} className={"flo-table-row"}>
                                                    <td className="flo-checkbox-col">
                                                        <label className="flo-checkbox">
                                                            <input type="checkbox" checked={selectedFlows.has(flo.id)} onChange={() => toggleSelectFlow(flo.id)} />
                                                            <span className="flo-checkbox-box" />
                                                        </label>
                                                    </td>
                                                    <td>
                                                        <span className={"fav-toggle"} onClick={(e) => { e.stopPropagation(); toggleFavourite(flo.id); }}>
                                                            <FontAwesomeIcon icon={favourites.has(flo.id) ? faStarSolid : faStarOutline} className={favourites.has(flo.id) ? "fav-active" : "fav-inactive"} />
                                                        </span>
                                                        <Link to={"/flo/" + flo.id}>
                                                            {flo.name}
                                                        </Link>
                                                        {flo.has_validation_errors && (
                                                            <>
                                                                <FontAwesomeIcon icon={faTriangleExclamation} style={{color: '#e6a817', marginLeft: '6px'}} data-tooltip-id={"validation-" + flo.id} data-tooltip-content={"Required fields are incomplete"} data-tooltip-place={"bottom"} />
                                                                <Tooltip id={"validation-" + flo.id} />
                                                            </>
                                                        )}
                                                        <span className={"flo-table-subtext table-column-hide-sm"}>{flo.id}</span>
                                                    </td>
                                                    <td className={"table-column-hide-sm"}>
                                                        {flo.environment_id && (
                                                            <Link to={"/environment/" + flo.environment_id}>
                                                                <span className={"environment-label"}>{flo.environment_name}</span>
                                                            </Link>
                                                        )}
                                                    </td>
                                                    <td className={"table-column-hide-sm"}>
                                                        {flo.last_execution && (
                                                            <Link to={"/execution/" + flo.last_execution?.id}>
                                                                <ExecuteState state={flo.last_execution?.execution_status || ExecutionStateValue.created} completionState={flo.last_execution?.completion_status || CompletionStateValue.unknown} />
                                                            </Link>
                                                        )}
                                                        {!flo.last_execution && (
                                                            <></>
                                                        )}
                                                    </td>
                                                    <td className={"table-column-hide-sm flo-table-subdued"}>
                                                        {flo.last_execution ? (
                                                            <Link to={"/execution/" + flo.last_execution.id} data-tooltip-id={"tooltip-time-" + flo.id} data-tooltip-content={formatDateString(flo.last_run)} data-tooltip-place={"bottom"}>
                                                                {formatDate(flo.last_run)}
                                                            </Link>
                                                        ) : (
                                                            <span data-tooltip-id={"tooltip-time-" + flo.id} data-tooltip-content={formatDateString(flo.last_run)} data-tooltip-place={"bottom"}>
                                                                {formatDate(flo.last_run)}
                                                            </span>
                                                        )}
                                                        <Tooltip id={"tooltip-time-" + flo.id} />
                                                    </td>
                                                    <td className={"table-column-hide-sm flo-table-subdued"}>
                                                        {friendlyDuration(flo.last_execution?.duration)}
                                                    </td>
                                                    <td className={"table-column-hide-sm flo-table-subdued"}>{flo.execution_count > 0 && (
                                                        <>{flo.execution_count}</>
                                                    )}</td>
                                                    <td>
                                                        <div className="flo-actions-cell">
                                                            <button
                                                                className="flo-run-btn"
                                                                disabled={flo.has_validation_errors}
                                                                onClick={() => { if (!flo.has_validation_errors) triggerFlo(flo.id, 'default'); }}
                                                                data-tooltip-id={"trigger-" + flo.id}
                                                                data-tooltip-content={flo.has_validation_errors ? "Complete all required fields before executing" : "Execute Default Trigger"}
                                                                data-tooltip-place="bottom"
                                                            >
                                                                {flo.triggers && flo.triggers.length > 0 && flo.triggers.some(e => e.name === "Default Trigger") && (
                                                                    currentTrigger == flo.id
                                                                        ? <><FontAwesomeIcon icon={faSpinner} spin /> Run</>
                                                                        : <><FontAwesomeIcon icon={faPlay} /> Run</>
                                                                )}
                                                            </button>
                                                            <Tooltip id={"trigger-" + flo.id} />

                                                            <div className="flo-more-menu-wrap" ref={openMenuId === flo.id ? menuRef : undefined}>
                                                                <button className="flo-more-btn" onClick={() => setOpenMenuId(openMenuId === flo.id ? null : flo.id)}>
                                                                    <FontAwesomeIcon icon={faEllipsisVertical} />
                                                                </button>
                                                                {openMenuId === flo.id && (
                                                                    <div className="flo-more-dropdown">
                                                                        <Link className="flo-more-item" to={"/flo/" + flo.id} onClick={() => setOpenMenuId(null)}>
                                                                            <FontAwesomeIcon icon={faPencil} /> Edit
                                                                        </Link>
                                                                        <button className="flo-more-item" onClick={() => { exportSingleFlow(flo); setOpenMenuId(null); }}>
                                                                            <FontAwesomeIcon icon={faFileExport} /> Export
                                                                        </button>
                                                                        <button className="flo-more-item flo-more-item--danger" onClick={() => { deleteFlo(flo.id); setOpenMenuId(null); }}>
                                                                            <FontAwesomeIcon icon={faTrash} /> Delete
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                        </tbody>
                                    </table>
                            <PaginationControls onPageChange={handlePageChange} disableRightPagination={disableRightPagination} totalCount={totalFloCount}/>
                        </>
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