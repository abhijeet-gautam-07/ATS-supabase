"use client";

import React, { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Session, User } from "@supabase/supabase-js";

type SessionContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

type Props = {
  children: ReactNode;
};

export default function SessionProvider({ children }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        setSession(currentSession ?? null);
        setUser(currentSession?.user ?? null);
      } catch (err) {
        // optionally handle error logging
        console.error("Failed to get session:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
      setUser(newSession?.user ?? null);
    });

    return () => {
      mounted = false;
      // unsubscribe from auth listener if available
      try {
        data?.subscription?.unsubscribe();
      } catch (err) {
        // ignore unsubscribe errors
      }
    };
  }, []);

  const value: SessionContextValue = { session, user, loading };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
