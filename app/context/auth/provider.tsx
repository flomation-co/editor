import {useEffect, useState} from "react";
import type {AuthUser, JWTPayload} from "~/types";
import AuthContext from "~/context/auth/context";
import useCookieToken from "~/components/cookie";
import useConfig from "~/components/config";
import Cookies from "js-cookie";
import api from "~/lib/api";

export default function AuthProvider({ children }: { children: React.ReactNode}) {
    const [ user, setUser ] = useState<AuthUser | null>(null);
    const [ userID, setUserID ] = useState<string | null>(null);
    const config = useConfig()

    const token = useCookieToken();

    const logout = () => {
        Cookies.remove("flomation-token");
        const redirectUrl = config("LOGIN_URL");
        if (redirectUrl) {
            window.location.replace(redirectUrl + "?redirect_url=" + window.location.href);
        }
    };

    useEffect(() => {
        if (!token) {
            // Skip redirect for invite pages — they handle auth themselves
            if (window.location.pathname.startsWith("/invite/")) {
                return;
            }

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

        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            logout();
            return;
        }

        setUserID(payload.id)

        const API_URL = config("AUTOMATE_API_URL");
        api.get(API_URL + "/api/v1/user", {
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
        <AuthContext.Provider value={{ user, setUser, userID, token, logout }}>
            {children}
        </AuthContext.Provider>
    )
}
