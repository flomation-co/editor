import type {Route} from "../+types/home";
import Container from "~/components/container";
import React, {useEffect, useState} from "react";
import {useAuth} from "~/context/auth/use";
import type {AuthUser} from "~/types";
import api from "~/lib/api";
import useConfig from "~/components/config";
import useCookieToken from "~/components/cookie";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";

dayjs.extend(relativeTime);
dayjs.extend(utc);

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Flomation - Profile" },
        { name: "description", content: "Get in the Flo" },
    ];
}

export default function Profile() {
    const config = useConfig();

    const auth = useAuth();
    const token = useCookieToken();

    const [ user, setUser ] = useState<AuthUser | null>()
    const [ name, setName ] = useState<string | null>();

    useEffect(() => {
        setUser(auth.user);
    }, [ auth ]);

    useEffect(() => {
        setName(user?.name);
    }, [ user ]);

    const onNameChange = (e) => {
        setName(e.target.value);
    }

    const onEmailChange = (e) => {
        console.log("Email", e.target.value);
    }

    const openMFA = () => {
        const mfaManageURL = config("LOGIN_URL") + "/mfa";
        window.location.replace(mfaManageURL)
    }

    const saveProfile = () => {
        const url = config("AUTOMATE_API_URL");

        let updatedUser = structuredClone(user);
        if (!updatedUser) {
            return;
        }

        updatedUser.name = name ? name : "";

        api.post(url + '/api/v1/user/' + updatedUser.id, updatedUser, {
            headers: {
                'Content-Type': 'application/json',
                "Authorization": "Bearer " + token,
            }
        })
            .then(response => {
                if (response) {
                    auth.setUser(response.data);
                    //     TODO: show a success toast or something
                }
            })
            .catch(error => {
                console.error(error);
            })
    }

    return (
        <Container>
            <div className={"header"}>Profile</div>

            <div className={"form-container"}>
                <div className={"form-inner-container"}>
                    <div className={"form-row"} >
                        <div className={"form-input-name"} >Display Name</div>
                        <input type={"text"} id={"display_name"} placeholder={"Display Name"} value={name ? name : ""} onChange={onNameChange}/>
                    </div>
                    <div className={"form-row"} >
                        <div className={"form-input-name"} >Email Address</div>
                        <input type={"email"} id={"email_address"} disabled={true} placeholder={"Email Address"} value={user?.email_address ? user.email_address : ""} onChange={onEmailChange}/>
                    </div>

                    <div className={"form-row"} >
                        <div className={"flo-table-subtext"}>Registered {dayjs.utc(user?.created_at).fromNow()}</div>
                    </div>
                    <div className={"form-row"} >
                        <input type={"submit"} value={"Manage MFA"} disabled={true} style={{opacity: 0.5, cursor: "not-allowed"}} onClick={openMFA}/>
                    </div>
                    <div className={"form-row"} >
                        <div className={`form-input-name`} ></div>
                        <input type={"submit"} value={"Save"} disabled={!user} style={{cursor: user ? "pointer" : "not-allowed"}} onClick={saveProfile}/>
                    </div>
                </div>
            </div>
        </Container>
    )
}