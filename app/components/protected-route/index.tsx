import { usePermissions } from "~/context/permissions/use";
import AccessDenied from "~/components/access-denied";

type ProtectedRouteProps = {
    permission?: string;
    permissions?: string[];
    children: React.ReactNode;
};

export default function ProtectedRoute({ permission, permissions, children }: ProtectedRouteProps) {
    const { hasPermission, isLoading } = usePermissions();

    if (isLoading) {
        return null;
    }

    const requiredPerms = permissions || (permission ? [permission] : []);

    if (requiredPerms.length > 0) {
        const hasAccess = requiredPerms.some(p => hasPermission(p));
        if (!hasAccess) {
            return <AccessDenied permission={requiredPerms.join(" or ")} />;
        }
    }

    return <>{children}</>;
}
