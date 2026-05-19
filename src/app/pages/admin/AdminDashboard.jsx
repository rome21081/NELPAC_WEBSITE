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

  return <div className="space-y-5">
    <div><h1 className="text-slate-900" style={{ fontSize: "22px", fontWeight: 700 }}>Admin Dashboard</h1><p className="text-slate-500 text-sm">Live overview from Supabase</p></div>
    <ErrorState message={error} />
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return <div key={card.label} className="bg-white rounded-2xl p-4 border border-slate-100">
          <div className="flex items-center justify-between"><p className="text-slate-400" style={{ fontSize: "11px", fontWeight: 700 }}>{card.label.toUpperCase()}</p><Icon style={{ width: 18, height: 18, color: card.color }} /></div>
          <p className="mt-2" style={{ color: card.color, fontSize: "26px", fontWeight: 800 }}>{card.value}</p>
        </div>;
      })}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <section className="bg-white rounded-2xl p-5 border border-slate-100">
        <h2 className="text-slate-900 mb-3" style={{ fontSize: "16px", fontWeight: 700 }}>Recent Member Applications</h2>
        {dashboard.members.slice(0, 8).length === 0 ? <EmptyState label="No member applications yet." /> : <div className="space-y-2">
          {dashboard.members.slice(0, 8).map((member) => <div key={member.id} className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm"><span>{member.name}</span><span className="text-slate-500">{member.review_status}</span></div>)}
        </div>}
      </section>
      <section className="bg-white rounded-2xl p-5 border border-slate-100">
        <h2 className="text-slate-900 mb-3" style={{ fontSize: "16px", fontWeight: 700 }}>Upcoming / Published Events</h2>
        {dashboard.events.slice(0, 8).length === 0 ? <EmptyState label="No events found." /> : <div className="space-y-2">
          {dashboard.events.slice(0, 8).map((event) => <div key={event.id} className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm"><span>{event.title}</span><span className="text-slate-500">{event.event_date}</span></div>)}
        </div>}
      </section>
    </div>
  </div>;
}

export { AdminDashboard };
