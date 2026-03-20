import type {Route} from "../+types/home";
import "./index.css"
import Container from "~/components/container";
import {Link, useParams} from "react-router";
import {CompletionStateValue, ExecuteState, ExecutionStateValue} from "~/components/executionState";
import type {Execution} from "~/types";
import {useContext, useEffect, useState} from "react";
import axios from "axios";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import useConfig from "~/components/config";
import {faLink} from "@fortawesome/pro-solid-svg-icons";
import useCookieToken from "~/components/cookie";
import {LogOutput} from "~/components/logOutput";

dayjs.extend(relativeTime);
dayjs.extend(utc);

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Execution" },
        { name: "description", content: "Get in the Flo" },
    ];
}

export default function ExecutionDetail() {
    const [ executionID, setExecutionID ] = useState<string>(useParams().id)
    const [ exec, setExec ] = useState<Execution>();

    const [ liveUpdate, setLiveUpdate ] = useState<boolean>(false);

    const [ isMobile, setIsMobile ] = useState<boolean>(true);
    const [ width, setWidth ] = useState<number>(0);

    const [ logModeRaw, setLogModeRaw ] = useState<boolean>(true)

    const controller = new AbortController();
    const token = useCookieToken();

    function handleWindowSizeChange() {
        setWidth(window.innerWidth);
    }

    useEffect(() => {
        window.addEventListener('resize', handleWindowSizeChange);
        return () => {
            window.removeEventListener('resize', handleWindowSizeChange);
        }
    }, []);

    useEffect(() => {
        setIsMobile(width <= 768);
    }, [ width ]);

    const queryExecutionState = () => {
        const config = useConfig();
        let url = config("AUTOMATE_API_URL") + '/api/v1/execution/' + executionID;

        axios.get(url, {
            signal: controller.signal,
            headers: {
                Authorization: "Bearer " + token,
            }
        })
            .then(response => {
                if (response) {
                    setExec(response.data);

                    if (response.data.completion_status === "pending") {
                        setLiveUpdate(true);
                    } else {
                        setLiveUpdate(false);
                    }
                }
            })
            .catch(error => {
                console.error(error);
            })
    }

    useEffect(() => {
        console.log(exec);
    }, [ exec ]);

    useEffect(() => {
        queryExecutionState();
    }, [ executionID ]);

    useEffect(() => {
        if (liveUpdate) {
            const interval = setInterval(() => {
                queryExecutionState();
            }, 500);

            return () => clearInterval(interval);
        }
    }, [ executionID, liveUpdate ]);

    function formatDate(date) {
        if (!date) {
            return "";
        }

        return dayjs.utc(date).fromNow();
    }

    function formatDateString(date) {
        if (!date) {
            return "Never Run";
        }

        return dayjs.utc(date).local().format("D MMM YYYY H:mm:ss");
    }

    return (
        <Container>
            {exec && (
                <>
                    <div className={"header"}>{exec.name} - #{exec.sequence}<div className={"small-label"}><ExecuteState state={exec.execution_status} completionState={exec.completion_status} /></div></div>

                    <div><div className={"property-label"}>Flow: <span className={"flo-table-subtext"}><Link to={"/flo/" + exec.flo_id}>{exec.name} <FontAwesomeIcon icon={faLink} /> </Link></span></div></div>
                    <div><div className={"property-label"}>Started: <span className={"flo-table-subtext"}>{formatDateString(exec.created_at)}</span></div></div>
                    <div><div className={"property-label"}>Completed: <span className={"flo-table-subtext"}>{exec.completed_at ? formatDateString(exec.completed_at) : "-"}</span></div></div>
                    <div><div className={"property-label"}>Runner: <span className={"flo-table-subtext"}>{exec.runner_id ? exec.runner_id : "-"}</span></div></div>
                    <div><div className={"property-label"}>Duration: <span className={"flo-table-subtext"}>{exec.duration > 0 ? exec.duration + " ms" : ""}</span></div></div>

                    <div className={"code-block-label"}>
                        Inputs
                    </div>
                    <pre className={"code-block"}>
                        {exec.data && (
                            <>
                                {JSON.stringify(exec.data, null, 4)}
                            </>
                        )}
                    </pre>

                    <div className={"code-block-label"}>
                        Outputs
                    </div>
                    <pre className={"code-block"}>
                        {!exec.result && (
                            <>
                                &nbsp;
                            </>
                        )}
                        {exec.result && (
                            <>
                                {exec.result.outputs ? JSON.stringify(exec.result.outputs, null, 4): " "}
                            </>
                        )}
                    </pre>

                    <div className={"code-block-label"}>
                        Logs
                    </div>

                    <div className={"log-toggle"}>
                        <span className={!logModeRaw ? "log-toggle-option active" : "log-toggle-option"} onClick={() => setLogModeRaw(false)}>Parsed</span>
                        <span className={logModeRaw ? "log-toggle-option active" : "log-toggle-option"} onClick={() => setLogModeRaw(true)}>Raw</span>
                    </div>

                    {!logModeRaw && (
                        <LogOutput logs={exec.result} />
                    )}

                    {logModeRaw && (
                        <pre className={"code-block"}>
                        {!exec.result && (
                            <>
                                &nbsp;
                            </>
                        )}
                            {exec.result && (
                                <>
                                    {exec.result.logs}
                                </>
                            )}
                    </pre>
                    )}
                </>
            )}
        </Container>
    )
}