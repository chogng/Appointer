import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { Calendar, LogOut, User, ChevronLeft, ChevronRight } from 'lucide-react';

const DashboardIcon = ({ size = 20, className = "" }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <rect x="3" y="3" width="8" height="10" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="3" y="15" width="8" height="6" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="13" y="3" width="8" height="6" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="13" y="11" width="8" height="10" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const DevicesIcon = ({ size = 24, className = "" }) => (
    <svg fill="none" height={size} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg" className={className}>
        <rect height="14" rx="2" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" width="20" x="2" y="3"></rect>
        <path d="M8 21H16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
        <path d="M12 17V21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
    </svg>
);

import MiniCalendar from '../components/MiniCalendar';

const MessageIcon = ({ size = 24, className = "" }) => (
    <svg fill="none" height={size} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M3 20.29V5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V15C21 16.1046 20.1046 17 19 17H7.29L3 20.29Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="2"></path>
        <path d="M8 9H16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
        <path d="M8 13H13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
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

const MainLayout = () => {
    const { user, logout } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const navItems = [
        { icon: DashboardIcon, label: 'Dashboard', path: '/dashboard' },
        { icon: DevicesIcon, label: 'Devices', path: '/devices' },
        { icon: BookingIcon, label: 'Booking', path: '/reservations' },
        { icon: MessageIcon, label: 'Messages', path: '/messages' },
    ];

    return (
        <div className="h-screen bg-bg-page flex overflow-hidden">
            {/* backdrop decoration */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-300/30 blur-[140px] animate-float-slow"></div>
                <div className="absolute bottom-[5%] right-[-10%] w-[45%] h-[45%] rounded-full bg-violet-300/30 blur-[120px] animate-float-slower"></div>
                <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] rounded-full bg-blue-200/20 blur-[100px] animate-float-slow" style={{ animationDelay: '-8s' }}></div>
                <div className="absolute inset-0 bg-grain opacity-[0.03]"></div>
            </div>

            <aside
                className={`
                    h-full bg-bg-surface/80 backdrop-blur-xl border-r border-border-subtle flex flex-col z-50 flex-shrink-0 relative
                    transition-all duration-300 ease-in-out
                    ${isCollapsed ? 'w-20' : 'w-[260px]'}
                `}
            >
                <div className={`flex items-center mb-10 text-text-primary pt-6 px-6 ${isCollapsed ? 'justify-center px-0' : 'gap-2.5'}`}>
                    <img src="/logo.svg" alt="Appointer Logo" className="w-6 h-6 object-contain shrink-0" />
                    {!isCollapsed && <span className="text-xl font-bold truncate">Appointer</span>}
                </div>

                {/* Toggle Button */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="absolute -right-3 top-8 w-6 h-6 bg-white border border-border-subtle rounded-full flex items-center justify-center shadow-sm text-text-secondary hover:text-text-primary z-50 transition-transform duration-300"
                >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto mb-4 px-2">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `
                                flex items-center rounded-xl mb-1
                                transition-all duration-200 text-[15px]
                                ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'}
                                ${isActive
                                    ? 'bg-white text-black font-medium shadow-sm'
                                    : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                                }
                            `}
                            title={isCollapsed ? item.label : ''}
                        >
                            <item.icon size={20} className="shrink-0" />
                            {!isCollapsed && <span className="truncate">{item.label}</span>}
                        </NavLink>
                    ))}
                </nav>

                {/* MiniCalendar */}
                <div className={`mb-4 px-2 transition-all duration-300 overflow-hidden ${isCollapsed ? 'opacity-0 h-0 invisible' : 'opacity-100 h-auto visible'}`}>
                    <MiniCalendar className="bg-transparent p-0" />
                </div>

                {/* User Info */}
                <div className={`mt-auto pt-5 border-t border-border-subtle flex items-center flex-shrink-0 pb-6 transition-all duration-300 ${isCollapsed ? 'justify-center px-2 flex-col gap-4' : 'gap-3 px-6'}`}>
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                        <User size={20} className="text-text-secondary" />
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 overflow-hidden">
                            <div className="font-semibold text-sm truncate text-text-primary">
                                {user?.name}
                            </div>
                            <div className="text-xs text-text-secondary">
                                {user?.role}
                            </div>
                        </div>
                    )}
                    <button
                        onClick={logout}
                        className={`p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors ${isCollapsed ? 'mt-auto' : ''}`}
                        title="退出登录"
                    >
                        <LogOut size={18} />
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
