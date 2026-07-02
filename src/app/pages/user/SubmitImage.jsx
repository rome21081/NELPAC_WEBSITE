import { useState } from "react";
import { Upload } from "lucide-react";
import { ErrorState, LoadingState } from "../../components/DataState";
import { useAuth } from "../../lib/authContext";
import { useSupabaseData } from "../../lib/useSupabaseData";
import {
  getMyMembers,
  listEvents,
  uploadImageSubmission,
} from "../../lib/supabaseServices";

function SubmitImage({ embedded = false }) {
  const { user } = useAuth();
  const { data, loading, error } = useSupabaseData(async () => {
    const [events, members] = await Promise.all([
      listEvents(),
      getMyMembers(user.id),
    ]);
    return [{ events, members }];
  }, [user?.id]);
  const [form, setForm] = useState({ event_id: "", caption: "", file: null });
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [uploading, setUploading] = useState(false);

  if (loading) return <LoadingState label="Loading upload form..." />;
  const { events = [], members = [] } = data[0] || {};
  const member = members[0];

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    setSuccess("");
    if (!form.file) {
      setMessage("Please choose an image file.");
      return;
    }
    setUploading(true);
    setMessage("Compressing and uploading image...");
    try {
      await uploadImageSubmission({
        file: form.file,
        caption: form.caption,
        event_id: form.event_id,
        local_church_id: member?.local_church_id,
        userId: user.id,
      });
      setForm({ event_id: "", caption: "", file: null });
      event.target.reset();
      setSuccess(
        "Image submitted for review. Status is Pending until an admin approves it.",
      );
      setMessage("");
    } catch (err) {
      setMessage(err.message || "Unable to submit image.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      {!embedded && (
        <div>
          <h1
            className="text-slate-900"
            style={{ fontSize: "22px", fontWeight: 700 }}
          >
            Submit Image
          </h1>
          <p className="text-slate-500 text-sm">
            Share a community photo for admin review.
          </p>
        </div>
      )}
      <ErrorState message={error || message} />
      {success && (
        <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
          {success}
        </p>
      )}
      <form
        onSubmit={submit}
        className="mx-auto max-w-3xl space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"
      >
        <div>
          <h2 className="text-xl font-black text-slate-950">
            Submit a community image
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Choose a clear photo, connect it to an event if applicable, and add
            a helpful caption.
          </p>
        </div>
        <label className="block rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center cursor-pointer hover:border-blue-400">
          <Upload
            className="mx-auto mb-2 text-slate-400"
            style={{ width: 28, height: 28 }}
          />
          <span
            className="block text-sm text-slate-700"
            style={{ fontWeight: 700 }}
          >
            {form.file ? form.file.name : "Choose an image file"}
          </span>
          <span className="block text-xs text-slate-500 mt-1">
            PNG, JPG, or WEBP
          </span>
          <input
            required
            type="file"
            accept="image/*"
            onChange={(e) =>
              setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))
            }
            className="mt-4 block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-700 file:px-4 file:py-2 file:text-sm file:text-white"
          />
        </label>
        <select
          value={form.event_id}
          onChange={(e) => setForm((f) => ({ ...f, event_id: e.target.value }))}
          className="w-full border rounded-xl px-3 py-2 text-sm"
        >
          <option value="">No event</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title}
            </option>
          ))}
        </select>
        <textarea
          className="w-full border rounded-xl px-3 py-2 text-sm"
          placeholder="Caption"
          value={form.caption}
          onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
        />
        <button
          disabled={uploading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-violet-800 disabled:opacity-60"
        >
          <Upload style={{ width: 16, height: 16 }} />{" "}
          {uploading ? "Uploading..." : "Submit Image for Review"}
        </button>
      </form>
    </div>
  );
}

export { SubmitImage };
