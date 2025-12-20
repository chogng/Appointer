import { useEffect, useState } from 'react';
import { LanguageContext } from './language-context';

const translations = {
    en: {
        settings: 'Settings',
        appearance: 'Appearance',
        language: 'Language',
        profile: 'Profile',
        security: 'Security',
        light: 'Light',
        dark: 'Dark',
        system: 'System',
        changeAvatar: 'Change Avatar',
        changePassword: 'Change Password',
        currentPassword: 'Current Password',
        newPassword: 'New Password',
        confirmPassword: 'Confirm Password',
        saveChanges: 'Save Changes',
        dashboard: 'Dashboard',
        devices: 'Devices',
        booking: 'Booking',
        messages: 'Messages',
        chinese: 'Chinese',
        english: 'English',
        welcomeBack: 'Welcome back',
        upcomingReservations: 'Upcoming Reservations',
        reservedHours: 'Reserved Hours',
        completed: 'Completed',
        recentActivity: 'Recent Activity',
        noActivity: 'No recent activity',
        systemUser: 'System',
        loginParams: 'User logged in',
        createDevice: 'Create Device',
        createReservation: 'Create Reservation',
        registerUser: 'User Registered',
        logout: 'Logout',
        super_admin: 'Super Admin',
        admin: 'Admin',
        user: 'User',
        SUPER_ADMIN: 'Super Admin',
        ADMIN: 'Admin',
        USER: 'User',
        displayName: 'Display Name',
        updateSuccess: 'Update Successful'
    },
    zh: {
        settings: '设置',
        appearance: '外观',
        language: '语言',
        profile: '个人资料',
        security: '账号安全',
        light: '浅色',
        dark: '深色',
        system: '跟随系统',
        changeAvatar: '更换头像',
        changePassword: '修改密码',
        currentPassword: '当前密码',
        newPassword: '新密码',
        confirmPassword: '确认密码',
        saveChanges: '保存更改',
        dashboard: '仪表盘',
        devices: '设备管理',
        booking: '设备预约',
        messages: '消息通知',
        chinese: '中文',
        english: 'English',
        welcomeBack: '欢迎回来',
        upcomingReservations: '即将到来的预约',
        reservedHours: '已预约时长',
        completed: '已完成',
        recentActivity: '最近活动',
        noActivity: '暂无最近活动',
        systemUser: '系统',
        loginParams: '登录系统',
        createDevice: '创建设备',
        createReservation: '创建预约',
        registerUser: '新用户注册',
        logout: '退出登录',
        super_admin: '超级管理员',
        admin: '管理员',
        user: '普通用户',
        SUPER_ADMIN: '超级管理员',
        ADMIN: '管理员',
        USER: '普通用户',
        displayName: '显示名称',
        updateSuccess: '更新成功'
    }
};

export const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState(() => {
        try {
            return localStorage.getItem('drms_language') || 'zh';
        } catch {
            return 'zh';
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('drms_language', language);
        } catch {
            // ignore storage failures
        }
    }, [language]);

    const t = (key) => {
        return translations[language][key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};
