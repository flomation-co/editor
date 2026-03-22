import {useEffect, useState} from "react";
import type {AuthUser, JWTPayload} from "~/types";
import AuthContext from "~/context/auth/context";
import useCookieToken from "~/components/cookie";
import useConfig from "~/components/config";
import axios from "axios";

export default function AuthProvider({ children }: { children: React.ReactNode}) {
    const [ user, setUser ] = useState<AuthUser | null>(null);
    const [ userID, setUserID ] = useState<string | null>(null);
    const [ token, setToken ] = useState<string | null>(null);
    const config = useConfig()

    // Read the cookie on the client only, after hydration.
    useEffect(() => {
        const cookieToken = useCookieToken();
        setToken(cookieToken);
    }, []);

    useEffect(() => {
        if (token === null) {
            return;
        }

        if (!token) {
            const redirectUrl = config("LOGIN_URL");
            const location = window.location;
            window.location.replace(redirectUrl + "?redirect_url=" + location.href)
            return;
        }

        const tokenParts = token.split(".");
        if (tokenParts.length != 3) {
            setToken(null);
            return;
        }

        // TODO: We should check Header + Footer parts, for now just parse the payload and store as a User
        const payload : JWTPayload = JSON.parse(atob(tokenParts[1]));
        if (!payload) {
            setToken(null);
            return;
        }

        setUserID(payload.id)
    }, [ token ]);

    useEffect(() => {
        if (userID) {
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
        }
    }, [ userID ]);

    return (
        <AuthContext.Provider value={{ user, setUser, userID, token }}>
            {children}
        </AuthContext.Provider>
    )
}