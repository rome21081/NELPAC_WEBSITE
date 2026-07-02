import { useMemo, useState } from "react";
import { CalendarDays, ClipboardPenLine, MapPin, ShoppingBag } from "lucide-react";
import { useSearchParams } from "react-router";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { listEvents, listMerchForms } from "../../lib/supabaseServices";
import { EventPreRegistration } from "./EventPreRegistration";
import { MerchPreorderForm } from "./MerchPreorderForm";

function UnifiedForms() {
  const [params, setParams] = useSearchParams();
  const initialType = params.get("type") === "merch" ? "merch" : "registration";
  const [type, setType] = useState(initialType);
  const [selectedId, setSelectedId] = useState(params.get("event") || params.get("form") || "");
  const { data, loading, error } = useSupabaseData(() => Promise.all([listEvents(), listMerchForms({ publishedOnly: true })]), []);
  const [events = [], merchForms = []] = data;
  const openEvents = useMemo(() => events.filter((event) => event.status === "Published" && event.pre_registration_enabled), [events]);

  const chooseType = (nextType) => {
    setType(nextType);
    setSelectedId("");
    setParams({ type: nextType });
  };
  const chooseForm = (id) => {
    setSelectedId(id);
    setParams(type === "registration" ? { type, event: id } : { type, form: id });
  };
  const backToSelection = () => {
    setSelectedId("");
    setParams({ type });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) return <LoadingState label="Loading available forms..." />;
  return <div className="space-y-6">
    <header className="rounded-3xl bg-gradient-to-r from-slate-950 via-blue-950 to-violet-950 p-6 text-white shadow-lg sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-200">NELPAC Forms Center</p>
      <h1 className="mt-2 text-2xl font-black sm:text-3xl">What would you like to submit?</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Choose one form below. Your event details, church information, order totals, and payment details stay together in one simple workspace.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button onClick={() => chooseType("registration")} className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${type === "registration" ? "border-blue-300 bg-white text-blue-950 shadow-lg" : "border-white/20 bg-white/10 text-white hover:bg-white/15"}`}><span className={`rounded-xl p-3 ${type === "registration" ? "bg-blue-100 text-blue-700" : "bg-white/10"}`}><ClipboardPenLine size={23} /></span><span><strong className="block">Pre-Registration Form</strong><small className={type === "registration" ? "text-blue-700" : "text-slate-300"}>Register church delegates for an event</small></span></button>
        <button onClick={() => chooseType("merch")} className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${type === "merch" ? "border-violet-300 bg-white text-violet-950 shadow-lg" : "border-white/20 bg-white/10 text-white hover:bg-white/15"}`}><span className={`rounded-xl p-3 ${type === "merch" ? "bg-violet-100 text-violet-700" : "bg-white/10"}`}><ShoppingBag size={23} /></span><span><strong className="block">Merch Pre-Order Form</strong><small className={type === "merch" ? "text-violet-700" : "text-slate-300"}>Order shirts, lace, and other merch</small></span></button>
      </div>
    </header>
    <ErrorState message={error} />
    {selectedId ? (type === "registration" ? <EventPreRegistration selectedEventId={selectedId} onBack={backToSelection} /> : <MerchPreorderForm selectedFormId={selectedId} onBack={backToSelection} />) : type === "registration" ? <section><div className="mb-4"><h2 className="text-xl font-extrabold text-slate-900">Available event registrations</h2><p className="text-sm text-slate-500">Select the event your church will attend.</p></div>{openEvents.length === 0 ? <EmptyState label="No event pre-registration forms are currently open." /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{openEvents.map((event) => <article key={event.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">{event.image_url && <img src={event.image_url} alt={event.title} className="h-44 w-full object-cover" />}<div className="p-5"><h3 className="text-lg font-extrabold text-slate-900">{event.title}</h3><p className="mt-2 line-clamp-2 text-sm text-slate-500">{event.description}</p><div className="mt-4 space-y-1.5 text-xs text-slate-500"><p className="flex items-center gap-2"><CalendarDays size={14} /> {event.event_date}</p><p className="flex items-center gap-2"><MapPin size={14} /> {event.venue || "Venue TBA"}</p></div><button onClick={() => chooseForm(event.id)} className="mt-5 w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white">Fill Out Pre-Registration · ₱{Number(event.registration_fee).toLocaleString()}</button></div></article>)}</div>}</section> : <section><div className="mb-4"><h2 className="text-xl font-extrabold text-slate-900">Available merch pre-orders</h2><p className="text-sm text-slate-500">Select the merch form your church wants to complete.</p></div>{merchForms.length === 0 ? <EmptyState label="No merch pre-order forms are currently open." /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{merchForms.map((form) => <article key={form.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">{form.image_url ? <img src={form.image_url} alt={form.title} className="h-44 w-full object-cover" /> : <div className="flex h-44 items-center justify-center bg-violet-50 text-violet-500"><ShoppingBag size={44} /></div>}<div className="p-5"><div className="flex items-start justify-between gap-3"><div><span className="text-xs font-bold text-violet-700">{form.merch_type === "Others" ? form.custom_merch_name : form.merch_type}</span><h3 className="text-lg font-extrabold text-slate-900">{form.title}</h3></div><strong className="text-violet-700">₱{Number(form.item_fee).toLocaleString()}</strong></div><p className="mt-2 line-clamp-2 text-sm text-slate-500">{form.description}</p><button onClick={() => chooseForm(form.id)} className="mt-5 w-full rounded-xl bg-violet-700 px-4 py-3 text-sm font-bold text-white">Fill Out Merch Pre-Order</button></div></article>)}</div>}</section>}
  </div>;
}

export { UnifiedForms };
