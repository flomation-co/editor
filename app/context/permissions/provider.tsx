import {useEffect, useState} from "react";
import PermissionsContext from "~/context/permissions/context";
import {useOrganisation} from "~/context/organisation/use";
import useCookieToken from "~/components/cookie";
import useConfig from "~/components/config";
import api from "~/lib/api";
import type {UserPermissions} from "~/types";
import {PERMISSIONS} from "~/types";

export default function PermissionsProvider({ children }: { children: React.ReactNode }) {
    const [permissions, setPermissions] = useState<string[]>(Object.values(PERMISSIONS));
    const [isAdmin, setIsAdmin] = useState<boolean>(true);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const { currentOrg } = useOrganisation();
    const token = useCookieToken();
    const config = useConfig();

    useEffect(() => {
        if (!token) return;

        if (!currentOrg) {
            // Personal mode — all permissions
            setPermissions(Object.values(PERMISSIONS));
            setIsAdmin(true);
            setIsLoading(false);
            return;
        }

        const API_URL = config("AUTOMATE_API_URL");
        setIsLoading(true);

        api.get(API_URL + `/api/v1/organisation/${currentOrg.id}/permissions`, {
            headers: { Authorization: "Bearer " + token }
        })
            .then(response => {
                const data: UserPermissions = response.data;
                setPermissions(data.permissions || []);
                setIsAdmin(data.is_admin);
            })
            .catch(() => {
                // Fallback: grant all to avoid locking users out
                setPermissions(Object.values(PERMISSIONS));
                setIsAdmin(true);
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [token, currentOrg?.id]);

    const hasPermission = (perm: string): boolean => {
        if (isAdmin) return true;
        return permissions.includes(perm);
    };

    return (
        <PermissionsContext.Provider value={{
            permissions,
            isAdmin,
            hasPermission,
            isLoading,
        }}>
            {children}
        </PermissionsContext.Provider>
    );
}
