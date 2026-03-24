import type {Route} from "../+types/home";
import Container from "~/components/container";
import "./index.css"
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faSpinner, faTrash} from "@fortawesome/free-solid-svg-icons";
import {faCancel, faCheck, faWarning, faWifi} from "@fortawesome/pro-solid-svg-icons";
import {useEffect, useState} from "react";
import useConfig from "~/components/config";
import api from "~/lib/api";
import useCookieToken from "~/components/cookie";
import type {Trigger} from "~/types";
import {useSearchParams} from "react-router";
import {Tooltip} from "react-tooltip";
import SearchBar from "~/components/searchBar";

const TRIGGER_TYPES = [
    {value: "manual", label: "Manual"},
    {value: "webhook", label: "Webhook"},
    {value: "schedule", label: "Schedule"},
    {value: "qr", label: "QR Code"},
    {value: "image", label: "Image"},
    {value: "email", label: "Email"},
    {value: "telegram", label: "Telegram"},
    {value: "form", label: "Form"},
    {value: "git-poll", label: "Git Poll"},
];

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Triggers" },
        { name: "description", content: "Get in the Flo" },
    ];
}

export default function Triggers() {
    const [ searchParams, setSearchParams ] = useSearchParams();

    const [ isLoading, setIsLoading ] = useState<boolean>(true);
    const [ triggers, setTriggers ] = useState<Trigger[]>();
    const [ search, setSearch ] = useState<string>(searchParams.get("search"));

    const [ hasInputRow, setHasInputRow ] = useState<boolean>(false);
    const [ inputTriggerName, setInputTriggerName ] = useState<string>("");
    const [ inputTriggerType, setInputTriggerType ] = useState<string>("manual");
    const [ confirmDeletionID, setConfirmDeletionID ] = useState<string>(null);

    const controller = new AbortController();
    const token = useCookieToken();

    function handleUpdateSearch(term: string) {
        setSearch(term);
    }

    const loadTriggers = () => {
        const config = useConfig();
        let url = config("AUTOMATE_API_URL") + '/api/v1/trigger';

        api.get(url, {
            signal: controller.signal,
            headers: {
                "Authorization": "Bearer " + token,
            }
        })
            .then(response => {
                if (response) {
                    setTriggers(response.data);
                }
            })
            .catch(error => {
                if (error.response && error.response.status === 204) {
                    setTriggers([]);
                } else {
                    console.error(error);
                }
            })
            .finally(() => {
                setIsLoading(false);
            })
    }

    useEffect(() => {
        loadTriggers();
    }, []);

    useEffect(() => {
        if (confirmDeletionID) {
            const interval = setInterval(() => {
                setConfirmDeletionID(null);
            }, 2500);

            return () => clearInterval(interval);
        }
    }, [ confirmDeletionID ]);

    const changeTriggerName = (e) => {
        setInputTriggerName(e.target.value);
    }

    const changeTriggerType = (e) => {
        setInputTriggerType(e.target.value);
    }

    const confirmDeleteTrigger = (id: string | null) => {
        setConfirmDeletionID(id);
    }

    const deleteTrigger = (id: string) => {
        const config = useConfig();
        let url = config("AUTOMATE_API_URL") + '/api/v1/trigger/' + id;

        api.delete(url, {
            signal: controller.signal,
            headers: {
                "Authorization": "Bearer " + token,
            }
        })
            .then(response => {
                if (response) {
                    loadTriggers();
                }
            })
            .catch(error => {
                console.error(error);
            })
    }

    const saveTrigger = () => {
        if (inputTriggerName.length < 3) {
            return;
        }

        setHasInputRow(false);
        const config = useConfig();
        let url = config("AUTOMATE_API_URL") + '/api/v1/trigger';

        api.post(url, {
            name: inputTriggerName,
            type_name: inputTriggerType,
        }, {
            signal: controller.signal,
            headers: {
                "Authorization": "Bearer " + token,
            }
        })
            .then(response => {
                if (response) {
                    loadTriggers();
                }
            })
            .catch(error => {
                console.error(error);
            })
    }

    const showInputRow = (value: boolean) => {
        if (value) {
            setInputTriggerName("");
            setInputTriggerType("manual");
        }

        setHasInputRow(value);
    }

    const getTypeLabelForTrigger = (trigger: Trigger): string => {
        const typeName = trigger.type_name || "";
        const found = TRIGGER_TYPES.find(t => t.value === typeName);
        return found ? found.label : typeName;
    }

    const formatDate = (dateStr?: string): string => {
        if (!dateStr) return "—";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-GB", {day: "numeric", month: "short", year: "numeric"});
    }

    return (
        <Container>
            <div className={"header"}>Triggers</div>

            <SearchBar value={search} onChange={handleUpdateSearch} placeholder="Search triggers..." disabled={true} />

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
                            <th className={"table-column-hide-sm"}>Type</th>
                            <th className={"table-column-hide-sm"}>Created</th>
                            <th className={"table-column-small-col"}>
                                <span className={"table-column-hide-sm"}>Actions</span>
                            </th>
                        </tr>
                        </thead>
                        {(!triggers || triggers.length === 0) && (
                            <tbody>
                            {!hasInputRow && (
                                <tr className={"flo-table-row"} >
                                    <td colSpan={4} className={"table-row-center"}>
                                        <button className={"table-button"} onClick={() => showInputRow(true)}><FontAwesomeIcon icon={faWifi} /> Create your first Trigger</button>
                                    </td>
                                </tr>
                            )}
                            {hasInputRow && (
                                <tr className={"flo-table-row"} >
                                    <td>
                                        <input type={"text"} placeholder={"Trigger name..."} autoFocus={true} value={inputTriggerName} onChange={changeTriggerName} />
                                    </td>
                                    <td>
                                        <select value={inputTriggerType} onChange={changeTriggerType}>
                                            {TRIGGER_TYPES.map(t => (
                                                <option key={t.value} value={t.value}>{t.label}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td></td>
                                    <td className={"table-column-small-col"}>
                                        <button className={"table-button"} onClick={() => saveTrigger()}>
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
                        {triggers && triggers.length > 0 && (
                            <tbody>
                            <>
                                {triggers.map((trigger) => {
                                    return (
                                        <tr className={"flo-table-row"} key={trigger.id}>
                                            <td>{trigger.name}<span className={"table-column-hide-sm flo-table-subtext"}>{trigger.id}</span></td>
                                            <td className={"table-column-hide-sm"}>{getTypeLabelForTrigger(trigger)}</td>
                                            <td className={"table-column-hide-sm"}>{formatDate(trigger.created_at)}</td>
                                            <td>
                                                <button className={(confirmDeletionID != null && confirmDeletionID == trigger.id) ? "hidden" : "table-button"} onClick={() => {confirmDeleteTrigger(trigger.id)}}>
                                                    <FontAwesomeIcon icon={faTrash} /> <span>Delete</span>
                                                </button>
                                                <button className={confirmDeletionID == trigger.id ? "table-button table-button-red" : "hidden"} autoFocus={true} onClick={() => deleteTrigger(trigger.id)}>
                                                    <FontAwesomeIcon icon={faWarning} /> <span>Confirm</span>
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                                {!hasInputRow && (
                                    <tr className={"flo-table-row"} >
                                        <td colSpan={4} className={"table-row-center"}>
                                            <button className={"table-button"} onClick={() => showInputRow(true)}>
                                                <FontAwesomeIcon icon={faWifi} /> Create new Trigger
                                            </button>
                                        </td>
                                    </tr>
                                )}
                                {hasInputRow && (
                                    <tr className={"flo-table-row"} >
                                        <td>
                                            <input type={"text"} placeholder={"Trigger name..."} autoFocus={true} value={inputTriggerName} onChange={changeTriggerName} />
                                        </td>
                                        <td>
                                            <select value={inputTriggerType} onChange={changeTriggerType}>
                                                {TRIGGER_TYPES.map(t => (
                                                    <option key={t.value} value={t.value}>{t.label}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td></td>
                                        <td className={"table-column-small-col"}>
                                            <button className={"table-button"} onClick={() => saveTrigger()}>
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
