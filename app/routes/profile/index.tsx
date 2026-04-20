import type {Route} from "../+types/home";
import Container from "~/components/container";
import React, {useEffect, useState} from "react";
import {useAuth} from "~/context/auth/use";
import type {AuthUser} from "~/types";
import api from "~/lib/api";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import {useToast} from "~/components/toast";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import "./index.css";
import { Icon } from "~/components/icons/Icon";

dayjs.extend(relativeTime);
dayjs.extend(utc);

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Profile" },
        { name: "description", content: "Manage your profile" },
    ];
}

export default function Profile() {
    const config = useConfig();
    const auth = useAuth();
    const token = useCookieToken();
    const { showToast } = useToast();

    const [ user, setUser ] = useState<AuthUser | null>();
    const [ name, setName ] = useState<string>("");

    useEffect(() => { setUser(auth.user); }, [ auth ]);
    useEffect(() => { setName(user?.name || ""); }, [ user ]);

    const openMFA = () => {
        window.location.replace(config("LOGIN_URL") + "/mfa");
    };

    const saveProfile = () => {
        if (!user) return;
        const url = config("AUTOMATE_API_URL");
        const updatedUser = { ...user, name: name || "" };

        api.post(url + '/api/v1/user/' + updatedUser.id, updatedUser, {
            headers: { 'Content-Type': 'application/json', Authorization: "Bearer " + token }
        })
            .then(response => {
                if (response) {
                    auth.setUser(response.data);
                    showToast("Profile saved", "success");
                }
            })
            .catch(() => showToast("Failed to save profile", "error"));
    };

    return (
        <Container>
            <div className={"header"}>Profile</div>

            <div className="profile-page">
                <div className="profile-card">
                    <div className="profile-section-label">Account Details</div>

                    <div className="profile-field">
                        <label className="profile-label">Display Name</label>
                        <input
                            type="text"
                            className="profile-input"
                            placeholder="Display Name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>

                    <div className="profile-field">
                        <label className="profile-label">Email Address</label>
                        <input
                            type="email"
                            className="profile-input profile-input--disabled"
                            disabled
                            placeholder="Email Address"
                            value={user?.email_address || ""}
                        />
                    </div>

                    {user?.created_at && (
                        <div className="profile-meta">
                            Registered {dayjs.utc(user.created_at).fromNow()}
                        </div>
                    )}

                    <div className="profile-actions">
                        <button className="profile-btn profile-btn--primary" onClick={saveProfile} disabled={!user}>
                            <Icon name="floppy-disk" /> Save
                        </button>
                    </div>
                </div>

                <div className="profile-card">
                    <div className="profile-section-label">Security</div>

                    <div className="profile-field">
                        <div className="profile-security-row">
                            <div className="profile-security-info">
                                <div className="profile-security-title">Multi-Factor Authentication</div>
                                <div className="profile-security-desc">Add an extra layer of security to your account with TOTP-based MFA</div>
                            </div>
                            <button className="profile-btn profile-btn--secondary" onClick={openMFA} disabled={!user}>
                                <Icon name="shield-halved" /> Manage MFA
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Container>
    );
}
