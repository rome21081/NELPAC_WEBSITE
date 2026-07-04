import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const AuthContext = createContext(null);
const realtimeTables = [
  "profiles",
  "local_churches",
  "local_church_members",
  "events",
  "event_evaluations",
  "image_submissions",
  "one_card_points",
  "one_card_redeem_codes",
  "one_card_redeem_code_claims",
  "posts_or_announcements",
  "rewards",
  "reward_claims",
  "redeem_codes",
  "notifications",
  "event_registrations",
  "event_registration_delegates",
  "event_registration_supplements",
  "merch_preorder_forms",
  "merch_preorders",
  "merch_shirt_order_items",
  "merch_preorder_supplements",
];

async function fetchProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, name, name_completed, email, avatar_url, contact_number, local_church_id")
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
      const currentProfile = currentSession?.user
        ? await fetchProfile(currentSession.user.id)
        : null;
      if (alive) {
        setSession(currentSession);
        setProfile(currentProfile);
        setLoading(false);
      }
    }

    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
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
      },
    );

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return undefined;

    const handleChange = (payload) => {
      window.dispatchEvent(
        new CustomEvent("nelpac:data-changed", {
          detail: {
            table: payload.table,
            eventType: payload.eventType,
            newRow: payload.new,
            oldRow: payload.old,
          },
        }),
      );

      if (
        payload.table === "profiles" &&
        (payload.new?.id === session.user.id ||
          payload.old?.id === session.user.id)
      ) {
        fetchProfile(session.user.id).then(setProfile).catch(console.error);
      }
    };

    const channel = supabase.channel(`nelpac-live-${session.user.id}`);
    realtimeTables.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        handleChange,
      );
    });
    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn(`NELPAC Realtime channel status: ${status}`);
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  const value = useMemo(
    () => ({
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
    }),
    [loading, profile, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export { AuthProvider, useAuth };
