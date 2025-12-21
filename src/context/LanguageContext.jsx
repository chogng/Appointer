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
        saveChanges: 'Save',
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
        updateSuccess: 'Update Successful',
        login: 'Log in',
        signup: 'Sign up',
        confirmClearLogs: 'Are you sure you want to clear all logs?',
        clearLogsFailed: 'Failed to clear logs',
        searchLogs: 'Search logs...',
        clearLogs: 'Clear logs',
        docsTitle: 'Appointer Docs',
        docsDescription: 'Learn how to make the most of Appointer. This page will contain documentation and guides about booking devices, managing reservations, and getting the best out of the system.',
        deviceList: 'Device List',
        selectDeviceToBook: 'Select a device to book',
        updateFailed: 'Update failed, please try again',
        deleteFailed: 'Delete failed, please try again',
        createDeviceSuccess: 'Device created successfully',
        createDeviceFailed: 'Failed to create device, please try again',
        newDevice: 'New Device',
        mon: 'Mon',
        tue: 'Tue',
        wed: 'Wed',
        thu: 'Thu',
        fri: 'Fri',
        sat: 'Sat',
        sun: 'Sun',
        bookNow: 'Book Now',
        delete: 'Delete',
        confirm: 'Confirm',
        deleteDevice: 'Delete Device',
        enterDeviceName: 'Enter device name',
        addDescription: 'Add description...',
        doubleClickInfo: 'Double click to edit',
        available: 'Available',
        unavailable: 'Unavailable',
        on: 'On',
        off: 'Off',
        week: ''
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
        saveChanges: '保存',
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
        updateSuccess: '更新成功',
        login: '登录',
        signup: '注册',
        confirmClearLogs: '您确定要清空所有日志记录吗？',
        clearLogsFailed: '清空日志失败',
        searchLogs: '搜索日志...',
        clearLogs: '清空日志',
        docsTitle: 'Appointer 文档',
        docsDescription: '了解如何充分利用 Appointer。本页面包含有关设备预约、管理预约以及如何最大限度利用系统的文档和指南。',
        deviceList: '设备列表',
        selectDeviceToBook: '选择设备进行预约',
        updateFailed: '更新失败，请重试',
        deleteFailed: '删除失败，请重试',
        createDeviceSuccess: '设备创建成功',
        createDeviceFailed: '创建设备失败，请重试',
        newDevice: '新设备',
        mon: '一',
        tue: '二',
        wed: '三',
        thu: '四',
        fri: '五',
        sat: '六',
        sun: '日',
        bookNow: '立即预约',
        delete: '删除',
        confirm: '确认',
        deleteDevice: '删除设备',
        enterDeviceName: '输入设备名称',
        addDescription: '添加描述...',
        doubleClickInfo: '双击编辑',
        available: '可用',
        unavailable: '不可用',
        on: '开',
        off: '关',
        week: '周'
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
