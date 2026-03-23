import PermissionsContext from "~/context/permissions/context";
import {useContext} from "react";

export const usePermissions = () => {
    const context = useContext(PermissionsContext);
    if (!context) {
        throw new Error("usePermissions must be used within PermissionsProvider");
    }
    return context;
}
