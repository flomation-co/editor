import "./index.css"
import { useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight, faChevronDown } from "@fortawesome/pro-solid-svg-icons";

type LogEntry = {
    time?: string;
    level?: string;
    msg?: string;
    error?: string;
    [key: string]: any;
};

type LogOutputProps = {
    logs?: any;
    streamingLines?: string[];
};

const SEVERITY_ORDER: Record<string, number> = {
    fatal: 0,
    panic: 0,
    error: 1,
    warning: 2,
    warn: 2,
    info: 3,
    debug: 4,
    trace: 5,
};

const HIDDEN_KEYS = new Set(['time', 'level', 'msg']);

function parseLine(line: string): LogEntry | null {
    if (!line || !line.trim()) return null;
    if (line.startsWith('__NODE__:')) return null;
    if (line.startsWith('__STATUS__:')) return null;
    try {
        return JSON.parse(line);
    } catch {
        return { msg: line, level: 'info' };
    }
}

function parseLogString(logStr: string): LogEntry[] {
    if (!logStr) return [];
    return logStr.split('\n')
        .map(parseLine)
        .filter((e): e is LogEntry => e !== null);
}

function formatTimestamp(time?: string): string {
    if (!time) return '';
    try {
        const d = new Date(time);
        return d.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3,
        });
    } catch {
        return time;
    }
}

function ObjectTree({ data, depth = 0 }: { data: any; depth?: number }) {
    const [expanded, setExpanded] = useState(depth < 1);

    if (data === null || data === undefined) {
        return <span className="log-val log-val--null">null</span>;
    }

    if (typeof data === 'boolean') {
        return <span className="log-val log-val--bool">{data.toString()}</span>;
    }

    if (typeof data === 'number') {
        return <span className="log-val log-val--number">{data}</span>;
    }

    if (typeof data === 'string') {
        if (data.length > 200 && depth > 0) {
            return <span className="log-val log-val--string">"{data.slice(0, 197)}..."</span>;
        }
        return <span className="log-val log-val--string">"{data}"</span>;
    }

    if (Array.isArray(data)) {
        if (data.length === 0) return <span className="log-val log-val--bracket">[]</span>;
        return (
            <span className="log-object-tree">
                <span className="log-toggle-icon" onClick={() => setExpanded(!expanded)}>
                    <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} />
                </span>
                <span className="log-val log-val--bracket" onClick={() => setExpanded(!expanded)}>
                    Array[{data.length}]
                </span>
                {expanded && (
                    <div className="log-object-children">
                        {data.map((item, i) => (
                            <div key={i} className="log-object-entry">
                                <span className="log-object-key">{i}</span>
                                <span className="log-object-sep">: </span>
                                <ObjectTree data={item} depth={depth + 1} />
                            </div>
                        ))}
                    </div>
                )}
            </span>
        );
    }

    if (typeof data === 'object') {
        const keys = Object.keys(data);
        if (keys.length === 0) return <span className="log-val log-val--bracket">{'{}'}</span>;
        return (
            <span className="log-object-tree">
                <span className="log-toggle-icon" onClick={() => setExpanded(!expanded)}>
                    <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} />
                </span>
                <span className="log-val log-val--bracket" onClick={() => setExpanded(!expanded)}>
                    {'{'}...{'}'}  <span className="log-object-count">{keys.length} keys</span>
                </span>
                {expanded && (
                    <div className="log-object-children">
                        {keys.map(k => (
                            <div key={k} className="log-object-entry">
                                <span className="log-object-key">{k}</span>
                                <span className="log-object-sep">: </span>
                                <ObjectTree data={data[k]} depth={depth + 1} />
                            </div>
                        ))}
                    </div>
                )}
            </span>
        );
    }

    return <span className="log-val">{String(data)}</span>;
}

function LogEntryRow({ entry }: { entry: LogEntry }) {
    const [expanded, setExpanded] = useState(false);

    const level = (entry.level || 'info').toLowerCase();
    const extraKeys = Object.keys(entry).filter(k => !HIDDEN_KEYS.has(k) && k !== 'error');
    const hasExtra = extraKeys.length > 0 || (entry.error && entry.error.length > 60);

    return (
        <div className={`log-entry log-entry--${level}`}>
            <div className="log-entry-main" onClick={() => hasExtra && setExpanded(!expanded)}>
                <span className="log-entry-time">{formatTimestamp(entry.time)}</span>
                <span className={`log-entry-level log-entry-level--${level}`}>{level.toUpperCase()}</span>
                <span className="log-entry-msg">{entry.msg}</span>
                {entry.error && (
                    <span className="log-entry-error"> {entry.error}</span>
                )}
                {hasExtra && (
                    <span className="log-entry-expand">
                        <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} />
                    </span>
                )}
            </div>
            {expanded && (
                <div className="log-entry-detail">
                    {extraKeys.map(k => (
                        <div key={k} className="log-entry-field">
                            <span className="log-entry-field-key">{k}</span>
                            <span className="log-entry-field-sep">: </span>
                            {typeof entry[k] === 'object' && entry[k] !== null ? (
                                <ObjectTree data={entry[k]} depth={0} />
                            ) : (
                                <span className={`log-val log-val--${typeof entry[k]}`}>{String(entry[k])}</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function LogOutput({ logs, streamingLines }: LogOutputProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const [filter, setFilter] = useState<string>('');
    const [minLevel, setMinLevel] = useState<string>('debug');

    // Parse completed execution logs
    const completedEntries = useMemo<LogEntry[]>(() => {
        if (!logs?.logs) return [];
        return parseLogString(logs.logs);
    }, [logs?.logs]);

    // Parse streaming logs
    const streamingEntries = useMemo<LogEntry[]>(() => {
        if (!streamingLines || streamingLines.length === 0) return [];
        return streamingLines
            .map(parseLine)
            .filter((e): e is LogEntry => e !== null);
    }, [streamingLines]);

    // Merge and sort
    const allEntries = useMemo(() => {
        const entries = completedEntries.length > 0 ? completedEntries : streamingEntries;

        return entries
            .filter(e => {
                const level = (e.level || 'info').toLowerCase();
                if ((SEVERITY_ORDER[level] ?? 3) > (SEVERITY_ORDER[minLevel] ?? 4)) return false;
                if (filter) {
                    const search = filter.toLowerCase();
                    const msg = (e.msg || '').toLowerCase();
                    const err = (e.error || '').toLowerCase();
                    if (!msg.includes(search) && !err.includes(search)) return false;
                }
                return true;
            })
            .sort((a, b) => {
                if (!a.time || !b.time) return 0;
                return a.time.localeCompare(b.time);
            });
    }, [completedEntries, streamingEntries, filter, minLevel]);

    // Auto-scroll to bottom on new entries
    useEffect(() => {
        if (autoScroll && containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [allEntries.length, autoScroll]);

    const handleScroll = () => {
        if (!containerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
    };

    return (
        <div className="log-viewer">
            <div className="log-viewer-toolbar">
                <input
                    type="text"
                    className="log-viewer-search"
                    placeholder="Filter logs..."
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                />
                <select
                    className="log-viewer-level-select"
                    value={minLevel}
                    onChange={e => setMinLevel(e.target.value)}
                >
                    <option value="trace">All</option>
                    <option value="debug">Debug+</option>
                    <option value="info">Info+</option>
                    <option value="warning">Warn+</option>
                    <option value="error">Error+</option>
                </select>
                <span className="log-viewer-count">{allEntries.length} entries</span>
            </div>
            <div
                className="log-viewer-entries"
                ref={containerRef}
                onScroll={handleScroll}
            >
                {allEntries.length === 0 && (
                    <div className="log-viewer-empty">No log entries{filter ? ' matching filter' : ''}</div>
                )}
                {allEntries.map((entry, i) => (
                    <LogEntryRow key={i} entry={entry} />
                ))}
            </div>
        </div>
    );
}
