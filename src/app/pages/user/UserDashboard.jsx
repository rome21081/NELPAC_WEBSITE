import { Link } from "react-router";
import { Calendar, CreditCard, FileText, Gift, Image, Upload, Users } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { useAuth } from "../../lib/authContext";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { getMyMembers, listEvents, listPointBalances, listPosts, listRewardClaims } from "../../lib/supabaseServices";

const actions = [
  { icon: Users, label: "Church Members", path: "/user/local-church-members" },
  { icon: CreditCard, label: "One Card", path: "/user/one-card" },
  { icon: Calendar, label: "Events", path: "/user/events" },
  { icon: Upload, label: "Submit Image", path: "/user/submit-image" },
  { icon: Gift, label: "Rewards", path: "/user/rewards" },
  { icon: Image, label: "Gallery", path: "/user/gallery" },
];

function UserDashboard() {
  const { user, profile } = useAuth();
  const { data, loading, error } = useSupabaseData(async () => {
    const [members, balances, events, posts, claims] = await Promise.all([
      getMyMembers(user.id),
      listPointBalances(),
      listEvents(),
      listPosts({ publishedOnly: true }),
      listRewardClaims(),
    ]);
    return [{ members, balances, events, posts, claims }];
  }, [user?.id]);
  if (loading) return <LoadingState label="Loading user dashboard..." />;
  const { members = [], balances = [], events = [], posts = [], claims = [] } = data[0] || {};
  const member = members[0];
  const points = balances.find((balance) => balance.user_id === user.id)?.points_balance || 0;
  const visibleEvents = events.filter((event) => ["Published", "Completed"].includes(event.status));

  return <div className="space-y-5">
    <ErrorState message={error} />
    <section className="rounded-2xl p-6 text-white" style={{ background: "linear-gradient(135deg, #0f172a, #1d4ed8)" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 800 }}>Welcome, {profile.full_name || profile.email}</h1>
      <p className="text-blue-200 text-sm">{member ? `${member.local_church_name} - ${member.district}` : "Complete your member application"}</p>
      <p className="mt-4" style={{ fontSize: "36px", fontWeight: 900 }}>{points.toLocaleString()} pts</p>
    </section>
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">{actions.map((action) => { const Icon = action.icon; return <Link key={action.path} to={action.path} className="bg-white rounded-2xl p-4 border border-slate-100 text-slate-700 hover:text-blue-700"><Icon style={{ width: 18, height: 18 }} /><p className="mt-2 text-sm" style={{ fontWeight: 700 }}>{action.label}</p></Link>; })}</div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <section className="bg-white rounded-2xl p-5 border border-slate-100">
        <h2 className="mb-3" style={{ fontWeight: 700 }}>Upcoming Events</h2>
        {visibleEvents.slice(0, 5).length === 0 ? <EmptyState label="No upcoming events." /> : visibleEvents.slice(0, 5).map((event) => <div key={event.id} className="flex gap-3 border-b border-slate-50 py-2 text-sm">
          {event.image_url ? <img src={event.image_url} alt={event.title} className="h-12 w-16 rounded-lg object-cover bg-slate-100" /> : <div className="flex h-12 w-16 items-center justify-center rounded-lg bg-slate-100 text-slate-400"><Calendar style={{ width: 16, height: 16 }} /></div>}
          <div><b>{event.title}</b><p className="text-slate-500">{event.event_date} - {event.venue || "No venue"}</p></div>
        </div>)}
      </section>
      <section className="bg-white rounded-2xl p-5 border border-slate-100">
        <h2 className="mb-3" style={{ fontWeight: 700 }}>Latest Posts</h2>
        {posts.slice(0, 5).length === 0 ? <EmptyState label="No posts yet." /> : posts.slice(0, 5).map((post) => <div key={post.id} className="flex gap-3 border-b border-slate-50 py-2 text-sm">
          {post.image_url ? <img src={post.image_url} alt={post.title} className="h-12 w-16 rounded-lg object-cover bg-slate-100" /> : <div className="flex h-12 w-16 items-center justify-center rounded-lg bg-slate-100 text-slate-400"><FileText style={{ width: 16, height: 16 }} /></div>}
          <div><b>{post.title}</b><p className="text-slate-500">{post.category}</p></div>
        </div>)}
      </section>
    </div>
    <section className="bg-white rounded-2xl p-5 border border-slate-100"><h2 className="mb-3" style={{ fontWeight: 700 }}>Reward Claims</h2>{claims.filter((claim) => claim.user_id === user.id).length === 0 ? <EmptyState label="No reward claims yet." /> : claims.filter((claim) => claim.user_id === user.id).slice(0, 5).map((claim) => <div key={claim.id} className="flex justify-between border-b border-slate-50 py-2 text-sm"><span>{claim.reward_name}</span><span>{claim.claim_status}</span></div>)}</section>
  </div>;
}

export { UserDashboard };
