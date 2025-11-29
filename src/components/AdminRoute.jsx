import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AdminRoute = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen">
            <div className="text-text-secondary">Loading...</div>
        </div>;
    }

    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

    if (!isAdmin) {
        return <Navigate to="/devices" replace />;
    }

    return children;
};

export default AdminRoute;
