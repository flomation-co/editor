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
import ProtectedRoute from "~/components/protected-route";
import {PERMISSIONS} from "~/types";

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
    'gitlab-webhook': "gitlab",
    'github-webhook': "github",
    'facebook-messenger': "facebook",
    'facebook-feed': "facebook",
    'linkedin-poll': "linkedin",
    'twilio-sms': "comment-sms",
    'twilio-voice': "phone-volume",
    'google-drive': "google",
    'calendly-webhook': "calendly",
    'calcom-webhook': "calcom",
    'zendesk-webhook': "zendesk",
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
    'gitlab-webhook': 'GitLab',
    'github-webhook': 'GitHub',
    'facebook-messenger': 'Messenger',
    'facebook-feed': 'Facebook Feed',
    'linkedin-poll': 'LinkedIn',
    'twilio-sms': 'Twilio SMS',
    'twilio-voice': 'Twilio Voice',
    'google-drive': 'Google Drive',
    'calendly-webhook': 'Calendly',
    'calcom-webhook': 'Cal.com',
    'zendesk-webhook': 'Zendesk',
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
// Hierarchical view: root_only=true on fetch + expand/collapse
    // per root using lazy /execution-tree/:rootID requests. Default
    // ON because the flat view fires one row per child every time a
    // remote-triggered flow runs — the tree compresses that down to
    // one expandable root row.
    const [ hierarchical, setHierarchical ] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('flomation-executions-hierarchical');
            // Default to ON unless the user has explicitly opted out.
            return stored === null ? true : stored === 'true';
        }
        return true;
    });
    const [ expandedRoots, setExpandedRoots ] = useState<Set<string>>(new Set());
    const [ subtrees, setSubtrees ] = useState<Map<string, Execution[]>>(new Map());
    const [ loadingTrees, setLoadingTrees ] = useState<Set<string>>(new Set());

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
    const [ refreshInterval, setRefreshInterval ] = useState<number>(15000);
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
        if (hierarchical) {
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

    // Fetch on mount + on filter change, AND set up the auto-refresh
    // interval in the same effect. The immediate fetch fires before
    // the interval starts ticking, so users never see the skeleton
    // wait for the first interval to roll over.
    useEffect(() => {
        fetchExecutions();
        if (refreshInterval === 0) return;
        setRefreshCycle(c => c + 1);
        const timer = setInterval(() => {
            fetchExecutions();
            setRefreshCycle(c => c + 1);
        }, refreshInterval);
        return () => clearInterval(timer);
    }, [refreshInterval, search, offset, limit, hierarchical]);

    // Expand a root row, lazy-fetching its subtree the first time.
    // Subsequent toggles just flip the expanded set — the cached tree
    // is reused so the user can collapse and re-expand without firing
    // another network round-trip.
    const toggleRoot = useCallback(async (rootId: string) => {
        const isExpanded = expandedRoots.has(rootId);
        if (isExpanded) {
            setExpandedRoots(prev => {
                const next = new Set(prev);
                next.delete(rootId);
                return next;
            });
            return;
        }
        if (!subtrees.has(rootId) && !loadingTrees.has(rootId)) {
            setLoadingTrees(prev => new Set(prev).add(rootId));
            const config = useConfig();
            try {
                const resp = await api.get(
                    config("AUTOMATE_API_URL") + '/api/v1/execution-tree/' + rootId,
                    { headers: { Authorization: "Bearer " + token } },
                );
                if (resp) {
                    setSubtrees(prev => new Map(prev).set(rootId, resp.data));
                }
            } catch (err) {
                console.error("failed to fetch execution tree", err);
            } finally {
                setLoadingTrees(prev => {
                    const next = new Set(prev);
                    next.delete(rootId);
                    return next;
                });
            }
        }
        setExpandedRoots(prev => new Set(prev).add(rootId));
    }, [expandedRoots, subtrees, loadingTrees, token]);

    // Given a root execution's id, return all descendant rows in the
    // order they should render (depth-first, by creation time at each
    // level). Roots return themselves when no tree has been fetched
    // yet — guarantees the table still renders cleanly during the
    // async load.
    function descendantsOf(rootId: string): Execution[] {
        const tree = subtrees.get(rootId);
        if (!tree) return [];
        // The tree already arrives ordered by (depth, created_at)
        // from the API. The root itself is included; strip it here
        // because the calling row already renders the root.
        return tree.filter(e => e.id !== rootId);
    }

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
            <ProtectedRoute permission={PERMISSIONS.FLOW_EXECUTE}>
            <div className={"header"}>Executions</div>

            <SearchBar value={search} onChange={handleUpdateSearch} placeholder="Search executions..." />

            <div className="exec-controls-bar">
                <div className="exec-view-mode-bar">
                    <div className="exec-view-mode-label">View</div>
                    <div className="exec-view-mode-options">
                        <button
                            className={`exec-view-mode-option ${hierarchical ? 'exec-view-mode-option--active' : ''}`}
                            onClick={() => {
                                if (hierarchical) return;
                                setHierarchical(true);
                                localStorage.setItem('flomation-executions-hierarchical', 'true');
                                setExpandedRoots(new Set());
                            }}
                            title="Show top-of-tree executions only — expand a row to see its children"
                        >
                            <Icon name="sitemap" /> Hierarchical
                        </button>
                        <button
                            className={`exec-view-mode-option ${!hierarchical ? 'exec-view-mode-option--active' : ''}`}
                            onClick={() => {
                                if (!hierarchical) return;
                                setHierarchical(false);
                                localStorage.setItem('flomation-executions-hierarchical', 'false');
                                setExpandedRoots(new Set());
                            }}
                            title="Show every execution as a flat list"
                        >
                            <Icon name="list" /> Flat
                        </button>
                    </div>
                </div>
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
                        <th className={"table-column-hide-sm"}>Cost</th>
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
                                    <th className={"table-column-hide-sm"}>Triggered by</th>
                                    <th className={"table-column-hide-sm"}>Status</th>
                                    <th className={"table-column-hide-sm"}>Duration</th>
                                    <th className={"table-column-hide-sm"}>Cost</th>
                                    <th>
                                        <span className={"table-column-hide-sm"}>Actions</span>
                                    </th>
                                </tr>
                                </thead>
                                <tbody>
                                <>
                                    {execs?.flatMap((exec, index) => {
                                        const isRoot = !exec.parent_execution_id;
                                        const showExpander = hierarchical && isRoot && exec.has_children;
                                        const isExpanded = expandedRoots.has(exec.id);
                                        const isLoading = loadingTrees.has(exec.id);

                                        const renderRow = (e: Execution, depth: number) => (
                                            <tr className={"flo-table-row" + (depth > 0 ? " flo-table-row--child" : "")} key={e.id}>
                                                <td>
                                                    <span className="exec-tree-indent" style={{ paddingLeft: depth * 20 }}>
                                                        {depth === 0 && hierarchical && e.has_children && (
                                                            <span
                                                                className="exec-tree-expander"
                                                                onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); toggleRoot(e.id); }}
                                                                title={isLoading ? "Loading…" : (expandedRoots.has(e.id) ? "Collapse" : "Expand")}
                                                            >
                                                                {isLoading ? "…" : (expandedRoots.has(e.id) ? "▼" : "▶")}
                                                            </span>
                                                        )}
                                                        {depth > 0 && (
                                                            <span className="exec-tree-rail" aria-hidden="true">└</span>
                                                        )}
                                                        {e.agent_id && (
                                                            <Icon name="robot" style={{ color: '#c084fc', fontSize: 12, marginRight: 6 }} data-tooltip-id={"tooltip-agent-" + e.id} data-tooltip-content="Agent execution" data-tooltip-place="bottom" />
                                                        )}
                                                        <Link to={"/execution/" + e.id} className={"flo-table-link"}>{e.name}</Link>
                                                        <span className={"table-column-hide-sm flo-table-subtext"}>{e.id}</span>
                                                        {e.parent_relationship && depth > 0 && (
                                                            <span className="exec-tree-rel" title={"Relationship: " + e.parent_relationship}>{e.parent_relationship}</span>
                                                        )}
                                                        {e.agent_id && <Tooltip id={"tooltip-agent-" + e.id} />}
                                                    </span>
                                                </td>
                                                <td className={"table-column-hide-sm flo-table-subdued"}>#{e.sequence}</td>
                                                <td className={"table-column-hide-sm flo-table-subdued"}>
                                                        <span data-tooltip-id={"tooltip-time-" + e.id} data-tooltip-content={formatDateString(e.created_at)} data-tooltip-place={"bottom"}>
                                                            {formatDate(e.created_at)}
                                                        </span>
                                                    <Tooltip id={"tooltip-time-" + e.id} />
                                                </td>
                                                <td className={"table-column-hide-sm flo-table-subdued"} style={{ textAlign: 'center' }}>
                                                    <span data-tooltip-id={"tooltip-trigger-" + e.id} data-tooltip-content={triggerLabel(e.trigger_type)} data-tooltip-place="bottom">
                                                        <Icon name={triggerIcon(e.trigger_type)} style={{ fontSize: 14, opacity: 0.6 }} />
                                                    </span>
                                                    <Tooltip id={"tooltip-trigger-" + e.id} />
                                                </td>
                                                <td className={"table-column-hide-sm flo-table-subdued"}>
                                                    {e.triggering_user_display_name ?? (e.triggering_user_id ? <span style={{fontFamily: 'monospace', fontSize: 11, opacity: 0.6}}>{e.triggering_user_id.slice(0, 8)}…</span> : '—')}
                                                </td>
                                                <td className={"table-column-hide-sm"}>
                                                    <Link to={{pathname: "/execution/" + e.id}}>
                                                        <ExecuteState state={e.execution_status} completionState={e.completion_status} />
                                                    </Link>
                                                </td>
                                                <td className={"table-column-hide-sm flo-table-subdued"}>
                                                    {e.completion_status === 'pending' && e.execution_status !== 'created'
                                                        ? <LiveDuration createdAt={e.created_at} formatter={friendlyDuration} />
                                                        : e.execution_status === 'created'
                                                            ? '—'
                                                            : friendlyDuration(effectiveDuration(e))}
                                                </td>
                                                <td className={"table-column-hide-sm flo-table-subdued"}>
                                                    {e.credit_cost_pence ? (
                                                        <span style={{color: "#fbbf24", fontWeight: 500}}>
                                                            £{(e.credit_cost_pence / 100).toFixed(2)}
                                                        </span>
                                                    ) : null}
                                                </td>
                                                <td>
                                                    <Link className={"table-button"} to={{pathname: "/execution/" + e.id}}>
                                                        <Icon name="eye" /> <span>View</span>
                                                    </Link>
                                                    <button className={"table-button"} disabled={true}>
                                                        <Icon name="circle-stop" /> <span>Stop</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );

                                        const rows: any[] = [ renderRow(exec, 0) ];
                                        if (showExpander && isExpanded) {
                                            for (const child of descendantsOf(exec.id)) {
                                                rows.push(renderRow(child, child.depth ?? 1));
                                            }
                                        }
                                        return rows;
                                    })}
                                </>
                                </tbody>
                            </table>
                            <PaginationControls totalCount={totalExecCount} onPageChange={handlePageChange} disableRightPagination={disableRightPagination}/>
                        </>
                    )}
                </>
            )}
            </ProtectedRoute>
        </Container>
    )
}