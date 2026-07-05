import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Calendar,
  ClipboardList,
  Image,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
  UserRoundCheck,
  Shield,
  FileCheck2,
} from "lucide-react";
import { LoadingState } from "./DataState";
import { NotificationCenter } from "./NotificationCenter";
import { getProfileDisplayName } from "../lib/profileNames";
import { useAuth } from "../lib/authContext";
import { useSupabaseData } from "../lib/useSupabaseData";
import {
  listNotifications,
  markNotificationRead,
} from "../lib/supabaseServices";
import nelpacLogo from "../../../NELPAC-LOGO.jpg";
const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  { icon: Users, label: "Church Members DB", path: "/admin/youth-database" },
  { icon: CreditCard, label: "NELPAC One Card", path: "/admin/one-card" },
  {
    icon: Calendar,
    label: "Events, Posts & Activities",
    path: "/admin/events",
  },
  { icon: FileCheck2, label: "Forms Center", path: "/admin/forms" },
  { icon: ClipboardList, label: "Evaluations", path: "/admin/evaluations" },
  { icon: Image, label: "Image Submissions", path: "/admin/image-submissions" },
  { icon: UserRoundCheck, label: "Delegates", path: "/admin/delegates" },
  { icon: Shield, label: "Settings", path: "/admin/settings" },
];
function AdminLayout() {
  const { profile, loading, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (path) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(path);
  };
  const currentPage =
    [...navItems]
      .sort((a, b) => b.path.length - a.path.length)
      .find((item) => isActive(item.path))?.label || "Admin Portal";
  useEffect(() => {
    setMobileSidebarOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileSidebarOpen) return undefined;
    const close = (event) => {
      if (event.key === "Escape") setMobileSidebarOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [mobileSidebarOpen]);
  const {
    data: notifications,
    loading: notificationsLoading,
    error: notificationsLoadError,
    reload: reloadNotifications,
  } = useSupabaseData(
    () =>
      profile?.role === "admin"
        ? listNotifications(profile.id)
        : Promise.resolve([]),
    [profile?.role, profile?.id],
  );
  if (loading) return <LoadingState label="Checking admin session..." />;
  if (!profile) {
    navigate("/");
    return null;
  }
  if (profile.role !== "admin") {
    navigate("/user");
    return null;
  }
  const displayName = getProfileDisplayName(
    profile,
    profile.email || "No name provided.",
  );
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
    <div className="flex h-[100dvh] min-h-0 w-full overflow-hidden bg-slate-50 text-slate-900">
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-[min(88vw,20rem)] flex-col shadow-2xl shadow-slate-950/30 lg:static lg:shadow-none
          transition-all duration-300 ease-in-out
          ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          ${sidebarOpen ? "lg:w-72" : "lg:w-20"}
        `}
        style={{
          background: "linear-gradient(180deg, #0f172a 0%, #1e3a5f 100%)",
        }}
      >
        {/* Logo */}
        <div className="flex min-h-20 items-center gap-3 border-b border-white/10 px-5 py-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-white">
            <img
              src={nelpacLogo}
              alt="NELPAC logo"
              className="h-full w-full object-contain"
            />
          </div>
          <div className={sidebarOpen ? "" : "lg:hidden"}>
              <p
                className="text-white text-sm leading-none"
                style={{ fontWeight: 700 }}
              >
                NELPAC
              </p>
              <p
                className="text-blue-300 leading-none"
                style={{ fontSize: "10px", fontWeight: 500 }}
              >
                SYSTEM
              </p>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileSidebarOpen(false)}
            className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {/* Admin badge */}
          <div
            className={`mx-4 mb-1 mt-3 rounded-lg px-3 py-1.5 ${sidebarOpen ? "" : "lg:hidden"}`}
            style={{
              background: "rgba(245,158,11,0.15)",
              border: "1px solid rgba(245,158,11,0.3)",
            }}
          >
            <p
              className="text-amber-400 text-center"
              style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.12em",
              }}
            >
              ADMIN INTERFACE
            </p>
          </div>

        {/* Navigation */}
        <nav className="app-scrollbar flex-1 overflow-y-auto px-3 py-3">
          <p
            className={`mb-2 px-2 text-slate-500 ${sidebarOpen ? "" : "lg:hidden"}`}
            style={{
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.1em",
            }}
          >
            MAIN MENU
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileSidebarOpen(false)}
                className={`
                  mb-1 flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200
                  ${active ? "bg-white/15 text-white" : "text-slate-400 hover:bg-white/8 hover:text-white"}
                `}
              >
                <Icon
                  className={`flex-shrink-0 ${active ? "text-amber-400" : ""}`}
                  style={{ width: 18, height: 18 }}
                />
                  <span
                    className={sidebarOpen ? "" : "lg:hidden"}
                    style={{ fontSize: "13px", fontWeight: active ? 600 : 400 }}
                  >
                    {item.label}
                  </span>
                {active && (
                  <div className={`ml-auto h-1.5 w-1.5 rounded-full bg-amber-400 ${sidebarOpen ? "" : "lg:hidden"}`} />
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
              style={{ width: 18, height: 18 }}
              className="flex-shrink-0"
            />
            <span className={sidebarOpen ? "" : "lg:hidden"} style={{ fontSize: "13px" }}>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <header
          className="flex min-h-16 flex-shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/95 px-3 shadow-sm backdrop-blur sm:px-5 lg:px-7"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
        >
          <button
            className="hidden h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 lg:flex"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu style={{ width: 20, height: 20 }} />
          </button>
          <button
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 shadow-sm transition-colors hover:bg-slate-50 lg:hidden"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu style={{ width: 20, height: 20 }} />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">
              NELPAC Administration
            </p>
            <h1 className="truncate text-sm font-extrabold text-slate-950 sm:text-base">
              {currentPage}
            </h1>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3">
            {/* Notifications */}
            <NotificationCenter
              notifications={notifications}
              loading={notificationsLoading}
              error={notificationError || notificationsLoadError}
              mode="admin"
              onMarkRead={markRead}
              onMarkAllRead={markAllRead}
              onRefresh={refreshNotifications}
              onOpen={() => {
                setProfileOpen(false);
                refreshNotifications();
              }}
            />

            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex min-h-11 items-center gap-2 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-slate-100 sm:px-2"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm overflow-hidden bg-slate-100"
                  style={{
                    background: profile.avatar_url
                      ? "#f1f5f9"
                      : "linear-gradient(135deg, #1d4ed8, #7c3aed)",
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
                    Admin
                  </p>
                </div>
                <ChevronDown
                  className="text-slate-400 hidden sm:block"
                  style={{ width: 14, height: 14 }}
                />
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl shadow-slate-900/10">
                  <Link
                    to="/admin/settings"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => setProfileOpen(false)}
                  >
                    <Settings style={{ width: 14, height: 14 }} /> Settings
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

        {/* Page Content */}
        <main className="app-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-3 sm:p-5 lg:p-7">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
export { AdminLayout };
