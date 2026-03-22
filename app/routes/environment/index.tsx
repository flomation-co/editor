import type {Route} from "../+types/home";
import Container from "~/components/container";
import type {Environment, Property, Secret} from "~/types";
import {useEffect, useState} from "react";
import {Link, useParams, useSearchParams} from "react-router";
import api from "~/lib/api";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import {Tooltip} from "react-tooltip";
import ReactCountryFlag from "react-country-flag";
import {ExecuteState} from "~/components/executionState";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCircleStop, faPencil, faTrash} from "@fortawesome/free-solid-svg-icons";
import {faCancel, faCheck, faGlobe, faPlus} from "@fortawesome/pro-solid-svg-icons";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Environment" },
        { name: "description", content: "Get in the Flo" },
    ];
}

export default function Environment() {
    const [ searchParams, setSearchParams ] = useSearchParams();

    const [ environmentID, setEnvironmentID ] = useState<string>(useParams().id)
    const [ environment, setEnvironment ] = useState<Environment>();
    const [ properties, setProperties ] = useState<Property[]>();
    const [ secrets, setSecrets ] = useState<Secret[]>();
    const [ search, setSearch ] = useState<string>(searchParams.get("search"))

    const [ hasInputRow, setHasInputRow ] = useState<boolean>(false);
    const [ inputEnvironmentPropertyName, setInputEnvironmentPropertyName ] = useState<string>("");
    const [ inputEnvironmentPropertyValue, setInputEnvironmentPropertyValue ] = useState<string>("");

    const [ hasSecretInputRow, setHasSecretInputRow ] = useState<boolean>(false);
    const [ inputEnvironmentSecretName, setInputEnvironmentSecretName ] = useState<string>("");
    const [ inputEnvironmentSecretValue, setInputEnvironmentSecretValue ] = useState<string>("");

    const [ confirmDeletionID, setConfirmDeletionID ] = useState<string>(null);

    const [ editingPropertyID, setEditingPropertyID ] = useState<string | null>(null);
    const [ editingPropertyValue, setEditingPropertyValue ] = useState<string>("");

    const [ editingSecretID, setEditingSecretID ] = useState<string | null>(null);
    const [ editingSecretValue, setEditingSecretValue ] = useState<string>("");

    const controller = new AbortController();
    const token = useCookieToken();

    function handleUpdateSearch(term) {
        setSearch(term);
    }

    const showInputRow = (value: boolean) => {
        if (value) {
            setInputEnvironmentPropertyName("");
            setInputEnvironmentPropertyValue("");
        }

        setHasInputRow(value);
    }

    const changeEnvironmentPropertyName = (e) => {
        setInputEnvironmentPropertyName(e.target.value);
    }

    const changeEnvironmentPropertyValue = (e) => {
        setInputEnvironmentPropertyValue(e.target.value);
    }

    const showSecretInputRow = (value: boolean) => {
        if (value) {
            setInputEnvironmentSecretName("");
            setInputEnvironmentSecretValue("");
        }

        setHasSecretInputRow(value);
    }

    const changeEnvironmentSecretName = (e) => {
        setInputEnvironmentSecretName(e.target.value);
    }

    const changeEnvironmentSecretValue = (e) => {
        setInputEnvironmentSecretValue(e.target.value);
    }

    useEffect(() => {
        const config = useConfig();
        let url = config("AUTOMATE_API_URL") + '/api/v1/environment/' + environmentID;

        api.get(url, {
            signal: controller.signal,
            headers: {
                Authorization: "Bearer " + token,
            }
        })
            .then(response => {
                if (response) {
                    setEnvironment(response.data);
                }
            })
            .catch(error => {
                console.error(error);
            })
    }, []);

    const updateProperties = () => {
        const config = useConfig();
        let url = config("AUTOMATE_API_URL") + '/api/v1/environment/' + environmentID + '/property';

        api.get(url, {
            signal: controller.signal,
            headers: {
                Authorization: "Bearer " + token,
            }
        })
            .then(response => {
                if (response) {
                    setProperties(response.data);
                }
            })
            .catch(error => {
                console.error(error);
            })
    }

    const updateSecrets = () => {
        const config = useConfig();
        let url = config("AUTOMATE_API_URL") + '/api/v1/environment/' + environmentID + '/secret';

        api.get(url, {
            signal: controller.signal,
            headers: {
                Authorization: "Bearer " + token,
            }
        })
            .then(response => {
                if (response) {
                    setSecrets(response.data);
                }
            })
            .catch(error => {
                console.error(error);
            })
    }

    useEffect(() => {
        updateProperties();
    }, []);

    useEffect(() => {
        updateSecrets();
    }, []);

    const saveProperty = () => {
        const config = useConfig();
        const url = config("AUTOMATE_API_URL") + '/api/v1/environment/' + environmentID + '/property';
        const property = {
            name: inputEnvironmentPropertyName,
            value: inputEnvironmentPropertyValue,
        }

        api.post(url, property, {
            signal: controller.signal,
            headers: {
                Authorization: "Bearer " + token,
            }
        })
            .then(response => {
                if (response) {
                    showInputRow(false);
                    updateProperties();
                }
            })
            .catch(error => {
                console.error(error);
            })
    }
    const saveSecret = () => {
        const config = useConfig();
        const url = config("AUTOMATE_API_URL") + '/api/v1/environment/' + environmentID + '/secret';
        const property = {
            name: inputEnvironmentSecretName,
            value: inputEnvironmentSecretValue,
        }

        api.post(url, property, {
            signal: controller.signal,
            headers: {
                Authorization: "Bearer " + token,
            }
        })
            .then(response => {
                if (response) {
                    showSecretInputRow(false);
                    updateSecrets();
                }
            })
            .catch(error => {
                console.error(error);
            })
    }

    const deleteProperty = (id) => {
        showInputRow(false);
        const config = useConfig();
        const url = config("AUTOMATE_API_URL") + '/api/v1/environment/' + environmentID + '/property/' + id;

        api.delete(url, {
            signal: controller.signal,
            headers: {
                Authorization: "Bearer " + token,
            }
        })
            .then(response => {
                if (response) {
                    updateProperties();
                }
            })
            .catch(error => {
                console.error(error);
            })
    }

    const deleteSecret = (id) => {
        showSecretInputRow(false);
        const config = useConfig();
        const url = config("AUTOMATE_API_URL") + '/api/v1/environment/' + environmentID + '/secret/' + id;

        api.delete(url, {
            signal: controller.signal,
            headers: {
                Authorization: "Bearer " + token,
            }
        })
            .then(response => {
                if (response) {
                    updateSecrets();
                }
            })
            .catch(error => {
                console.error(error);
            })
    }

    const startEditProperty = (prop) => {
        setEditingPropertyID(prop.id);
        setEditingPropertyValue(prop.value);
    }

    const cancelEditProperty = () => {
        setEditingPropertyID(null);
        setEditingPropertyValue("");
    }

    const saveEditProperty = () => {
        if (!editingPropertyID) return;
        const config = useConfig();
        const url = config("AUTOMATE_API_URL") + '/api/v1/environment/' + environmentID + '/property/' + editingPropertyID;

        api.post(url, { value: editingPropertyValue }, {
            headers: { Authorization: "Bearer " + token }
        })
            .then(() => { cancelEditProperty(); updateProperties(); })
            .catch(error => console.error(error));
    }

    const startEditSecret = (secret) => {
        setEditingSecretID(secret.id);
        setEditingSecretValue("");
    }

    const cancelEditSecret = () => {
        setEditingSecretID(null);
        setEditingSecretValue("");
    }

    const saveEditSecret = () => {
        if (!editingSecretID) return;
        const config = useConfig();
        const url = config("AUTOMATE_API_URL") + '/api/v1/environment/' + environmentID + '/secret/' + editingSecretID;

        api.post(url, { value: editingSecretValue }, {
            headers: { Authorization: "Bearer " + token }
        })
            .then(() => { cancelEditSecret(); updateSecrets(); })
            .catch(error => console.error(error));
    }

    return (
        <Container>
            <div className={"header"}>Environment</div>

            <div className={"search-section"}>
                <input disabled={true} type={"text"} className={"search-textbox"} placeholder={"Search..."} onChange={(e) => handleUpdateSearch(e.target.value)} value={search || ''} data-tooltip-id={"search"} data-tooltip-content={"Search for Environment Property by Name or ID"} data-tooltip-place={"bottom-start"}/>
                <Tooltip id={"search"} />
            </div>

            <div className={"table-spacer"}></div>
            <div className={"header"}>Properties</div>

            <div className={"table-spacer"}></div>
            <table className={"flo-table"}>
                <thead className={"flo-table-head"}>
                <tr>
                    <th>Name</th>
                    <th className={"table-column-hide-sm"}>Value</th>
                    <th>
                        <span className={"table-column-hide-sm"}>Actions</span>
                    </th>
                </tr>
                </thead>
                <tbody>
                <>
                    {properties && properties?.map((prop, index) => {
                        const isEditing = editingPropertyID === prop.id;
                        return (
                            <tr className={"flo-table-row"} key={prop.id}>
                                <td>{prop.name}<span className={"table-column-hide-sm flo-table-subtext"}>{prop.id}</span></td>
                                <td className={"table-column-hide-sm"}>
                                    {isEditing ? (
                                        <textarea value={editingPropertyValue} onChange={(e) => setEditingPropertyValue(e.target.value)} rows={3} autoFocus />
                                    ) : (
                                        prop.value
                                    )}
                                </td>
                                <td>
                                    {isEditing ? (
                                        <>
                                            <button className={"table-button"} onClick={saveEditProperty}>
                                                <FontAwesomeIcon icon={faCheck}/> <span>Save</span>
                                            </button>
                                            <button className={"table-button"} onClick={cancelEditProperty}>
                                                <FontAwesomeIcon icon={faCancel}/> <span>Cancel</span>
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button className={"table-button"} onClick={() => startEditProperty(prop)}>
                                                <FontAwesomeIcon icon={faPencil}/> <span>Edit</span>
                                            </button>
                                            <button className={"table-button"} onClick={() => deleteProperty(prop.id)}>
                                                <FontAwesomeIcon icon={faTrash}/> <span>Delete</span>
                                            </button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        )
                    })}
                    {!hasInputRow && (
                        <tr className={"flo-table-row"} >
                            <td colSpan={3} className={"table-row-center"}>
                                <button className={"table-button"} onClick={() => showInputRow(true)}>
                                    <FontAwesomeIcon icon={faPlus} /> Create new Property

                                </button>
                            </td>
                        </tr>
                    )}
                    {hasInputRow && (
                        <tr className={"flo-table-row"} >
                            <td>
                                <input type={"text"} placeholder={"Property name..."} autoFocus={true} value={inputEnvironmentPropertyName} onChange={changeEnvironmentPropertyName} />
                            </td>
                            <td>
                                <textarea placeholder={"Property value..."} value={inputEnvironmentPropertyValue} onChange={changeEnvironmentPropertyValue} rows={3} />
                            </td>
                            <td className={"table-column-small-col"}>
                                <button className={"table-button"} onClick={() => saveProperty()}>
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
            </table>

            <div className={"table-spacer"}></div>
            <div className={"header"}>Secrets</div>

            <div className={"table-spacer"}></div>
            <table className={"flo-table"}>
                <thead className={"flo-table-head"}>
                <tr>
                    <th>Name</th>
                    <th className={"table-column-hide-sm"}>Value</th>
                    <th>
                        <span className={"table-column-hide-sm"}>Actions</span>
                    </th>
                </tr>
                </thead>
                <tbody>
                <>
                    {secrets && secrets?.map((secret, index) => {
                        const isEditing = editingSecretID === secret.id;
                        return (
                            <tr className={"flo-table-row"} key={secret.id}>
                                <td>{secret.name}<span className={"table-column-hide-sm flo-table-subtext"}>{secret.id}</span></td>
                                <td className={"table-column-hide-sm"}>
                                    {isEditing ? (
                                        <textarea placeholder={"Enter new secret value..."} value={editingSecretValue} onChange={(e) => setEditingSecretValue(e.target.value)} rows={3} autoFocus />
                                    ) : (
                                        <small>Hidden</small>
                                    )}
                                </td>
                                <td>
                                    {isEditing ? (
                                        <>
                                            <button className={"table-button"} onClick={saveEditSecret}>
                                                <FontAwesomeIcon icon={faCheck}/> <span>Save</span>
                                            </button>
                                            <button className={"table-button"} onClick={cancelEditSecret}>
                                                <FontAwesomeIcon icon={faCancel}/> <span>Cancel</span>
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button className={"table-button"} onClick={() => startEditSecret(secret)}>
                                                <FontAwesomeIcon icon={faPencil}/> <span>Edit</span>
                                            </button>
                                            <button className={"table-button"} onClick={() => deleteSecret(secret.id)}>
                                                <FontAwesomeIcon icon={faTrash}/> <span>Delete</span>
                                            </button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        )
                    })}
                    {!hasSecretInputRow && (
                        <tr className={"flo-table-row"} >
                            <td colSpan={3} className={"table-row-center"}>
                                <button className={"table-button"} onClick={() => showSecretInputRow(true)}>
                                    <FontAwesomeIcon icon={faPlus} /> Create new Secret
                                </button>
                            </td>
                        </tr>
                    )}
                    {hasSecretInputRow && (
                        <tr className={"flo-table-row"} >
                            <td>
                                <input type={"text"} placeholder={"Secret name..."} autoFocus={true} value={inputEnvironmentSecretName} onChange={changeEnvironmentSecretName} />
                            </td>
                            <td>
                                <textarea placeholder={"Secret value..."} value={inputEnvironmentSecretValue} onChange={changeEnvironmentSecretValue} rows={3} />
                            </td>
                            <td className={"table-column-small-col"}>
                                <button className={"table-button"} onClick={() => saveSecret()}>
                                    <FontAwesomeIcon icon={faCheck}/> <span>Save</span>
                                </button>
                                <button className={"table-button"} onClick={() => showSecretInputRow(false)}>
                                    <FontAwesomeIcon icon={faCancel} /> <span>Cancel</span>
                                </button>
                            </td>
                        </tr>
                    )}
                </>
                </tbody>
            </table>
        </Container>
    )
}