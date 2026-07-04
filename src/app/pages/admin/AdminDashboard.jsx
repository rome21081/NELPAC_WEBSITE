import { Calendar, ClipboardList, Gift, Image, Users, Building2 } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { listEvents, listImageSubmissions, listLocalChurches, listMembers, listPosts, listRewardClaims } from "../../lib/supabaseServices";

function AdminDashboard() {
  const { data, loading, error } = useSupabaseData(async () => {
    const [members, churches, events, images, posts, claims] = await Promise.all([
      listMembers(),
      listLocalChurches({ activeOnly: true }),
      listEvents(),
      listImageSubmissions(),
      listPosts(),
      listRewardClaims(),
    ]);
    return [{ members, churches, events, images, posts, claims }];
  }, []);

  if (loading) return <LoadingState label="Loading admin dashboard..." />;
  const dashboard = data[0] || { members: [], churches: [], events: [], images: [], posts: [], claims: [] };

  const cards = [
    { label: "Members", value: dashboard.members.length, icon: Users, color: "#1d4ed8" },
    { label: "Active Churches", value: dashboard.churches.length, icon: Building2, color: "#059669" },
    { label: "Events", value: dashboard.events.length, icon: Calendar, color: "#7c3aed" },
    { label: "Pending Images", value: dashboard.images.filter((i) => i.status === "Pending").length, icon: Image, color: "#dc2626" },
    { label: "Published Posts", value: dashboard.posts.filter((p) => p.status === "Published").length, icon: ClipboardList, color: "#ca8a04" },
    { label: "Reward Claims", value: dashboard.claims.length, icon: Gift, color: "#0891b2" },
  ];

  return <div className="space-y-5 sm:space-y-6">
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Operations overview</p><h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Admin Dashboard</h2><p className="mt-1 text-sm leading-6 text-slate-500">Live membership, content, event, and submission activity.</p></div>
        <span className="w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">Live data</span>
      </div>
    </section>
    <ErrorState message={error} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return <div key={card.label} className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
          <div className="flex items-start justify-between gap-2"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500 sm:text-[11px]">{card.label}</p><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50"><Icon style={{ width: 17, height: 17, color: card.color }} /></span></div>
          <p className="mt-3 text-2xl font-black tracking-tight sm:text-3xl" style={{ color: card.color }}>{card.value}</p>
        </div>;
      })}
    </div>
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4"><h2 className="font-black text-slate-950">Recent Member Applications</h2><p className="mt-1 text-xs text-slate-500">Latest records awaiting or completing review.</p></div>
        {dashboard.members.slice(0, 8).length === 0 ? <EmptyState label="No member applications yet." /> : <div className="space-y-2">
          {dashboard.members.slice(0, 8).map((member) => <div key={member.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 text-sm"><span className="min-w-0 truncate font-semibold text-slate-800">{member.name}</span><span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">{member.review_status}</span></div>)}
        </div>}
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4"><h2 className="font-black text-slate-950">Upcoming / Published Events</h2><p className="mt-1 text-xs text-slate-500">Current events visible across the platform.</p></div>
        {dashboard.events.slice(0, 8).length === 0 ? <EmptyState label="No events found." /> : <div className="space-y-2">
          {dashboard.events.slice(0, 8).map((event) => <div key={event.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 text-sm"><span className="min-w-0 truncate font-semibold text-slate-800">{event.title}</span><span className="shrink-0 text-xs font-medium text-slate-500">{event.event_date}</span></div>)}
        </div>}
      </section>
    </div>
  </div>;
}

export { AdminDashboard };
