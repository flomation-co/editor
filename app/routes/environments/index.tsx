import type {Route} from "../+types/home";
import Container from "~/components/container";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCircleStop, faEye, faSpinner, faTrash} from "@fortawesome/free-solid-svg-icons";
import {Tooltip} from "react-tooltip";
import ReactCountryFlag from "react-country-flag";
import {Link, useNavigate, useSearchParams} from "react-router";
import {ExecuteState} from "~/components/executionState";
import {PaginationControls} from "~/components/paginationControls";
import {useEffect, useState} from "react";
import useConfig from "~/components/config";
import axios from "axios";
import useCookieToken from "~/components/cookie";
import type {Environment} from "~/types";
import {faCancel, faCheck, faGlobe, faWarning} from "@fortawesome/pro-solid-svg-icons";
import {useAuth} from "~/context/auth/use";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Environments" },
        { name: "description", content: "Get in the Flo" },
    ];
}

export default function Environments() {
    const navigate = useNavigate();

    const [ searchParams, setSearchParams ] = useSearchParams();

    const [ isLoading, setIsLoading ] = useState<boolean>(true);
    const [ environments, setEnvironments ] = useState<Environment[]>();
    const [ search, setSearch ] = useState<string>(searchParams.get("search"))

    const [ hasInputRow, setHasInputRow ] = useState<boolean>(false);
    const [ inputEnvironmentName, setInputEnvironmentName ] = useState<string>("");
    const [ confirmDeletionID, setConfirmDeletionID ] = useState<string>(null);

    const controller = new AbortController();
    const token = useCookieToken();
    const user = useAuth()

    function handleUpdateSearch(term) {
        setSearch(term);
    }

    const loadEnvironments = () => {
        // setIsLoading(true);
        const config = useConfig();
        let url = config("AUTOMATE_API_URL") + '/api/v1/environment';

        axios.get(url, {
            signal: controller.signal,
            headers: {
                "Authorization": "Bearer " + token,
            }
        })
            .then(response => {
                if (response) {
                    setEnvironments(response.data);
                }
            })
            .catch(error => {
                console.error(error);
            })
            .finally(() => {
                setIsLoading(false);
            })
    }

    useEffect(() => {
        loadEnvironments();
    }, []);

    useEffect(() => {
        if (confirmDeletionID) {
            const interval = setInterval(() => {
                setConfirmDeletionID(null);
            }, 2500);

            return () => clearInterval(interval);
        }
    }, [ confirmDeletionID ]);

    const changeEnvironmentName = (e) => {
        setInputEnvironmentName(e.target.value);
    }

    const confirmDeleteEnvironment = (id: string | null) => {
        setConfirmDeletionID(id);
    }

    const deleteEnvironment = (id: string) => {
        const config = useConfig();
        let url = config("AUTOMATE_API_URL") + '/api/v1/environment/' + id;

        axios.delete(url, {
            signal: controller.signal,
            headers: {
                "Authorization": "Bearer " + token,
            }
        })
            .then(response => {
                if (response) {
                    loadEnvironments();
                }
            })
            .catch(error => {
                console.error(error);
            })
    }

    const saveEnvironment = () => {
        if (inputEnvironmentName.length < 3) {
            return;
        }

        setHasInputRow(false);
        const config = useConfig();
        let url = config("AUTOMATE_API_URL") + '/api/v1/environment';

        axios.post(url, {
            name: inputEnvironmentName,
        }, {
            signal: controller.signal,
            headers: {
                "Authorization": "Bearer " + token,
            }
        })
            .then(response => {
                if (response) {
                    loadEnvironments();
                }
            })
            .catch(error => {
                console.error(error);
            })
    }

    const goToEnvironment = (id: string) => {
        navigate("/environment/" + id);
    }

    const showInputRow = (value: boolean) => {
        if (value) {
            setInputEnvironmentName("");
        }

        setHasInputRow(value);
    }

    return (
        <Container>
            <div className={"header"}>Environments</div>

            <div className={"search-section"}>
                <input disabled={true} type={"text"} className={"search-textbox"} placeholder={"Search..."} onChange={(e) => handleUpdateSearch(e.target.value)} value={search || ''} data-tooltip-id={"search"} data-tooltip-content={"Search for Environment by Name or ID"} data-tooltip-place={"bottom-start"}/>
                <Tooltip id={"search"} />
            </div>

            {isLoading && (
                <div className={"loading-container"}>
                    <FontAwesomeIcon icon={faSpinner} spin />
                </div>
            )}

            {!isLoading && (
                <>
                    <table className={"flo-table"}>
                        <thead className={"flo-table-head"}>
                        <tr>
                            <th>Name</th>
                            <th className={"table-column-hide-sm"}>Owner</th>
                            <th className={"table-column-small-col"}>
                                <span className={"table-column-hide-sm"}>Actions</span>
                            </th>
                        </tr>
                        </thead>
                        {!environments && (
                            <tbody>
                            {!hasInputRow && (
                                <tr className={"flo-table-row"} >
                                    <td colSpan={3} className={"table-row-center"}>
                                        <button className={"table-button"} onClick={() => showInputRow(true)}><FontAwesomeIcon icon={faGlobe} /> Create your first Environment</button>
                                    </td>
                                </tr>
                            )}
                            {hasInputRow && (
                                <tr className={"flo-table-row"} >
                                    <td colSpan={2}>
                                        <input type={"text"} placeholder={"Environment name..."} autoFocus={true} value={inputEnvironmentName} onChange={changeEnvironmentName} />
                                    </td>
                                    <td className={"table-column-small-col"}>
                                        <button className={"table-button"} onClick={() => saveEnvironment()}>
                                            <FontAwesomeIcon icon={faCheck}/> <span>Save</span>
                                        </button>
                                        <button className={"table-button"} onClick={() => showInputRow(false)}>
                                            <FontAwesomeIcon icon={faCancel} /> <span>Cancel</span>
                                        </button>
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        )}
                        {environments && environments.length > 0 && (
                            <tbody>
                            <>
                                {environments?.map((env, index) => {
                                    return (
                                        <tr className={"flo-table-row"} key={env.id}>
                                            <td>{env.name}<span className={"table-column-hide-sm flo-table-subtext"}>{env.id}</span></td>
                                            <td className={"table-column-hide-sm"}>{user.userID == env.owner_id ? "You" : "Other"}</td>
                                            <td>
                                                <button className={"table-button"} onClick={() => goToEnvironment(env.id)}>
                                                    <FontAwesomeIcon icon={faEye}/> <span>View</span>
                                                </button>
                                                <button className={(confirmDeletionID != null && confirmDeletionID == env.id) ? "hidden" : "table-button"} onClick={() => {confirmDeleteEnvironment(env.id)}}>
                                                    <FontAwesomeIcon icon={faTrash} /> <span>Delete</span>
                                                </button>
                                                <button className={confirmDeletionID == env.id ? "table-button table-button-red" : "hidden"} autoFocus={true} onClick={() => deleteEnvironment(env.id)}>
                                                    <FontAwesomeIcon icon={faWarning} /> <span>Confirm</span>
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                                {!hasInputRow && (
                                    <tr className={"flo-table-row"} >
                                        <td colSpan={3} className={"table-row-center"}>
                                            <button className={"table-button"} onClick={() => showInputRow(true)}>
                                                <FontAwesomeIcon icon={faGlobe} /> Create new Environment

                                            </button>
                                        </td>
                                    </tr>
                                )}
                                {hasInputRow && (
                                    <tr className={"flo-table-row"} >
                                        <td colSpan={2}>
                                            <input type={"text"} placeholder={"Environment name..."} autoFocus={true} value={inputEnvironmentName} onChange={changeEnvironmentName} />
                                        </td>
                                        <td className={"table-column-small-col"}>
                                            <button className={"table-button"} onClick={() => saveEnvironment()}>
                                                <FontAwesomeIcon icon={faCheck}/> <span>Save</span>
                                            </button>
                                            <button className={"table-button"} onClick={() => showInputRow(false)}>
                                                <FontAwesomeIcon icon={faCancel} /> <span>Cancel</span>
                                            </button>
                                        </td>
                                    </tr>
                                )}
                            </>
                            </tbody>
                        )}
                    </table>
                </>
            )}
        </Container>
    )
}