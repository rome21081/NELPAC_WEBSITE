import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const AuthContext = createContext(null);

async function fetchProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, avatar_url, contact_number")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function loadSession() {
      setLoading(true);
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error("Unable to load auth session", error);
        if (alive) setLoading(false);
        return;
      }

      const currentSession = data.session;
      const currentProfile = currentSession?.user ? await fetchProfile(currentSession.user.id) : null;
      if (alive) {
        setSession(currentSession);
        setProfile(currentProfile);
        setLoading(false);
      }
    }

    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      fetchProfile(nextSession.user.id)
        .then(setProfile)
        .catch((error) => {
          console.error("Unable to load profile", error);
          setProfile(null);
        })
        .finally(() => setLoading(false));
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({
    session,
    user: session?.user || null,
    profile,
    loading,
    refreshProfile: async () => {
      const nextProfile = await fetchProfile(session?.user?.id);
      setProfile(nextProfile);
      return nextProfile;
    },
    signOut: () => supabase.auth.signOut(),
  }), [loading, profile, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export {
  AuthProvider,
  useAuth,
};
