import React, { useRef, useState } from 'react';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';
import { useLanguage } from '../context/useLanguage';
import Card from '../components/ui/Card';
import Toast from '../components/ui/Toast';
import { User, Moon, Sun, Monitor, Lock, Camera, Check, ArrowUp } from 'lucide-react';

function Section({ title, icon, children }) {
    const Icon = icon;
    return (
        <Card variant="glass" className="mb-6">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border-subtle">
                <Icon size={20} className="text-accent" />
                <h2 className="text-lg font-medium text-text-primary">{title}</h2>
            </div>
            {children}
        </Card>
    );
}

const Settings = () => {
    const containerRef = useRef(null);
    const { user, updateUser } = useAuth();
    const { theme, setTheme } = useTheme();
    const { language, setLanguage, t } = useLanguage();

    const [name, setName] = useState(user?.name || '');
    const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
    const [toast, setToast] = useState({ isVisible: false, message: '' });

    const showToast = (message) => setToast({ isVisible: true, message });
    const closeToast = () => setToast((prev) => ({ ...prev, isVisible: false }));

    const handleNameSave = () => {
        if (!name.trim()) return;
        updateUser({ name: name.trim() });
        showToast(t('updateSuccess'));
    };

    const handleAvatarChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            updateUser({ avatar: reader.result });
            showToast(t('updateSuccess'));
        };
        reader.readAsDataURL(file);
    };

    const handlePasswordChange = (e) => {
        e.preventDefault();
        if (passwordData.new !== passwordData.confirm) {
            showToast('两次输入的密码不一致');
            return;
        }
        setPasswordData({ current: '', new: '', confirm: '' });
        showToast(t('updateSuccess'));
    };

    return (
        <div ref={containerRef} className="max-w-4xl mx-auto relative min-h-screen">
            <h1 className="text-3xl font-serif font-medium text-text-primary mb-8">{t('settings')}</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Section title={t('profile')} icon={User}>
                    <div className="mb-6">
                        <div className="flex items-center gap-4">
                            <div className="relative group">
                                <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden">
                                    {user?.avatar ? (
                                        <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <svg fill="none" height="32" viewBox="0 0 24 24" width="32" xmlns="http://www.w3.org/2000/svg" className="text-white opacity-50">
                                            <circle cx="12" cy="7" r="4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></circle>
                                            <path d="M20 21V19C20 16.7909 18.2091 15 16 15H8C5.79086 15 4 16.7909 4 19V21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                            <path d="M12 11V17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                            <path d="M12 17L10 15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                            <path d="M12 17L14 15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                        </svg>
                                    )}
                                </div>
                                <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer">
                                    <Camera size={20} className="text-white" />
                                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                                </label>
                            </div>

                            <div className="flex-1 min-w-0">
                                <label className="block text-sm font-medium text-text-secondary mb-1.5">{t('displayName')}</label>
                                <div className="flex items-center p-1 bg-bg-page border border-border-subtle rounded-xl shadow-sm focus-within:ring-1 focus-within:ring-black transition-all">
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="flex-1 min-w-0 pl-2 pr-4 py-1 bg-transparent border-none text-text-primary text-sm focus:outline-none focus:ring-0 placeholder:text-text-secondary"
                                        placeholder={t('displayName')}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleNameSave}
                                        className="flex items-center justify-center gap-2 pl-6 pr-3 py-1.5 bg-black text-white text-sm font-medium rounded-lg hover:scale-102 active:scale-95 transition-all whitespace-nowrap"
                                    >
                                        <span>{t('saveChanges')}</span>
                                        <ArrowUp size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="w-20 flex justify-center mt-3">
                            <p className="text-xs text-text-secondary font-medium uppercase tracking-wider whitespace-nowrap">{t(user?.role)}</p>
                        </div>
                    </div>
                </Section>

                <Section title={t('appearance')} icon={Monitor}>
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { id: 'light', icon: Sun, label: t('light') },
                            { id: 'dark', icon: Moon, label: t('dark') },
                            { id: 'system', icon: Monitor, label: t('system') },
                        ].map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setTheme(item.id)}
                                className={`
                                    flex flex-col items-center justify-center p-4 rounded-xl border transition-all
                                    ${theme === item.id
                                        ? 'bg-accent/5 border-accent text-accent'
                                        : 'border-border-subtle text-text-secondary hover:bg-bg-subtle'
                                    }
                                `}
                            >
                                <item.icon size={24} className="mb-2" />
                                <span className="text-sm">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </Section>

                <Section title={t('language')} icon={Monitor}>
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { id: 'en', label: t('english') },
                            { id: 'zh', label: t('chinese') },
                        ].map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setLanguage(item.id)}
                                className={`
                                    flex items-center justify-between p-4 rounded-xl border transition-all text-left
                                    ${language === item.id
                                        ? 'bg-accent/5 border-accent text-accent'
                                        : 'border-border-subtle text-text-secondary hover:bg-bg-subtle'
                                    }
                                `}
                            >
                                <span className="text-xs font-serif font-medium">{item.label}</span>
                                {language === item.id && <Check size={16} />}
                            </button>
                        ))}
                    </div>
                </Section>

                <Section title={t('security')} icon={Lock}>
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">{t('currentPassword')}</label>
                            <input
                                type="password"
                                value={passwordData.current}
                                onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                                className="w-full px-4 py-2 bg-bg-page border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">{t('newPassword')}</label>
                            <input
                                type="password"
                                value={passwordData.new}
                                onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                                className="w-full px-4 py-2 bg-bg-page border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">{t('confirmPassword')}</label>
                            <input
                                type="password"
                                value={passwordData.confirm}
                                onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                                className="w-full px-4 py-2 bg-bg-page border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full py-2.5 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium text-sm"
                        >
                            {t('saveChanges')}
                        </button>
                    </form>
                </Section>
            </div>

            <Toast
                message={toast.message}
                isVisible={toast.isVisible}
                onClose={closeToast}
                containerRef={containerRef}
            />
        </div>
    );
};

export default Settings;
