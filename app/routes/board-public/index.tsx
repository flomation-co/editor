import {useEffect, useState, useCallback} from "react";
import {useParams} from "react-router";
import api from "~/lib/api";
import useConfig from "~/components/config";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faSync, faSpinner} from "@fortawesome/free-solid-svg-icons";
import type {Dashboard, DashboardWidget, DashboardWidgetData} from "~/types";
import {WidgetRenderer} from "~/components/widgets";

import "../board-view/index.css";
import "./index.css";

const cfgFn = useConfig();
const API_URL = cfgFn("AUTOMATE_API_URL");

export function meta() {
    return [
        {title: "Flomation - Dashboard"},
        {name: "description", content: "Public dashboard"},
    ];
}

function PublicBoardGrid({widgets, widgetDataMap, columns}: {widgets: DashboardWidget[]; widgetDataMap: Record<string, DashboardWidgetData>; columns: number}) {
    const cols = columns || 12;
    return (
        <div className="board-grid-container" style={{gridTemplateColumns: `repeat(${cols}, 1fr)`}}>
            {widgets.map(w => {
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
                        </div>
                        <div className="widget-card-body">
                            <WidgetRenderer widget={w} widgetData={widgetDataMap[w.id]}/>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function PublicBoard() {
    const {slug} = useParams();

    const [board, setBoard] = useState<Dashboard | null>(null);
    const [widgetDataMap, setWidgetDataMap] = useState<Record<string, DashboardWidgetData>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [countdown, setCountdown] = useState(0);

    const fetchBoard = useCallback(() => {
        if (!slug) return;
        api.get(API_URL + "/api/v1/board/public/" + slug)
            .then(res => {
                setBoard(res.data);
                if (res.data?.widgets) {
                    const ws = res.data.widgets as DashboardWidget[];
                    const dataMap: Record<string, DashboardWidgetData> = {};
                    ws.forEach((w: DashboardWidget) => {
                        if (w.data) dataMap[w.id] = w.data;
                    });
                    setWidgetDataMap(dataMap);
                }
            })
            .catch(() => setError(true))
            .finally(() => setIsLoading(false));
    }, [slug]);

    const handleRefresh = useCallback(() => {
        if (!slug) return;
        setIsRefreshing(true);
        api.post(API_URL + "/api/v1/board/public/" + slug + "/refresh", {})
            .then(() => { setTimeout(() => { fetchBoard(); setIsRefreshing(false); }, 1500); })
            .catch(() => setIsRefreshing(false));
        if (board?.refresh_interval && board.refresh_interval > 0) setCountdown(board.refresh_interval);
    }, [slug, board, fetchBoard]);

    useEffect(() => { fetchBoard(); }, [fetchBoard]);

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
        return <div className="public-board"><div className="public-board-loading"><FontAwesomeIcon icon={faSpinner} spin/> Loading dashboard...</div></div>;
    }

    if (error || !board) {
        return (
            <div className="public-board">
                <div className="public-board-header"><img src="/flomation-logo.png" alt="Flomation" className="public-board-logo"/></div>
                <div className="public-board-error">
                    <div className="public-board-error-title">Dashboard not found</div>
                    <div className="public-board-error-desc">This dashboard does not exist or is no longer public.</div>
                </div>
                <div className="public-board-footer">Powered by <a href="https://www.flomation.co" target="_blank" rel="noopener noreferrer">Flomation</a></div>
            </div>
        );
    }

    return (
        <div className="public-board">
            <div className="public-board-header">
                <img src="/flomation-logo.png" alt="Flomation" className="public-board-logo"/>
                <div className="public-board-divider"/>
                <div className="public-board-title">{board.name}</div>
                <button className="public-board-refresh-btn" onClick={handleRefresh} disabled={isRefreshing}>
                    <FontAwesomeIcon icon={faSync} spin={isRefreshing}/> Refresh
                </button>
                {board.refresh_interval > 0 && countdown > 0 && <span className="public-board-countdown">{countdown}s</span>}
            </div>

            <div className="public-board-body">
                {widgets.length > 0 ? (
                    <PublicBoardGrid widgets={widgets} widgetDataMap={widgetDataMap} columns={board.layout_columns || 12}/>
                ) : (
                    <div className="public-board-loading" style={{opacity: 0.4}}>This dashboard has no widgets yet.</div>
                )}
            </div>

            <div className="public-board-footer">Powered by <a href="https://www.flomation.co" target="_blank" rel="noopener noreferrer">Flomation</a></div>
        </div>
    );
}
