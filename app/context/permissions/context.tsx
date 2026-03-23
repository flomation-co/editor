import {createContext} from "react";

interface PermissionsContextType {
    permissions: string[];
    isAdmin: boolean;
    hasPermission: (perm: string) => boolean;
    isLoading: boolean;
}

const PermissionsContext = createContext<PermissionsContextType | null>(null);

export default PermissionsContext;
