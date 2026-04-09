import type {Route} from "../+types/home";
import Container from "~/components/container";
import useConfig from "~/components/config";
import api from "~/lib/api";
import {useEffect, useState} from "react";
import type {Runner} from "~/types";
import {Tooltip} from "react-tooltip";
import SearchBar from "~/components/searchBar";
import {useSearchParams} from "react-router";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import useCookieToken from "~/components/cookie";
import "./index.css";
import { Icon } from "~/components/icons/Icon";

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
    const url = config("AUTOMATE_API_URL") + '/api/v1/runner';

    const [ runners, setRunners ] = useState<Runner[]>();
    const [ loading, setLoading ] = useState<boolean>(true);
    const [ search, setSearch ] = useState<string>(searchParams.get("search"));
    const [ copiedId, setCopiedId ] = useState<string | null>(null);

    const queryRunners = () => {
        setLoading(true);
        api.get(url, {
            signal: controller.signal,
            headers: { Authorization: "Bearer " + token }
        })
            .then(response => { if (response) setRunners(response.data); })
            .catch(error => console.error(error))
            .finally(() => setLoading(false));
    };

    useEffect(() => { queryRunners(); }, []);

    function handleUpdateSearch(term: string) {
        setSearch(term);
    }

    function formatDate(date?: string) {
        if (!date) return "";
        return dayjs.utc(date).fromNow();
    }

    function formatDateString(date?: string) {
        if (!date) return "Never";
        return dayjs.utc(date).local().format("D MMM YYYY H:mm:ss");
    }

    const copyRegCode = (id: string, code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <Container>
            <div className={"header"}>Runners</div>

            <SearchBar value={search} onChange={handleUpdateSearch} placeholder="Search runners..." disabled={true} />

            {loading && (
                <div className={"loading-container"}>
                    <Icon name="spinner" spin />
                </div>
            )}

            {!loading && runners && runners.length === 0 && (
                <div className="runners-empty">No runners registered</div>
            )}

            {!loading && runners && runners.length > 0 && (
                <div className="runners-list">
                    {runners.map(r => (
                        <div key={r.id} className={`runner-card ${r.state !== 'active' ? 'runner-card--inactive' : ''}`}>
                            <div className={`runner-card-indicator runner-card-indicator--${r.state === 'active' ? 'active' : 'inactive'}`} />
                            <div className="runner-card-info">
                                <div className="runner-card-name">
                                    <Icon name="server" className="runner-card-icon" />
                                    {r.name || 'Unnamed Runner'}
                                    {r.verified && (
                                        <Icon name="shield-halved" className="runner-card-verified" data-tooltip-id={`verified-${r.id}`} data-tooltip-content="Verified" data-tooltip-place="right" />
                                    )}
                                    {r.verified && <Tooltip id={`verified-${r.id}`} />}
                                </div>
                                <div className="runner-card-details">
                                    {r.ip_address && <span>{r.ip_address}</span>}
                                    {r.version && <span>v{r.version}</span>}
                                    {r.executor_version && <span>Executor v{r.executor_version}</span>}
                                </div>
                                <div className="runner-card-details">
                                    {r.enrolled_at && (
                                        <span data-tooltip-id={`enrolled-${r.id}`} data-tooltip-content={formatDateString(r.enrolled_at)} data-tooltip-place="bottom">
                                            Enrolled {formatDate(r.enrolled_at)}
                                        </span>
                                    )}
                                    {r.last_contact_at && (
                                        <span data-tooltip-id={`contact-${r.id}`} data-tooltip-content={formatDateString(r.last_contact_at)} data-tooltip-place="bottom">
                                            Last seen {formatDate(r.last_contact_at)}
                                        </span>
                                    )}
                                    <Tooltip id={`enrolled-${r.id}`} />
                                    <Tooltip id={`contact-${r.id}`} />
                                </div>
                            </div>
                            <div className="runner-card-meta">
                                <span className={`runner-card-badge runner-card-badge--${r.state === 'active' ? 'active' : 'inactive'}`}>
                                    {r.state === 'active' ? 'Active' : 'Inactive'}
                                </span>
                                {r.registration_code && (
                                    <button className="runner-card-copy" onClick={() => copyRegCode(r.id, r.registration_code!)} data-tooltip-id={`copy-${r.id}`} data-tooltip-content="Copy registration code" data-tooltip-place="left">
                                        <Icon name={copiedId === r.id? "check" : "copy"} />
                                        <Tooltip id={`copy-${r.id}`} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Container>
    );
}
