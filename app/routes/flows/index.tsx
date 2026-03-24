import type {Route} from "../+types/home";
import {useEffect, useState, useCallback} from "react";
import api from "~/lib/api";
import type {Flo} from "~/types";
import {Link, useSearchParams, useNavigate} from "react-router";
import Container from "~/components/container";
import "./index.css"
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faPencil, faPlay, faTrash, faSpinner, faTriangleExclamation, faStar as faStarSolid, faFileExport, faFileImport, faXmark} from '@fortawesome/free-solid-svg-icons'
import {faStar as faStarOutline} from '@fortawesome/free-regular-svg-icons'
import Modal from "~/components/modal";
import ImportFlowModal from "~/components/importFlow";
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

    const [favourites, setFavourites] = useState<Set<string>>(new Set());
    const [selectedFlows, setSelectedFlows] = useState<Set<string>>(new Set());
    const [isExporting, setIsExporting] = useState(false);
    const [importModalVisible, setImportModalVisible] = useState(false);

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
    }, [search, offset, limit]);

    function deleteFlo(id : string) {
        setDeleteFloID(id);
        setDeleteModalVisible(true);
    }

    function handleUpdateSearch(term) {
        setSearch(term);
    }

    function confirmDeleteFlo() {
        if (deleteFloID) {
            api.delete(API_URL + '/api/v1/flo/' + deleteFloID)
                .then(response => {
                    api.get(API_URL + '/api/v1/flo', {
                        headers: {
                            "Authorization": "Bearer " + token
                        }
                    })
                        .then(response => {
                            setTotalFloCount(+response.headers["x-total-items"]);
                            setFlos(response.data);
                        })
                        .catch(error => {
                            console.error(error);
                        })
                })
                .catch(error => {
                    console.error(error);
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
        setSearch(search); // trigger useEffect re-fetch
    };

    return (
        <Container>
            <>
                <div className={"header"}>Flows</div>

                <>
                    <div className={"search-section"}>
                        <input type={"text"} className={"search-textbox"} placeholder={"Search..."} onChange={(e) => handleUpdateSearch(e.target.value)} value={search || ''} data-tooltip-id={"search"} data-tooltip-content={"Search for flow by Name or ID"} data-tooltip-place={"bottom-start"}/>
                        <Tooltip id={"search"} />
                        <button className={"import-flow-btn"} onClick={() => setImportModalVisible(true)} data-tooltip-id={"import-btn"} data-tooltip-content={"Import flow from file"} data-tooltip-place={"bottom"}>
                            <FontAwesomeIcon icon={faFileImport} /> Import
                        </button>
                        <Tooltip id={"import-btn"} />
                    </div>

                    {selectedFlows.size > 0 && (
                        <div className={"selection-action-bar"}>
                            <span className={"selection-count"}>{selectedFlows.size} flow{selectedFlows.size > 1 ? "s" : ""} selected</span>
                            <button className={"selection-export-btn"} onClick={exportSelectedFlows} disabled={isExporting}>
                                {isExporting ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faFileExport} />}
                                {" "}Export {selectedFlows.size > 1 ? "as ZIP" : ""}
                            </button>
                            <button className={"selection-clear-btn"} onClick={() => setSelectedFlows(new Set())}>
                                <FontAwesomeIcon icon={faXmark} /> Clear
                            </button>
                        </div>
                    )}

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
                                    <th className={"checkbox-column"}>
                                        <input type="checkbox" checked={flos !== undefined && flos.length > 0 && selectedFlows.size === flos.length} onChange={toggleSelectAll} />
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
                                                    <td className={"checkbox-column"}>
                                                        <input type="checkbox" checked={selectedFlows.has(flo.id)} onChange={() => toggleSelectFlow(flo.id)} />
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
                                                        {flo.duration && (
                                                            <>
                                                                {flo.duration}m {flo.duration_additional && (
                                                                <span className={"premium-allocation"}>(+{flo.duration_additional}m</span>
                                                            )}
                                                            </>
                                                        )}
                                                        {!flo.duration && (
                                                            <>

                                                            </>
                                                        )}
                                                    </td>
                                                    <td className={"table-column-hide-sm flo-table-subdued"}>{flo.execution_count > 0 && (
                                                        <>{flo.execution_count}</>
                                                    )}</td>
                                                    <td>
                                                        <button className={"table-button"} disabled={flo.has_validation_errors} onClick={() => {if (!flo.has_validation_errors) triggerFlo(flo.id, 'default')}} data-tooltip-id={"trigger-" + flo.id} data-tooltip-content={flo.has_validation_errors ? "Complete all required fields before executing" : "Execute Default Trigger"} data-tooltip-place={"bottom"}>
                                                            {flo.triggers && flo.triggers.length > 0 &&  flo.triggers.some(e => e.name === "Default Trigger") && (
                                                                <>
                                                                    {currentTrigger == flo.id && (
                                                                        <>
                                                                            <FontAwesomeIcon icon={faSpinner} spin/> <span>Run</span>
                                                                        </>
                                                                    )}
                                                                    {currentTrigger != flo.id && (
                                                                        <>
                                                                            <FontAwesomeIcon icon={faPlay}/> <span>Run</span>
                                                                        </>

                                                                    )}
                                                                </>
                                                            )}
                                                        </button>
                                                        <Tooltip id={"trigger-" + flo.id} />

                                                        <Link className={"table-button"} to={{pathname: "/flo/" + flo.id}} data-tooltip-id={"edit-" + flo.id} data-tooltip-content={"Edit Flow"} data-tooltip-place={"bottom"}>
                                                            <FontAwesomeIcon icon={faPencil}/> <span>Edit</span>
                                                        </Link>
                                                        <Tooltip id={"edit-" + flo.id} />

                                                        <button className={"table-button"} onClick={() => exportSingleFlow(flo)} disabled={isExporting} data-tooltip-id={"export-" + flo.id} data-tooltip-content={"Export Flow"} data-tooltip-place={"bottom"}>
                                                            <FontAwesomeIcon icon={faFileExport}/> <span className={"table-column-hide-sm"}>Export</span>
                                                        </button>
                                                        <Tooltip id={"export-" + flo.id} />

                                                        <button disabled={true} className={"table-button"} onClick={() => {deleteFlo(flo.id)}} data-tooltip-id={"delete-" + flo.id} data-tooltip-content={"Delete Flow"} data-tooltip-place={"bottom"}>
                                                            <FontAwesomeIcon icon={faTrash}/> <span>Delete</span>
                                                        </button>
                                                        <Tooltip id={"delete-" + flo.id} />
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
                    label={"Delete Flo"}
                    // footerMessage={"This action can not be undone"}
                    visible={true}
                    canDismiss={true}
                    onDismiss={() => {setDeleteModalVisible(false)}}
                    actions={[{
                        label: "Delete",
                        primary: true,
                        onClick: () => {confirmDeleteFlo()},
                    }]}
                >
                    Are you sure you want to delete?
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