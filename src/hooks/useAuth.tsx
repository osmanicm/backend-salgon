import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "admin" | "agent";

export interface AuthProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: AuthProfile | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState | undefined>(undefined);

async function fetchProfileAndRoles(userId: string) {
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, avatar_url, is_active").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  return {
    profile: (profile as AuthProfile | null) ?? null,
    roles: (roleRows ?? []).map((r: { role: AppRole }) => r.role),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [user, setUser] = React.useState<User | null>(null);
  const [profile, setProfile] = React.useState<AuthProfile | null>(null);
  const [roles, setRoles] = React.useState<AppRole[]>([]);
  const [loading, setLoading] = React.useState(true);

  const loadExtras = React.useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setProfile(null);
      setRoles([]);
      return;
    }
    const { profile: p, roles: r } = await fetchProfileAndRoles(uid);
    setProfile(p);
    setRoles(r);
  }, []);

  React.useEffect(() => {
    // Set up listener BEFORE getSession (avoid missed events).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      // Defer Supabase calls to avoid deadlock inside the callback.
      if (newSession?.user) {
        setTimeout(() => void loadExtras(newSession.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        void loadExtras(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [loadExtras]);

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refresh = React.useCallback(async () => {
    if (user?.id) await loadExtras(user.id);
  }, [user?.id, loadExtras]);

  const value: AuthState = { user, session, profile, roles, loading, signOut, refresh };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}

export function useHasRole(role: AppRole) {
  const { roles } = useAuth();
  return roles.includes(role);
}
