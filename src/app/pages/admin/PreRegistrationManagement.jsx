import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, ClipboardPenLine, MapPin, Plus, Save, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { listEvents, updateEventPreRegistration } from "../../lib/supabaseServices";
import { useSupabaseData } from "../../lib/useSupabaseData";

const defaultGuide = "Registration must be filled out by one representative only, preferably the Local Church President.";
const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100";

function PreRegistrationManagement() {
  const [params, setParams] = useSearchParams();
  const { data: events, loading, error, reload } = useSupabaseData(() => listEvents(), []);
  const [selectedId, setSelectedId] = useState(params.get("event") || "");
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const selectedEvent = useMemo(() => events.find((event) => event.id === selectedId), [events, selectedId]);

  useEffect(() => {
    if (!selectedEvent) { setSettings(null); return; }
    setSettings({
      pre_registration_enabled: Boolean(selectedEvent.pre_registration_enabled),
      pre_registration_slug: selectedEvent.pre_registration_slug || "",
      registration_fee: selectedEvent.registration_fee || 0,
      registration_deadline: selectedEvent.registration_deadline?.slice(0, 16) || "",
      registration_guide: selectedEvent.registration_guide || defaultGuide,
      registration_gcash_details: selectedEvent.registration_gcash_details || "",
      registration_gcash_recipient_name: selectedEvent.registration_gcash_recipient_name || "",
      registration_gcash_number: selectedEvent.registration_gcash_number || "",
      section_one_title: selectedEvent.registration_form_config?.section_one_title || "Church and delegate information",
      section_two_title: selectedEvent.registration_form_config?.section_two_title || "Payment details",
      custom_sections: selectedEvent.registration_form_config?.custom_sections || [],
    });
  }, [selectedEvent]);

  const chooseEvent = (eventId) => {
    setSelectedId(eventId);
    setParams({ type: "registration", event: eventId });
    setMessage("");
  };

  const save = async (submitEvent) => {
    submitEvent.preventDefault();
    setMessage("");
    if (settings.pre_registration_enabled && (!settings.registration_gcash_recipient_name.trim() || !settings.registration_gcash_number.trim())) {
      setMessage("Unable to save: enter both the GCash recipient name and GCash number.");
      return;
    }
    setSaving(true);
    try {
      const generatedSlug = selectedEvent.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await updateEventPreRegistration(selectedId, {
        pre_registration_enabled: settings.pre_registration_enabled,
        pre_registration_slug: settings.pre_registration_enabled ? (settings.pre_registration_slug || generatedSlug) : null,
        registration_fee: Number(settings.registration_fee || 0),
        registration_deadline: settings.registration_deadline || null,
        registration_guide: settings.registration_guide,
        registration_gcash_details: settings.registration_gcash_details || null,
        registration_gcash_recipient_name: settings.registration_gcash_recipient_name || null,
        registration_gcash_number: settings.registration_gcash_number || null,
        registration_form_config: {
          section_one_title: settings.section_one_title,
          section_two_title: settings.section_two_title,
          custom_sections: settings.custom_sections,
        },
      });
      await reload();
      setMessage("Pre-registration settings saved for this event.");
    } catch (err) {
      setMessage(err.message || "Unable to save pre-registration settings.");
    } finally { setSaving(false); }
  };

  if (loading) return <LoadingState label="Loading events for pre-registration..." />;
  return <div className="space-y-5">
    <div><h1 className="text-2xl font-extrabold text-slate-900">Event Pre-Registration Forms</h1><p className="text-sm text-slate-500">Select an existing event, then configure its delegate registration form separately.</p></div>
    <ErrorState message={error || (message.includes("Unable") ? message : "")} />
    {message && !message.includes("Unable") && <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 size={17} /> {message}</p>}
    {events.length === 0 ? <EmptyState label="Create an event first before configuring pre-registration." /> : <div className="grid gap-5 xl:grid-cols-[20rem_1fr]">
      <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><p className="mb-3 px-2 text-xs font-black uppercase tracking-wide text-slate-400">Choose an existing event</p><div className="space-y-2">{events.map((event) => <button key={event.id} type="button" onClick={() => chooseEvent(event.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedId === event.id ? "border-blue-400 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 hover:border-blue-200"}`}><div className="flex items-start justify-between gap-2"><strong className="text-sm text-slate-900">{event.title}</strong><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${event.pre_registration_enabled ? "bg-emerald-500" : "bg-slate-300"}`} /></div><p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><CalendarDays size={13} /> {event.event_date}</p><span className={`mt-2 inline-block rounded-full px-2 py-1 text-[10px] font-bold ${event.pre_registration_enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{event.pre_registration_enabled ? "Registration Open" : "Registration Closed"}</span></button>)}</div></aside>
      {!selectedEvent || !settings ? <div className="flex min-h-72 items-center justify-center rounded-3xl border-2 border-dashed border-blue-200 bg-blue-50 p-8 text-center"><div><ClipboardPenLine className="mx-auto text-blue-600" size={38} /><h2 className="mt-3 font-extrabold text-blue-950">Select an event</h2><p className="mt-1 text-sm text-blue-700">Its delegate form settings will appear here.</p></div></div> : <form onSubmit={save} className="space-y-5">
        <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">{selectedEvent.image_url && <img src={selectedEvent.image_url} alt={selectedEvent.title} className="h-48 w-full object-cover" />}<div className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-blue-700">Connected Event</p><h2 className="mt-1 text-xl font-extrabold text-slate-900">{selectedEvent.title}</h2><p className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500"><span className="flex items-center gap-1.5"><CalendarDays size={14} /> {selectedEvent.event_date}</span><span className="flex items-center gap-1.5"><MapPin size={14} /> {selectedEvent.venue || "Venue TBA"}</span></p></div><label className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-900">Open Pre-Registration<input type="checkbox" className="h-5 w-5 accent-blue-700" checked={settings.pre_registration_enabled} onChange={(e) => setSettings((current) => ({ ...current, pre_registration_enabled: e.target.checked }))} /></label></div></div></header>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h3 className="font-extrabold text-slate-900">Registration settings for {selectedEvent.title}</h3><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Registration Fee per Delegate<input required min="0" step="0.01" type="number" className={inputClass} value={settings.registration_fee} onChange={(e) => setSettings((current) => ({ ...current, registration_fee: e.target.value }))} /></label><label className="text-sm font-semibold text-slate-700">Registration Deadline<input type="datetime-local" className={inputClass} value={settings.registration_deadline} onChange={(e) => setSettings((current) => ({ ...current, registration_deadline: e.target.value }))} /></label><label className="text-sm font-semibold text-slate-700">Registration Page Slug<input className={inputClass} placeholder="Generated from event title" value={settings.pre_registration_slug} onChange={(e) => setSettings((current) => ({ ...current, pre_registration_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} /></label><div className="hidden sm:block" /><label className="text-sm font-semibold text-slate-700">Name of the GCash Recipient<input className={inputClass} value={settings.registration_gcash_recipient_name} onChange={(e) => setSettings((current) => ({ ...current, registration_gcash_recipient_name: e.target.value }))} /></label><label className="text-sm font-semibold text-slate-700">GCash Number<input inputMode="numeric" className={inputClass} value={settings.registration_gcash_number} onChange={(e) => setSettings((current) => ({ ...current, registration_gcash_number: e.target.value }))} /></label><label className="text-sm font-semibold text-slate-700">Section 1 Title<input className={inputClass} value={settings.section_one_title} onChange={(e) => setSettings((current) => ({ ...current, section_one_title: e.target.value }))} /></label><label className="text-sm font-semibold text-slate-700">Section 2 Title<input className={inputClass} value={settings.section_two_title} onChange={(e) => setSettings((current) => ({ ...current, section_two_title: e.target.value }))} /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Representative Guide<textarea rows="3" className={inputClass} value={settings.registration_guide} onChange={(e) => setSettings((current) => ({ ...current, registration_guide: e.target.value }))} /></label></div></section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex items-center justify-between gap-3"><div><h3 className="font-extrabold text-slate-900">Additional Form Sections</h3><p className="text-xs text-slate-500">These instructions belong only to {selectedEvent.title}.</p></div><button type="button" onClick={() => setSettings((current) => ({ ...current, custom_sections: [...current.custom_sections, { title: "", description: "" }] }))} className="inline-flex items-center gap-1 rounded-xl border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700"><Plus size={14} /> Add</button></div><div className="mt-4 space-y-3">{settings.custom_sections.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No additional sections for this event.</p> : settings.custom_sections.map((section, index) => <div key={index} className="grid gap-2 rounded-2xl border border-slate-200 p-3 sm:grid-cols-[1fr_2fr_auto]"><input placeholder="Section title" className="rounded-xl border px-3 py-2 text-sm" value={section.title} onChange={(e) => setSettings((current) => ({ ...current, custom_sections: current.custom_sections.map((item, row) => row === index ? { ...item, title: e.target.value } : item) }))} /><input placeholder="Instructions or details" className="rounded-xl border px-3 py-2 text-sm" value={section.description} onChange={(e) => setSettings((current) => ({ ...current, custom_sections: current.custom_sections.map((item, row) => row === index ? { ...item, description: e.target.value } : item) }))} /><button type="button" onClick={() => setSettings((current) => ({ ...current, custom_sections: current.custom_sections.filter((_, row) => row !== index) }))} className="rounded-xl border border-red-200 p-2 text-red-600"><Trash2 size={16} /></button></div>)}</div></section>
        <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-4 text-sm font-extrabold text-white shadow-lg disabled:opacity-60"><Save size={17} /> {saving ? "Saving event registration form..." : "Save Pre-Registration Form"}</button>
      </form>}
    </div>}
  </div>;
}

export { PreRegistrationManagement };
