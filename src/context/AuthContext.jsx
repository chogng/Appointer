import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiService } from "../services/apiService";
import { socketService } from "../services/socketService";
import { AuthContext } from "./auth-context";

// 开发模式：启用虚拟登录（设为 true 可跳过后端验证）
const DEV_MOCK_LOGIN =
  String(import.meta.env?.VITE_MOCK_API || "").toLowerCase() === "true";

// 虚拟用户数据
const MOCK_USERS = {
  admin: {
    id: "user_mock_admin",
    username: "admin",
    name: "管理员",
    email: "admin@example.com",
    role: "SUPER_ADMIN",
    status: "ACTIVE",
  },
  user: {
    id: "user_mock_user",
    username: "user",
    name: "普通用户",
    email: "user@example.com",
    role: "USER",
    status: "ACTIVE",
  },
};

export const AuthProvider = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      // 开发模式：从 localStorage 恢复
      if (DEV_MOCK_LOGIN) {
        const saved = localStorage.getItem("mock_user");
        if (saved) {
          try {
            setUser(JSON.parse(saved));
          } catch {
            setUser(null);
          }
        }
        setLoading(false);
        return;
      }

      try {
        // Try to get current user from server (using cookie)
        const user = await apiService.request("/auth/me");
        setUser(user);
      } catch {
        // Not authenticated
        socketService.disconnect();
        queryClient.clear();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, [queryClient]);

  const login = async (username, password) => {
    // 开发模式：虚拟登录
    if (DEV_MOCK_LOGIN) {
      const mockUser = MOCK_USERS[username] || MOCK_USERS.admin;
      setUser(mockUser);
      localStorage.setItem("mock_user", JSON.stringify(mockUser));
      return { success: true };
    }

    try {
      const userData = await apiService.login(username, password);
      setUser(userData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = useCallback(async () => {
    // 开发模式：清理 localStorage
    if (DEV_MOCK_LOGIN) {
      localStorage.removeItem("mock_user");
      setUser(null);
      return;
    }

    try {
      await apiService.request("/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout failed", error);
    }
    socketService.disconnect();
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

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
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{ user, login, logout, register, loading, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};
