import {useEffect, useState} from "react";
import type {AuthUser, JWTPayload} from "~/types";
import AuthContext from "~/context/auth/context";
import useCookieToken from "~/components/cookie";
import useConfig from "~/components/config";
import axios from "axios";

export default function AuthProvider({ children }: { children: React.ReactNode}) {
    const [ user, setUser ] = useState<AuthUser | null>(null);
    const [ userID, setUserID ] = useState<string | null>(null);
    const config = useConfig()

    // Read the cookie directly on each render (works client-side after hydration,
    // matching the pattern used by Dashboard and other pages).
    const token = useCookieToken();

    useEffect(() => {
        if (!token) {
            const redirectUrl = config("LOGIN_URL");
            if (redirectUrl) {
                window.location.replace(redirectUrl + "?redirect_url=" + window.location.href)
            }
            return;
        }

        const tokenParts = token.split(".");
        if (tokenParts.length != 3) {
            return;
        }

        const payload : JWTPayload = JSON.parse(atob(tokenParts[1]));
        if (!payload) {
            return;
        }

        setUserID(payload.id)

        const API_URL = config("AUTOMATE_API_URL");
        axios.get(API_URL + "/api/v1/user", {
            headers: {
                "Authorization": "Bearer " + token,
            }
        })
            .then(response => {
                setUser(response.data);
            })
            .catch(error => {
                console.error("Unable to fetch user", error);
            })
    }, [ token ]);

    return (
        <AuthContext.Provider value={{ user, setUser, userID, token }}>
            {children}
        </AuthContext.Provider>
    )
}
