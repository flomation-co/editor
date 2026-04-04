import {useEffect, useState, useCallback, useRef} from "react";
import {useParams, useNavigate} from "react-router";
import Container from "~/components/container";
import api from "~/lib/api";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import {useToast} from "~/components/toast";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faSync, faPencil, faGrip, faSpinner, faCopy} from "@fortawesome/free-solid-svg-icons";
import type {Dashboard, DashboardWidget, DashboardWidgetData} from "~/types";
import {WidgetRenderer} from "~/components/widgets";
import "./index.css";

const config = useConfig();
const API_URL = config("AUTOMATE_API_URL");

function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 5) return "just now";
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleTimeString();
}

const TIME_RANGES = [
    {value: "1h", label: "Last 1 hour"},
    {value: "6h", label: "Last 6 hours"},
    {value: "24h", label: "Last 24 hours"},
    {value: "7d", label: "Last 7 days"},
    {value: "30d", label: "Last 30 days"},
];

export function meta() {
    return [
        {title: "Flomation - Dashboard"},
        {name: "description", content: "View dashboard"},
    ];
}

function BoardGrid({widgets, widgetDataMap, columns}: {widgets: DashboardWidget[]; widgetDataMap: Record<string, DashboardWidgetData>; columns: number}) {
    const cols = columns || 12;
    return (
        <div className="board-grid-container" style={{gridTemplateColumns: `repeat(${cols}, 1fr)`}}>
            {widgets.map(w => {
                const wd = widgetDataMap[w.id];
                const isRefreshing = wd && (wd.status === "pending" || wd.status === "running");
                const colSpan = Math.min(w.grid_w || 4, cols);
                const rowSpan = w.grid_h || 3;
                return (
                    <div
                        key={w.id}
                        className="widget-card"
                        style={{gridColumn: `span ${colSpan}`, gridRow: `span ${rowSpan}`}}
                    >
                        <div className="widget-card-header">
                            <div className="widget-card-title">{w.title}</div>
                            {isRefreshing && (
                                <FontAwesomeIcon icon={faSpinner} spin className="widget-refresh-indicator"/>
                            )}
                        </div>
                        <div className="widget-card-body">
                            <WidgetRenderer widget={w} widgetData={wd}/>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function BoardView() {
    const {id} = useParams();
    const navigate = useNavigate();
    const token = useCookieToken();
    const {showToast} = useToast();

    const [board, setBoard] = useState<Dashboard | null>(null);
    const [widgetDataMap, setWidgetDataMap] = useState<Record<string, DashboardWidgetData>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [timeRange, setTimeRange] = useState("24h");
    const [countdown, setCountdown] = useState(0);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
    const [refreshCycle, setRefreshCycle] = useState(0);

    const fetchBoard = useCallback(() => {
        if (!id || !token) return;
        api.get(API_URL + "/api/v1/board/" + id, {
            headers: {Authorization: "Bearer " + token}
        })
            .then(res => {
                setBoard(res.data);
                if (res.data?.widgets) {
                    fetchAllWidgetData(res.data.widgets);
                }
            })
            .catch(() => showToast("Failed to load dashboard", "error"))
            .finally(() => setIsLoading(false));
    }, [id, token]);

    const fetchAllWidgetData = useCallback((widgets: DashboardWidget[]) => {
        if (!id || !token) return;
        widgets.forEach(w => {
            api.get(API_URL + "/api/v1/board/" + id + "/widget/" + w.id + "/data", {
                headers: {Authorization: "Bearer " + token}
            })
                .then(res => {
                    setWidgetDataMap(prev => ({...prev, [w.id]: res.data}));
                    if (res.data?.fetched_at) {
                        setLastUpdatedAt(new Date(res.data.fetched_at));
                    }
                })
                .catch(() => {});
        });
    }, [id, token]);

    const pollWidgetData = useCallback((widgets: DashboardWidget[], attempt = 0) => {
        if (!id || !token || attempt > 30) { setIsRefreshing(false); return; }
        const flowWidgets = widgets.filter(w => w.flo_id);
        if (flowWidgets.length === 0) { setIsRefreshing(false); return; }

        Promise.all(
            flowWidgets.map(w =>
                api.get(API_URL + "/api/v1/board/" + id + "/widget/" + w.id + "/data", {
                    headers: {Authorization: "Bearer " + token}
                }).then(res => ({widgetId: w.id, data: res.data}))
                  .catch(() => ({widgetId: w.id, data: null}))
            )
        ).then(results => {
            let allDone = true;
            for (const r of results) {
                if (r.data) {
                    setWidgetDataMap(prev => {
                        const existing = prev[r.widgetId];
                        const merged = {...r.data};
                        if (!merged.data && existing?.data) merged.data = existing.data;
                        return {...prev, [r.widgetId]: merged};
                    });
                    if (r.data.status === "pending" || r.data.status === "running") allDone = false;
                }
            }
            if (!allDone) {
                setTimeout(() => pollWidgetData(widgets, attempt + 1), 2000);
            } else {
                setIsRefreshing(false);
                setLastUpdatedAt(new Date());
                setRefreshCycle(c => c + 1);
            }
        });
    }, [id, token]);

    const handleRefresh = useCallback(() => {
        if (!id || !token) return;
        setIsRefreshing(true);
        api.post(API_URL + "/api/v1/board/" + id + "/refresh", {time_range: timeRange}, {
            headers: {Authorization: "Bearer " + token}
        })
            .then(() => {
                if (board?.widgets) setTimeout(() => pollWidgetData(board.widgets), 1000);
                else setIsRefreshing(false);
            })
            .catch(() => { showToast("Failed to refresh dashboard", "error"); setIsRefreshing(false); });

        if (board?.refresh_interval && board.refresh_interval > 0) setCountdown(board.refresh_interval);
    }, [id, token, board, timeRange, pollWidgetData]);

    const handleCopyPublicLink = () => {
        if (board?.public_slug) {
            navigator.clipboard.writeText(window.location.origin + "/public/board/" + board.public_slug)
                .then(() => showToast("Public link copied to clipboard", "success"));
        }
    };

    useEffect(() => { fetchBoard(); }, [fetchBoard]);

    const hasTriggeredInitialRef = useRef(false);
    useEffect(() => {
        if (!board?.widgets || hasTriggeredInitialRef.current) return;
        const hasFlowWidgets = board.widgets.some(w => w.flo_id);
        const hasCachedData = board.widgets.some(w => w.data?.data);
        if (hasFlowWidgets && !hasCachedData) { hasTriggeredInitialRef.current = true; handleRefresh(); }
    }, [board?.widgets, handleRefresh]);

    // Refresh when time range changes (skip the initial render)
    const prevTimeRange = useRef(timeRange);
    useEffect(() => {
        if (prevTimeRange.current === timeRange) return;
        prevTimeRange.current = timeRange;
        if (board?.widgets?.some(w => w.flo_id)) handleRefresh();
    }, [timeRange, board?.widgets, handleRefresh]);

    const [, setTick] = useState(0);
    useEffect(() => {
        if (!lastUpdatedAt) return;
        const t = setInterval(() => setTick(v => v + 1), 10000);
        return () => clearInterval(t);
    }, [lastUpdatedAt]);

    useEffect(() => {
        if (!board || !board.refresh_interval || board.refresh_interval <= 0) return;
        setCountdown(board.refresh_interval);
        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) { handleRefresh(); return board.refresh_interval; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [board?.refresh_interval, handleRefresh]);

    const widgets = board?.widgets || [];

    if (isLoading) {
        return <Container><div className="widget-loading" style={{padding: 80}}><FontAwesomeIcon icon={faSpinner} className="widget-loading-spinner" style={{marginRight: 8}}/>Loading dashboard...</div></Container>;
    }

    if (!board) {
        return <Container><div className="board-empty"><div className="board-empty-title">Dashboard not found</div><div className="board-empty-description">The dashboard you are looking for does not exist or has been archived.</div></div></Container>;
    }

    return (
        <Container>
            <div className="board-view-topbar">
                <div className="board-view-title">{board.name}</div>
                <div className="board-view-controls">
                    {lastUpdatedAt && <span className="board-view-last-updated">Updated {formatTimeAgo(lastUpdatedAt)}</span>}
                    <select className="board-view-select" value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
                        {TIME_RANGES.map(tr => <option key={tr.value} value={tr.value}>{tr.label}</option>)}
                    </select>
                    <button className="board-view-btn" onClick={handleRefresh} disabled={isRefreshing}>
                        <FontAwesomeIcon icon={faSync} spin={isRefreshing}/> Refresh
                    </button>
                    {board.is_public && board.public_slug && (
                        <button className="board-view-btn" onClick={handleCopyPublicLink} title="Copy public link"><FontAwesomeIcon icon={faCopy}/> Share</button>
                    )}
                    <button className="board-view-btn board-view-btn--primary" onClick={() => navigate("/board/" + id + "/edit")}>
                        <FontAwesomeIcon icon={faPencil}/> Edit
                    </button>
                </div>
            </div>

            {board.refresh_interval > 0 && (
                <div key={refreshCycle} className="board-refresh-bar" style={{'--refresh-duration': `${board.refresh_interval * 1000}ms`} as React.CSSProperties}/>
            )}

            {widgets.length === 0 && (
                <div className="board-empty">
                    <div className="board-empty-icon"><FontAwesomeIcon icon={faGrip}/></div>
                    <div className="board-empty-title">No widgets yet</div>
                    <div className="board-empty-description">Edit this dashboard to add widgets and visualise your flow data.</div>
                    <button className="board-view-btn board-view-btn--primary" onClick={() => navigate("/board/" + id + "/edit")}>
                        <FontAwesomeIcon icon={faPencil}/> Add Widgets
                    </button>
                </div>
            )}

            {widgets.length > 0 && (
                <BoardGrid widgets={widgets} widgetDataMap={widgetDataMap} columns={board.layout_columns || 12}/>
            )}
        </Container>
    );
}
