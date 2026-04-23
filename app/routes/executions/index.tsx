import type {Route} from "../+types/home";
import "./index.css"
import Container from "~/components/container";
import {Link, useSearchParams} from "react-router";
import {ExecuteState, ExecutionStateValue} from "~/components/executionState";
import type {Execution} from "~/types";
import {useEffect, useState, useCallback} from "react";
import api from "~/lib/api";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import {Tooltip} from "react-tooltip";
import SearchBar from "~/components/searchBar";
import ReactCountryFlag from "react-country-flag"
import {PaginationControls} from "~/components/paginationControls";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import { Icon } from "~/components/icons/Icon";
import { ExecutionTableSkeleton } from "~/components/skeleton";

dayjs.extend(relativeTime);
dayjs.extend(utc);

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Executions" },
        { name: "description", content: "Get in the Flo" },
    ];
}

const TRIGGER_ICONS: Record<string, any> = {
    manual: "hand",
    schedule: "clock",
    'git-poll': "code-branch",
    webhook: "globe",
    telegram: "telegram",
    slack: "slack",
    email: "envelope",
    s3: "box",
    form: "file",
    qr: "qrcode",
    image: "image",
};

const TRIGGER_LABELS: Record<string, string> = {
    manual: 'Manual',
    schedule: 'Schedule',
    'git-poll': 'Git Poll',
    webhook: 'Webhook',
    telegram: 'Telegram',
    slack: 'Slack',
    email: 'Email',
    s3: 'S3',
    form: 'Form',
    qr: 'QR Code',
    image: 'Tracking Pixel',
};

function triggerIcon(type?: string): any {
    return TRIGGER_ICONS[type || ''] || "bolt";
}

function triggerLabel(type?: string): string {
    return TRIGGER_LABELS[type || ''] || type || 'Unknown';
}

// Live elapsed timer for in-progress executions in the list view
function LiveDuration({ createdAt, formatter }: { createdAt: string; formatter: (ms: number) => string }) {
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        const start = dayjs.utc(createdAt);
        const tick = () => setElapsed(dayjs.utc().diff(start));
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [createdAt]);
    return <>{formatter(elapsed)}</>;
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
    const [ hideAgentChildren, setHideAgentChildren ] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('flomation-hide-agent-execs') === 'true';
        }
        return false;
    });

    const [ width, setWidth ] = useState<number>(0);
    const [ isMobile, setIsMobile ] = useState<boolean>(true);

    const REFRESH_OPTIONS = [
        { label: "1s", value: 1000 },
        { label: "5s", value: 5000 },
        { label: "10s", value: 10000 },
        { label: "30s", value: 30000 },
        { label: "1m", value: 60000 },
        { label: "5m", value: 300000 },
        { label: "Off", value: 0 },
    ];
    const [ refreshInterval, setRefreshInterval ] = useState<number>(5000);
    const [ refreshCycle, setRefreshCycle ] = useState<number>(0);

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

    const fetchExecutions = () => {
        const config = useConfig();
        let url = config("AUTOMATE_API_URL") + '/api/v1/execution';

        if (search && search.length > 2) {
            url += "?search=" + search;
        }

        if (url.indexOf('?') == -1) {
            url += "?";
        } else {
            url += "&";
        }
        url += "offset=" + offset + "&limit=" + limit;
        if (hideAgentChildren) {
            url += "&root_only=true";
        }

        api.get(url, {
            signal: controller.signal,
            headers: { Authorization: "Bearer " + token }
        })
            .then(response => {
                if (response) {
                    setTotalExecCount(+response.headers["x-total-items"]);
                    setExecs(response.data);
                    setDisableRightPagination(response.data.length < limit);
                }
            })
            .catch(error => console.error(error))
            .finally(() => setIsLoading(false));
    };

    // Initial fetch + on filter change
    useEffect(() => {
        fetchExecutions();
    }, [search, offset, limit, hideAgentChildren]);

    // Auto-refresh interval
    useEffect(() => {
        if (refreshInterval === 0) return;

        setRefreshCycle(c => c + 1);

        const timer = setInterval(() => {
            fetchExecutions();
            setRefreshCycle(c => c + 1);
        }, refreshInterval);

        return () => clearInterval(timer);
    }, [refreshInterval, search, offset, limit, hideAgentChildren]);

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

    function friendlyDuration(ms?: number): string {
        if (!ms || ms <= 0) return "";
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

    function effectiveDuration(exec: any): number {
        if (exec.duration && exec.duration > 0) return exec.duration;
        if (exec.completed_at && exec.created_at) {
            return dayjs.utc(exec.completed_at).diff(dayjs.utc(exec.created_at));
        }
        return 0;
    }

    return (
        <Container>
            <div className={"header"}>Executions</div>

            <SearchBar value={search} onChange={handleUpdateSearch} placeholder="Search executions..." />

            <div className="exec-controls-bar">
                <label className="exec-agent-filter" title="Hide executions triggered by agents">
                    <input type="checkbox" checked={hideAgentChildren} onChange={e => {
                        setHideAgentChildren(e.target.checked);
                        localStorage.setItem('flomation-hide-agent-execs', String(e.target.checked));
                    }} />
                    <span className="exec-agent-filter-slider"></span>
                    <span className="exec-agent-filter-label">Hide agent executions</span>
                </label>
            </div>

            <div className="exec-refresh-bar">
                <div className="exec-refresh-bar-label">Auto-refresh</div>
                <div
                    key={refreshCycle}
                    className={`exec-refresh-options ${refreshInterval === 0 ? 'exec-refresh-options--off' : ''}`}
                    style={refreshInterval > 0 ? { '--refresh-duration': `${refreshInterval}ms` } as React.CSSProperties : undefined}
                >
                    {REFRESH_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            className={`exec-refresh-option ${refreshInterval === opt.value ? 'exec-refresh-option--active' : ''}`}
                            onClick={() => setRefreshInterval(opt.value)}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading && (
                <table className={"flo-table"}>
                    <thead className={"flo-table-head"}>
                    <tr>
                        <th>Name</th>
                        <th className={"table-column-hide-sm"}>Execution #</th>
                        <th className={"table-column-hide-sm"}>Started</th>
                        <th className={"table-column-hide-sm"}>Trigger</th>
                        <th className={"table-column-hide-sm"}>Status</th>
                        <th className={"table-column-hide-sm"}>Duration</th>
                        <th><span className={"table-column-hide-sm"}>Actions</span></th>
                    </tr>
                    </thead>
                    <tbody>
                        <ExecutionTableSkeleton />
                    </tbody>
                </table>
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
                                    <th className={"table-column-hide-sm"}>Trigger</th>
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
                                                <td>
                                                    {exec.agent_id && (
                                                        <Icon name="robot" style={{ color: '#c084fc', fontSize: 12, marginRight: 6 }} data-tooltip-id={"tooltip-agent-" + exec.id} data-tooltip-content="Agent execution" data-tooltip-place="bottom" />
                                                    )}
                                                    <Link to={"/execution/" + exec.id} className={"flo-table-link"}>{exec.name}</Link>
                                                    <span className={"table-column-hide-sm flo-table-subtext"}>{exec.id}</span>
                                                    {exec.agent_id && <Tooltip id={"tooltip-agent-" + exec.id} />}
                                                </td>
                                                <td className={"table-column-hide-sm flo-table-subdued"}>#{exec.sequence}</td>
                                                <td className={"table-column-hide-sm flo-table-subdued"}>
                                                        <span data-tooltip-id={"tooltip-time-" + exec.id} data-tooltip-content={formatDateString(exec.created_at)} data-tooltip-place={"bottom"}>
                                                            {formatDate(exec.created_at)}
                                                        </span>
                                                    <Tooltip id={"tooltip-time-" + exec.id} />
                                                </td>
                                                <td className={"table-column-hide-sm flo-table-subdued"} style={{ textAlign: 'center' }}>
                                                    <span data-tooltip-id={"tooltip-trigger-" + exec.id} data-tooltip-content={triggerLabel(exec.trigger_type)} data-tooltip-place="bottom">
                                                        <Icon name={triggerIcon(exec.trigger_type)} style={{ fontSize: 14, opacity: 0.6 }} />
                                                    </span>
                                                    <Tooltip id={"tooltip-trigger-" + exec.id} />
                                                </td>
                                                <td className={"table-column-hide-sm"}>
                                                    <Link to={{pathname: "/execution/" + exec.id}}>
                                                        <ExecuteState state={exec.execution_status} completionState={exec.completion_status} />
                                                    </Link>
                                                </td>
                                                <td className={"table-column-hide-sm flo-table-subdued"}>
                                                    {exec.completion_status === 'pending'
                                                        ? <LiveDuration createdAt={exec.created_at} formatter={friendlyDuration} />
                                                        : friendlyDuration(effectiveDuration(exec))}
                                                </td>
                                                {/*<td className={"table-column-hide-sm"}>{friendlyDuration(exec.billing_duration)}</td>*/}
                                                <td>
                                                    {/*<button disabled={true || r.state != "active"} className={"table-button"}>
                                            <Icon name="pencil" /> Edit
                                        </button>*/}
                                                    <Link className={"table-button"} to={{pathname: "/execution/" + exec.id}}>
                                                        <Icon name="eye" /> <span>View</span>
                                                    </Link>
                                                    <button className={"table-button"} disabled={true}>
                                                        <Icon name="circle-stop" /> <span>Stop</span>
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