import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { CheckCircle2, Eye, EyeOff, Lock, XCircle } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { logPasswordResetActivity } from "../../lib/supabaseServices";
import nelpacLogo from "../../../../NELPAC-LOGO.jpg";

function getPasswordIssues(password) {
  const issues = [];
  if (password.length < 8) issues.push("At least 8 characters");
  if (!/[A-Z]/.test(password)) issues.push("One uppercase letter");
  if (!/[a-z]/.test(password)) issues.push("One lowercase letter");
  if (!/[0-9]/.test(password)) issues.push("One number");
  if (!/[^A-Za-z0-9]/.test(password)) issues.push("One symbol");
  return issues;
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("Validating reset link...");
  const [submitting, setSubmitting] = useState(false);
  const passwordIssues = useMemo(() => getPasswordIssues(password), [password]);
  const passwordsMatch = password && password === confirmPassword;
  const canSubmit = status === "ready" && passwordIssues.length === 0 && passwordsMatch;

  useEffect(() => {
    let alive = true;
    let subscription;

    async function consumeRecoveryToken() {
      if (!supabase) {
        if (alive) {
          setStatus("invalid");
          setMessage("Authentication is not configured.");
        }
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const type = params.get("type");
      const authCode = params.get("code");

      try {
        if (tokenHash && type === "recovery") {
          const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
          if (otpError) throw otpError;
        } else if (authCode) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);
          if (exchangeError) throw exchangeError;
        }

        const { data: sessionData } = await supabase.auth.getSession();
        if (!alive) return;

        if (sessionData.session?.user) {
          setStatus("ready");
          setMessage("");
          return;
        }
      } catch (error) {
        if (import.meta.env.DEV) console.error("Password recovery token validation failed", error);
        if (!alive) return;
        setStatus("invalid");
        setMessage("This reset link is invalid, expired, or already used. Please request a new password reset link.");
        return;
      }

      if (!alive) return;
      setStatus("invalid");
      setMessage("This reset link is invalid, expired, or already used. Please request a new password reset link.");
    }

    if (!supabase) {
      setStatus("invalid");
      setMessage("Authentication is not configured.");
      return;
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && alive) {
        setStatus("ready");
        setMessage("");
      }
    });
    subscription = listener.subscription;

    consumeRecoveryToken();

    return () => {
      alive = false;
      subscription?.unsubscribe();
    };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setMessage("");

    try {
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await logPasswordResetActivity({
        email: data.user?.email || null,
        activityType: "completed",
        success: true,
      }).catch(() => null);
      await supabase.auth.signOut();
      setStatus("success");
      setMessage("Your password has been updated. Redirecting to login...");
      window.setTimeout(() => navigate("/"), 1600);
    } catch (err) {
      await logPasswordResetActivity({
        activityType: "failed",
        success: false,
        detail: err.message || "Password reset failed",
      }).catch(() => null);
      setStatus("ready");
      setMessage(err.message || "Unable to update password. Please request a new reset link.");
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="flex h-[100dvh] min-h-0 items-center justify-center overflow-y-auto bg-slate-950 px-4 py-8">
    <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="h-11 w-11 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          <img src={nelpacLogo} alt="NELPAC logo" className="h-full w-full object-contain" />
        </div>
        <div>
          <p className="text-slate-900" style={{ fontWeight: 800 }}>Reset Password</p>
          <p className="text-xs text-slate-500">Create a new secure password</p>
        </div>
      </div>

      {message && <p className={`mb-4 rounded-xl border px-3 py-2 text-sm ${status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "invalid" ? "border-red-200 bg-red-50 text-red-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>{message}</p>}

      {status === "ready" && <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm text-slate-700" style={{ fontWeight: 700 }}>
          New Password
          <div className="relative mt-1.5">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              required
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-10 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
            />
            <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>

        <label className="block text-sm text-slate-700" style={{ fontWeight: 700 }}>
          Confirm Password
          <input
            required
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
          />
        </label>

        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="mb-2 text-xs text-slate-500" style={{ fontWeight: 700 }}>PASSWORD REQUIREMENTS</p>
          {["At least 8 characters", "One uppercase letter", "One lowercase letter", "One number", "One symbol"].map((requirement) => {
            const met = !passwordIssues.includes(requirement);
            return <div key={requirement} className={`flex items-center gap-2 py-0.5 text-sm ${met ? "text-emerald-700" : "text-slate-500"}`}>
              {met ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              <span>{requirement}</span>
            </div>;
          })}
          {confirmPassword && !passwordsMatch && <p className="mt-2 text-sm text-red-600">Passwords do not match.</p>}
        </div>

        <button disabled={!canSubmit || submitting} className="w-full rounded-xl bg-blue-700 py-3 text-sm text-white disabled:opacity-60" style={{ fontWeight: 700 }}>
          {submitting ? "Updating..." : "Update Password"}
        </button>
      </form>}

      {status === "invalid" && <Link to="/forgot-password" className="inline-flex rounded-xl bg-blue-700 px-4 py-2.5 text-sm text-white">Request a new link</Link>}
    </div>
  </div>;
}

export { ResetPasswordPage };
