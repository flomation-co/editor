import type {Route} from "../+types/home";
import Container from "~/components/container";
import type {HelpContent} from "~/components/helpPane";
import React, {useEffect, useState} from "react";
import {useOrganisation} from "~/context/organisation/use";
import {useAuth} from "~/context/auth/use";
import type {OrganisationMember, OrganisationInvite, OrganisationAgentMember} from "~/types";
import api from "~/lib/api";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import "./index.css";
import { Icon } from "~/components/icons/Icon";
import ProtectedRoute from "~/components/protected-route";
import {PERMISSIONS} from "~/types";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Organisation" },
        { name: "description", content: "Manage your organisation" },
    ];
}

const ORGANISATION_HELP: HelpContent = {
    title: "About your Organisation",
    intro: "Your organisation is your shared workspace, where your team, settings and shared resources live together.",
    points: [
        "Invite people and manage who is a member",
        "Set what each person is allowed to do",
        "Manage shared settings for everyone",
        "Keep your workspace details up to date",
    ],
    tip: "Members share the organisation's flows, environments and usage, so changes here affect the whole team.",
};

export default function Organisations() {
    const config = useConfig();
    const token = useCookieToken();
    const auth = useAuth();
    const { organisations, currentOrg, setCurrentOrg, refreshOrganisations } = useOrganisation();

    const [newOrgName, setNewOrgName] = useState("");
    const [members, setMembers] = useState<OrganisationMember[]>([]);
    const [agentMembers, setAgentMembers] = useState<OrganisationAgentMember[]>([]);
    const [invites, setInvites] = useState<OrganisationInvite[]>([]);
    const [inviteEmail, setInviteEmail] = useState("");
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Legal-entity details used to identify the organisation as the Controller
    // on the generated Data Processing Agreement. Editable by admins; seeded
    // from the current organisation and re-seeded whenever it changes.
    type LegalDetails = {
        legal_name: string;
        company_number: string;
        address_line_1: string;
        address_line_2: string;
        city: string;
        region: string;
        postcode: string;
        country: string;
    };
    const emptyLegal: LegalDetails = {
        legal_name: "", company_number: "", address_line_1: "", address_line_2: "",
        city: "", region: "", postcode: "", country: "",
    };
    const [legal, setLegal] = useState<LegalDetails>(emptyLegal);
    const [savingLegal, setSavingLegal] = useState(false);

    // Seed the legal-details form from the current organisation. Declared here,
    // above every early return, so the hook order stays stable across renders.
    useEffect(() => {
        if (!currentOrg) { setLegal(emptyLegal); return; }
        setLegal({
            legal_name: currentOrg.legal_name || "",
            company_number: currentOrg.company_number || "",
            address_line_1: currentOrg.address_line_1 || "",
            address_line_2: currentOrg.address_line_2 || "",
            city: currentOrg.city || "",
            region: currentOrg.region || "",
            postcode: currentOrg.postcode || "",
            country: currentOrg.country || "",
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentOrg?.id]);

    const API_URL = config("AUTOMATE_API_URL");
    const isAdmin = currentOrg?.role === "admin";

    const fetchMembers = () => {
        if (!currentOrg) return;
        api.get(`${API_URL}/api/v1/organisation/${currentOrg.id}/member`, {
            headers: { Authorization: "Bearer " + token }
        })
            .then(res => {
                if (res.data) {
                    setMembers(res.data.members || []);
                    setAgentMembers(res.data.agents || []);
                }
            })
            .catch(() => { setMembers([]); setAgentMembers([]); });
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
            <Container help={ORGANISATION_HELP}>
                <ProtectedRoute permission={PERMISSIONS.ORGANISATION_VIEW}>
                <div className={"header"}>Organisations</div>

                {organisations.length > 0 && (
                    <div className={"org-section"}>
                        <div className={"org-section-header"}>Your Organisations</div>
                        <div className={"org-members-list"}>
                            {organisations.map(org => (
                                <div key={org.id} className={"org-member-row"}>
                                    <div className={"org-member-name"}>
                                        <span>{org.name}</span>
                                        {org.role && (
                                            <span className={"org-member-email"}>{org.role}</span>
                                        )}
                                    </div>
                                    <a
                                        className={"org-switch-link"}
                                        onClick={() => setCurrentOrg(org)}
                                    >
                                        Switch →
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className={"org-section"}>
                    <div className={"org-section-header"}>Create Organisation</div>
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
                </ProtectedRoute>
            </Container>
        );
    }

    const togglePublicRunners = () => {
        if (!currentOrg || !isAdmin) return;
        const updated = { ...currentOrg, allow_public_runners: !currentOrg.allow_public_runners };
        api.post(`${API_URL}/api/v1/organisation/${currentOrg.id}`, updated, {
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }
        })
            .then(() => refreshOrganisations())
            .catch(err => console.error("Unable to update organisation", err));
    };

    const saveLegalDetails = () => {
        if (!currentOrg || !isAdmin || savingLegal) return;
        setSavingLegal(true);
        // Spread the whole organisation so name/icon/runner-flag are preserved,
        // then overlay the legal fields the admin has edited.
        const updated = { ...currentOrg, ...legal };
        api.post(`${API_URL}/api/v1/organisation/${currentOrg.id}`, updated, {
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }
        })
            .then(res => { if (res.data) setCurrentOrg(res.data); return refreshOrganisations(); })
            .catch(err => console.error("Unable to update organisation legal details", err))
            .finally(() => setSavingLegal(false));
    };

    return (
        <Container help={ORGANISATION_HELP}>
            <ProtectedRoute permission={PERMISSIONS.ORGANISATION_VIEW}>
            <div className={"header"}>{currentOrg.name}</div>

            {isAdmin && (
                <div className={"org-section"}>
                    <div className={"org-section-header"}>Settings</div>
                    <div className={"org-setting-row"}>
                        <div className={"org-setting-label"}>
                            <div className={"org-setting-name"}>Allow Public Runners</div>
                            <div className={"org-setting-description"}>
                                When enabled, organisation flows can be executed by public runners that are not assigned to any organisation queue.
                            </div>
                        </div>
                        <label className={"org-toggle"}>
                            <input
                                type="checkbox"
                                checked={currentOrg.allow_public_runners}
                                onChange={togglePublicRunners}
                            />
                            <span className={"org-toggle-slider"}></span>
                        </label>
                    </div>
                </div>
            )}

            {isAdmin && (
                <div className={"org-section"}>
                    <div className={"org-section-header"}>Legal Details</div>
                    <div className={"org-setting-description"} style={{ marginBottom: 18 }}>
                        Your organisation's registered legal identity. These details identify your
                        organisation as the data controller on the Data Processing Agreement available
                        from your Compliance settings, and are used on official documents.
                    </div>

                    <div className={"org-legal-grid"}>
                        <div className={"org-legal-field org-legal-field--wide"}>
                            <label>Registered legal name</label>
                            <input
                                type="text"
                                placeholder="e.g. Acme Widgets Limited"
                                value={legal.legal_name}
                                onChange={e => setLegal({ ...legal, legal_name: e.target.value })}
                            />
                        </div>
                        <div className={"org-legal-field"}>
                            <label>Company number</label>
                            <input
                                type="text"
                                placeholder="e.g. 12345678"
                                value={legal.company_number}
                                onChange={e => setLegal({ ...legal, company_number: e.target.value })}
                            />
                        </div>
                        <div className={"org-legal-field org-legal-field--wide"}>
                            <label>Registered address line 1</label>
                            <input
                                type="text"
                                placeholder="Building and street"
                                value={legal.address_line_1}
                                onChange={e => setLegal({ ...legal, address_line_1: e.target.value })}
                            />
                        </div>
                        <div className={"org-legal-field org-legal-field--wide"}>
                            <label>Address line 2</label>
                            <input
                                type="text"
                                placeholder="Optional"
                                value={legal.address_line_2}
                                onChange={e => setLegal({ ...legal, address_line_2: e.target.value })}
                            />
                        </div>
                        <div className={"org-legal-field"}>
                            <label>Town / City</label>
                            <input
                                type="text"
                                value={legal.city}
                                onChange={e => setLegal({ ...legal, city: e.target.value })}
                            />
                        </div>
                        <div className={"org-legal-field"}>
                            <label>County / Region</label>
                            <input
                                type="text"
                                value={legal.region}
                                onChange={e => setLegal({ ...legal, region: e.target.value })}
                            />
                        </div>
                        <div className={"org-legal-field"}>
                            <label>Postcode</label>
                            <input
                                type="text"
                                value={legal.postcode}
                                onChange={e => setLegal({ ...legal, postcode: e.target.value })}
                            />
                        </div>
                        <div className={"org-legal-field"}>
                            <label>Country</label>
                            <input
                                type="text"
                                placeholder="e.g. United Kingdom"
                                value={legal.country}
                                onChange={e => setLegal({ ...legal, country: e.target.value })}
                            />
                        </div>
                    </div>

                    <div style={{ marginTop: 18 }}>
                        <button className={"org-legal-save"} onClick={saveLegalDetails} disabled={savingLegal}>
                            <Icon name="check" /> {savingLegal ? "Saving…" : "Save Legal Details"}
                        </button>
                    </div>
                </div>
            )}

            <div className={"org-section"}>
                <div className={"org-section-header"}>Members</div>
                <div className={"org-members-list"}>
                    {members.map(member => (
                        <div key={member.user_id} className={"org-member-row"}>
                            <div className={"org-member-name"}>
                                <span>{member.name && member.name !== "auto-generate" ? member.name : (member.email_address || "Unknown User")}</span>
                                {member.email_address && member.name && member.name !== "auto-generate" && (
                                    <span className={"org-member-email"}>{member.email_address}</span>
                                )}
                            </div>
                            <div className={`org-member-role ${member.role}`}>{member.role}</div>
                            {isAdmin && member.user_id !== auth.user?.id && (
                                <button className={"org-action-button danger"} onClick={() => removeMember(member.user_id)}>
                                    <Icon name="trash" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {agentMembers.length > 0 && (
                <div className={"org-section"}>
                    <div className={"org-section-header"}>Agents</div>
                    <div className={"org-members-list"}>
                        {agentMembers.map(agent => (
                            <div key={agent.agent_id} className={"org-member-row"}>
                                <div className={"org-agent-icon"}>
                                    <Icon name="robot" />
                                </div>
                                <div className={"org-member-name"}>
                                    <span>{agent.name}</span>
                                    <span className={"org-member-email"}>Owned by {agent.owner_name}</span>
                                </div>
                                <span className={`org-agent-status ${agent.status}`}>
                                    <span className={"org-agent-status-dot"} />
                                    {agent.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
                            <Icon name="plus" /> Create Invite
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
                                        <Icon name={copiedId === invite.id? "check" : "copy"} />
                                    </button>
                                    <button className={"org-action-button danger"} onClick={() => revokeInvite(invite.id)} style={{cursor: "pointer"}}>
                                        <Icon name="trash" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            </ProtectedRoute>
        </Container>
    );
}
