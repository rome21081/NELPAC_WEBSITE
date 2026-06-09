import { useState } from "react";
import { Star } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { listEvents, listPointBalances, submitEvaluation } from "../../lib/supabaseServices";
import { useAuth } from "../../lib/authContext";

function StarRating({ label, value, onChange }) {
  return <div>
    <p className="mb-1 text-sm text-slate-600">{label}</p>
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" onClick={() => onChange(rating)} className="rounded-lg p-1 hover:bg-amber-50" aria-label={`${label} ${rating} stars`}>
        <Star className={rating <= value ? "fill-amber-400 text-amber-400" : "text-slate-300"} style={{ width: 24, height: 24 }} />
      </button>)}
    </div>
  </div>;
}

function friendlyEvaluationError(error) {
  const message = error?.message || "";
  if (error?.code === "23505" || message.toLowerCase().includes("duplicate key") || message.toLowerCase().includes("event_evaluations_one_per_user")) {
    return "You already evaluated this event.";
  }
  if (message.includes("not available for evaluation")) return "Evaluation is currently closed for this event.";
  return message || "Unable to submit evaluation.";
}

function UserEvaluation() {
  const { user } = useAuth();
  const { data: events, loading, error } = useSupabaseData(() => listEvents(), []);
  const { data: balances, setData: setBalances } = useSupabaseData(() => user ? listPointBalances() : Promise.resolve([]), [user?.id]);
  const [form, setForm] = useState({ event_id: "", overall_rating: 5, speaker_rating: 5, venue_rating: 5, program_rating: 5, comment: "" });
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const eligible = events.filter((event) => ["Published", "Completed"].includes(event.status));
  const selectedEvent = eligible.find((event) => event.id === form.event_id);
  const evaluationClosed = selectedEvent && !selectedEvent.evaluation_enabled;
  const points = balances.find((balance) => balance.user_id === user?.id)?.points_balance || 0;

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    setSuccess("");
    if (evaluationClosed) {
      setMessage("Evaluation is currently closed for this event.");
      return;
    }
    try {
      const result = await submitEvaluation(form);
      const nextBalances = await listPointBalances();
      setBalances(nextBalances);
      window.dispatchEvent(new CustomEvent("nelpac:points-updated"));
      const awarded = result?.points_awarded ?? 100;
      const updatedPoints = nextBalances.find((balance) => balance.user_id === user?.id)?.points_balance || points + awarded;
      setSuccess(`Evaluation submitted. You earned ${awarded} NELPAC Points for completing the evaluation. Updated One Card balance: ${updatedPoints.toLocaleString()} pts.`);
      setForm({ event_id: "", overall_rating: 5, speaker_rating: 5, venue_rating: 5, program_rating: 5, comment: "" });
    } catch (err) {
      setMessage(friendlyEvaluationError(err));
    }
  };

  if (loading) return <LoadingState label="Loading evaluations..." />;
  return <div className="space-y-5">
    <div>
      <h1 className="text-slate-900" style={{ fontSize: "22px", fontWeight: 700 }}>Event Evaluation</h1>
      <p className="text-slate-500 text-sm">Submit feedback for eligible events · One Card balance: {points.toLocaleString()} pts</p>
    </div>
    <ErrorState message={error || message} />
    {success && <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">{success}</p>}
    {eligible.length === 0 ? <EmptyState label="No events are available for evaluation." /> : <form onSubmit={submit} className="bg-white rounded-2xl p-5 border border-slate-100 space-y-4">
      <select required value={form.event_id} onChange={(e) => setForm((f) => ({ ...f, event_id: e.target.value }))} className="w-full border rounded-xl px-3 py-2 text-sm">
        <option value="">Select event</option>
        {eligible.map((event) => <option key={event.id} value={event.id}>{event.title}{event.evaluation_enabled ? "" : " (Closed)"}</option>)}
      </select>
      {evaluationClosed && <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">Evaluation is currently closed for this event.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StarRating label="Overall rating" value={form.overall_rating} onChange={(value) => setForm((f) => ({ ...f, overall_rating: value }))} />
        <StarRating label="Speaker rating" value={form.speaker_rating} onChange={(value) => setForm((f) => ({ ...f, speaker_rating: value }))} />
        <StarRating label="Venue rating" value={form.venue_rating} onChange={(value) => setForm((f) => ({ ...f, venue_rating: value }))} />
        <StarRating label="Program rating" value={form.program_rating} onChange={(value) => setForm((f) => ({ ...f, program_rating: value }))} />
      </div>
      <textarea className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Comment" value={form.comment} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} />
      <button disabled={evaluationClosed} className="rounded-xl bg-blue-700 text-white px-4 py-2 text-sm disabled:bg-slate-200 disabled:text-slate-500">Submit Evaluation</button>
    </form>}
  </div>;
}

export { UserEvaluation };
