import { Link } from "react-router";
import { Icon } from "~/components/icons/Icon";
import "./index.css";

type AccessDeniedProps = {
    permission?: string;
};

export default function AccessDenied({ permission }: AccessDeniedProps) {
    return (
        <div className="access-denied">
            <div className="access-denied-icon">
                <Icon name="lock" />
            </div>
            <h2>Access Denied</h2>
            <p>You do not have permission to view this page.</p>
            {permission && (
                <p className="access-denied-permission">
                    Required permission: <code>{permission}</code>
                </p>
            )}
            <p className="access-denied-contact">
                Contact your organisation administrator to request access.
            </p>
            <Link to="/" className="access-denied-link">
                <Icon name="house" /> Return to Dashboard
            </Link>
        </div>
    );
}
