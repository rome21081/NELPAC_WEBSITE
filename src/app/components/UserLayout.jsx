import { useState } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router";
import {
  LayoutDashboard,
  User,
  CreditCard,
  Calendar,
  ClipboardList,
  Image,
  FileText,
  Gift,
  Settings,
  LogOut,
  Bell,
  Users,
  Upload,
  Menu,
  ChevronDown
} from "lucide-react";
import { LoadingState } from "./DataState";
import { useAuth } from "../lib/authContext";
import { useSupabaseData } from "../lib/useSupabaseData";
import { getMyMembers, listNotifications, listPointBalances, markNotificationRead } from "../lib/supabaseServices";
import nelpacLogo from "../../../NELPAC-LOGO.jpg";
const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/user" },
  { icon: User, label: "My Profile", path: "/user/profile" },
  { icon: CreditCard, label: "NELPAC One Card", path: "/user/one-card" },
  { icon: Users, label: "Local Church Members", path: "/user/local-church-members" },
  { icon: Calendar, label: "Events", path: "/user/events" },
  { icon: ClipboardList, label: "Evaluations", path: "/user/evaluations" },
  { icon: Image, label: "Image Gallery", path: "/user/gallery" },
  { icon: Upload, label: "Submit Image", path: "/user/submit-image" },
  { icon: FileText, label: "Posts & News", path: "/user/posts" },
  { icon: Gift, label: "Rewards / Merch", path: "/user/rewards" },
  { icon: Settings, label: "Settings", path: "/user/settings" }
];
function UserLayout() {
  const { user, profile, loading, signOut } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (path) => {
    if (path === "/user") return location.pathname === "/user";
    return location.pathname === path;
  };
  const { data: myMembers } = useSupabaseData(() => user ? getMyMembers(user.id) : Promise.resolve([]), [user?.id]);
  const { data: balances } = useSupabaseData(() => listPointBalances(), []);
  const { data: notifications, reload: reloadNotifications } = useSupabaseData(() => user ? listNotifications(user.id) : Promise.resolve([]), [user?.id]);
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
  const points = balances.find((balance) => balance.user_id === profile.id)?.points_balance || 0;
  const unreadCount = notifications.filter((notification) => !notification.is_read).length;
  const initials = (profile.full_name || profile.email || "U").charAt(0).toUpperCase();
  const logout = async () => {
    await signOut();
    navigate("/");
  };
  const markRead = async (notificationId) => {
    setNotificationError("");
    try {
      await markNotificationRead(notificationId);
      await reloadNotifications();
    } catch {
      setNotificationError("Unable to mark notification as read.");
    }
  };
  return <div className="flex h-screen bg-slate-50 overflow-hidden">
      {
    /* Mobile overlay */
  }
      {mobileSidebarOpen && <div
    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
    onClick={() => setMobileSidebarOpen(false)}
  />}

      {
    /* Sidebar */
  }
      <aside
    className={`
          fixed lg:static inset-y-0 left-0 z-50 w-64 flex flex-col
          transition-transform duration-300 ease-in-out
          ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
    style={{ background: "linear-gradient(180deg, #0f172a 0%, #1a3a5c 100%)" }}
  >
        {
    /* Logo */
  }
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-white">
            <img src={nelpacLogo} alt="NELPAC logo" className="h-full w-full object-contain" />
          </div>
          <div>
            <p className="text-white text-sm leading-none" style={{ fontWeight: 700 }}>NELPAC</p>
            <p className="text-emerald-300 leading-none" style={{ fontSize: "10px", fontWeight: 500 }}>SYSTEM</p>
          </div>
        </div>

        {
    /* User badge */
  }
        <div className="mx-4 mt-3 mb-1 px-3 py-1.5 rounded-lg" style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>
          <p className="text-emerald-400 text-center" style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em" }}>YOUTH PORTAL</p>
        </div>

        {
    /* User mini profile */
  }
        <div className="mx-4 mt-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0 overflow-hidden bg-slate-700" style={{ background: profile.avatar_url ? "#f1f5f9" : "linear-gradient(135deg, #10b981, #3b82f6)", fontWeight: 700 }}>{profile.avatar_url ? <img src={profile.avatar_url} alt="Profile" className="h-full w-full object-contain" /> : initials}</div>
            <div className="min-w-0">
              <p className="text-white text-sm truncate leading-tight" style={{ fontWeight: 600 }}>{profile.full_name || profile.email}</p>
              <p className="text-emerald-400 leading-tight" style={{ fontSize: "10px" }}>{member?.local_church_name || "Member"}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-slate-400" style={{ fontSize: "11px" }}>Points</span>
            <span className="text-amber-400" style={{ fontSize: "13px", fontWeight: 700 }}>{points.toLocaleString()} pts</span>
          </div>
        </div>

        {
    /* Navigation */
  }
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          <p className="text-slate-500 mb-2 px-2" style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em" }}>NAVIGATION</p>
          {navItems.map((item, idx) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return <Link
      key={`${item.path}-${idx}`}
      to={item.path}
      onClick={() => setMobileSidebarOpen(false)}
      className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 transition-all duration-200
                  ${active ? "bg-white/15 text-white" : "text-slate-400 hover:bg-white/8 hover:text-white"}
                `}
    >
                <Icon className={`flex-shrink-0 ${active ? "text-emerald-400" : ""}`} style={{ width: 17, height: 17 }} />
                <span style={{ fontSize: "13px", fontWeight: active ? 600 : 400 }}>{item.label}</span>
                {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />}
              </Link>;
  })}
        </nav>

        {
    /* Logout */
  }
        <div className="p-3 border-t border-white/10">
          <button
    onClick={logout}
    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all w-full"
  >
            <LogOut style={{ width: 17, height: 17 }} className="flex-shrink-0" />
            <span style={{ fontSize: "13px" }}>Logout</span>
          </button>
        </div>
      </aside>

      {
    /* Main */
  }
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {
    /* Top Navbar */
  }
        <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center gap-4 flex-shrink-0">
          <button
    className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100"
    onClick={() => setMobileSidebarOpen(true)}
  >
            <Menu style={{ width: 20, height: 20 }} />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-slate-800 text-sm hidden sm:block" style={{ fontWeight: 600 }}>NELPAC Youth Portal</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="relative">
            <button onClick={() => setNotificationsOpen((open) => !open)} className="relative w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
              <Bell style={{ width: 20, height: 20 }} />
              {unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 rounded-full bg-emerald-500 px-1 text-center text-white" style={{ fontSize: "11px", fontWeight: 700 }}>{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </button>
            {notificationsOpen && <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white py-2 shadow-lg z-50">
              <div className="px-4 py-2 border-b border-slate-100"><p className="text-sm text-slate-800" style={{ fontWeight: 700 }}>Notifications</p>{notificationError && <p className="mt-1 text-xs text-red-600">{notificationError}</p>}</div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? <p className="px-4 py-5 text-sm text-slate-500">No notifications yet.</p> : notifications.slice(0, 12).map((notification) => <button key={notification.id} onClick={() => markRead(notification.id)} className={`block w-full border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50 ${notification.is_read ? "bg-white" : "bg-emerald-50/50"}`}>
                  <div className="flex justify-between gap-3"><p className="text-sm text-slate-800" style={{ fontWeight: notification.is_read ? 600 : 800 }}>{notification.title}</p><span className="text-[10px] text-slate-400">{notification.created_at?.slice(0, 10)}</span></div>
                  <p className="mt-1 text-xs text-slate-500">{notification.message}</p>
                </button>)}
              </div>
            </div>}
            </div>

            <div className="relative">
              <button
    onClick={() => setProfileOpen(!profileOpen)}
    className="flex items-center gap-2 hover:bg-slate-100 rounded-xl px-2 py-1.5 transition-colors"
  >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm overflow-hidden bg-slate-100" style={{ background: profile.avatar_url ? "#f1f5f9" : "linear-gradient(135deg, #10b981, #3b82f6)", fontWeight: 700 }}>{profile.avatar_url ? <img src={profile.avatar_url} alt="Profile" className="h-full w-full object-contain" /> : initials}</div>
                <div className="hidden sm:block text-left">
                  <p className="text-slate-800 text-sm leading-none" style={{ fontWeight: 600 }}>{profile.full_name || profile.email}</p>
                  <p className="text-slate-400 leading-none mt-0.5" style={{ fontSize: "11px" }}>Youth Portal</p>
                </div>
                <ChevronDown className="text-slate-400 hidden sm:block" style={{ width: 14, height: 14 }} />
              </button>
              {profileOpen && <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                  <Link to="/user/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={() => setProfileOpen(false)}>
                    <User style={{ width: 14, height: 14 }} /> My Profile
                  </Link>
                  <hr className="my-1 border-slate-100" />
                  <button onClick={logout} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full">
                    <LogOut style={{ width: 14, height: 14 }} /> Sign Out
                  </button>
                </div>}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>;
}
export {
  UserLayout
};
