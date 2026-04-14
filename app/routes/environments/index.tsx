import type {Route} from "../+types/home";
import Container from "~/components/container";
import SearchBar from "~/components/searchBar";
import {Link, useNavigate, useSearchParams} from "react-router";
import {useEffect, useState} from "react";
import useConfig from "~/components/config";
import api from "~/lib/api";
import useCookieToken from "~/components/cookie";
import type {Environment} from "~/types";
import {useAuth} from "~/context/auth/use";
import Modal from "~/components/modal";
import {toast} from "react-toastify";
import "./index.css";
import { Icon } from "~/components/icons/Icon";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Environments" },
        { name: "description", content: "Get in the Flo" },
    ];
}

export default function Environments() {
    const navigate = useNavigate();
    const [ searchParams ] = useSearchParams();
    const [ isLoading, setIsLoading ] = useState<boolean>(true);
    const [ environments, setEnvironments ] = useState<Environment[]>();
    const [ search, setSearch ] = useState<string>(searchParams.get("search"));
    const [ newEnvName, setNewEnvName ] = useState("");
    const [ showCreate, setShowCreate ] = useState(false);
    const [ confirmDeleteId, setConfirmDeleteId ] = useState<string | null>(null);

    const controller = new AbortController();
    const token = useCookieToken();
    const user = useAuth();

    const loadEnvironments = () => {
        const config = useConfig();
        const url = config("AUTOMATE_API_URL") + '/api/v1/environment';

        api.get(url, {
            signal: controller.signal,
            headers: { Authorization: "Bearer " + token }
        })
            .then(response => { if (response) setEnvironments(response.data); })
            .catch(error => console.error(error))
            .finally(() => setIsLoading(false));
    };

    useEffect(() => { loadEnvironments(); }, []);

    const createEnvironment = () => {
        if (newEnvName.trim().length < 3) return;
        const config = useConfig();
        const url = config("AUTOMATE_API_URL") + '/api/v1/environment';

        api.post(url, { name: newEnvName }, {
            headers: { Authorization: "Bearer " + token }
        })
            .then(() => {
                setNewEnvName("");
                setShowCreate(false);
                toast.success("Environment created");
                loadEnvironments();
            })
            .catch(error => { console.error(error); toast.error("Failed to create environment"); });
    };

    const deleteEnvironment = (id: string) => {
        const config = useConfig();
        const url = config("AUTOMATE_API_URL") + '/api/v1/environment/' + id;

        api.delete(url, { headers: { Authorization: "Bearer " + token } })
            .then(() => { toast.success("Environment deleted"); loadEnvironments(); })
            .catch(error => { console.error(error); toast.error("Failed to delete environment"); });
    };

    function handleUpdateSearch(term: string) {
        setSearch(term);
    }

    return (
        <Container>
            <div className={"header"}>Environments</div>

            <SearchBar value={search} onChange={handleUpdateSearch} placeholder="Search environments..." disabled={true} />

            {isLoading && (
                <div className={"loading-container"}>
                    <Icon name="spinner" spin />
                </div>
            )}

            {!isLoading && (
                <div className="env-page">
                    {/* Create section */}
                    {!showCreate && (
                        <button className="env-create-btn" onClick={() => setShowCreate(true)}>
                            <Icon name="plus" /> Create Environment
                        </button>
                    )}

                    {showCreate && (
                        <div className="env-create-form">
                            <input
                                type="text"
                                placeholder="Environment name..."
                                autoFocus
                                value={newEnvName}
                                onChange={e => setNewEnvName(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && createEnvironment()}
                            />
                            <button className="env-create-form-save" onClick={createEnvironment} disabled={newEnvName.trim().length < 3}>
                                <Icon name="plus" /> Create
                            </button>
                            <button className="env-create-form-cancel" onClick={() => { setShowCreate(false); setNewEnvName(""); }}>
                                Cancel
                            </button>
                        </div>
                    )}

                    {/* Empty state */}
                    {(!environments || environments.length === 0) && (
                        <div className="env-empty">No environments configured</div>
                    )}

                    {/* Environment cards */}
                    {environments && environments.length > 0 && (
                        <div className="env-list">
                            {environments.map(env => (
                                <div key={env.id} className="env-card" onClick={() => navigate("/environment/" + env.id)}>
                                    <div className="env-card-icon">
                                        <Icon name="globe" />
                                    </div>
                                    <div className="env-card-info">
                                        <div className="env-card-name">{env.name}</div>
                                        <div className="env-card-details">
                                            <span>{user.userID === env.owner_id ? "Owned by you" : "Shared"}</span>
                                            <span>{env.id.substring(0, 8)}</span>
                                        </div>
                                    </div>
                                    <div className="env-card-actions">
                                        <Link to={"/environment/" + env.id} className="env-card-view" onClick={e => e.stopPropagation()}>
                                            <Icon name="eye" />
                                        </Link>
                                        <button className="env-card-delete" onClick={e => { e.stopPropagation(); setConfirmDeleteId(env.id); }}>
                                            <Icon name="trash" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {confirmDeleteId && (
                <Modal
                    label="Delete Environment"
                    footerMessage="This action cannot be undone"
                    visible={true}
                    canDismiss={true}
                    onDismiss={() => setConfirmDeleteId(null)}
                    actions={[{
                        label: "Delete",
                        primary: false,
                        variant: 'danger',
                        onClick: () => { deleteEnvironment(confirmDeleteId); setConfirmDeleteId(null); },
                    }]}
                >
                    Are you sure you want to delete this environment? All properties and secrets will be permanently removed.
                </Modal>
            )}
        </Container>
    );
}
