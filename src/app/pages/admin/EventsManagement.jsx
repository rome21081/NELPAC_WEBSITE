import { useState } from "react";
import { Edit2, Plus, X } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { useAuth } from "../../lib/authContext";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { listEvents, saveEvent, uploadStorageImage } from "../../lib/supabaseServices";

const emptyForm = { title: "", description: "", event_date: "", venue: "", status: "Draft", evaluation_enabled: true, image_url: "" };

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
      created_by: event.created_by || profile.id,
    });
    setImageFile(null);
    setImagePreview(event.image_url || "");
  };

  const saveConfirmed = async () => {
    setSaving(true);
    setMessage("");
    try {
      const imageUrl = imageFile ? await uploadStorageImage("event-images", imageFile, "events", profile.id) : form.image_url;
      await saveEvent({ ...form, image_url: imageUrl || null, created_by: form.created_by || profile.id });
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
        {imagePreview && <img src={imagePreview} alt="Event preview" className="mt-3 h-40 w-full rounded-xl object-cover" />}
      </label>
      <textarea className="border rounded-xl px-3 py-2 text-sm md:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      <select className="border rounded-xl px-3 py-2 text-sm" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
        <option>Draft</option><option>Published</option><option>Completed</option><option>Cancelled</option>
      </select>
      <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.evaluation_enabled} onChange={(e) => setForm((f) => ({ ...f, evaluation_enabled: e.target.checked }))} /> Evaluation enabled</label>
      {form.id && <button type="button" onClick={resetForm} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm"><X style={{ width: 14, height: 14 }} /> Cancel Edit</button>}
      <button disabled={saving} className="flex items-center justify-center gap-2 rounded-xl bg-blue-700 text-white px-4 py-2 text-sm disabled:opacity-60"><Plus style={{ width: 14, height: 14 }} /> {saving ? "Saving..." : form.id ? "Update Event" : "Save Event"}</button>
    </form>
    {events.length === 0 ? <EmptyState label="No events yet." /> : <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {events.map((event) => <div key={event.id} className="bg-white rounded-2xl p-5 border border-slate-100">
        {event.image_url && <img src={event.image_url} alt={event.title} className="mb-3 h-36 w-full rounded-xl object-cover" />}
        <div className="flex justify-between gap-3"><h2 className="text-slate-900" style={{ fontSize: "16px", fontWeight: 700 }}>{event.title}</h2><span className="text-xs rounded-full bg-slate-100 px-2 py-1">{event.status}</span></div>
        <p className="text-slate-500 text-sm mt-1">{event.event_date} - {event.venue || "No venue"}</p>
        <p className="text-slate-600 text-sm mt-3">{event.description || "No description."}</p>
        <button onClick={() => editEvent(event)} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"><Edit2 style={{ width: 14, height: 14 }} /> Edit</button>
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
