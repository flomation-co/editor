import type {Organisation} from "~/types";
import {createContext} from "react";

interface OrganisationContextType {
    organisations: Organisation[];
    currentOrg: Organisation | null;
    setCurrentOrg: (org: Organisation | null) => void;
    isOrgMode: boolean;
    refreshOrganisations: () => void;
}

const OrganisationContext = createContext<OrganisationContextType | null>(null);

export default OrganisationContext;
