import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  MessageSquareText,
  Search,
  Star,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { listEvaluationAnalytics, listEvaluationDetails, listMembers } from "../../lib/supabaseServices";

const categories = [
  ["Accommodation", "average_accommodation", "accommodation"],
  ["Time management", "average_time_management", "time_management"],
  ["Event objectives", "average_objectives_of_the_event", "objectives_of_the_event"],
  ["Program organization", "average_organization_of_the_program", "organization_of_the_program"],
  ["Resource speakers", "average_effectiveness_of_resource_speakers", "effectiveness_of_resource_speakers"],
  ["Committee & staff", "average_committee_heads_and_staffs", "committee_heads_and_staffs"],
];
const chartColors = ["#2563eb", "#0891b2", "#7c3aed", "#d97706", "#059669", "#e11d48"];

function number(value) { return Number(value || 0); }
function rating(value) { return number(value).toFixed(2); }
function formatDate(value) {
  if (!value) return "Date not set";
  const date = new Date(`${value}`.slice(0, 10) + "T00:00:00");
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}
function ratingTone(value) {
  if (number(value) >= 4.5) return "text-emerald-700 bg-emerald-50";
  if (number(value) >= 3.5) return "text-blue-700 bg-blue-50";
  if (number(value) > 0) return "text-amber-700 bg-amber-50";
  return "text-slate-500 bg-slate-100";
}

function KpiCard({ icon: Icon, label, value, detail, tone = "blue" }) {
  const tones = { blue: "bg-blue-50 text-blue-700", emerald: "bg-emerald-50 text-emerald-700", violet: "bg-violet-50 text-violet-700", amber: "bg-amber-50 text-amber-700" };
  return <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{value}</p></div><span className={`rounded-xl p-2.5 ${tones[tone]}`}><Icon size={19} /></span></div>
    <p className="mt-2 text-xs leading-relaxed text-slate-400">{detail}</p>
  </div>;
}

function EvaluationManagement() {
  const { data, loading, error } = useSupabaseData(async () => {
    const [analytics, details, members] = await Promise.all([listEvaluationAnalytics(), listEvaluationDetails(), listMembers()]);
    return [{ analytics, details, members }];
  }, []);
  const { analytics = [], details = [], members = [] } = data[0] || {};
  const eventsWithResponses = useMemo(() => analytics.filter((event) => number(event.total_evaluations) > 0), [analytics]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [eventSearch, setEventSearch] = useState("");

  useEffect(() => {
    if (!selectedEventId && eventsWithResponses.length) setSelectedEventId(String(eventsWithResponses[0].event_id));
  }, [eventsWithResponses, selectedEventId]);

  const selectedEvent = eventsWithResponses.find((event) => String(event.event_id) === selectedEventId) || eventsWithResponses[0];
  const selectedDetails = useMemo(() => selectedEvent ? details.filter((detail) => String(detail.event_id) === String(selectedEvent.event_id)) : [], [details, selectedEvent]);
  const eligibleMembers = members.filter((member) => member.review_status === "Approved" || member.review_status === "Confirmed").length || members.length;
  const report = useMemo(() => {
    if (!selectedEvent) return null;
    const categoryData = categories.map(([name, aggregateKey]) => ({ name, score: number(selectedEvent[aggregateKey]) }));
    const ranked = [...categoryData].sort((a, b) => b.score - a.score);
    const distribution = [1, 2, 3, 4, 5].map((score) => ({ score: `${score} star`, responses: selectedDetails.filter((item) => Math.round(number(item.overall_rating)) === score).length }));
    const uniqueParticipants = new Set(selectedDetails.map((item) => item.user_id).filter(Boolean)).size || selectedDetails.length;
    const positive = selectedDetails.filter((item) => number(item.overall_rating) >= 4).length;
    const needsAttention = selectedDetails.filter((item) => number(item.overall_rating) < 3).length;
    const responseRate = eligibleMembers ? Math.min(100, Math.round((uniqueParticipants / eligibleMembers) * 100)) : 0;
    return { categoryData, strongest: ranked[0], weakest: ranked[ranked.length - 1], distribution, uniqueParticipants, positive, needsAttention, responseRate };
  }, [eligibleMembers, selectedDetails, selectedEvent]);
  const matchingEvents = eventsWithResponses.filter((event) => event.event_title?.toLowerCase().includes(eventSearch.toLowerCase()));
  const totalResponses = details.length;
  const overallAverage = details.length ? details.reduce((sum, item) => sum + number(item.overall_rating), 0) / details.length : 0;

  if (loading) return <LoadingState label="Loading event evaluation analytics..." />;

  return <div className="space-y-5 pb-8">
    <header>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Reporting center</p>
      <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Event Evaluation Analytics</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-500">Review one event at a time, identify what worked, and turn participant feedback into clear next-event priorities.</p>
    </header>
    <ErrorState message={error} />
    {eventsWithResponses.length === 0 ? <EmptyState label="No event evaluations have been submitted yet." /> : <>
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-slate-400">Choose event</p><p className="mt-1 text-sm font-bold text-slate-900">{eventsWithResponses.length} evaluated event{eventsWithResponses.length === 1 ? "" : "s"}</p></div><CalendarDays size={20} className="text-blue-700" /></div>
            <label className="relative mt-3 block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={eventSearch} onChange={(event) => setEventSearch(event.target.value)} placeholder="Find an event..." className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10" /></label>
            <select aria-label="Select event" value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)} className="mt-3 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none lg:hidden">{eventsWithResponses.map((event) => <option key={event.event_id} value={event.event_id}>{event.event_title}</option>)}</select>
          </div>
          <div className="hidden max-h-[500px] overflow-y-auto p-2 lg:block">{matchingEvents.length ? matchingEvents.map((event) => {
            const active = String(event.event_id) === String(selectedEvent?.event_id);
            return <button type="button" key={event.event_id} onClick={() => setSelectedEventId(String(event.event_id))} className={`mb-1 w-full rounded-xl p-3 text-left transition ${active ? "bg-blue-700 text-white shadow-md shadow-blue-700/20" : "text-slate-700 hover:bg-slate-50"}`}><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{event.event_title}</p><p className={`mt-1 text-xs ${active ? "text-blue-100" : "text-slate-400"}`}>{formatDate(event.event_date)} · {event.total_evaluations} responses</p></div><ChevronRight size={16} className={active ? "text-white" : "text-slate-300"} /></div></button>;
          }) : <p className="p-5 text-center text-xs text-slate-500">No matching events.</p>}</div>
        </aside>

        <div className="min-w-0 space-y-4">
          <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 p-5 text-white shadow-lg sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="min-w-0"><p className="text-xs font-black uppercase tracking-[0.16em] text-blue-200">Selected event report</p><h2 className="mt-2 text-xl font-black sm:text-2xl">{selectedEvent?.event_title}</h2><p className="mt-1 flex items-center gap-1.5 text-sm text-blue-100"><CalendarDays size={14} /> {formatDate(selectedEvent?.event_date)}</p></div><div className="w-fit rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur"><p className="text-[10px] font-black uppercase tracking-wider text-blue-200">Overall score</p><p className="mt-1 text-3xl font-black">{rating(selectedEvent?.average_overall_rating)}<span className="text-base text-blue-200"> / 5</span></p></div></div>
          </section>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <KpiCard icon={ClipboardCheck} label="Responses" value={selectedDetails.length} detail={`${report?.uniqueParticipants || 0} unique participants`} tone="blue" />
            <KpiCard icon={Target} label="Response coverage" value={`${report?.responseRate || 0}%`} detail={`Compared with ${eligibleMembers} current members`} tone="violet" />
            <KpiCard icon={TrendingUp} label="Positive ratings" value={`${selectedDetails.length ? Math.round((report.positive / selectedDetails.length) * 100) : 0}%`} detail={`${report?.positive || 0} responses rated 4 or higher`} tone="emerald" />
            <KpiCard icon={Star} label="Needs attention" value={report?.needsAttention || 0} detail="Responses with an overall score below 3" tone="amber" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 xl:col-span-3">
          <div className="mb-5"><p className="text-xs font-black uppercase tracking-wider text-blue-700">Experience breakdown</p><h2 className="mt-1 text-lg font-black text-slate-950">Ratings by category</h2><p className="mt-1 text-xs text-slate-500">Average score from all responses for this event.</p></div>
          <div className="space-y-4">{report?.categoryData.map((category, index) => <div key={category.name} className="grid grid-cols-[minmax(105px,1fr)_minmax(100px,2fr)_42px] items-center gap-3"><p className="text-xs font-semibold text-slate-600 sm:text-sm">{category.name}</p><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, (category.score / 5) * 100))}%`, backgroundColor: chartColors[index] }} /></div><p className="text-right text-sm font-black text-slate-800">{rating(category.score)}</p></div>)}</div>
          <div className="mt-6 grid grid-cols-1 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2"><div className="rounded-xl bg-emerald-50 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Strongest area</p><p className="mt-1 text-sm font-extrabold text-emerald-950">{report?.strongest.name}</p><p className="mt-1 text-xs text-emerald-700">{rating(report?.strongest.score)} average rating</p></div><div className="rounded-xl bg-amber-50 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Priority for next event</p><p className="mt-1 text-sm font-extrabold text-amber-950">{report?.weakest.name}</p><p className="mt-1 text-xs text-amber-700">Lowest category at {rating(report?.weakest.score)}</p></div></div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 xl:col-span-2">
          <div><p className="text-xs font-black uppercase tracking-wider text-violet-700">Score spread</p><h2 className="mt-1 text-lg font-black text-slate-950">Rating distribution</h2><p className="mt-1 text-xs text-slate-500">Rounded overall rating per response.</p></div>
          <div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={report?.distribution} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="score" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} /><Tooltip cursor={{ fill: "#f8fafc" }} /><Bar dataKey="responses" radius={[8, 8, 0, 0]}>{report?.distribution.map((item, index) => <Cell key={item.score} fill={chartColors[index]} />)}</Bar></BarChart></ResponsiveContainer></div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5"><div><p className="text-xs font-black uppercase tracking-wider text-blue-700">Participant voice</p><h2 className="mt-1 text-lg font-black text-slate-950">Comments for this event</h2></div><MessageSquareText size={21} className="text-blue-700" /></div>
          {selectedDetails.filter((item) => item.comment?.trim()).length === 0 ? <div className="p-8"><EmptyState label="No written comments for this event." /></div> : <div className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto">{selectedDetails.filter((item) => item.comment?.trim()).map((item) => <article key={item.id} className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{item.user_full_name || "Anonymous participant"}</p><p className="mt-0.5 text-xs text-slate-400">{item.submitted_at ? new Date(item.submitted_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "Submission date unavailable"}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${ratingTone(item.overall_rating)}`}>{rating(item.overall_rating)} / 5</span></div><p className="mt-3 text-sm leading-6 text-slate-600">“{item.comment}”</p></article>)}</div>}
        </div>
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><BarChart3 size={18} className="text-blue-700" /><h2 className="font-black text-slate-950">All-events snapshot</h2></div>
          <div className="mt-5 space-y-4">{[
            ["Evaluated events", eventsWithResponses.length, CalendarDays], ["Total responses", totalResponses, ClipboardCheck], ["Average rating", rating(overallAverage), Star], ["Unique respondents", new Set(details.map((item) => item.user_id).filter(Boolean)).size, Users],
          ].map(([label, value, Icon]) => <div key={label} className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Icon size={17} /></span><div><p className="text-xs text-slate-500">{label}</p><p className="text-lg font-black text-slate-900">{value}</p></div></div>)}</div>
          <p className="mt-5 rounded-xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-800">Event reports are intentionally separated so averages from one event do not hide issues or strengths in another.</p>
        </aside>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 sm:p-5"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Compare and open</p><h2 className="mt-1 text-lg font-black text-slate-950">Event performance overview</h2></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500"><th className="px-5 py-3.5">Event</th><th className="px-4 py-3.5">Responses</th><th className="px-4 py-3.5">Overall</th><th className="px-4 py-3.5">Strongest</th><th className="px-4 py-3.5">Needs attention</th><th className="px-5 py-3.5"></th></tr></thead><tbody>{eventsWithResponses.map((event) => {
          const ranked = categories.map(([name, key]) => ({ name, score: number(event[key]) })).sort((a, b) => b.score - a.score);
          return <tr key={event.event_id} className={`border-b border-slate-100 ${String(event.event_id) === String(selectedEvent?.event_id) ? "bg-blue-50/50" : "hover:bg-slate-50"}`}><td className="px-5 py-4"><p className="font-bold text-slate-900">{event.event_title}</p><p className="mt-0.5 text-xs text-slate-400">{formatDate(event.event_date)}</p></td><td className="px-4 py-4 text-sm font-semibold text-slate-700">{event.total_evaluations}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${ratingTone(event.average_overall_rating)}`}>{rating(event.average_overall_rating)}</span></td><td className="px-4 py-4 text-sm text-emerald-700">{ranked[0]?.name}</td><td className="px-4 py-4 text-sm text-amber-700">{ranked[ranked.length - 1]?.name}</td><td className="px-5 py-4 text-right"><button type="button" onClick={() => { setSelectedEventId(String(event.event_id)); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">View report <ChevronRight size={14} /></button></td></tr>;
        })}</tbody></table></div>
      </section>
    </>}
  </div>;
}

export { EvaluationManagement };
