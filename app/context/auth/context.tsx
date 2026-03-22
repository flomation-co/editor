import type {AuthUser} from "~/types";
import {createContext} from "react";

interface AuthContextType {
    user: AuthUser | null;
    setUser: (user: AuthUser | null) => void;
    userID: string | null;
    token: string | null;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export default AuthContext;
