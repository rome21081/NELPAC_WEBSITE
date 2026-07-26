import { supabase } from "./supabaseClient";

function getAuthRedirectUrl() {
  if (typeof window === "undefined") return undefined;
  return window.location.origin;
}

async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getAuthRedirectUrl(),
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });
  if (error) throw error;
}

export { signInWithGoogle };
