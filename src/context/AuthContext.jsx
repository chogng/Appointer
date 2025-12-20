import { useState } from 'react';
import { apiService } from '../services/apiService';
import { AuthContext } from './auth-context';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        try {
            const storedUser = localStorage.getItem('drms_current_user');
            return storedUser ? JSON.parse(storedUser) : null;
        } catch {
            return null;
        }
    });
    const loading = false;

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

    const updateUser = (updates) => {
        const newUser = { ...user, ...updates };
        setUser(newUser);
        localStorage.setItem('drms_current_user', JSON.stringify(newUser));
        return { success: true };
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, register, loading, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
};
