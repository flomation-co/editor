import OrganisationContext from "~/context/organisation/context";
import {useContext} from "react";

export const useOrganisation = () => {
    const context = useContext(OrganisationContext);
    if (!context) {
        throw new Error("useOrganisation must be used within OrganisationProvider");
    }
    return context;
}
