import { useState } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Calendar,
  ClipboardList,
  Image,
  FileText,
  Gift,
  Settings,
  LogOut,
  Bell,
  Search,
  ChevronDown,
  Menu,
  Building2,
  Shield
} from "lucide-react";
import { LoadingState } from "./DataState";
import { useAuth } from "../lib/authContext";
const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  { icon: Users, label: "Church Members DB", path: "/admin/youth-database" },
  { icon: CreditCard, label: "NELPAC One Card", path: "/admin/one-card" },
  { icon: Calendar, label: "Events", path: "/admin/events" },
  { icon: ClipboardList, label: "Evaluations", path: "/admin/evaluations" },
  { icon: Image, label: "Image Submissions", path: "/admin/image-submissions" },
  { icon: FileText, label: "Posts & Activities", path: "/admin/posts" },
  { icon: Gift, label: "Merch / Rewards", path: "/admin/rewards" },
  { icon: Building2, label: "Reports & Analytics", path: "/admin/reports" },
  { icon: Shield, label: "Settings", path: "/admin/settings" }
];
function AdminLayout() {
  const { profile, loading, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (path) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(path);
  };
  if (loading) return <LoadingState label="Checking admin session..." />;
  if (!profile) {
    navigate("/");
    return null;
  }
  if (profile.role !== "admin") {
    navigate("/user");
    return null;
  }
  const initials = (profile.full_name || profile.email || "A").charAt(0).toUpperCase();
  const logout = async () => {
    await signOut();
    navigate("/");
  };
  return <div className="flex h-screen bg-slate-100 overflow-hidden">
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
          fixed lg:static inset-y-0 left-0 z-50 flex flex-col
          transition-all duration-300 ease-in-out
          ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          ${sidebarOpen ? "w-64" : "w-20"}
        `}
    style={{ background: "linear-gradient(180deg, #0f172a 0%, #1e3a5f 100%)" }}
  >
        {
    /* Logo */
  }
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
            <Shield className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && <div>
              <p className="text-white text-sm leading-none" style={{ fontWeight: 700 }}>NELPAC</p>
              <p className="text-blue-300 leading-none" style={{ fontSize: "10px", fontWeight: 500 }}>SYSTEM</p>
            </div>}
        </div>

        {
    /* Admin badge */
  }
        {sidebarOpen && <div className="mx-4 mt-3 mb-1 px-3 py-1.5 rounded-lg" style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)" }}>
            <p className="text-amber-400 text-center" style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em" }}>ADMIN INTERFACE</p>
          </div>}

        {
    /* Navigation */
  }
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          <p className={`text-slate-500 mb-2 px-2 ${sidebarOpen ? "" : "hidden"}`} style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em" }}>MAIN MENU</p>
          {navItems.map((item) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return <Link
      key={item.path}
      to={item.path}
      onClick={() => setMobileSidebarOpen(false)}
      className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all duration-200
                  ${active ? "bg-white/15 text-white" : "text-slate-400 hover:bg-white/8 hover:text-white"}
                `}
    >
                <Icon className={`flex-shrink-0 ${active ? "text-amber-400" : ""}`} style={{ width: 18, height: 18 }} />
                {sidebarOpen && <span style={{ fontSize: "13px", fontWeight: active ? 600 : 400 }}>{item.label}</span>}
                {sidebarOpen && active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400" />}
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
            <LogOut style={{ width: 18, height: 18 }} className="flex-shrink-0" />
            {sidebarOpen && <span style={{ fontSize: "13px" }}>Logout</span>}
          </button>
        </div>
      </aside>

      {
    /* Main Content */
  }
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {
    /* Top Navbar */
  }
        <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center gap-4 flex-shrink-0" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <button
    className="hidden lg:flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
    onClick={() => setSidebarOpen(!sidebarOpen)}
  >
            <Menu style={{ width: 20, height: 20 }} />
          </button>
          <button
    className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
    onClick={() => setMobileSidebarOpen(true)}
  >
            <Menu style={{ width: 20, height: 20 }} />
          </button>

          {
    /* Search */
  }
          <div className="flex-1 max-w-sm relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ width: 16, height: 16 }} />
            <input
    type="text"
    placeholder="Search..."
    className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 border border-transparent focus:border-blue-300 transition-all"
  />
          </div>

          <div className="ml-auto flex items-center gap-3">
            {
    /* Notifications */
  }
            <button className="relative w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
              <Bell style={{ width: 20, height: 20 }} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
            </button>

            {
    /* Profile */
  }
            <div className="relative">
              <button
    onClick={() => setProfileOpen(!profileOpen)}
    className="flex items-center gap-2 hover:bg-slate-100 rounded-xl px-2 py-1.5 transition-colors"
  >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm" style={{ background: "linear-gradient(135deg, #1d4ed8, #7c3aed)", fontWeight: 700 }}>{initials}</div>
                <div className="hidden sm:block text-left">
                  <p className="text-slate-800 text-sm leading-none" style={{ fontWeight: 600 }}>{profile.full_name || profile.email}</p>
                  <p className="text-slate-400 leading-none mt-0.5" style={{ fontSize: "11px" }}>Admin</p>
                </div>
                <ChevronDown className="text-slate-400 hidden sm:block" style={{ width: 14, height: 14 }} />
              </button>
              {profileOpen && <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                  <Link to="/admin/settings" className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={() => setProfileOpen(false)}>
                    <Settings style={{ width: 14, height: 14 }} /> Settings
                  </Link>
                  <hr className="my-1 border-slate-100" />
                  <button onClick={logout} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full">
                    <LogOut style={{ width: 14, height: 14 }} /> Sign Out
                  </button>
                </div>}
            </div>
          </div>
        </header>

        {
    /* Page Content */
  }
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>;
}
export {
  AdminLayout
};
