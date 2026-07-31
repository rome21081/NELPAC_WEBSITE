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
  "registration_discount_vouchers",
  "reward_merch_allocations",
  "notifications",
  "event_registrations",
  "event_registration_delegates",
  "event_registration_supplements",
  "merch_preorder_forms",
  "merch_preorders",
  "merch_shirt_order_items",
  "merch_preorder_supplements",
];

function buildFallbackProfile(user) {
  if (!user?.id) return null;
  const fullName =
    user.user_metadata?.full_name || user.user_metadata?.name || "";
  return {
    id: user.id,
    role: "user",
    full_name: fullName,
    name: user.user_metadata?.name || fullName,
    name_completed: false,
    email: user.email || "",
    avatar_url: user.user_metadata?.avatar_url || null,
    contact_number: null,
    local_church_id: null,
  };
}

async function fetchProfile(user) {
  const userId = user?.id;
  if (!userId) return null;
  const selectProfile = () =>
    supabase
      .from("profiles")
      .select("id, role, full_name, name, name_completed, email, avatar_url, contact_number, local_church_id")
      .eq("id", userId)
      .maybeSingle();

  const { data, error } = await selectProfile();
  if (error) throw error;
  if (data) return data;

  const { error: ensureError } = await supabase.rpc("ensure_my_profile");
  if (ensureError) {
    console.warn("Unable to ensure missing profile", ensureError);
    return buildFallbackProfile(user);
  }

  const { data: ensuredProfile, error: ensuredError } = await selectProfile();
  if (ensuredError) {
    console.warn("Unable to reload ensured profile", ensuredError);
    return buildFallbackProfile(user);
  }
  return ensuredProfile || buildFallbackProfile(user);
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
        ? await fetchProfile(currentSession.user)
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

        fetchProfile(nextSession.user)
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
        fetchProfile(session.user).then(setProfile).catch(console.error);
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
        const nextProfile = await fetchProfile(session?.user);
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
