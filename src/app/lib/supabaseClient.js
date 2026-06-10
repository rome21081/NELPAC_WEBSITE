import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const productionResetUrl = "https://nelpac-website.vercel.app/reset-password";
const fallbackOrigin = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
const configuredBaseUrl = import.meta.env.VITE_SITE_URL || import.meta.env.VITE_APP_URL || fallbackOrigin;

const supabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null;

function isLocalHost(hostname) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}

function getPasswordResetRedirectUrl() {
  if (typeof window !== "undefined" && window.location.origin === "https://nelpac-website.vercel.app") {
    return productionResetUrl;
  }

  const targetUrl = new URL("/reset-password", configuredBaseUrl);
  if (targetUrl.protocol !== "https:" && !isLocalHost(targetUrl.hostname)) {
    throw new Error("Password reset links must use HTTPS in production. Configure VITE_SITE_URL or VITE_APP_URL to a secure URL.");
  }

  return targetUrl.toString();
}

export {
  getPasswordResetRedirectUrl,
  supabase,
};
