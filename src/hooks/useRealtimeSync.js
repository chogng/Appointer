import { useEffect } from 'react';
import { socketService } from '../services/socketService';

/**
 * 实时同步 Hook
 * 用于监听 WebSocket 事件并自动更新状态
 * 
 * @param {string} event - 事件名称（如 'reservation:created'）
 * @param {function} callback - 回调函数
 */
export const useRealtimeSync = (event, callback) => {
    useEffect(() => {
        // 确保 WebSocket 已连接
        socketService.connect();

        // 订阅事件
        socketService.on(event, callback);

        // 清理：组件卸载时取消订阅
        return () => {
            socketService.off(event, callback);
        };
    }, [event, callback]);
};

/**
 * 预约实时同步 Hook
 * 专门用于日历页面的预约同步
 */
export const useReservationSync = (onCreated, onUpdated, onDeleted) => {
    useEffect(() => {
        socketService.connect();

        if (onCreated) {
            socketService.on('reservation:created', onCreated);
        }
        if (onUpdated) {
            socketService.on('reservation:updated', onUpdated);
        }
        if (onDeleted) {
            socketService.on('reservation:deleted', onDeleted);
        }

        return () => {
            if (onCreated) socketService.off('reservation:created', onCreated);
            if (onUpdated) socketService.off('reservation:updated', onUpdated);
            if (onDeleted) socketService.off('reservation:deleted', onDeleted);
        };
    }, [onCreated, onUpdated, onDeleted]);
};
