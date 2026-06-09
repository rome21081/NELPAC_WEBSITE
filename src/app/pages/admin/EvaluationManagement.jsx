import { useMemo } from "react";
import { Activity, BarChart3, ClipboardCheck, Star, Users } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { listEvaluationAnalytics, listEvaluationDetails, listMembers } from "../../lib/supabaseServices";

const chartColors = ["#2563eb", "#059669", "#d97706", "#7c3aed", "#dc2626"];

function average(values) {
  const numeric = values.map(Number).filter((value) => Number.isFinite(value));
  if (numeric.length === 0) return 0;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function formatRating(value) {
  return Number(value || 0).toFixed(2);
}

function KpiCard({ icon: Icon, label, value, detail }) {
  return <div className="bg-white rounded-2xl border border-slate-100 p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-slate-400" style={{ fontSize: "11px", fontWeight: 700 }}>{label.toUpperCase()}</p>
        <p className="mt-2 text-slate-900" style={{ fontSize: "28px", fontWeight: 850 }}>{value}</p>
      </div>
      <div className="rounded-xl bg-blue-50 p-2 text-blue-700"><Icon style={{ width: 19, height: 19 }} /></div>
    </div>
    {detail && <p className="mt-3 text-xs text-slate-500">{detail}</p>}
  </div>;
}

function ChartPanel({ title, children }) {
  return <section className="bg-white rounded-2xl border border-slate-100 p-5">
    <h2 className="text-slate-900 mb-4" style={{ fontSize: "15px", fontWeight: 800 }}>{title}</h2>
    <div className="h-72">{children}</div>
  </section>;
}

function EvaluationManagement() {
  const { data, loading, error } = useSupabaseData(async () => {
    const [analytics, details, members] = await Promise.all([listEvaluationAnalytics(), listEvaluationDetails(), listMembers()]);
    return [{ analytics, details, members }];
  }, []);
  const { analytics = [], details = [], members = [] } = data[0] || {};
  const dashboard = useMemo(() => {
    const totalEvaluations = details.length;
    const evaluatedEvents = analytics.filter((event) => event.total_evaluations > 0).length;
    const uniqueParticipants = new Set(details.map((detail) => detail.user_id).filter(Boolean)).size;
    const eligibleMembers = members.filter((member) => member.review_status === "Approved" || member.review_status === "Confirmed").length || members.length;
    const completionRate = eligibleMembers ? Math.round((uniqueParticipants / eligibleMembers) * 100) : 0;
    const categoryAverages = [
      { category: "Overall", average: Number(formatRating(average(details.map((detail) => detail.overall_rating)))) },
      { category: "Speaker", average: Number(formatRating(average(details.map((detail) => detail.speaker_rating)))) },
      { category: "Venue", average: Number(formatRating(average(details.map((detail) => detail.venue_rating)))) },
      { category: "Program", average: Number(formatRating(average(details.map((detail) => detail.program_rating)))) },
    ];
    const eventPerformance = analytics
      .filter((event) => event.total_evaluations > 0)
      .map((event) => ({
        event: event.event_title,
        responses: event.total_evaluations,
        average: Number(event.average_overall_rating || 0),
      }))
      .slice(0, 8)
      .reverse();
    const monthlyMap = details.reduce((acc, detail) => {
      const date = detail.submitted_at ? new Date(detail.submitted_at) : null;
      if (!date || Number.isNaN(date.getTime())) return acc;
      const key = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      if (!acc[key]) acc[key] = { period: key, responses: 0, average: 0, totalRating: 0 };
      acc[key].responses += 1;
      acc[key].totalRating += Number(detail.overall_rating || 0);
      acc[key].average = Number(formatRating(acc[key].totalRating / acc[key].responses));
      return acc;
    }, {});
    const trends = Object.values(monthlyMap).slice(-8);
    const participationByEvent = analytics
      .filter((event) => event.total_evaluations > 0)
      .map((event) => ({ event: event.event_title, responses: event.total_evaluations }))
      .slice(0, 8)
      .reverse();
    return { totalEvaluations, evaluatedEvents, uniqueParticipants, completionRate, categoryAverages, eventPerformance, trends, participationByEvent };
  }, [analytics, details, members]);
  if (loading) return <LoadingState label="Loading evaluation analytics..." />;

  return <div className="space-y-5">
    <div><h1 className="text-slate-900" style={{ fontSize: "22px", fontWeight: 700 }}>Evaluation Analytics Dashboard</h1><p className="text-slate-500 text-sm">Evaluation performance, participation, and response quality</p></div>
    <ErrorState message={error} />
    {analytics.length === 0 ? <EmptyState label="No evaluation analytics yet." /> : <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard icon={ClipboardCheck} label="Submitted Evaluations" value={dashboard.totalEvaluations.toLocaleString()} detail={`${dashboard.evaluatedEvents} event${dashboard.evaluatedEvents === 1 ? "" : "s"} with responses`} />
        <KpiCard icon={Activity} label="Completion Rate" value={`${dashboard.completionRate}%`} detail={`${dashboard.uniqueParticipants} participant${dashboard.uniqueParticipants === 1 ? "" : "s"} against current member base`} />
        <KpiCard icon={Star} label="Average Overall" value={formatRating(average(details.map((detail) => detail.overall_rating)))} detail="Across all submitted evaluations" />
        <KpiCard icon={Users} label="Participation" value={dashboard.uniqueParticipants.toLocaleString()} detail="Unique users who submitted feedback" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartPanel title="Average Rating Per Category">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dashboard.categoryAverages}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="category" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 5]} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="average" radius={[8, 8, 0, 0]}>
                {dashboard.categoryAverages.map((entry, index) => <Cell key={entry.category} fill={chartColors[index % chartColors.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Performance Trends Over Time">
          {dashboard.trends.length === 0 ? <EmptyState label="No trend data yet." /> : <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dashboard.trends}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="period" tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 5]} tickLine={false} axisLine={false} />
              <Tooltip />
              <Line yAxisId="left" type="monotone" dataKey="responses" stroke="#2563eb" strokeWidth={3} dot={{ r: 3 }} />
              <Line yAxisId="right" type="monotone" dataKey="average" stroke="#059669" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>}
        </ChartPanel>
        <ChartPanel title="User Participation By Event">
          {dashboard.participationByEvent.length === 0 ? <EmptyState label="No participation data yet." /> : <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dashboard.participationByEvent}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="event" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey="responses" stroke="#7c3aed" fill="#ddd6fe" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>}
        </ChartPanel>
        <ChartPanel title="Event Rating Performance">
          {dashboard.eventPerformance.length === 0 ? <EmptyState label="No event ratings yet." /> : <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dashboard.eventPerformance}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="event" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 5]} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="average" fill="#d97706" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>}
        </ChartPanel>
      </div>

      <section className="bg-white rounded-2xl p-5 border border-slate-100">
        <div className="mb-4 flex items-center gap-2"><BarChart3 className="text-blue-700" style={{ width: 17, height: 17 }} /><h2 className="text-slate-900" style={{ fontSize: "16px", fontWeight: 800 }}>Event Summary</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 bg-slate-50 text-left text-slate-500">
              {["Event", "Responses", "Overall", "Speaker", "Venue", "Program"].map((heading) => <th key={heading} className="px-4 py-3" style={{ fontSize: "11px", fontWeight: 700 }}>{heading}</th>)}
            </tr></thead>
            <tbody>{analytics.filter((event) => event.total_evaluations > 0).map((event) => <tr key={event.event_id} className="border-b border-slate-50">
              <td className="px-4 py-3 text-slate-800" style={{ fontWeight: 700 }}>{event.event_title}</td>
              <td className="px-4 py-3 text-slate-600">{event.total_evaluations}</td>
              <td className="px-4 py-3 text-slate-600">{event.average_overall_rating || "0.00"}</td>
              <td className="px-4 py-3 text-slate-600">{event.average_speaker_rating || "0.00"}</td>
              <td className="px-4 py-3 text-slate-600">{event.average_venue_rating || "0.00"}</td>
              <td className="px-4 py-3 text-slate-600">{event.average_program_rating || "0.00"}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>
    </>}
    <section className="bg-white rounded-2xl p-5 border border-slate-100">
      <h2 className="text-slate-900 mb-3" style={{ fontSize: "16px", fontWeight: 700 }}>Recent Comments</h2>
      {details.filter((detail) => detail.comment).length === 0 ? <EmptyState label="No comments submitted." /> : <div className="space-y-2">
        {details.filter((detail) => detail.comment).slice(0, 20).map((detail) => <div key={detail.id} className="rounded-xl bg-slate-50 p-3 text-sm"><b>{detail.event_title}</b><p className="text-slate-600">{detail.comment}</p></div>)}
      </div>}
    </section>
  </div>;
}

export { EvaluationManagement };
