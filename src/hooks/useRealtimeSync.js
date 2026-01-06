import { useEffect } from "react";
import { socketService } from "../services/socketService";
import { useAuth } from "./useAuth";

const DEV_MOCK_LOGIN =
  String(import.meta.env?.VITE_MOCK_API || "").toLowerCase() === "true";

export const useRealtimeSync = (eventOrHandlers, callback) => {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (DEV_MOCK_LOGIN) return;
    if (loading || !user) return;

    socketService.connect();

    const subscriptions = [];

    // Backwards compatible: (event, callback)
    if (typeof eventOrHandlers === "string") {
      if (typeof callback === "function") {
        socketService.on(eventOrHandlers, callback);
        subscriptions.push([eventOrHandlers, callback]);
      }
    } else if (
      eventOrHandlers &&
      typeof eventOrHandlers === "object" &&
      !Array.isArray(eventOrHandlers)
    ) {
      // New: ({ eventName: handler, ... })
      for (const [eventName, handler] of Object.entries(eventOrHandlers)) {
        if (typeof handler !== "function") continue;
        socketService.on(eventName, handler);
        subscriptions.push([eventName, handler]);
      }
    }

    return () => {
      for (const [eventName, handler] of subscriptions) {
        socketService.off(eventName, handler);
      }
    };
  }, [user, loading, eventOrHandlers, callback]);
};

export const useReservationSync = (onCreated, onUpdated, onDeleted) => {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (DEV_MOCK_LOGIN) return;
    if (loading || !user) return;

    socketService.connect();

    if (onCreated) socketService.on("reservation:created", onCreated);
    if (onUpdated) socketService.on("reservation:updated", onUpdated);
    if (onDeleted) socketService.on("reservation:deleted", onDeleted);

    return () => {
      if (onCreated) socketService.off("reservation:created", onCreated);
      if (onUpdated) socketService.off("reservation:updated", onUpdated);
      if (onDeleted) socketService.off("reservation:deleted", onDeleted);
    };
  }, [user, loading, onCreated, onUpdated, onDeleted]);
};
