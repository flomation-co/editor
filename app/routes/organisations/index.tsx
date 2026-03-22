import type {Route} from "../+types/home";
import Container from "~/components/container";
import React, {useEffect, useState} from "react";
import {useOrganisation} from "~/context/organisation/use";
import {useAuth} from "~/context/auth/use";
import type {OrganisationMember, OrganisationInvite} from "~/types";
import api from "~/lib/api";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faTrash, faCopy, faPlus, faCheck} from "@fortawesome/pro-solid-svg-icons";
import "./index.css";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Organisation" },
        { name: "description", content: "Manage your organisation" },
    ];
}

export default function Organisations() {
    const config = useConfig();
    const token = useCookieToken();
    const auth = useAuth();
    const { currentOrg, refreshOrganisations } = useOrganisation();

    const [newOrgName, setNewOrgName] = useState("");
    const [members, setMembers] = useState<OrganisationMember[]>([]);
    const [invites, setInvites] = useState<OrganisationInvite[]>([]);
    const [inviteEmail, setInviteEmail] = useState("");
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const API_URL = config("AUTOMATE_API_URL");
    const isAdmin = currentOrg?.role === "admin";

    const fetchMembers = () => {
        if (!currentOrg) return;
        api.get(`${API_URL}/api/v1/organisation/${currentOrg.id}/member`, {
            headers: { Authorization: "Bearer " + token }
        })
            .then(res => { if (res.data) setMembers(res.data); })
            .catch(() => setMembers([]));
    };

    const fetchInvites = () => {
        if (!currentOrg || !isAdmin) return;
        api.get(`${API_URL}/api/v1/organisation/${currentOrg.id}/invite`, {
            headers: { Authorization: "Bearer " + token }
        })
            .then(res => { if (res.data) setInvites(res.data); })
            .catch(() => setInvites([]));
    };

    useEffect(() => {
        fetchMembers();
        fetchInvites();
    }, [currentOrg]);

    const createOrganisation = () => {
        if (!newOrgName.trim()) return;
        api.post(`${API_URL}/api/v1/organisation`, { name: newOrgName }, {
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }
        })
            .then(() => {
                setNewOrgName("");
                refreshOrganisations();
            })
            .catch(err => console.error("Unable to create organisation", err));
    };

    const removeMember = (userId: string) => {
        if (!currentOrg) return;
        api.delete(`${API_URL}/api/v1/organisation/${currentOrg.id}/member/${userId}`, {
            headers: { Authorization: "Bearer " + token }
        })
            .then(() => fetchMembers())
            .catch(err => console.error("Unable to remove member", err));
    };

    const createInvite = () => {
        if (!currentOrg) return;
        const body: any = { role: "member" };
        if (inviteEmail.trim()) body.email = inviteEmail;

        api.post(`${API_URL}/api/v1/organisation/${currentOrg.id}/invite`, body, {
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }
        })
            .then(() => {
                setInviteEmail("");
                fetchInvites();
            })
            .catch(err => console.error("Unable to create invite", err));
    };

    const revokeInvite = (inviteId: string) => {
        if (!currentOrg) return;
        api.delete(`${API_URL}/api/v1/organisation/${currentOrg.id}/invite/${inviteId}`, {
            headers: { Authorization: "Bearer " + token }
        })
            .then(() => fetchInvites())
            .catch(err => console.error("Unable to revoke invite", err));
    };

    const copyInviteLink = (code: string, id: string) => {
        const link = `${window.location.origin}/invite/${code}`;
        navigator.clipboard.writeText(link);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    if (!currentOrg) {
        return (
            <Container>
                <div className={"header"}>Organisation</div>
                <div className={"org-section"}>
                    <p className={"org-description"}>
                        Create an organisation to collaborate with your team. Organisation members can view and execute shared flows.
                    </p>
                    <div className={"org-create-form"}>
                        <input
                            type="text"
                            placeholder="Organisation name"
                            value={newOrgName}
                            onChange={e => setNewOrgName(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && createOrganisation()}
                        />
                        <button onClick={createOrganisation} disabled={!newOrgName.trim()} style={{cursor: newOrgName.trim() ? "pointer" : "not-allowed"}}>
                            Create Organisation
                        </button>
                    </div>
                </div>
            </Container>
        );
    }

    return (
        <Container>
            <div className={"header"}>{currentOrg.name}</div>

            <div className={"org-section"}>
                <div className={"org-section-header"}>Members</div>
                <div className={"org-members-list"}>
                    {members.map(member => (
                        <div key={member.user_id} className={"org-member-row"}>
                            <div className={"org-member-name"}>{member.name}</div>
                            <div className={`org-member-role ${member.role}`}>{member.role}</div>
                            {isAdmin && member.user_id !== auth.user?.id && (
                                <button className={"org-action-button danger"} onClick={() => removeMember(member.user_id)}>
                                    <FontAwesomeIcon icon={faTrash} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {isAdmin && (
                <div className={"org-section"}>
                    <div className={"org-section-header"}>Invite Members</div>
                    <div className={"org-invite-form"}>
                        <input
                            type="email"
                            placeholder="Email address (optional)"
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                        />
                        <button onClick={createInvite} style={{cursor: "pointer"}}>
                            <FontAwesomeIcon icon={faPlus} /> Create Invite
                        </button>
                    </div>

                    {invites.length > 0 && (
                        <div className={"org-invites-list"}>
                            {invites.map(invite => (
                                <div key={invite.id} className={"org-invite-row"}>
                                    <div className={"org-invite-detail"}>
                                        {invite.email || "Link invite"}
                                        <span className={"org-invite-expires"}>
                                            Expires {new Date(invite.expires_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <button
                                        className={"org-action-button"}
                                        onClick={() => copyInviteLink(invite.invite_code, invite.id)}
                                        style={{cursor: "pointer"}}
                                    >
                                        <FontAwesomeIcon icon={copiedId === invite.id ? faCheck : faCopy} />
                                    </button>
                                    <button className={"org-action-button danger"} onClick={() => revokeInvite(invite.id)} style={{cursor: "pointer"}}>
                                        <FontAwesomeIcon icon={faTrash} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </Container>
    );
}
