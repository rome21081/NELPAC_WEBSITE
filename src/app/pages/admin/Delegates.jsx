import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Building2,
  ChevronRight,
  Edit3,
  Filter,
  Mars,
  Plus,
  Search,
  Shuffle,
  Trash2,
  UserCog,
  UserRoundCheck,
  Users,
  Venus,
  WandSparkles,
  X,
} from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { useSupabaseData } from "../../lib/useSupabaseData";
import {
  deleteOnsiteEventParticipant,
  listEventRegistrations,
  listEvents,
  listLocalChurches,
  listOnsiteEventParticipants,
  saveOnsiteEventParticipant,
} from "../../lib/supabaseServices";

const brackets = ["All", "Freshman", "Junior", "Senior"];
const personnelRoles = ["CDG Leader", "Staff", "Group Head"];
const emptyParticipant = {
  name: "",
  participant_role: "Delegate",
  local_church_id: "",
  age: "",
  gender: "",
  contact_number: "",
  notes: "",
};

function ageBracket(age) {
  const value = Number(age);
  if (value >= 11 && value <= 14) return "Freshman";
  if (value >= 15 && value <= 18) return "Junior";
  if (value >= 19 && value <= 22) return "Senior";
  return "Unclassified";
}

function normalizeParticipants(registrations, onsite) {
  const rows = [];
  registrations
    .filter((registration) => registration.submission_status === "Submitted")
    .forEach((registration) => {
      const shared = {
        event_id: registration.event_id,
        church: registration.local_churches?.name || "Unassigned",
        church_id: registration.local_church_id,
        source: registration.registration_type === "Onsite" ? "Onsite Form" : "Pre-registration",
      };
      (registration.event_registration_delegates || []).forEach((delegate) =>
        rows.push({
          ...shared,
          id: `pre-${delegate.id}`,
          record_id: delegate.id,
          name: delegate.name,
          role: "Delegate",
          age: delegate.age,
          gender: delegate.gender,
          health: delegate.health_condition,
          bracket: ageBracket(delegate.age),
        }),
      );
      (registration.event_registration_supplements || []).forEach((supplement) =>
        (Array.isArray(supplement.delegates) ? supplement.delegates : []).forEach(
          (delegate, index) =>
            rows.push({
              ...shared,
              id: `supp-${supplement.id}-${index}`,
              name: delegate.name,
              role: "Delegate",
              age: delegate.age,
              gender: delegate.gender,
              health: delegate.health_condition,
              bracket: ageBracket(delegate.age),
            }),
        ),
      );
      if (registration.local_church_worker?.trim())
        rows.push({
          ...shared,
          id: `worker-${registration.id}`,
          name: registration.local_church_worker,
          role: "Worker",
          age: null,
          gender: null,
          bracket: "Unclassified",
        });
      if (registration.local_church_president?.trim())
        rows.push({
          ...shared,
          id: `officer-${registration.id}`,
          name: registration.local_church_president,
          role: "Officer",
          age: null,
          gender: null,
          bracket: "Unclassified",
        });
    });
  onsite.forEach((participant) =>
    rows.push({
      id: `onsite-${participant.id}`,
      record_id: participant.id,
      event_id: participant.event_id,
      church_id: participant.local_church_id,
      church: participant.local_churches?.name || "Unassigned",
      name: participant.name,
      role: participant.participant_role,
      age: participant.age,
      gender: participant.gender,
      health: participant.notes,
      bracket: ageBracket(participant.age),
      source: "Onsite",
      raw: participant,
    }),
  );
  return rows;
}

function distributeByChurch(participants, size) {
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  const groupCount = Math.ceil(shuffled.length / size);
  const groups = Array.from({ length: groupCount }, () => []);
  shuffled.forEach((participant) => {
    const choices = groups
      .map((members, index) => ({
        index,
        members,
        sameChurch: members.filter((member) => member.church_id === participant.church_id).length,
      }))
      .filter((item) => item.members.length < size)
      .sort(
        (a, b) =>
          a.sameChurch - b.sameChurch ||
          a.members.length - b.members.length ||
          Math.random() - 0.5,
      );
    groups[choices[0].index].push(participant);
  });
  return groups;
}

function distributeRandomly(participants, size) {
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  return Array.from(
    { length: Math.ceil(shuffled.length / size) },
    (_, index) => shuffled.slice(index * size, (index + 1) * size),
  );
}

function StatCard({ icon: Icon, label, value, tone = "blue", detail }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    violet: "bg-violet-50 text-violet-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    cyan: "bg-cyan-50 text-cyan-700",
  };
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className={`inline-flex rounded-xl p-2.5 ${tones[tone]}`}><Icon size={18} /></div>
      <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

function ParticipantForm({ eventId, churches, participant, onClose, onSaved }) {
  const [form, setForm] = useState(
    participant
      ? {
          ...emptyParticipant,
          ...participant.raw,
          local_church_id: participant.raw.local_church_id || "",
          age: participant.raw.age ?? "",
          gender: participant.raw.gender || "",
        }
      : emptyParticipant,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.name.trim()) return setError("Participant name is required.");
    if (form.participant_role === "Delegate" && (!form.age || !form.gender))
      return setError("Delegate age and gender are required.");
    setSaving(true);
    try {
      await saveOnsiteEventParticipant({
        ...(form.id ? { id: form.id } : {}),
        event_id: eventId,
        name: form.name.trim(),
        participant_role: form.participant_role,
        local_church_id: form.local_church_id || null,
        age: form.age === "" ? null : Number(form.age),
        gender: form.gender || null,
        contact_number: form.contact_number?.trim() || null,
        notes: form.notes?.trim() || null,
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "Unable to save onsite participant.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={submit} className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="text-xl font-black text-slate-950">{participant ? "Edit" : "Add"} onsite participant</h2><p className="mt-1 text-sm text-slate-500">Saved directly to the selected event roster.</p></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2 text-sm font-bold text-slate-700">Full name<input value={form.name} onChange={(e) => update("name", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" /></label>
          <label className="text-sm font-bold text-slate-700">Participant type<select value={form.participant_role} onChange={(e) => update("participant_role", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"><option>Delegate</option><option>Staff</option><option>Officer</option><option>Worker</option></select></label>
          <label className="text-sm font-bold text-slate-700">Local church<select value={form.local_church_id} onChange={(e) => update("local_church_id", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"><option value="">Unassigned</option>{churches.map((church) => <option key={church.id} value={church.id}>{church.name}</option>)}</select></label>
          <label className="text-sm font-bold text-slate-700">Age<input type="number" min="0" max="120" value={form.age} onChange={(e) => update("age", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" /></label>
          <label className="text-sm font-bold text-slate-700">Gender<select value={form.gender} onChange={(e) => update("gender", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"><option value="">Not specified</option><option>Male</option><option>Female</option><option>Prefer not to say</option></select></label>
          <label className="text-sm font-bold text-slate-700">Contact number<input value={form.contact_number || ""} onChange={(e) => update("contact_number", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" /></label>
          <label className="text-sm font-bold text-slate-700">Notes<input value={form.notes || ""} onChange={(e) => update("notes", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" /></label>
        </div>
        {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button disabled={saving} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Saving…" : "Save participant"}</button></div>
      </form>
    </div>
  );
}

function GroupRandomizer({ eventId, delegates }) {
  const [groupSize, setGroupSize] = useState(8);
  const [mode, setMode] = useState("bracket");
  const [avoidChurch, setAvoidChurch] = useState(true);
  const [assignments, setAssignments] = useState([]);
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    if (!eventId) return;
    try {
      const saved = JSON.parse(localStorage.getItem(`nelpac-groups-${eventId}`));
      setGroups(saved?.groups || []);
      setAssignments(saved?.assignments || []);
      if (saved?.groupSize) setGroupSize(saved.groupSize);
      if (saved?.mode) setMode(saved.mode);
      if (typeof saved?.avoidChurch === "boolean") setAvoidChurch(saved.avoidChurch);
    } catch {
      setGroups([]);
      setAssignments([]);
    }
  }, [eventId]);

  const addAssignment = () => setAssignments((current) => [...current, { id: crypto.randomUUID(), name: "", role: "CDG Leader", bracket: "All" }]);
  const updateAssignment = (id, field, value) => setAssignments((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
  const generate = () => {
    const size = Math.max(1, Number(groupSize) || 1);
    const sets = [];
    if (mode === "bracket") {
      ["Freshman", "Junior", "Senior", "Unclassified"].forEach((bracket) => {
        const pool = delegates.filter((delegate) => delegate.bracket === bracket);
        const chunks = avoidChurch
          ? distributeByChurch(pool, size)
          : distributeRandomly(pool, size);
        chunks.forEach((members, index) => sets.push({ name: `${bracket} Group ${index + 1}`, bracket, members }));
      });
    } else {
      (avoidChurch
        ? distributeByChurch(delegates, size)
        : distributeRandomly(delegates, size)
      ).forEach((members, index) =>
        sets.push({ name: `Group ${index + 1}`, bracket: "All", members }),
      );
    }
    const counters = {};
    const completed = sets.map((group) => ({
      ...group,
      leaders: personnelRoles.flatMap((role) => {
        const candidates = assignments.filter((item) => item.name.trim() && item.role === role && (item.bracket === "All" || group.bracket === "All" || item.bracket === group.bracket));
        if (!candidates.length) return [];
        counters[role] = counters[role] || 0;
        const selected = candidates[counters[role] % candidates.length];
        counters[role] += 1;
        return [selected];
      }),
    }));
    setGroups(completed);
    localStorage.setItem(`nelpac-groups-${eventId}`, JSON.stringify({ groups: completed, assignments, groupSize: size, mode, avoidChurch }));
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <aside className="space-y-5">
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3"><span className="rounded-xl bg-violet-50 p-2.5 text-violet-700"><Shuffle size={19} /></span><div><h2 className="font-black text-slate-950">Grouping settings</h2><p className="text-xs text-slate-500">{delegates.length} delegates available</p></div></div>
          <label className="mt-5 block text-sm font-bold text-slate-700">Members per group<input type="number" min="1" value={groupSize} onChange={(e) => setGroupSize(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" /></label>
          <div className="mt-4 space-y-2 text-sm"><p className="font-bold text-slate-700">Grouping type</p><label className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3"><input type="radio" checked={mode === "bracket"} onChange={() => setMode("bracket")} /><span><strong className="block text-slate-800">By age bracket</strong><small className="text-slate-500">Freshman, Junior, and Senior stay separate.</small></span></label><label className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3"><input type="radio" checked={mode === "all"} onChange={() => setMode("all")} /><span><strong className="block text-slate-800">Shuffle everyone</strong><small className="text-slate-500">Mix every age bracket randomly.</small></span></label></div>
          <label className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-700"><span>Avoid same local church</span><input type="checkbox" checked={avoidChurch} onChange={(e) => setAvoidChurch(e.target.checked)} /></label>
        </section>
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><div><h2 className="font-black text-slate-950">Leader assignments</h2><p className="text-xs text-slate-500">CDG leaders, staff, and group heads</p></div><button onClick={addAssignment} className="rounded-lg bg-blue-50 p-2 text-blue-700"><Plus size={17} /></button></div>
          <div className="mt-4 space-y-3">{assignments.map((item) => <div key={item.id} className="rounded-xl border border-slate-200 p-3"><div className="flex gap-2"><input placeholder="Full name" value={item.name} onChange={(e) => updateAssignment(item.id, "name", e.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-2 text-sm" /><button onClick={() => setAssignments((current) => current.filter((row) => row.id !== item.id))} className="text-slate-400 hover:text-red-600"><Trash2 size={16} /></button></div><div className="mt-2 grid grid-cols-2 gap-2"><select value={item.role} onChange={(e) => updateAssignment(item.id, "role", e.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-xs">{personnelRoles.map((role) => <option key={role}>{role}</option>)}</select><select value={item.bracket} onChange={(e) => updateAssignment(item.id, "bracket", e.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-xs">{brackets.map((bracket) => <option key={bracket}>{bracket}</option>)}</select></div></div>)}</div>
          <button onClick={generate} disabled={!delegates.length} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-3 text-sm font-black text-white disabled:opacity-40"><WandSparkles size={17} /> Generate groups</button>
        </section>
      </aside>
      <section>
        {!groups.length ? <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><span className="rounded-2xl bg-violet-50 p-4 text-violet-600"><WandSparkles size={30} /></span><h2 className="mt-4 font-black text-slate-900">Your groups will appear here</h2><p className="mt-1 max-w-md text-sm text-slate-500">Configure the group size and leader assignments, then generate a church-aware shuffle.</p></div> : <div className="grid gap-4 lg:grid-cols-2">{groups.map((group) => <article key={group.name} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"><div className="flex items-center justify-between bg-slate-950 px-5 py-4 text-white"><div><h3 className="font-black">{group.name}</h3><p className="text-xs text-slate-300">{group.members.length} delegates</p></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">{group.bracket}</span></div>{group.leaders?.length > 0 && <div className="grid gap-2 border-b border-slate-100 bg-blue-50/60 p-4 sm:grid-cols-3">{group.leaders.map((leader) => <div key={`${leader.role}-${leader.name}`}><p className="text-[10px] font-black uppercase text-blue-500">{leader.role}</p><p className="text-sm font-bold text-slate-800">{leader.name}</p></div>)}</div>}<div className="divide-y divide-slate-50">{group.members.map((member, index) => <div key={member.id} className="flex items-center gap-3 px-5 py-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-500">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{member.name}</p><p className="truncate text-xs text-slate-500">{member.church}</p></div><span className="text-xs font-bold text-slate-400">{member.age}</span></div>)}</div></article>)}</div>}
      </section>
    </div>
  );
}

function Delegates() {
  const [tab, setTab] = useState("list");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [formParticipant, setFormParticipant] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const base = useSupabaseData(() => Promise.all([listEvents(), listEventRegistrations(), listLocalChurches()]), []);
  const onsiteData = useSupabaseData(() => listOnsiteEventParticipants(), []);
  const [events = [], registrations = [], churches = []] = base.data;
  const onsite = onsiteData.data || [];

  useEffect(() => {
    if (!selectedEventId && events[0]?.id) setSelectedEventId(events[0].id);
  }, [events, selectedEventId]);
  const allParticipants = useMemo(() => normalizeParticipants(registrations, onsite), [registrations, onsite]);
  const participants = useMemo(() => allParticipants.filter((item) => item.event_id === selectedEventId), [allParticipants, selectedEventId]);
  const delegates = useMemo(() => participants.filter((item) => item.role === "Delegate"), [participants]);
  const visible = useMemo(() => participants.filter((item) => {
    const query = search.trim().toLowerCase();
    const sourceMatches = sourceFilter === "All" || (sourceFilter === "Onsite" ? item.source.startsWith("Onsite") : item.source === sourceFilter);
    return (!query || `${item.name} ${item.church}`.toLowerCase().includes(query)) && (roleFilter === "All" || item.role === roleFilter) && sourceMatches;
  }), [participants, roleFilter, search, sourceFilter]);
  const churchCounts = delegates.reduce((counts, item) => ({ ...counts, [item.church]: (counts[item.church] || 0) + 1 }), {});
  const topChurch = Object.entries(churchCounts).sort((a, b) => b[1] - a[1])[0];
  const count = (predicate) => delegates.filter(predicate).length;

  const removeOnsite = async (participant) => {
    if (!window.confirm(`Remove ${participant.name} from this event?`)) return;
    setActionError("");
    try {
      await deleteOnsiteEventParticipant(participant.record_id);
      await onsiteData.reload({ silent: true });
    } catch (error) {
      setActionError(error.message || "Unable to remove onsite participant.");
    }
  };
  if (base.loading) return <LoadingState label="Loading delegate roster…" />;
  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-blue-600"><UserRoundCheck size={15} /> Event management</div><h1 className="mt-1 text-2xl font-black text-slate-950">Delegates</h1><p className="mt-1 text-sm text-slate-500">One roster for pre-registration, onsite registration, analytics, and group shuffling.</p></div>
        <label className="text-xs font-black uppercase tracking-wide text-slate-500">Selected event<select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} className="mt-1 block min-w-72 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold normal-case text-slate-800 shadow-sm">{events.map((event) => <option key={event.id} value={event.id}>{event.title} · {event.event_date}</option>)}</select></label>
      </div>
      <ErrorState message={base.error || actionError} />
      {onsiteData.error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><strong>Onsite roster is not available yet.</strong> Run <code>supabase-onsite-delegates-migration.sql</code> in Supabase. Pre-registration data is still shown below.</div>}
      <div className="inline-flex rounded-xl bg-slate-100 p-1"><button onClick={() => setTab("list")} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold ${tab === "list" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}><BarChart3 size={17} /> Analytics & List</button><button onClick={() => setTab("groups")} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold ${tab === "groups" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}><Shuffle size={17} /> Group Randomizer</button></div>
      {tab === "groups" ? <GroupRandomizer eventId={selectedEventId} delegates={delegates} /> : <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
          <StatCard icon={Users} label="Participants" value={participants.length} detail="All roles" />
          <StatCard icon={UserRoundCheck} label="Delegates" value={delegates.length} tone="violet" />
          <StatCard icon={Mars} label="Male" value={count((item) => item.gender === "Male")} tone="cyan" />
          <StatCard icon={Venus} label="Female" value={count((item) => item.gender === "Female")} tone="rose" />
          <StatCard icon={Users} label="Freshman" value={count((item) => item.bracket === "Freshman")} detail="Age 11–14" tone="emerald" />
          <StatCard icon={Users} label="Junior" value={count((item) => item.bracket === "Junior")} detail="Age 15–18" tone="amber" />
          <StatCard icon={Users} label="Senior" value={count((item) => item.bracket === "Senior")} detail="Age 19–22" tone="violet" />
          <StatCard icon={UserCog} label="Staff & officers" value={participants.filter((item) => ["Staff", "Officer"].includes(item.role)).length} detail={`${participants.filter((item) => item.role === "Worker").length} workers`} tone="blue" />
        </div>
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><Building2 size={19} /></span><div><p className="text-xs font-black uppercase tracking-wide text-slate-400">Largest delegation</p><h2 className="font-black text-slate-950">{topChurch ? topChurch[0] : "No delegate data"}</h2></div>{topChurch && <span className="ml-auto rounded-full bg-emerald-50 px-3 py-1 text-sm font-black text-emerald-700">{topChurch[1]} delegates</span>}</div></section>
        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5"><div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center"><div><h2 className="font-black text-slate-950">Event participant roster</h2><p className="text-sm text-slate-500">{visible.length} of {participants.length} participants shown</p></div><button disabled={!selectedEventId || !!onsiteData.error} onClick={() => { setFormParticipant(null); setFormOpen(true); }} className="flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40"><Plus size={17} /> Add onsite participant</button></div><div className="mt-4 grid gap-2 md:grid-cols-[1fr_180px_180px]"><label className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or local church…" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm" /></label><label className="relative"><Filter size={15} className="absolute left-3 top-3 text-slate-400" /><select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="w-full appearance-none rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm"><option>All</option><option>Delegate</option><option>Staff</option><option>Officer</option><option>Worker</option></select></label><select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option>All</option><option>Pre-registration</option><option>Onsite</option></select></div></div>
          {!visible.length ? <EmptyState label="No participants match this event and filter." /> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-3">Participant</th><th className="px-4 py-3">Local church</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Age bracket</th><th className="px-4 py-3">Gender</th><th className="px-4 py-3">Registration</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-50">{visible.map((participant) => <tr key={participant.id} className="hover:bg-slate-50/70"><td className="px-5 py-3.5"><p className="font-bold text-slate-900">{participant.name}</p>{participant.health && <p className="max-w-xs truncate text-xs text-slate-400">{participant.health}</p>}</td><td className="px-4 py-3.5 text-slate-600">{participant.church}</td><td className="px-4 py-3.5"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{participant.role}</span></td><td className="px-4 py-3.5"><p className="font-bold text-slate-700">{participant.bracket}</p><p className="text-xs text-slate-400">{participant.age == null ? "Age not recorded" : `${participant.age} years old`}</p></td><td className="px-4 py-3.5 text-slate-600">{participant.gender || "—"}</td><td className="px-4 py-3.5"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${participant.source === "Onsite" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>{participant.source}</span></td><td className="px-4 py-3.5"><div className="flex justify-end gap-1">{participant.source === "Onsite" ? <><button title="Edit onsite participant" onClick={() => { setFormParticipant(participant); setFormOpen(true); }} className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-700"><Edit3 size={16} /></button><button title="Remove onsite participant" onClick={() => removeOnsite(participant)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button></> : <span className="flex items-center gap-1 text-xs text-slate-400">Managed in Forms <ChevronRight size={14} /></span>}</div></td></tr>)}</tbody></table></div>}
        </section>
      </>}
      {formOpen && <ParticipantForm eventId={selectedEventId} churches={churches} participant={formParticipant} onClose={() => setFormOpen(false)} onSaved={() => onsiteData.reload({ silent: true })} />}
    </div>
  );
}

export { Delegates };
