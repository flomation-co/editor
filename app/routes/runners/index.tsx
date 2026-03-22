import type {Route} from "../+types/home";
import Container from "~/components/container";
import useConfig from "~/components/config";
import api from "~/lib/api";
import {useEffect, useState} from "react";
import type {Runner} from "~/types";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faPencil, faSpinner, faShield, faTrash} from "@fortawesome/free-solid-svg-icons";
import {Tooltip} from "react-tooltip";
import {useSearchParams} from "react-router";
import dayjs from "dayjs";
import { faCopy, faPause} from "@fortawesome/pro-solid-svg-icons";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import useCookieToken from "~/components/cookie";

dayjs.extend(relativeTime);
dayjs.extend(utc);

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Runners" },
        { name: "description", content: "Get in the Flo" },
    ];
}

export default function Runners() {
    const [ searchParams, setSearchParams ] = useSearchParams();

    const controller = new AbortController();
    const token = useCookieToken();

    const config = useConfig();
    let url = config("AUTOMATE_API_URL") + '/api/v1/runner';

    const [ runners, setRunners ] = useState<Runner[]>();
    const [ loading, setLoading ] = useState<boolean>(true);
    const [ search, setSearch ] = useState<string>(searchParams.get("search"))

    const queryRunners = () => {
        setLoading(true);

        api.get(url, {
            signal: controller.signal,
            headers: {
                "Authorization": "Bearer "+ token,
            }
        })
            .then(response => {
                if (response) {
                    setRunners(response.data)
                }
            })
            .catch(error => {
                console.error(error);
            })
            .finally(() => {
                setLoading(false);
            })
    }

    useEffect(() => {
        queryRunners();
    }, []);

    function handleUpdateSearch(term) {
        setSearch(term);
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

    return (
        <Container>
            <div className={"header"}>Runners</div>

            <div className={"search-section"}>
                <input disabled={true} type={"text"} className={"search-textbox"} placeholder={"Search..."} onChange={(e) => handleUpdateSearch(e.target.value)} value={search || ''} data-tooltip-id={"search"} data-tooltip-content={"Search for Runner by Name or ID"} data-tooltip-place={"bottom-start"}/>
                <Tooltip id={"search"} />
            </div>

            {loading && (
                <div className={"loading-container"}>
                    <FontAwesomeIcon icon={faSpinner} spin />
                </div>
            )}

            {!loading && runners && (
                <>
                    <table className={"flo-table"}>
                        <thead className={"flo-table-head"}>
                        <tr>
                            <th>Name</th>
                            <th className={"table-column-hide-sm"}>Registration Code</th>
                            <th className={"table-column-hide-sm"}>IP Address</th>
                            <th className={"table-column-hide-sm"}>Version</th>
                            <th className={"table-column-hide-sm"}>Executor</th>
                            <th className={"table-column-hide-sm"}>Verified</th>
                            <th className={"table-column-hide-sm"}>Enrolled</th>
                            <th className={"table-column-hide-sm"}>Last Contact</th>
                            <th>Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {runners && runners?.map((r) => {
                            return (
                                <tr key={r.id} className={r.state == "active" ? "flo-table-row" : "flo-table-row disabled-row"}>
                                    <td>{r.name}</td>
                                    <td className={"table-column-hide-sm"}>{r.registration_code} <FontAwesomeIcon icon={faCopy}/></td>
                                    <td className={"table-column-hide-sm"}>{r.ip_address}</td>
                                    <td className={"table-column-hide-sm"}>{r.version}</td>
                                    <td className={"table-column-hide-sm"}>{r.executor_version}</td>
                                    <td className={"table-column-hide-sm"}>{r.verified && (
                                        <FontAwesomeIcon icon={faShield}/>
                                    )}</td>
                                    <td className={"table-column-hide-sm"}>
                                        <span data-tooltip-id={"tooltip-enrolled-" + r.id} data-tooltip-content={formatDateString(r.enrolled_at)} data-tooltip-place={"bottom"}>
                                            {formatDate(r.enrolled_at)}
                                        </span>
                                        <Tooltip id={"tooltip-enrolled-" + r.id} />
                                    </td>
                                    <td className={"table-column-hide-sm"}>
                                        <span data-tooltip-id={"tooltip-contact-" + r.id} data-tooltip-content={formatDateString(r.last_contact_at)} data-tooltip-place={"bottom"}>
                                            {formatDate(r.last_contact_at)}
                                        </span>
                                        <Tooltip id={"tooltip-contact-" + r.id} />
                                    </td>
                                    <td>
                                        <button disabled={true || r.state != "active"} className={"table-button"}>
                                            <FontAwesomeIcon icon={faPencil}/> <span>Edit</span>
                                        </button>
                                        <button disabled={true} className={"table-button"}>
                                            <FontAwesomeIcon icon={faPause}/> <span>Pause</span>
                                        </button>
                                        <button disabled={true} className={"table-button table-button-danger"}>
                                            <FontAwesomeIcon icon={faTrash}/> <span>Remove</span>
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                        </tbody>
                    </table>
                </>
            )}
        </Container>
    )
}