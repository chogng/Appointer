import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { AuthContext } from './auth-context';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for existing session (simple storage check for demo)
        const storedUser = localStorage.getItem('drms_current_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const login = async (username, password) => {
        try {
            const userData = await apiService.login(username, password);
            setUser(userData);
            localStorage.setItem('drms_current_user', JSON.stringify(userData));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('drms_current_user');
    };

    const register = async (data) => {
        try {
            await apiService.createUser(data);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, register, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
