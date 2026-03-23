import type {Route} from "../+types/home";
import "./index.css"
import Container from "~/components/container";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCircleStop, faEye, faSpinner} from "@fortawesome/free-solid-svg-icons";
import {Link, useSearchParams} from "react-router";
import {ExecuteState, ExecutionStateValue} from "~/components/executionState";
import type {Execution} from "~/types";
import {useEffect, useState} from "react";
import api from "~/lib/api";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import {Tooltip} from "react-tooltip";
import ReactCountryFlag from "react-country-flag"
import {PaginationControls} from "~/components/paginationControls";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";

dayjs.extend(relativeTime);
dayjs.extend(utc);

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Executions" },
        { name: "description", content: "Get in the Flo" },
    ];
}

export default function Executions() {
    const [ searchParams, setSearchParams ] = useSearchParams();
    const [ execs, setExecs ] = useState<Execution[]>();
    const [ totalExecCount, setTotalExecCount ] = useState<number>(0);
    const [ isLoading, setIsLoading ] = useState<boolean>(true);

    const [ search, setSearch ] = useState<string>(searchParams.get("search"))

    const [ offset, setOffset ] = useState<number>(0);
    const [ limit, setLimit ] = useState<number>(10);
    const [ disableRightPagination, setDisableRightPagination ] = useState<boolean>(false);

    const [ width, setWidth ] = useState<number>(0);
    const [ isMobile, setIsMobile ] = useState<boolean>(true);

    const controller = new AbortController();
    const token = useCookieToken();

    useEffect(() => {
        window.addEventListener('resize', handleWindowSizeChange);
        return () => {
            window.removeEventListener('resize', handleWindowSizeChange);
        }
    }, []);

    function handleWindowSizeChange() {
        setWidth(window.innerWidth);
    }

    useEffect(() => {
        setIsMobile(width <= 768);
    }, [ width ]);

    useEffect(() => {
        const interval = setInterval(() => {
            const config = useConfig();
            let url = config("AUTOMATE_API_URL") + '/api/v1/execution';

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

            api.get(url, {
                signal: controller.signal,
                headers: {
                    "Authorization": "Bearer " + token,
                }
            })
                .then(response => {
                    if (response) {
                        setTotalExecCount(+response.headers["x-total-items"]);
                        setExecs(response.data);

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
        }, 250);

        return () => clearInterval(interval);
    }, [search, offset, limit]);

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

    function handlePageChange(offset: number, limit: number) {
        setOffset(offset * limit);
        setLimit(limit);
    }

    function friendlyDuration(duration?: number) : string {
        if (!duration) {
            return "";
        }

        if (duration === 0) {
            return ""
        }

        // const newDate = new Date(duration);
        // const hours = newDate.getUTCHours();
        // const minutes = newDate.getUTCMinutes();
        // const seconds = newDate.getUTCSeconds();
        // const milliseconds = newDate.getUTCMilliseconds();
        // console.log(hours, minutes, seconds, milliseconds);
        //
        // let friendlyDate = milliseconds + " ms";
        // if (hours > 0) {
        //     return hours + " h " + minutes + " m " + seconds + " s " + milliseconds + " ms";
        // }
        //
        // if (minutes > 0) {
        //     return minutes + " m " + seconds + " s " + milliseconds + " ms";
        // }
        //
        // if (seconds > 0) {
        //     return seconds + " s " + milliseconds + " ms";
        // }

        return duration + " ms";
    }

    return (
        <Container>
            <div className={"header"}>Executions</div>

            <div className={"search-section"}>
                <input type={"text"} className={"search-textbox"} placeholder={"Search..."} onChange={(e) => handleUpdateSearch(e.target.value)} value={search || ''} data-tooltip-id={"search"} data-tooltip-content={"Search for Execution by flow Name or ID"} data-tooltip-place={"bottom-start"}/>
                <Tooltip id={"search"} />
            </div>

            {isLoading && (
                <div className={"loading-container"}>
                    <FontAwesomeIcon icon={faSpinner} spin />
                </div>
            )}
            {!isLoading && (
                <>
                    {execs && execs.length > 0 && (
                        <>
                            <table className={"flo-table"}>
                                <thead className={"flo-table-head"}>
                                <tr>
                                    <th>Name</th>
                                    <th className={"table-column-hide-sm"}>Execution #</th>
                                    <th className={"table-column-hide-sm"}>Started</th>
                                    <th className={"table-column-hide-sm"}>Location</th>
                                    <th className={"table-column-hide-sm"}>Status</th>
                                    <th className={"table-column-hide-sm"}>Duration</th>
                                    {/*<th className={"table-column-hide-sm"}>Allocation</th>*/}
                                    <th>
                                        <span className={"table-column-hide-sm"}>Actions</span>
                                    </th>
                                </tr>
                                </thead>
                                <tbody>
                                <>
                                    {execs?.map((exec, index) => {
                                        return (
                                            <tr className={"flo-table-row"} key={exec.id}>
                                                <td><Link to={"/execution/" + exec.id} className={"flo-table-link"}>{exec.name}</Link><span className={"table-column-hide-sm flo-table-subtext"}>{exec.id}</span></td>
                                                <td className={"table-column-hide-sm"}>#{exec.sequence}</td>
                                                <td className={"table-column-hide-sm"}>
                                                        <span data-tooltip-id={"tooltip-time-" + exec.id} data-tooltip-content={formatDateString(exec.created_at)} data-tooltip-place={"bottom"}>
                                                            {formatDate(exec.created_at)}
                                                        </span>
                                                    <Tooltip id={"tooltip-time-" + exec.id} />
                                                </td>
                                                <td className={"table-column-hide-sm"}>
                                                    <ReactCountryFlag countryCode={"gb"} />
                                                </td>
                                                <td className={"table-column-hide-sm"}>
                                                    <Link to={{pathname: "/execution/" + exec.id}}>
                                                        <ExecuteState state={exec.execution_status} completionState={exec.completion_status} />
                                                    </Link>
                                                </td>
                                                <td className={"table-column-hide-sm"}>{friendlyDuration(exec.duration)}</td>
                                                {/*<td className={"table-column-hide-sm"}>{friendlyDuration(exec.billing_duration)}</td>*/}
                                                <td>
                                                    {/*<button disabled={true || r.state != "active"} className={"table-button"}>
                                            <FontAwesomeIcon icon={faPencil}/> Edit
                                        </button>*/}
                                                    <Link className={"table-button"} to={{pathname: "/execution/" + exec.id}}>
                                                        <FontAwesomeIcon icon={faEye}/> <span>View</span>
                                                    </Link>
                                                    <button className={"table-button"} disabled={true}>
                                                        <FontAwesomeIcon icon={faCircleStop}/> <span>Stop</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </>
                                </tbody>
                            </table>
                            <PaginationControls totalCount={totalExecCount} onPageChange={handlePageChange} disableRightPagination={disableRightPagination}/>
                        </>
                    )}
                </>
            )}
        </Container>
    )
}