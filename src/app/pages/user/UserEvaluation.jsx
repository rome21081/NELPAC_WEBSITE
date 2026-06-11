import { useMemo, useState } from "react";
import { Award, CheckCircle2, ClipboardList, Info, Sparkles, Star } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { listEvents, listPointBalances, submitEvaluation } from "../../lib/supabaseServices";
import { useAuth } from "../../lib/authContext";

const evaluationCategories = [
  { key: "accommodation", label: "Accommodation", hint: "Comfort, accessibility, and suitability of the accommodations." },
  { key: "time_management", label: "Time Management", hint: "How well the event followed its planned schedule." },
  { key: "objectives_of_the_event", label: "Objectives of the Event", hint: "How clearly the event met its stated goals." },
  { key: "organization_of_the_program", label: "Organization of the Program", hint: "Structure, coordination, and flow of activities." },
  { key: "effectiveness_of_resource_speakers", label: "Effectiveness of the Resource Speaker/s", hint: "Speakers' clarity, relevance, and ability to engage." },
  { key: "committee_heads_and_staffs", label: "Committee Heads & Staffs", hint: "The team's preparedness, support, and professionalism." },
];

const emptyForm = {
  event_id: "",
  accommodation: 0,
  time_management: 0,
  objectives_of_the_event: 0,
  organization_of_the_program: 0,
  effectiveness_of_resource_speakers: 0,
  committee_heads_and_staffs: 0,
  comment: "",
};

function StarRating({ id, label, value, onChange, hint }) {
  return (
    <fieldset className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-md">
      <legend className="sr-only">{label}</legend>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          {hint && <p className="text-xs text-slate-500">{hint}</p>}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${value ? "bg-amber-50 text-amber-700" : "bg-slate-200 text-slate-600"}`}>
          {value ? `${value}/5` : "Not rated"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-1 sm:justify-start" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            id={`${id}-${rating}`}
            key={rating}
            type="button"
            onClick={() => onChange(rating)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl transition hover:-translate-y-0.5 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
            aria-label={`${rating} out of 5 for ${label}`}
            aria-checked={value === rating}
            role="radio"
          >
            <Star
              className={rating <= value ? "fill-amber-400 text-amber-400" : "text-slate-300"}
              style={{ width: 24, height: 24 }}
            />
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">1 = Needs improvement, 5 = Excellent</p>
    </fieldset>
  );
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
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const eligible = events.filter((event) => ["Published", "Completed"].includes(event.status));
  const selectedEvent = eligible.find((event) => event.id === form.event_id);
  const evaluationClosed = selectedEvent && !selectedEvent.evaluation_enabled;
  const points = balances.find((balance) => balance.user_id === user?.id)?.points_balance || 0;
  const completedRatings = evaluationCategories.filter(({ key }) => form[key] >= 1).length;
  const progress = useMemo(() => {
    let value = 0;
    if (form.event_id) value += 25;
    value += (completedRatings / evaluationCategories.length) * 65;
    if (form.comment.trim().length > 0) value += 10;
    return Math.min(Math.round(value), 100);
  }, [completedRatings, form.comment, form.event_id]);

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    setSuccess("");
    if (evaluationClosed) {
      setMessage("Evaluation is currently closed for this event.");
      return;
    }
    if (completedRatings !== evaluationCategories.length) {
      setMessage("Please rate every evaluation category before submitting.");
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
      setForm(emptyForm);
    } catch (err) {
      setMessage(friendlyEvaluationError(err));
    }
  };

  if (loading) return <LoadingState label="Loading evaluations..." />;

  return (
    <div className="space-y-6 pb-8">
      <header className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-slate-100">Event Evaluation</p>
            <h1 className="text-2xl font-semibold text-white md:text-3xl">Share your feedback in a few simple steps</h1>
            <p className="max-w-2xl text-sm text-slate-200 md:text-base">Rate your experience, help improve future events, and earn NELPAC points for every completed evaluation.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm shadow-inner backdrop-blur">
            <div className="flex items-center gap-2 text-slate-100">
              <Award className="h-4 w-4 text-amber-300" />
              <span className="font-semibold">One Card balance</span>
            </div>
            <div className="mt-1 text-2xl font-semibold text-white">{points.toLocaleString()} pts</div>
          </div>
        </div>
      </header>

      <ErrorState message={error || message} />

      {success && (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold">Evaluation submitted successfully</p>
                <p className="text-sm text-emerald-700">{success}</p>
              </div>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">You're all set</span>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold">
              <span className="text-slate-600">Form completion</span>
              <span className="text-blue-700">{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Evaluation form completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
              <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {eligible.length === 0 ? (
            <EmptyState label="No events are available for evaluation." />
          ) : (
            <form onSubmit={submit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700" htmlFor="event-select">Choose an event</label>
                <select
                  id="event-select"
                  required
                  value={form.event_id}
                  onChange={(e) => setForm((f) => ({ ...f, event_id: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">Select an event to evaluate</option>
                  {eligible.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title}{event.evaluation_enabled ? "" : " (Closed)"}
                    </option>
                  ))}
                </select>
                {selectedEvent && (
                  <p className="text-xs text-slate-500">Selected event: <span className="font-semibold text-slate-700">{selectedEvent.title}</span></p>
                )}
              </div>

              {evaluationClosed && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  Evaluation is currently closed for this event. Please choose another event to continue.
                </div>
              )}

              <div>
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Rate your event experience</h2>
                    <p className="text-xs text-slate-500">All six categories are required.</p>
                  </div>
                  <p className="text-xs font-semibold text-blue-700">{completedRatings} of {evaluationCategories.length} rated</p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {evaluationCategories.map(({ key, label, hint }) => (
                    <StarRating
                      id={key}
                      key={key}
                      label={label}
                      hint={hint}
                      value={form[key]}
                      onChange={(value) => setForm((current) => ({ ...current, [key]: value }))}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700" htmlFor="comment">Additional comments</label>
                <textarea
                  id="comment"
                  rows={4}
                  value={form.comment}
                  onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                  placeholder="Share what stood out, what could be improved, or any suggestions for future events."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">Your feedback helps improve future NELPAC events and activities.</p>
                <button
                  type="submit"
                  disabled={evaluationClosed || completedRatings !== evaluationCategories.length}
                  className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:shadow-md hover:brightness-105 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Submit Evaluation
                </button>
              </div>
            </form>
          )}
        </section>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-blue-700">
              <Info className="h-4 w-4" />
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em]">Guidelines</h3>
            </div>
            <div className="space-y-3 text-sm text-slate-600">
              <p>Be honest and specific so the team can improve future events.</p>
              <p>Use clear examples in your comments to highlight what worked well or what needs attention.</p>
              <p>Each completed evaluation contributes to your NELPAC One Card points balance.</p>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-slate-100">
              <ClipboardList className="h-4 w-4 text-amber-300" />
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em]">What to expect</h3>
            </div>
            <ul className="space-y-3 text-sm text-slate-200">
              <li>1. Pick the event you attended.</li>
              <li>2. Rate all six event experience categories.</li>
              <li>3. Add optional comments for more detailed feedback.</li>
              <li>4. Receive your points automatically after submission.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

export { UserEvaluation };
