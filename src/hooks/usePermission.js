import { useAuth } from '../context/AuthContext';

export const usePermission = () => {
    const { user } = useAuth();

    const isAdmin = () => {
        return user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
    };

    const isSuperAdmin = () => {
        return user?.role === 'SUPER_ADMIN';
    };

    const isUser = () => {
        return user?.role === 'USER';
    };

    return {
        isAdmin,
        isSuperAdmin,
        isUser,
        role: user?.role
    };
};
