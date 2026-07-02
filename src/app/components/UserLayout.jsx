import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router";
import {
  LayoutDashboard,
  User,
  CreditCard,
  Calendar,
  ClipboardList,
  Image,
  Settings,
  LogOut,
  Users,
  Menu,
  ChevronDown,
  ShoppingBag,
  AlertTriangle,
} from "lucide-react";
import { LoadingState } from "./DataState";
import { NotificationCenter } from "./NotificationCenter";
import {
  getProfileDisplayName,
  hasCompleteProfileName,
} from "../lib/profileNames";
import { useAuth } from "../lib/authContext";
import { useSupabaseData } from "../lib/useSupabaseData";
import {
  getMyMembers,
  listNotifications,
  listPointBalances,
  markNotificationRead,
} from "../lib/supabaseServices";
import nelpacLogo from "../../../NELPAC-LOGO.jpg";
const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/user" },
  { icon: User, label: "My Profile", path: "/user/profile" },
  {
    icon: CreditCard,
    label: "NELPAC One Card & Rewards",
    path: "/user/one-card",
  },
  {
    icon: Users,
    label: "Local Church Members",
    path: "/user/local-church-members",
  },
  { icon: Calendar, label: "Events, Posts & Activities", path: "/user/events" },
  { icon: ShoppingBag, label: "Forms Center", path: "/user/forms" },
  { icon: ClipboardList, label: "Evaluations", path: "/user/evaluations" },
  { icon: Image, label: "Community Gallery", path: "/user/gallery" },
  { icon: Settings, label: "Settings", path: "/user/settings" },
];
function UserLayout() {
  const { user, profile, loading, signOut } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [profileUpdatePromptAcknowledged, setProfileUpdatePromptAcknowledged] =
    useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (path) => {
    if (path === "/user") return location.pathname === "/user";
    return (
      location.pathname === path || location.pathname.startsWith(`${path}/`)
    );
  };
  const { data: myMembers } = useSupabaseData(
    () => (user ? getMyMembers(user.id) : Promise.resolve([])),
    [user?.id],
  );
  const { data: balances, reload: reloadBalances } = useSupabaseData(
    () => listPointBalances(),
    [],
  );
  const {
    data: notifications,
    loading: notificationsLoading,
    error: notificationsLoadError,
    reload: reloadNotifications,
  } = useSupabaseData(
    () => (user ? listNotifications(user.id) : Promise.resolve([])),
    [user?.id],
  );
  useEffect(() => {
    const refreshPoints = () => {
      reloadBalances();
      reloadNotifications();
    };
    window.addEventListener("nelpac:points-updated", refreshPoints);
    return () =>
      window.removeEventListener("nelpac:points-updated", refreshPoints);
  }, [reloadBalances, reloadNotifications]);

  useEffect(() => {
    if (!profile || profile.role !== "user" || hasCompleteProfileName(profile)) {
      return;
    }

    const isMandatoryProfilePage =
      location.pathname === "/user/profile" &&
      new URLSearchParams(location.search).get("completeName") === "1";

    if (!isMandatoryProfilePage) {
      navigate("/user/profile?completeName=1&mandatory=1", { replace: true });
    }
  }, [location.pathname, location.search, navigate, profile]);

  if (loading) return <LoadingState label="Checking session..." />;
  if (!profile) {
    navigate("/");
    return null;
  }
  if (profile.role === "admin") {
    navigate("/admin");
    return null;
  }
  const member = myMembers[0];
  const points =
    balances.find((balance) => balance.user_id === profile.id)
      ?.points_balance || 0;
  const displayName = getProfileDisplayName(
    profile,
    profile.email || "No name provided.",
  );
  const profileIsComplete = hasCompleteProfileName(profile);
  const missingProfileDetails = [
    profile.full_name?.trim().split(/\s+/).filter(Boolean).length >= 2
      ? null
      : "First name and last name",
    profile.contact_number?.trim() ? null : "Contact number",
  ].filter(Boolean);
  const initials = displayName.charAt(0).toUpperCase();
  const logout = async () => {
    await signOut();
    navigate("/");
  };
  const markRead = async (notificationId) => {
    setNotificationError("");
    try {
      await markNotificationRead(notificationId);
      await reloadNotifications();
    } catch (error) {
      setNotificationError(
        error.message || "Unable to mark notification as read.",
      );
    }
  };
  const markAllRead = async (notificationIds) => {
    setNotificationError("");
    try {
      await Promise.all(
        notificationIds.map((notificationId) =>
          markNotificationRead(notificationId),
        ),
      );
      await reloadNotifications();
    } catch (error) {
      setNotificationError(
        error.message || "Unable to mark all notifications as read.",
      );
    }
  };
  const refreshNotifications = async () => {
    setNotificationError("");
    await reloadNotifications();
  };
  return (
    <div className="fixed inset-0 flex overflow-hidden bg-slate-50">
      {!profileIsComplete && !profileUpdatePromptAcknowledged && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="required-profile-update-title"
        >
          <div className="w-full max-w-md rounded-3xl border border-red-100 bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-700">
              <AlertTriangle size={28} />
            </div>
            <h2
              id="required-profile-update-title"
              className="mt-5 text-2xl font-black text-slate-950"
            >
              Profile update required
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              You must complete and save all required profile details before
              continuing to the NELPAC System.
            </p>
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-amber-800">
                {missingProfileDetails.length
                  ? "Details still needed"
                  : "Please confirm your details"}
              </p>
              <ul className="mt-2 space-y-1 text-sm font-semibold text-amber-950">
                {(missingProfileDetails.length
                  ? missingProfileDetails
                  : ["First name, last name, and contact number"]
                ).map((detail) => (
                  <li key={detail}>• {detail}</li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={() => {
                setProfileUpdatePromptAcknowledged(true);
                navigate("/user/profile?completeName=1&mandatory=1", {
                  replace: true,
                });
              }}
              className="mt-6 w-full rounded-xl bg-red-700 px-4 py-3 text-sm font-extrabold text-white hover:bg-red-800"
            >
              Update My Profile Now
            </button>
            <button
              type="button"
              onClick={logout}
              className="mt-2 w-full rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-64 flex flex-col
          transition-transform duration-300 ease-in-out
          ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
        style={{
          background: "linear-gradient(180deg, #0f172a 0%, #1a3a5c 100%)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-white">
            <img
              src={nelpacLogo}
              alt="NELPAC logo"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <p
              className="text-white text-sm leading-none"
              style={{ fontWeight: 700 }}
            >
              NELPAC
            </p>
            <p
              className="text-emerald-300 leading-none"
              style={{ fontSize: "10px", fontWeight: 500 }}
            >
              SYSTEM
            </p>
          </div>
        </div>

        {/* User badge */}
        <div
          className="mx-4 mt-3 mb-1 px-3 py-1.5 rounded-lg"
          style={{
            background: "rgba(16,185,129,0.15)",
            border: "1px solid rgba(16,185,129,0.3)",
          }}
        >
          <p
            className="text-emerald-400 text-center"
            style={{
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.12em",
            }}
          >
            YOUTH PORTAL
          </p>
        </div>

        {/* User mini profile */}
        <div
          className="mx-4 mt-3 p-3 rounded-xl"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0 overflow-hidden bg-slate-700"
              style={{
                background: profile.avatar_url
                  ? "#f1f5f9"
                  : "linear-gradient(135deg, #10b981, #3b82f6)",
                fontWeight: 700,
              }}
            >
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Profile"
                  className="h-full w-full object-contain"
                />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0">
              <p
                className="text-white text-sm truncate leading-tight"
                style={{ fontWeight: 600 }}
              >
                {displayName}
              </p>
              <p
                className="text-emerald-400 leading-tight"
                style={{ fontSize: "10px" }}
              >
                {member?.local_church_name || "Member"}
              </p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-slate-400" style={{ fontSize: "11px" }}>
              Points
            </span>
            <span
              className="text-amber-400"
              style={{ fontSize: "13px", fontWeight: 700 }}
            >
              {points.toLocaleString()} pts
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          <p
            className="text-slate-500 mb-2 px-2"
            style={{
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.1em",
            }}
          >
            NAVIGATION
          </p>
          {navItems.map((item, idx) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={`${item.path}-${idx}`}
                to={item.path}
                onClick={() => setMobileSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 transition-all duration-200
                  ${active ? "bg-white/15 text-white" : "text-slate-400 hover:bg-white/8 hover:text-white"}
                `}
              >
                <Icon
                  className={`flex-shrink-0 ${active ? "text-emerald-400" : ""}`}
                  style={{ width: 17, height: 17 }}
                />
                <span
                  style={{ fontSize: "13px", fontWeight: active ? 600 : 400 }}
                >
                  {item.label}
                </span>
                {active && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all w-full"
          >
            <LogOut
              style={{ width: 17, height: 17 }}
              className="flex-shrink-0"
            />
            <span style={{ fontSize: "13px" }}>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center gap-4 flex-shrink-0">
          <button
            className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu style={{ width: 20, height: 20 }} />
          </button>

          <div className="flex items-center gap-2">
            <span
              className="text-slate-800 text-sm hidden sm:block"
              style={{ fontWeight: 600 }}
            >
              NELPAC Youth Portal
            </span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <NotificationCenter
              notifications={notifications}
              loading={notificationsLoading}
              error={notificationError || notificationsLoadError}
              mode="user"
              onMarkRead={markRead}
              onMarkAllRead={markAllRead}
              onRefresh={refreshNotifications}
              onOpen={() => {
                setProfileOpen(false);
                refreshNotifications();
              }}
            />

            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 hover:bg-slate-100 rounded-xl px-2 py-1.5 transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm overflow-hidden bg-slate-100"
                  style={{
                    background: profile.avatar_url
                      ? "#f1f5f9"
                      : "linear-gradient(135deg, #10b981, #3b82f6)",
                    fontWeight: 700,
                  }}
                >
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Profile"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    initials
                  )}
                </div>
                <div className="hidden sm:block text-left">
                  <p
                    className="text-slate-800 text-sm leading-none"
                    style={{ fontWeight: 600 }}
                  >
                    {displayName}
                  </p>
                  <p
                    className="text-slate-400 leading-none mt-0.5"
                    style={{ fontSize: "11px" }}
                  >
                    Youth Portal
                  </p>
                </div>
                <ChevronDown
                  className="text-slate-400 hidden sm:block"
                  style={{ width: 14, height: 14 }}
                />
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                  <Link
                    to="/user/profile"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => setProfileOpen(false)}
                  >
                    <User style={{ width: 14, height: 14 }} /> My Profile
                  </Link>
                  <hr className="my-1 border-slate-100" />
                  <button
                    onClick={logout}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full"
                  >
                    <LogOut style={{ width: 14, height: 14 }} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
export { UserLayout };
