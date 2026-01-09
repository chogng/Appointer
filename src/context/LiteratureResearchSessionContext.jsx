import { useCallback, useMemo, useRef } from "react";
import { LiteratureResearchSessionContext } from "./literature-research-session-context";

export const LiteratureResearchSessionProvider = ({ children }) => {
  const sessionsByUserIdRef = useRef(new Map());

  const getSession = useCallback((userId) => {
    if (!userId) return null;
    return sessionsByUserIdRef.current.get(userId) ?? null;
  }, []);

  const setSession = useCallback((userId, snapshot) => {
    if (!userId) return;
    if (!snapshot) {
      sessionsByUserIdRef.current.delete(userId);
      return;
    }
    sessionsByUserIdRef.current.set(userId, snapshot);
  }, []);

  const clearSession = useCallback((userId) => {
    if (!userId) return;
    sessionsByUserIdRef.current.delete(userId);
  }, []);

  const value = useMemo(
    () => ({
      getSession,
      setSession,
      clearSession,
    }),
    [clearSession, getSession, setSession],
  );

  return (
    <LiteratureResearchSessionContext.Provider value={value}>
      {children}
    </LiteratureResearchSessionContext.Provider>
  );
};

