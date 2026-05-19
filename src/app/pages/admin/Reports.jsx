import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { listEvaluationAnalytics, listMembers, listPointLedger } from "../../lib/supabaseServices";

function Reports() {
  const { data, loading, error } = useSupabaseData(async () => {
    const [members, evaluations, points] = await Promise.all([listMembers(), listEvaluationAnalytics(), listPointLedger()]);
    return [{ members, evaluations, points }];
  }, []);
  if (loading) return <LoadingState label="Loading reports..." />;
  const { members = [], evaluations = [], points = [] } = data[0] || {};
  const churches = Object.values(members.reduce((acc, member) => {
    const name = member.local_church_name || "Unassigned";
    acc[name] = acc[name] || { church: name, members: 0 };
    acc[name].members += 1;
    return acc;
  }, {})).sort((a, b) => b.members - a.members).slice(0, 10);
  const pointsTotal = points.reduce((sum, entry) => sum + (entry.points || 0), 0);
  return <div className="space-y-5">
    <div><h1 className="text-slate-900" style={{ fontSize: "22px", fontWeight: 700 }}>Reports & Analytics</h1><p className="text-slate-500 text-sm">Live reports from Supabase views and ledgers</p></div>
    <ErrorState message={error} />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[["Members", members.length], ["Evaluated Events", evaluations.filter((e) => e.total_evaluations > 0).length], ["Ledger Entries", points.length], ["Net Points", pointsTotal]].map(([label, value]) => <div key={label} className="bg-white rounded-2xl p-4 border border-slate-100"><p className="text-slate-400 text-xs">{label}</p><p className="text-blue-700" style={{ fontSize: "24px", fontWeight: 800 }}>{value}</p></div>)}</div>
    {churches.length === 0 ? <EmptyState label="No church participation data yet." /> : <section className="bg-white rounded-2xl p-5 border border-slate-100"><h2 className="mb-4" style={{ fontWeight: 700 }}>Members by Local Church</h2><div className="h-80"><ResponsiveContainer><BarChart data={churches}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="church" hide /><YAxis /><Tooltip /><Bar dataKey="members" fill="#1d4ed8" /></BarChart></ResponsiveContainer></div></section>}
  </div>;
}

export { Reports };
