import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../hooks/useLanguage";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Package,
  Users,
  Trophy,
  Activity,
} from "lucide-react";
import MiniCalendar from "../components/MiniCalendar";

const DashboardIcon = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect
      x="3"
      y="3"
      width="8"
      height="10"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect
      x="3"
      y="15"
      width="8"
      height="6"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect
      x="13"
      y="3"
      width="8"
      height="6"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect
      x="13"
      y="11"
      width="8"
      height="10"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const DevicesIcon = ({ size = 24, className = "" }) => (
  <svg
    fill="none"
    height={size}
    viewBox="0 0 24 24"
    width={size}
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect
      height="14"
      rx="2"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="2"
      width="20"
      x="2"
      y="3"
    ></rect>
    <path
      d="M8 21H16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    ></path>
    <path
      d="M12 17V21"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    ></path>
  </svg>
);

const MessageIcon = ({ size = 24, className = "" }) => (
  <svg
    fill="none"
    height={size}
    viewBox="0 0 24 24"
    width={size}
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M3 20.29V5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V15C21 16.1046 20.1046 17 19 17H7.29L3 20.29Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="2"
    ></path>
    <path
      d="M8 9H16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    ></path>
    <path
      d="M8 13H13"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    ></path>
  </svg>
);

const BookingIcon = ({ size = 20, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" />
    <path d="M16 2V6" />
    <path d="M8 2V6" />
    <path d="M3 10H21" />
    <path d="M8 16L11 18L16 13" />
  </svg>
);

const LogoutIcon = ({ size = 24, className = "" }) => (
  <svg
    fill="none"
    height={size}
    viewBox="0 0 24 24"
    width={size}
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    ></path>
    <path
      d="M16 17L21 12L16 7"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    ></path>
    <path
      d="M21 12H9"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    ></path>
  </svg>
);

const SidebarCollapseIcon = ({ size = 24, className = "" }) => (
  <svg
    fill="none"
    height={size}
    viewBox="0 0 24 24"
    width={size}
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect
      height="18"
      rx="2"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      width="18"
      x="3"
      y="3"
    ></rect>
    <path
      d="M9 3V21"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    ></path>
    <path
      d="M15 15L12 12L15 9"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    ></path>
  </svg>
);

const UserIcon = ({ size = 24, className = "" }) => (
  <svg
    fill="none"
    height={size}
    viewBox="0 0 24 24"
    width={size}
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle
      cx="12"
      cy="7"
      r="4"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    ></circle>
    <path
      d="M20 21V19C20 16.7909 18.2091 15 16 15H8C5.79086 15 4 16.7909 4 19V21"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    ></path>
    <path
      d="M12 11V17"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    ></path>
    <path
      d="M12 17L10 15"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    ></path>
    <path
      d="M12 17L14 15"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    ></path>
  </svg>
);

const ActivityIcon = ({ size = 20, className = "" }) => (
  <Activity size={size} className={className} />
);

const MainLayout = () => {
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();

  const navItems = [
    { icon: DashboardIcon, label: t("dashboard"), path: "/dashboard" },
    {
      icon: ActivityIcon,
      label: t("device_analysis") || "Device Analysis",
      path: "/device-analysis",
    },
    {
      icon: BookOpen,
      label: t("literature_research") || "Literature Research",
      path: "/literature-research",
    },
    { icon: DevicesIcon, label: t("devices"), path: "/devices" },
    { icon: Package, label: t("inventory"), path: "/inventory" },
    { icon: BookingIcon, label: t("booking"), path: "/reservations" },
    { icon: MessageIcon, label: t("messages"), path: "/messages" },
  ];

  if (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") {
    navItems.push({
      icon: Users,
      label: t("user_management") || "Users",
      path: "/users",
    });
    navItems.push({
      icon: Trophy,
      label: t("leaderboard") || "Leaderboard",
      path: "/leaderboard",
    });
  }

  return (
    <div className="h-screen bg-bg-page flex overflow-hidden">
      {/* backdrop decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-15%] w-[60%] h-[60%] rounded-full bg-indigo-500/15 blur-[160px] animate-float-slow"></div>
        <div className="absolute bottom-[-10%] right-[-15%] w-[55%] h-[55%] rounded-full bg-violet-400/15 blur-[140px] animate-float-slower"></div>
        <div
          className="absolute top-[20%] right-[5%] w-[40%] h-[40%] rounded-full bg-indigo-300/10 blur-[120px] animate-float-slow"
          style={{ animationDelay: "-10s" }}
        ></div>
        <div className="absolute inset-0 bg-grain opacity-[0.02]"></div>
      </div>

      <aside
        className={`
                    h-full bg-bg-surface/70 backdrop-blur-2xl border-r border-border flex flex-col z-50 flex-shrink-0 relative
                    transition-all duration-500 ease-in-out overflow-hidden
                    ${isCollapsed ? "w-20" : "w-[280px]"}
                `}
      >
        <div
          className={`flex items-center mb-10 text-text-primary pt-6 transition-all duration-500 pl-[28px] pr-6 gap-2.5 relative`}
        >
          <img
            src="/logo.svg"
            alt="Appointer Logo"
            className="w-6 h-6 object-contain shrink-0"
          />
          <span
            className={`text-xl font-bold truncate transition-all duration-500 ${isCollapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[150px] opacity-100"}`}
          >
            Appointer
          </span>

          {/* Toggle Button in Header */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`
                            absolute right-4 p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-black/5 transition-all duration-300
                            ${isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"}
                        `}
          >
            <SidebarCollapseIcon size={20} />
          </button>
        </div>

        {/* Invisible Toggle Overlay on Logo for Collapsed State */}
        {isCollapsed && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute top-6 left-[28px] w-6 h-6 z-50 cursor-pointer"
            title="展开菜单"
          />
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto mb-4 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                                flex items-center rounded-2xl mb-1.5 h-12
                                transition-all duration-500 text-[15px] group relative
                                mx-3 pl-2.5 pr-4 gap-3.5
                                ${
                                  isActive
                                    ? "bg-accent text-white font-semibold shadow-lg shadow-accent/25"
                                    : "text-text-secondary hover:text-text-primary hover:bg-accent/5"
                                }
                            `}
              title={isCollapsed ? item.label : ""}
            >
              <item.icon size={20} className="shrink-0" />
              <span
                className={`truncate transition-all duration-500 ${isCollapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[150px] opacity-100"}`}
              >
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>

        {/* MiniCalendar */}
        <div
          className={`mb-4 px-2 transition-all duration-500 overflow-hidden ${isCollapsed ? "opacity-0 max-h-0" : "opacity-100 max-h-[300px]"}`}
        >
          <MiniCalendar className="bg-transparent p-0" />
        </div>

        {/* User Info Section */}
        <div
          className={`
                    mt-auto border-t border-border-subtle flex-shrink-0 transition-all duration-500 relative overflow-hidden
                    ${isCollapsed ? "h-[148px]" : "h-24"}
                `}
        >
          {/* User Icon - Maintains fixed horizontal position (centered at 40px) */}
          <div
            className="absolute w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center transition-all duration-500 -translate-y-1/2"
            style={{
              left: "20px",
              top: isCollapsed ? "44px" : "48px",
            }}
          >
            <UserIcon size={20} className="text-text-secondary" />
          </div>

          {/* User Text - Click to go to Settings */}
          <div
            className={`
                            absolute transition-all duration-500 overflow-hidden -translate-y-1/2 cursor-pointer
                            ${
                              isCollapsed
                                ? "opacity-0 pointer-events-none"
                                : "opacity-100"
                            }
                        `}
            onClick={() => navigate("/settings")}
            style={{
              left: "70px",
              top: "48px",
              width: isCollapsed ? "0px" : "140px",
            }}
          >
            <div className="font-semibold text-sm truncate text-text-primary hover:text-accent transition-colors">
              {user?.name}
            </div>
            <div className="text-xs text-text-secondary truncate">
              {t(user?.role)}
            </div>
          </div>

          {/* Logout Button - Moves left/center when collapsed */}
          <button
            onClick={logout}
            className="absolute p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/5 transition-all duration-500 -translate-y-1/2"
            style={{
              left: isCollapsed ? "23px" : "234px",
              top: isCollapsed ? "108px" : "48px",
            }}
            title={t("logout")}
          >
            <LogoutIcon size={18} />
          </button>
        </div>
      </aside>

      {/* main content */}
      <main className="flex-1 h-full overflow-hidden flex flex-col relative">
        <div className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
