import { useState, useEffect } from "react";
import { apiService } from "../services/apiService";
import { socketService } from "../services/socketService";
import { AuthContext } from "./auth-context";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Try to get current user from server (using cookie)
        const user = await apiService.request("/auth/me");
        setUser(user);
      } catch {
        // Not authenticated
        socketService.disconnect();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  const login = async (username, password) => {
    try {
      const userData = await apiService.login(username, password);
      setUser(userData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await apiService.request("/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout failed", error);
    }
    socketService.disconnect();
    setUser(null);
  };

  const register = async (data) => {
    try {
      await apiService.createUser(data);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const updateUser = async (updates) => {
    try {
      if (user?.id) {
        await apiService.updateUser(user.id, updates);
      }
      const newUser = { ...user, ...updates };
      setUser(newUser);
      return { success: true };
    } catch (error) {
      console.error("Update user failed:", error);
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    apiService.bindUnauthorizedCallback(logout);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, login, logout, register, loading, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};
