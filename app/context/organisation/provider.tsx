import {useEffect, useState} from "react";
import type {Organisation} from "~/types";
import OrganisationContext from "~/context/organisation/context";
import useCookieToken from "~/components/cookie";
import useConfig from "~/components/config";
import api from "~/lib/api";

const ORG_STORAGE_KEY = "flomation-current-org";

export default function OrganisationProvider({ children }: { children: React.ReactNode }) {
    const [organisations, setOrganisations] = useState<Organisation[]>([]);
    const [currentOrg, setCurrentOrgState] = useState<Organisation | null>(null);
    const token = useCookieToken();
    const config = useConfig();

    const fetchOrganisations = () => {
        if (!token) return;

        const API_URL = config("AUTOMATE_API_URL");
        api.get(API_URL + "/api/v1/organisation", {
            headers: { Authorization: "Bearer " + token }
        })
            .then(response => {
                if (response.data) {
                    setOrganisations(response.data);
                }
            })
            .catch(() => {
                setOrganisations([]);
            });
    };

    useEffect(() => {
        fetchOrganisations();
    }, [token]);

    // Restore selected org from localStorage
    useEffect(() => {
        if (organisations.length === 0) return;

        const savedOrgId = localStorage.getItem(ORG_STORAGE_KEY);
        if (savedOrgId) {
            const found = organisations.find(o => o.id === savedOrgId);
            if (found) {
                setCurrentOrgState(found);
            }
        }
    }, [organisations]);

    const setCurrentOrg = (org: Organisation | null) => {
        const previousOrgId = localStorage.getItem(ORG_STORAGE_KEY);
        const newOrgId = org?.id || null;

        setCurrentOrgState(org);
        if (org) {
            localStorage.setItem(ORG_STORAGE_KEY, org.id);
        } else {
            localStorage.removeItem(ORG_STORAGE_KEY);
        }

        // Reload the page so all data re-fetches with the new org context
        if (previousOrgId !== newOrgId) {
            window.location.reload();
        }
    };

    return (
        <OrganisationContext.Provider value={{
            organisations,
            currentOrg,
            setCurrentOrg,
            isOrgMode: currentOrg !== null,
            refreshOrganisations: fetchOrganisations,
        }}>
            {children}
        </OrganisationContext.Provider>
    );
}
