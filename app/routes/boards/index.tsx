import {useEffect, useState} from "react";
import {useNavigate} from "react-router";
import Container from "~/components/container";
import api from "~/lib/api";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import {useToast} from "~/components/toast";
import SearchBar from "~/components/searchBar";
import Modal from "~/components/modal";
import type {Dashboard} from "~/types";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "./index.css";
import { Icon } from "~/components/icons/Icon";

dayjs.extend(relativeTime);

const config = useConfig();
const API_URL = config("AUTOMATE_API_URL");

export function meta() {
    return [
        {title: "Flomation - Dashboards"},
        {name: "description", content: "Manage your dashboards"},
    ];
}

export default function BoardsList() {
    const navigate = useNavigate();
    const token = useCookieToken();
    const {showToast} = useToast();

    const [boards, setBoards] = useState<Dashboard[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState<string>("");
    const [searchExpanded, setSearchExpanded] = useState(false);

    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [newName, setNewName] = useState("");
    const [newDescription, setNewDescription] = useState("");
    const [newIsPublic, setNewIsPublic] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [deleteBoardId, setDeleteBoardId] = useState<string | null>(null);

    const fetchBoards = () => {
        setIsLoading(true);
        api.get(API_URL + "/api/v1/board", {
            headers: {Authorization: "Bearer " + token}
        })
            .then(res => {
                setBoards(res.data || []);
            })
            .catch(() => {
                showToast("Failed to load dashboards", "error");
            })
            .finally(() => setIsLoading(false));
    };

    useEffect(() => {
        if (token) fetchBoards();
    }, [token]);

    const handleCreate = () => {
        if (!newName.trim()) return;
        setIsCreating(true);
        api.post(API_URL + "/api/v1/board", {
            name: newName.trim(),
            description: newDescription.trim(),
            is_public: newIsPublic,
        }, {
            headers: {Authorization: "Bearer " + token}
        })
            .then(res => {
                showToast("Dashboard created", "success");
                setCreateModalVisible(false);
                setNewName("");
                setNewDescription("");
                setNewIsPublic(false);
                navigate("/board/" + res.data.id + "/edit");
            })
            .catch(() => {
                showToast("Failed to create dashboard", "error");
            })
            .finally(() => setIsCreating(false));
    };

    const handleDelete = () => {
        if (!deleteBoardId) return;
        api.delete(API_URL + "/api/v1/board/" + deleteBoardId, {
            headers: {Authorization: "Bearer " + token}
        })
            .then(() => {
                showToast("Dashboard archived", "success");
                setDeleteModalVisible(false);
                setDeleteBoardId(null);
                fetchBoards();
            })
            .catch(() => {
                showToast("Failed to archive dashboard", "error");
            });
    };

    const filteredBoards = boards.filter(b => {
        if (!search) return true;
        const s = search.toLowerCase();
        return b.name.toLowerCase().includes(s) || (b.description || "").toLowerCase().includes(s);
    });

    return (
        <Container>
            <div className="boards-action-bar">
                <div className="boards-action-bar-search">
                    <SearchBar
                        value={search}
                        onChange={setSearch}
                        placeholder="Search dashboards..."
                        onExpandChange={setSearchExpanded}
                    />
                </div>
                <div className="boards-action-bar-actions">
                    <button
                        className="boards-action-btn boards-action-btn--primary"
                        onClick={() => setCreateModalVisible(true)}
                    >
                        <Icon name="plus" />
                        <span>New Dashboard</span>
                    </button>
                </div>
            </div>

            {!isLoading && filteredBoards.length === 0 && (
                <div className="boards-empty">
                    <div className="boards-empty-icon">
                        <Icon name="chart-line" />
                    </div>
                    <div className="boards-empty-title">
                        {search ? "No dashboards found" : "No dashboards yet"}
                    </div>
                    <div className="boards-empty-description">
                        {search
                            ? "Try adjusting your search terms."
                            : "Create your first dashboard to visualise data from your flows."}
                    </div>
                    {!search && (
                        <button className="boards-empty-btn" onClick={() => setCreateModalVisible(true)}>
                            <Icon name="plus" />
                            Create Dashboard
                        </button>
                    )}
                </div>
            )}

            {filteredBoards.length > 0 && (
                <div className="boards-grid">
                    {filteredBoards.map(board => (
                        <div
                            key={board.id}
                            className="board-card"
                            onClick={() => navigate("/board/" + board.id)}
                        >
                            <div className="board-card-header">
                                <div className="board-card-name">{board.name}</div>
                                <div className="board-card-badges">
                                    <span className={`board-card-badge ${board.is_public ? "board-card-badge--public" : "board-card-badge--private"}`}>
                                        <Icon name={board.is_public? "globe" : "lock"} style={{marginRight: 4}} />
                                        {board.is_public ? "Public" : "Private"}
                                    </span>
                                </div>
                            </div>

                            <div className="board-card-description">
                                {board.description || "No description"}
                            </div>

                            <div className="board-card-footer">
                                <div className="board-card-stat">
                                    <Icon name="grip" className="board-card-stat-icon" />
                                    {board.widget_count || 0} widget{(board.widget_count || 0) !== 1 ? "s" : ""}
                                </div>
                                <div className="board-card-stat">
                                    <Icon name="clock" className="board-card-stat-icon" />
                                    {dayjs(board.updated_at).fromNow()}
                                </div>
                                <div className="board-card-actions">
                                    {board.is_public && board.public_slug && (
                                        <button
                                            className="board-card-action-btn"
                                            title="Copy public link"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigator.clipboard.writeText(window.location.origin + "/public/board/" + board.public_slug)
                                                    .then(() => showToast("Public link copied to clipboard", "success"));
                                            }}
                                        >
                                            <Icon name="copy" />
                                        </button>
                                    )}
                                    <button
                                        className="board-card-action-btn"
                                        title="Edit"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate("/board/" + board.id + "/edit");
                                        }}
                                    >
                                        <Icon name="pencil" />
                                    </button>
                                    <button
                                        className="board-card-action-btn board-card-action-btn--danger"
                                        title="Archive"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDeleteBoardId(board.id);
                                            setDeleteModalVisible(true);
                                        }}
                                    >
                                        <Icon name="trash" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {createModalVisible && (
                <Modal
                    label="Create Dashboard"
                    visible={true}
                    canDismiss={true}
                    onDismiss={() => setCreateModalVisible(false)}
                    actions={[
                        {
                            label: isCreating ? "Creating..." : "Create",
                            primary: true,
                            onClick: handleCreate,
                        }
                    ]}
                >
                    <div className="board-form-group">
                        <label className="board-form-label">Name</label>
                        <input
                            className="board-form-input"
                            type="text"
                            placeholder="My Dashboard"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="board-form-group">
                        <label className="board-form-label">Description</label>
                        <textarea
                            className="board-form-textarea"
                            placeholder="Optional description..."
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                        />
                    </div>
                    <div className="board-form-group">
                        <div className="board-form-toggle-row">
                            <span className="board-form-toggle-label">Make publicly accessible</span>
                            <button
                                type="button"
                                className={`board-form-toggle ${newIsPublic ? "board-form-toggle--active" : ""}`}
                                onClick={() => setNewIsPublic(!newIsPublic)}
                            >
                                <div className="board-form-toggle-knob"/>
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {deleteModalVisible && (
                <Modal
                    label="Archive Dashboard"
                    visible={true}
                    canDismiss={true}
                    onDismiss={() => {
                        setDeleteModalVisible(false);
                        setDeleteBoardId(null);
                    }}
                    actions={[
                        {
                            label: "Archive",
                            primary: true,
                            variant: "danger",
                            onClick: handleDelete,
                        }
                    ]}
                >
                    <p style={{color: "rgba(255,255,255,0.7)", fontSize: 14}}>
                        Are you sure you want to archive this dashboard? It will no longer appear in your dashboard list.
                    </p>
                </Modal>
            )}
        </Container>
    );
}
