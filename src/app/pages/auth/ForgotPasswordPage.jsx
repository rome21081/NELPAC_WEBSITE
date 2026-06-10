import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import { getPasswordResetRedirectUrl, supabase } from "../../lib/supabaseClient";
import { logPasswordResetActivity } from "../../lib/supabaseServices";
import nelpacLogo from "../../../../NELPAC-LOGO.jpg";

const genericMessage = "If an account exists with this email, a password reset link has been sent.";
const cooldownKey = "nelpac-password-reset-last-request";


function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setSubmitting(true);

    try {
      if (!supabase) throw new Error("Authentication is not configured.");
      const lastRequest = Number(window.localStorage.getItem(cooldownKey) || 0);
      if (Date.now() - lastRequest < 60_000) {
        throw new Error("Please wait a minute before requesting another reset link.");
      }

      const redirectTo = getPasswordResetRedirectUrl();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });
      if (resetError) throw resetError;

      try {
        await logPasswordResetActivity({ email: email.trim(), activityType: "request", success: true });
      } catch (logError) {
        if (import.meta.env.DEV) {
          console.warn("Password reset audit logging failed", logError);
        }
      }

      window.localStorage.setItem(cooldownKey, String(Date.now()));
      setMessage(genericMessage);
      setEmail("");
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Password reset request failed", err);
      }
      if (err.message?.toLowerCase().includes("too many")) {
        setError("Too many reset requests. Please try again later.");
      } else if (err.message?.includes("HTTPS")) {
        setError(err.message);
      } else {
        setMessage(genericMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-8">
    <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="h-11 w-11 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          <img src={nelpacLogo} alt="NELPAC logo" className="h-full w-full object-contain" />
        </div>
        <div>
          <p className="text-slate-900" style={{ fontWeight: 800 }}>Recover Account</p>
          <p className="text-xs text-slate-500">NELPAC SYSTEM</p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl bg-blue-50 p-4 text-blue-800">
        <ShieldCheck className="mb-2" size={20} />
        <p className="text-sm">Enter your registered email address. For privacy, the system will not reveal whether the email is registered.</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm text-slate-700" style={{ fontWeight: 700 }}>
          Email Address
          <div className="relative mt-1.5">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </label>

        {message && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button disabled={submitting} className="w-full rounded-xl bg-blue-700 py-3 text-sm text-white disabled:opacity-60" style={{ fontWeight: 700 }}>
          {submitting ? "Sending..." : "Send Reset Link"}
        </button>
      </form>

      <Link to="/" className="mt-5 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-700">
        <ArrowLeft size={15} /> Back to login
      </Link>
    </div>
  </div>;
}

export { ForgotPasswordPage };
