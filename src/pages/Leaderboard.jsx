import React, { useEffect, useState } from 'react';
import { apiService } from '../services/apiService';
import { Crown, Sparkles, Trophy, Medal, Timer } from 'lucide-react';
import { useLanguage } from '../context/useLanguage';

const Avatar = ({ name, className = "", style = {} }) => (
    <div
        className={`rounded-full flex items-center justify-center font-bold text-white shadow-lg overflow-hidden relative ${className}`}
        style={{ ...style }}
    >
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 opacity-90" />
        <span className="relative z-10 text-lg md:text-xl font-medium tracking-tight">
            {name ? name.charAt(0).toUpperCase() : '?'}
        </span>
    </div>
);

const PodiumCard = ({ user, rank }) => {
    if (!user) return <div className="w-full h-full opacity-0" />;

    const isFirst = rank === 1;
    const isSecond = rank === 2;
    const isThird = rank === 3;

    let containerClasses = "mt-4 h-[280px]";
    let cardClasses = "bg-white/60 border-white/40";
    let ringColor = "ring-gray-200";
    let icon = null;
    let rankColor = "text-text-tertiary";

    if (isFirst) {
        containerClasses = "h-[320px] -mt-4 z-10"; // Elevated
        cardClasses = "bg-gradient-to-b from-yellow-50/80 to-white/80 border-yellow-200/60 shadow-xl shadow-yellow-500/10";
        ringColor = "ring-yellow-300";
        icon = <Crown className="w-8 h-8 text-yellow-500 fill-yellow-500 animate-bounce-slow" />;
        rankColor = "text-yellow-500/20";
    } else if (isSecond) {
        containerClasses = "mt-4 h-[280px]";
        cardClasses = "bg-gradient-to-b from-slate-50/80 to-white/80 border-slate-200/60 shadow-lg";
        ringColor = "ring-slate-300";
        icon = <Medal className="w-6 h-6 text-slate-400" />;
        rankColor = "text-slate-400/20";
    } else if (isThird) {
        containerClasses = "mt-8 h-[260px]";
        cardClasses = "bg-gradient-to-b from-orange-50/80 to-white/80 border-orange-200/60 shadow-lg";
        ringColor = "ring-orange-300";
        icon = <Medal className="w-6 h-6 text-amber-600" />;
        rankColor = "text-amber-600/20";
    }

    return (
        <div className={`relative flex flex-col ${containerClasses} w-full max-w-[240px] transition-all duration-500 hover:-translate-y-2`}>
            <div className={`
                flex-1 rounded-3xl backdrop-blur-xl border flex flex-col items-center justify-center p-6 relative overflow-hidden group
                ${cardClasses}
            `}>
                {/* Background Rank Number */}
                <span className={`absolute -bottom-6 -right-4 text-[120px] font-black leading-none select-none pointer-events-none transition-transform duration-500 group-hover:scale-110 ${rankColor}`}>
                    {rank}
                </span>

                {/* Crown/Medal Icon */}
                <div className="mb-4 relative z-10">
                    {icon}
                </div>

                {/* Avatar */}
                <div className={`p-1 rounded-full ring-4 ${ringColor} bg-white relative z-10 mb-4 shadow-sm`}>
                    <Avatar name={user.name} className="w-20 h-20 text-2xl" />
                </div>

                {/* User Info */}
                <div className="text-center relative z-10 w-full">
                    <h3 className="font-bold text-text-primary text-lg truncate px-2 mb-1">
                        {user.name}
                    </h3>

                    <div className="mt-4 flex items-center justify-center gap-2 text-indigo-600 bg-indigo-50/50 py-1.5 px-4 rounded-xl">
                        <Timer className="w-4 h-4" />
                        <span className="font-bold font-mono text-lg">{user.totalHours}</span>
                        <span className="text-xs font-medium opacity-70">hrs</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Leaderboard = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const { t } = useLanguage();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await apiService.getLeaderboard();
                setData(res);
            } catch (error) {
                console.error("Failed to fetch leaderboard", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const topThree = [
        data[1] || null, // 2nd
        data[0] || null, // 1st
        data[2] || null  // 3rd
    ];

    const restUsers = data.slice(3);

    return (
        <div className="max-w-[1500px] mx-auto min-h-screen relative animate-fade-in pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-1 gap-4">
                <div>
                    <h1 className="text-3xl font-serif font-medium text-text-primary mb-2 flex items-center gap-3">
                        {t('leaderboard') || 'Leaderboard'}
                    </h1>
                    <p className="text-text-secondary">
                        {t('leaderboard_subtitle') || 'Top contributors by total reservation hours. Keep up the good work!'}
                    </p>
                </div>
            </div>

            {/* Podium Section */}
            <div className="flex flex-row justify-center items-end gap-6 md:gap-8 px-4 h-[350px] mb-12">
                {loading ? (
                    <div className="text-text-secondary animate-pulse">Loading podium...</div>
                ) : (
                    <>
                        <PodiumCard user={topThree[0]} rank={2} />
                        <PodiumCard user={topThree[1]} rank={1} />
                        <PodiumCard user={topThree[2]} rank={3} />
                    </>
                )}
            </div>

            {/* List Section */}
            <div className="bg-white/60 backdrop-blur-xl rounded-[32px] border border-white/60 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border/40 text-text-tertiary text-xs uppercase tracking-wider font-semibold">
                                <th className="py-5 px-8 w-24">{t('rank')}</th>
                                <th className="py-5 px-8">{t('column_user')}</th>
                                <th className="py-5 px-8 text-center">{t('role')}</th>
                                <th className="py-5 px-8 text-right">{t('total_duration')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 text-text-primary">
                            {restUsers.length > 0 ? (
                                restUsers.map((user, index) => (
                                    <tr
                                        key={user.id}
                                        className="hover:bg-white/50 transition-colors duration-200 group"
                                    >
                                        <td className="py-4 px-8">
                                            <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center font-mono font-bold text-text-secondary text-sm">
                                                {index + 4}
                                            </div>
                                        </td>
                                        <td className="py-4 px-8">
                                            <div className="flex items-center gap-4">
                                                <Avatar name={user.name} className="w-10 h-10 ring-2 ring-white shadow-sm group-hover:scale-110 transition-transform duration-300" />
                                                <div className="min-w-0">
                                                    <div className="font-semibold truncate text-base">{user.name}</div>
                                                    <div className="text-xs text-text-tertiary truncate">{user.username}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-8 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
                                                ? 'bg-purple-100 text-purple-700 border-purple-200'
                                                : 'bg-gray-100 text-gray-600 border-gray-200'
                                                }`}>
                                                {user.role || 'USER'}
                                            </span>
                                        </td>
                                        <td className="py-4 px-8 text-right">
                                            <div className="inline-flex items-center gap-2">
                                                <span className="font-mono font-bold text-lg text-indigo-900">{user.totalHours}</span>
                                                <span className="text-xs font-medium text-text-tertiary uppercase">hrs</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="py-12 text-center text-text-tertiary">
                                        No more users to display.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Leaderboard;
