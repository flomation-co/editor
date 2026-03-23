import type {Route} from "../+types/home";
import Container from "~/components/container";
import React, {useEffect, useState} from "react";
import {useOrganisation} from "~/context/organisation/use";
import type {Group, GroupMember, OrganisationMember} from "~/types";
import {PERMISSION_CATEGORIES} from "~/types";
import api from "~/lib/api";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faChevronDown, faChevronRight, faCheck, faPlus, faTrash, faXmark} from "@fortawesome/pro-solid-svg-icons";
import "./index.css";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Groups" },
        { name: "description", content: "Manage permission groups" },
    ];
}

export default function Groups() {
    const config = useConfig();
    const token = useCookieToken();
    const { currentOrg } = useOrganisation();

    const [groups, setGroups] = useState<Group[]>([]);
    const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
    const [newGroupName, setNewGroupName] = useState("");
    const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
    const [orgMembers, setOrgMembers] = useState<OrganisationMember[]>([]);
    const [selectedMemberId, setSelectedMemberId] = useState("");

    const API_URL = config("AUTOMATE_API_URL");

    const fetchGroups = () => {
        if (!currentOrg) return;
        api.get(`${API_URL}/api/v1/organisation/${currentOrg.id}/group`, {
            headers: { Authorization: "Bearer " + token }
        })
            .then(res => { if (res.data) setGroups(res.data); })
            .catch(() => setGroups([]));
    };

    const fetchGroupMembers = (groupId: string) => {
        if (!currentOrg) return;
        api.get(`${API_URL}/api/v1/organisation/${currentOrg.id}/group/${groupId}/member`, {
            headers: { Authorization: "Bearer " + token }
        })
            .then(res => { if (res.data) setGroupMembers(res.data); })
            .catch(() => setGroupMembers([]));
    };

    const fetchOrgMembers = () => {
        if (!currentOrg) return;
        api.get(`${API_URL}/api/v1/organisation/${currentOrg.id}/member`, {
            headers: { Authorization: "Bearer " + token }
        })
            .then(res => { if (res.data) setOrgMembers(res.data); })
            .catch(() => setOrgMembers([]));
    };

    useEffect(() => {
        fetchGroups();
        fetchOrgMembers();
    }, [currentOrg]);

    useEffect(() => {
        if (expandedGroupId) {
            fetchGroupMembers(expandedGroupId);
        } else {
            setGroupMembers([]);
        }
    }, [expandedGroupId]);

    const createGroup = () => {
        if (!currentOrg || !newGroupName.trim()) return;
        api.post(`${API_URL}/api/v1/organisation/${currentOrg.id}/group`, {
            name: newGroupName,
        }, {
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }
        })
            .then(() => {
                setNewGroupName("");
                fetchGroups();
            })
            .catch(err => console.error("Unable to create group", err));
    };

    const deleteGroup = (groupId: string) => {
        if (!currentOrg) return;
        api.delete(`${API_URL}/api/v1/organisation/${currentOrg.id}/group/${groupId}`, {
            headers: { Authorization: "Bearer " + token }
        })
            .then(() => {
                if (expandedGroupId === groupId) setExpandedGroupId(null);
                fetchGroups();
            })
            .catch(err => console.error("Unable to delete group", err));
    };

    const togglePermission = (group: Group, perm: string) => {
        if (!currentOrg) return;
        const current = group.permissions || [];
        const updated = current.includes(perm)
            ? current.filter(p => p !== perm)
            : [...current, perm];

        api.post(`${API_URL}/api/v1/organisation/${currentOrg.id}/group/${group.id}/permission`, {
            permissions: updated,
        }, {
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }
        })
            .then(() => fetchGroups())
            .catch(err => console.error("Unable to update permissions", err));
    };

    const toggleDefault = (group: Group) => {
        if (!currentOrg) return;
        api.post(`${API_URL}/api/v1/organisation/${currentOrg.id}/group/${group.id}`, {
            name: group.name,
            description: group.description || null,
            is_default: !group.is_default,
        }, {
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }
        })
            .then(() => fetchGroups())
            .catch(err => console.error("Unable to update group", err));
    };

    const addMember = (groupId: string) => {
        if (!currentOrg || !selectedMemberId) return;
        api.post(`${API_URL}/api/v1/organisation/${currentOrg.id}/group/${groupId}/member`, {
            user_id: selectedMemberId,
        }, {
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }
        })
            .then(() => {
                setSelectedMemberId("");
                fetchGroupMembers(groupId);
                fetchGroups();
            })
            .catch(err => console.error("Unable to add member", err));
    };

    const removeMember = (groupId: string, userId: string) => {
        if (!currentOrg) return;
        api.delete(`${API_URL}/api/v1/organisation/${currentOrg.id}/group/${groupId}/member/${userId}`, {
            headers: { Authorization: "Bearer " + token }
        })
            .then(() => {
                fetchGroupMembers(groupId);
                fetchGroups();
            })
            .catch(err => console.error("Unable to remove member", err));
    };

    if (!currentOrg) {
        return (
            <Container>
                <div className={"header"}>Groups</div>
                <div className={"groups-section"}>
                    <p className={"groups-description"}>
                        Switch to an organisation to manage permission groups.
                    </p>
                </div>
            </Container>
        );
    }

    const expandedGroup = groups.find(g => g.id === expandedGroupId);
    const availableMembers = orgMembers.filter(
        m => !groupMembers.some(gm => gm.user_id === m.user_id)
    );

    return (
        <Container>
            <div className={"header"}>Groups</div>

            <div className={"groups-section"}>
                <p className={"groups-description"}>
                    Create groups to control what members can do within your organisation. Assign permissions and add members to each group.
                </p>

                <div className={"groups-create-form"}>
                    <input
                        type="text"
                        placeholder="New group name"
                        value={newGroupName}
                        onChange={e => setNewGroupName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && createGroup()}
                    />
                    <button onClick={createGroup} disabled={!newGroupName.trim()}>
                        <FontAwesomeIcon icon={faPlus} /> Create Group
                    </button>
                </div>
            </div>

            <div className={"groups-section"}>
                <div className={"groups-section-header"}>Permission Groups</div>

                {groups.length === 0 && (
                    <div className={"groups-empty"}>
                        No groups yet. Members without groups get default permissions.
                    </div>
                )}

                <div className={"groups-list"}>
                    {groups.map(group => {
                        const isExpanded = expandedGroupId === group.id;

                        return (
                            <div key={group.id} className={`group-card ${isExpanded ? "expanded" : ""}`}>
                                <div className={"group-card-header"} onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}>
                                    <div className={"group-card-info"}>
                                        <div className={"group-card-name"}>
                                            {group.name}
                                            {group.is_default && (
                                                <span className={"group-badge default"}>Default</span>
                                            )}
                                        </div>
                                        {group.description && (
                                            <div className={"group-card-desc"}>{group.description}</div>
                                        )}
                                    </div>
                                    <div className={"group-member-count"}>
                                        {group.member_count || 0} {(group.member_count || 0) === 1 ? "member" : "members"}
                                    </div>
                                    <div className={"group-card-chevron"}>
                                        <FontAwesomeIcon icon={isExpanded ? faChevronDown : faChevronRight} />
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className={"group-card-body"}>
                                        {/* Permissions */}
                                        {PERMISSION_CATEGORIES.map(cat => (
                                            <div key={cat.name} className={"perm-category"}>
                                                <div className={"perm-category-name"}>{cat.name}</div>
                                                <div className={"perm-list"}>
                                                    {cat.permissions.map(perm => {
                                                        const isActive = (group.permissions || []).includes(perm.key);
                                                        return (
                                                            <label
                                                                key={perm.key}
                                                                className={`perm-toggle ${isActive ? "active" : ""}`}
                                                                onClick={() => togglePermission(group, perm.key)}
                                                            >
                                                                <div className={"perm-check"}>
                                                                    {isActive && <FontAwesomeIcon icon={faCheck} />}
                                                                </div>
                                                                {perm.label}
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}

                                        {/* Members */}
                                        <div className={"group-members"}>
                                            <div className={"group-members-header"}>Members</div>
                                            {groupMembers.length > 0 && (
                                                <div className={"group-members-list"}>
                                                    {groupMembers.map(member => (
                                                        <div key={member.user_id} className={"group-member-row"}>
                                                            <span className={"member-name"}>{member.name}</span>
                                                            <button className={"remove-btn"} onClick={() => removeMember(group.id, member.user_id)}>
                                                                <FontAwesomeIcon icon={faXmark} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {availableMembers.length > 0 && (
                                                <div className={"group-add-member"}>
                                                    <select
                                                        value={selectedMemberId}
                                                        onChange={e => setSelectedMemberId(e.target.value)}
                                                    >
                                                        <option value="">Select member to add...</option>
                                                        {availableMembers.map(m => (
                                                            <option key={m.user_id} value={m.user_id}>{m.name}</option>
                                                        ))}
                                                    </select>
                                                    <button onClick={() => addMember(group.id)} disabled={!selectedMemberId}>
                                                        <FontAwesomeIcon icon={faPlus} /> Add
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Settings */}
                                        <div className={"group-settings-row"}>
                                            <label>
                                                <input
                                                    type="checkbox"
                                                    checked={group.is_default}
                                                    onChange={() => toggleDefault(group)}
                                                />
                                                Auto-assign new members to this group
                                            </label>
                                            <div style={{ flex: 1 }} />
                                            <button className={"group-action-button danger"} onClick={() => deleteGroup(group.id)}>
                                                <FontAwesomeIcon icon={faTrash} /> Delete Group
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </Container>
    );
}
