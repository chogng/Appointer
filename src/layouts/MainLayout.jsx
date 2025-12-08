import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Monitor, Calendar, MessageSquare, LogOut, User } from 'lucide-react';

import MiniCalendar from '../components/MiniCalendar';

const MainLayout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: Monitor, label: 'Devices', path: '/devices' },
        { icon: Calendar, label: 'Booking', path: '/reservations' },
        { icon: MessageSquare, label: 'Messages', path: '/messages' },
    ];

    return (
        <div className="h-screen bg-bg-page flex overflow-hidden">
            <aside className="w-[260px] h-full bg-bg-surface/80 backdrop-blur-xl border-r border-border-subtle flex flex-col z-50 flex-shrink-0">
                <div className="text-xl font-bold mb-10 flex items-center gap-2.5 text-text-primary px-6 pt-6">
                    <img src="/logo.svg" alt="Appointer Logo" className="w-6 h-6 object-contain" />
                    Appointer
                </div>
                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto mb-4 px-2">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `
                                flex items-center gap-3 px-4 py-3 rounded-xl mb-1
                                transition-all duration-200 text-[15px]
                                ${isActive
                                    ? 'bg-white text-black font-medium'
                                    : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                                }
                            `}
                        >
                            <item.icon size={20} />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                {/* MiniCalendar */}
                <div className="mb-4 px-2">
                    <MiniCalendar className="bg-transparent p-0" />
                </div>

                {/* User Info */}
                <div className="mt-auto pt-5 border-t border-border-subtle flex items-center gap-3 flex-shrink-0 px-6 pb-6">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                        <User size={20} className="text-text-secondary" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <div className="font-semibold text-sm truncate text-text-primary">
                            {user?.name}
                        </div>
                        <div className="text-xs text-text-secondary">
                            {user?.role}
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
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
