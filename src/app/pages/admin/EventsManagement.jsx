import { useState } from "react";
import { ClipboardPenLine, Edit2, ExternalLink, Plus, X } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { useAuth } from "../../lib/authContext";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { listEvents, saveEvent, uploadStorageImage } from "../../lib/supabaseServices";

const emptyForm = { title: "", description: "", event_date: "", venue: "", status: "Draft", evaluation_enabled: true, image_url: "", pre_registration_enabled: false, pre_registration_slug: "", registration_fee: 0, registration_deadline: "", registration_guide: "Registration must be filled out by one representative only, preferably the Local Church President.", registration_gcash_details: "", section_one_title: "Church and delegate information", section_two_title: "Payment details", custom_sections: [] };

function EventsManagement() {
  const { profile } = useAuth();
  const { data: events, loading, error, reload } = useSupabaseData(() => listEvents(), []);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const resetForm = () => {
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview("");
  };

  const chooseImage = (file) => {
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : form.image_url || "");
  };

  const editEvent = (event) => {
    setMessage("");
    setForm({
      id: event.id,
      title: event.title || "",
      description: event.description || "",
      event_date: event.event_date || "",
      venue: event.venue || "",
      status: event.status || "Draft",
      evaluation_enabled: event.evaluation_enabled !== false,
      image_url: event.image_url || "",
      pre_registration_enabled: Boolean(event.pre_registration_enabled),
      pre_registration_slug: event.pre_registration_slug || "",
      registration_fee: event.registration_fee || 0,
      registration_deadline: event.registration_deadline?.slice(0, 16) || "",
      registration_guide: event.registration_guide || emptyForm.registration_guide,
      registration_gcash_details: event.registration_gcash_details || "",
      section_one_title: event.registration_form_config?.section_one_title || emptyForm.section_one_title,
      section_two_title: event.registration_form_config?.section_two_title || emptyForm.section_two_title,
      custom_sections: event.registration_form_config?.custom_sections || [],
      created_by: event.created_by || profile.id,
    });
    setImageFile(null);
    setImagePreview(event.image_url || "");
  };

  const saveConfirmed = async () => {
    setSaving(true);
    setMessage("");
    try {
      if (imageFile) setMessage("Compressing and uploading event image...");
      const imageUrl = imageFile ? await uploadStorageImage("event-images", imageFile, "events", profile.id) : form.image_url;
      const { section_one_title, section_two_title, custom_sections, ...eventForm } = form;
      const generatedSlug = form.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await saveEvent({
        ...eventForm,
        pre_registration_slug: form.pre_registration_enabled ? (form.pre_registration_slug || generatedSlug) : null,
        registration_deadline: form.registration_deadline || null,
        registration_fee: Number(form.registration_fee || 0),
        registration_form_config: { section_one_title, section_two_title, custom_sections },
        image_url: imageUrl || null,
        created_by: form.created_by || profile.id,
      });
      const wasEditing = Boolean(form.id);
      resetForm();
      await reload();
      setConfirmOpen(false);
      setMessage(wasEditing ? "Event updated." : "Event saved.");
    } catch (err) {
      setMessage(err.message || "Unable to save event.");
    } finally {
      setSaving(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    setConfirmOpen(true);
  };

  const toggleEvaluation = async (eventRecord) => {
    setMessage("");
    setSaving(true);
    try {
      const { local_churches: _localChurch, ...eventPayload } = eventRecord;
      await saveEvent({ ...eventPayload, evaluation_enabled: !eventRecord.evaluation_enabled });
      await reload();
      setMessage(eventRecord.evaluation_enabled ? "Evaluation closed for this event." : "Evaluation opened for this event.");
    } catch (err) {
      setMessage(err.message || "Unable to update evaluation status.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading events..." />;

  return <div className="space-y-5">
    <div><h1 className="text-slate-900" style={{ fontSize: "22px", fontWeight: 700 }}>Events Management</h1><p className="text-slate-500 text-sm">{events.length} total events</p></div>
    <ErrorState message={error || (message.includes("Unable") ? message : "")} />
    {message && !message.includes("Unable") && <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">{message}</p>}
    <form onSubmit={submit} className="bg-white rounded-2xl p-5 border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
      <input required className="border rounded-xl px-3 py-2 text-sm" placeholder="Event title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
      <input required type="date" className="border rounded-xl px-3 py-2 text-sm" value={form.event_date} onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))} />
      <input className="border rounded-xl px-3 py-2 text-sm" placeholder="Venue" value={form.venue} onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))} />
      <label className="md:col-span-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        <span className="block mb-2" style={{ fontWeight: 700 }}>Event image</span>
        <input type="file" accept="image/*" className="block w-full file:mr-4 file:rounded-xl file:border-0 file:bg-blue-700 file:px-4 file:py-2 file:text-sm file:text-white" onChange={(e) => chooseImage(e.target.files?.[0] || null)} />
        {imagePreview && <img src={imagePreview} alt="Event preview" className="mt-3 max-h-72 w-full rounded-xl object-contain bg-slate-100" />}
      </label>
      <textarea className="border rounded-xl px-3 py-2 text-sm md:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      <select className="border rounded-xl px-3 py-2 text-sm" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
        <option>Draft</option><option>Published</option><option>Completed</option><option>Cancelled</option>
      </select>
      <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.evaluation_enabled} onChange={(e) => setForm((f) => ({ ...f, evaluation_enabled: e.target.checked }))} /> Evaluation enabled</label>
      <label className="md:col-span-3 flex items-center justify-between gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-4"><span><strong className="block text-sm text-blue-950">Open Pre-Registration</strong><span className="text-xs text-blue-700">Enable delegate registration for this event. Configure its fee, deadline, sections, and payment details separately in the Forms Center after saving the event.</span></span><input type="checkbox" className="h-5 w-5 accent-blue-700" checked={form.pre_registration_enabled} onChange={(e) => setForm((f) => ({ ...f, pre_registration_enabled: e.target.checked }))} /></label>
      {form.id && <button type="button" onClick={resetForm} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm"><X style={{ width: 14, height: 14 }} /> Cancel Edit</button>}
      <button disabled={saving} className="flex items-center justify-center gap-2 rounded-xl bg-blue-700 text-white px-4 py-2 text-sm disabled:opacity-60"><Plus style={{ width: 14, height: 14 }} /> {saving ? "Saving..." : form.id ? "Update Event" : "Save Event"}</button>
    </form>
    {events.length === 0 ? <EmptyState label="No events yet." /> : <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {events.map((event) => <div key={event.id} className="bg-white rounded-2xl p-5 border border-slate-100">
        {event.image_url && <img src={event.image_url} alt={event.title} className="mb-3 max-h-64 w-full rounded-xl object-contain bg-slate-100" />}
        <div className="flex justify-between gap-3"><h2 className="text-slate-900" style={{ fontSize: "16px", fontWeight: 700 }}>{event.title}</h2><span className="text-xs rounded-full bg-slate-100 px-2 py-1">{event.status}</span></div>
        <p className="text-slate-500 text-sm mt-1">{event.event_date} - {event.venue || "No venue"}</p>
        <p className="text-slate-600 text-sm mt-3">{event.description || "No description."}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => editEvent(event)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"><Edit2 style={{ width: 14, height: 14 }} /> Edit</button>
          <button disabled={saving} onClick={() => toggleEvaluation(event)} className={`rounded-xl px-3 py-2 text-sm ${event.evaluation_enabled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{event.evaluation_enabled ? "Evaluation Open" : "Evaluation Closed"}</button>
          {event.pre_registration_enabled && <><span className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700"><ClipboardPenLine size={14} /> ₱{Number(event.registration_fee).toLocaleString()}</span><a href={`/admin/forms?type=registration&event=${event.id}`} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-3 py-2 text-sm text-white"><Edit2 size={14} /> Configure Form</a><a href={`/user/forms?type=registration&event=${event.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-3 py-2 text-sm text-blue-700"><ExternalLink size={14} /> View Form</a></>}
        </div>
      </div>)}
    </div>}
    {confirmOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-slate-900" style={{ fontWeight: 800 }}>{form.id ? "Update event?" : "Create event?"}</h2>
        <p className="mt-2 text-sm text-slate-600">This will save the event details, status, and image to Supabase.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button disabled={saving} onClick={() => setConfirmOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm">Cancel</button>
          <button disabled={saving} onClick={saveConfirmed} className="rounded-xl bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-60">{saving ? "Saving..." : "Confirm"}</button>
        </div>
      </div>
    </div>}
  </div>;
}

export { EventsManagement };
