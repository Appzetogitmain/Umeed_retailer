import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface PublicRouteProps {
    children?: React.ReactNode;
}

export default function PublicRoute({ children }: PublicRouteProps) {
    const { isAuthenticated, user } = useAuth();

    if (isAuthenticated && user) {
        // Redirect authenticated users away from any public/login page to
        // their own role's dashboard, regardless of which role's login page
        // they landed on (e.g. a logged-in Customer hitting /seller/login).
        const currentUserType = (user as any).userType || (user as any).role;

        if (currentUserType === 'Admin' || currentUserType === 'Super Admin') {
            return <Navigate to="/admin" replace />;
        }

        if (currentUserType === 'Seller') {
            return <Navigate to="/seller" replace />;
        }

        if (currentUserType === 'Delivery') {
            return <Navigate to="/delivery" replace />;
        }

        // Default for Customer
        return <Navigate to="/" replace />;
    }

    return children ? <>{children}</> : <Outlet />;
}
