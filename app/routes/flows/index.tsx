import type {Route} from "../+types/home";
import {useEffect, useState} from "react";
import axios from "axios";
import type {Flo} from "~/types";
import {Link, useSearchParams, useNavigate} from "react-router";
import Container from "~/components/container";
import "./index.css"
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faPencil, faPlay, faTrash, faSpinner} from '@fortawesome/free-solid-svg-icons'
import Modal from "~/components/modal";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc"
import relativeTime from "dayjs/plugin/relativeTime"
import {Tooltip} from 'react-tooltip'
import {CompletionStateValue, ExecuteState, ExecutionStateValue} from "~/components/executionState";
import useConfig from "~/components/config";
import {PaginationControls} from "~/components/paginationControls";
import {useAuth} from "~/context/auth/use";
import useCookieToken from "~/components/cookie";

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

        axios.get(url, {
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
            axios.delete(API_URL + '/api/v1/flo/' + deleteFloID)
                .then(response => {
                    axios.get(API_URL + '/api/v1/flo', {
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

    function handlePageChange(offset: number, limit: number) {
        console.log("handlePageChange", offset, limit);
        setOffset(offset * limit);
        setLimit(limit);
    }

    return (
        <Container>
            <>
                <div className={"header"}>Flows</div>

                <>
                    <div className={"search-section"}>
                        <input type={"text"} className={"search-textbox"} placeholder={"Search..."} onChange={(e) => handleUpdateSearch(e.target.value)} value={search || ''} data-tooltip-id={"search"} data-tooltip-content={"Search for flow by Name or ID"} data-tooltip-place={"bottom-start"}/>
                        <Tooltip id={"search"} />
                    </div>

                    {isLoading && (
                        <div className={"loading-container"}>
                            <FontAwesomeIcon icon={faSpinner} spin />
                        </div>
                    )}
                    {!isLoading && (
                        <>
                            {flos && flos.length > 0 && (
                                <>
                                    <table className={"flo-table"}>
                                        <thead className={"flo-table-head"}>
                                        <tr>
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
                                                    <td>{flo.name}<span className={"flo-table-subtext table-column-hide-sm"}>{flo.id}</span></td>
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
                                                <span data-tooltip-id={"tooltip-time-" + flo.id} data-tooltip-content={formatDateString(flo.last_run)} data-tooltip-place={"bottom"}>
                                                    {formatDate(flo.last_run)}
                                                </span>
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
                                                        <button className={"table-button"} onClick={() => {triggerFlo(flo.id, 'default')}} data-tooltip-id={"trigger-" + flo.id} data-tooltip-content={"Execute Default Trigger"} data-tooltip-place={"bottom"}>
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

        </Container>

    )
}