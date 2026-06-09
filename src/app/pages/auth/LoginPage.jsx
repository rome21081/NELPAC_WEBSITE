import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/authContext";
import nelpacLogo from "../../../../NELPAC-LOGO.jpg";
import {
  listEvents,
  listLocalChurches,
  listMembers,
  listPointLedger,
} from "../../lib/supabaseServices";

function LoginPage() {
  const navigate = useNavigate();
  const { profile, loading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({
    youth: 0,
    churches: 0,
    events: 0,
    points: 0,
  });

  useEffect(() => {
    if (!loading && profile?.role === "admin") navigate("/admin");
    if (!loading && profile?.role === "user") navigate("/user");
  }, [loading, navigate, profile]);

  useEffect(() => {
    Promise.all([
      listMembers().catch(() => []),
      listLocalChurches({ activeOnly: true }).catch(() => []),
      listEvents().catch(() => []),
      listPointLedger().catch(() => []),
    ]).then(([members, churches, events, points]) => {
      setStats({
        youth: members.length,
        churches: churches.length,
        events: events.filter((event) => event.status === "Completed").length,
        points: points.reduce(
          (sum, entry) => sum + Math.max(entry.points || 0, 0),
          0,
        ),
      });
    });
  }, []);

  const handleLogin = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();
      if (profileError) throw profileError;

      navigate(profileData.role === "admin" ? "/admin" : "/user");
    } catch (err) {
      setError(err.message || "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex"
      style={{
        background:
          "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)",
      }}
    >
      <div
        className="hidden lg:flex flex-col justify-between w-1/2 p-12"
        style={{
          background: "rgba(255,255,255,0.03)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden bg-white"
          >
            <img src={nelpacLogo} alt="NELPAC logo" className="h-full w-full object-contain" />
          </div>
          <div>
            <p
              className="text-white"
              style={{ fontWeight: 800, fontSize: "20px" }}
            >
              NELPAC
            </p>
            <p
              className="text-blue-300"
              style={{
                fontSize: "11px",
                fontWeight: 500,
                letterSpacing: "0.15em",
              }}
            >
              Northeast Luzon Philipines Annual Conference
            </p>
          </div>
        </div>

        <div>
          <h1
            className="text-white mb-4"
            style={{ fontSize: "40px", fontWeight: 800, lineHeight: 1.2 }}
          >
            Digital Platform for{" "}
            <span style={{ color: "#f59e0b" }}>NELPAC Youth</span>
          </h1>
          <p
            className="text-slate-400"
            style={{ fontSize: "16px", lineHeight: 1.7 }}
          >
            A centralized and modern website for NELPAC youth members, built to
            support member management, event engagement, evaluations, rewards,
            announcements, and efficient admin operations.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            {[
              {
                label: "Registered Youth",
                value: stats.youth.toLocaleString(),
              },
              {
                label: "Active Churches",
                value: stats.churches.toLocaleString(),
              },
              {
                label: "Events Completed",
                value: stats.events.toLocaleString(),
              },
              {
                label: "Total Points Issued",
                value: stats.points.toLocaleString(),
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="p-4 rounded-2xl"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <p
                  className="text-white"
                  style={{ fontSize: "22px", fontWeight: 800 }}
                >
                  {stat.value}
                </p>
                <p className="text-slate-400" style={{ fontSize: "12px" }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-600" style={{ fontSize: "12px" }}>
          © 2026 NELPAC System. All rights reserved.
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center overflow-hidden bg-white"
            >
              <img src={nelpacLogo} alt="NELPAC logo" className="h-full w-full object-contain" />
            </div>
            <p
              className="text-white"
              style={{ fontWeight: 800, fontSize: "18px" }}
            >
              NELPAC SYSTEM
            </p>
          </div>

          <div
            className="rounded-3xl p-8"
            style={{
              background: "rgba(255,255,255,0.97)",
              boxShadow: "0 25px 50px rgba(0,0,0,0.3)",
            }}
          >
            <h2
              className="text-slate-900 mb-1"
              style={{ fontSize: "24px", fontWeight: 700 }}
            >
              Welcome back
            </h2>
            <p className="text-slate-500 mb-6" style={{ fontSize: "14px" }}>
              Sign in to access the NELPAC System
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label
                  className="block text-slate-700 mb-1.5"
                  style={{ fontSize: "13px", fontWeight: 600 }}
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    style={{ width: 16, height: 16 }}
                  />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                    style={{ background: "#f8fafc" }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label
                    className="text-slate-700"
                    style={{ fontSize: "13px", fontWeight: 600 }}
                  >
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-blue-600 hover:text-blue-700"
                    style={{ fontSize: "12px", fontWeight: 700 }}
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    style={{ width: 16, height: 16 }}
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 text-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                    style={{ background: "#f8fafc" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? (
                      <EyeOff style={{ width: 16, height: 16 }} />
                    ) : (
                      <Eye style={{ width: 16, height: 16 }} />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <p
                  className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-red-700"
                  style={{ fontSize: "12px" }}
                >
                  {error === "Cannot coerce the result to a single JSON object"
                    ? "Login failed. Please check your email or password."
                    : "Login failed. Please try again."}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl text-white text-sm transition-all hover:opacity-90 disabled:opacity-60 active:scale-[0.99] mt-2"
                style={{
                  background: "linear-gradient(135deg, #1d4ed8, #7c3aed)",
                  fontWeight: 600,
                  boxShadow: "0 4px 15px rgba(29,78,216,0.3)",
                }}
              >
                {submitting ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <p
              className="text-center text-slate-500 mt-5"
              style={{ fontSize: "13px" }}
            >
              Don't have an account?{" "}
              <Link
                to="/register"
                className="text-blue-600 hover:text-blue-700"
                style={{ fontWeight: 600 }}
              >
                Register here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export { LoginPage };
