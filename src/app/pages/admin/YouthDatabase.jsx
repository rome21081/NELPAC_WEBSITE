import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  MapPin,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { listMembers, reviewMember } from "../../lib/supabaseServices";
import { activityStatusColors, confirmationStatusColors, verificationColors } from "../../lib/localChurchMembers";

const controlClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10";
const pageSizeOptions = [10, 25, 50];
const emptyFilters = { district: "", church: "", activity: "", confirmation: "", minAge: "", maxAge: "" };

function StatusBadge({ value, colors }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${colors[value] || "bg-slate-100 text-slate-600"}`}>{value || "Not set"}</span>;
}

function MemberActions({ member, loading, onView, onReview }) {
  const pending = member.review_status === "Pending";
  return <div className="flex items-center justify-end gap-1">
    <button type="button" onClick={() => onView(member)} aria-label={`View ${member.name}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-blue-700 hover:bg-blue-50"><Eye size={15} /> <span className="hidden xl:inline">View</span></button>
    {pending && <>
      <button type="button" disabled={loading} onClick={() => onReview(member, "Approved")} aria-label={`Approve ${member.name}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"><CheckCircle2 size={17} /></button>
      <button type="button" disabled={loading} onClick={() => onReview(member, "Rejected")} aria-label={`Reject ${member.name}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-40"><XCircle size={17} /></button>
    </>}
  </div>;
}

function YouthDatabase() {
  const { data: members, loading, error, reload } = useSupabaseData(() => listMembers(), []);
  const [search, setSearch] = useState("");
  const [reviewFilter, setReviewFilter] = useState("All");
  const [filters, setFilters] = useState(emptyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewProfile, setViewProfile] = useState(null);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const counts = useMemo(() => ({
    All: members.length,
    Pending: members.filter((member) => member.review_status === "Pending").length,
    Approved: members.filter((member) => member.review_status === "Approved").length,
    Rejected: members.filter((member) => member.review_status === "Rejected").length,
    ISED: members.filter((member) => member.district?.trim().toUpperCase() === "ISED").length,
    ISIED: members.filter((member) => member.district?.trim().toUpperCase() === "ISIED").length,
  }), [members]);
  const churchMembership = useMemo(() => {
    const totals = members.reduce((result, member) => {
      const church = member.local_church_name?.trim();
      if (church) result[church] = (result[church] || 0) + 1;
      return result;
    }, {});
    const ranked = Object.entries(totals)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return {
      highest: ranked[0] || null,
      lowest: ranked.length ? [...ranked].sort((a, b) => a.count - b.count || a.name.localeCompare(b.name))[0] : null,
    };
  }, [members]);
  const metricTones = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
  };
  const churches = useMemo(() => [...new Set(members.map((member) => member.local_church_name).filter(Boolean))].sort(), [members]);
  const districts = useMemo(() => [...new Set(members.map((member) => member.district).filter(Boolean))].sort(), [members]);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return members.filter((member) => {
      const searchable = [member.name, member.local_church_name, member.district, member.contact_number, member.emergency_contact, member.gender].filter(Boolean).join(" ").toLowerCase();
      const age = Number(member.computed_age);
      return (!query || searchable.includes(query))
        && (reviewFilter === "All" || member.review_status === reviewFilter)
        && (!filters.district || member.district === filters.district)
        && (!filters.church || member.local_church_name === filters.church)
        && (!filters.activity || member.activity_status === filters.activity)
        && (!filters.confirmation || member.confirmation_class_status === filters.confirmation)
        && (!filters.minAge || age >= Number(filters.minAge))
        && (!filters.maxAge || age <= Number(filters.maxAge));
    }).sort((a, b) => {
      if (sort === "age-asc") return Number(a.computed_age) - Number(b.computed_age);
      if (sort === "age-desc") return Number(b.computed_age) - Number(a.computed_age);
      if (sort === "church") return (a.local_church_name || "").localeCompare(b.local_church_name || "");
      if (sort === "newest") return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [filters, members, reviewFilter, search, sort]);
  const pageCount = Math.max(Math.ceil(filtered.length / pageSize), 1);
  const pageStart = (page - 1) * pageSize;
  const paginated = filtered.slice(pageStart, pageStart + pageSize);

  useEffect(() => setPage(1), [filters, pageSize, reviewFilter, search, sort]);
  useEffect(() => setPage((current) => Math.min(current, pageCount)), [pageCount]);

  const requestReview = (member, status) => setConfirmAction({
    type: "single", id: member.id, status, danger: status === "Rejected",
    title: `${status === "Approved" ? "Approve" : "Reject"} this application?`,
    message: `${member.name}'s member application will be marked as ${status.toLowerCase()}.`,
  });
  const executeReview = async () => {
    if (!confirmAction) return;
    setActionError(""); setActionSuccess(""); setActionLoading(true);
    try {
      await reviewMember(confirmAction.id, confirmAction.status);
      await reload();
      setViewProfile((current) => current?.id === confirmAction.id ? { ...current, review_status: confirmAction.status } : current);
      setActionSuccess(`Application ${confirmAction.status.toLowerCase()} successfully.`);
    } catch (err) {
      setActionError(err.message || "Unable to update the application.");
    } finally {
      setActionLoading(false); setConfirmAction(null);
    }
  };

  if (loading) return <LoadingState label="Loading church member database..." />;

  return <div className="space-y-5 pb-8">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Member management</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Church Member Database</h1>
        <p className="mt-1 text-sm text-slate-500">Find, review, and understand member records in one place.</p>
      </div>
      <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm"><Users size={16} className="text-blue-700" /><b className="text-slate-900">{members.length}</b> total records</div>
    </header>
    <ErrorState message={error || actionError} />
    {actionSuccess && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700"><CheckCircle2 size={17} />{actionSuccess}</div>}

    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {[
        { label: "Total members", value: counts.All, detail: "All submitted records", icon: Users, tone: "blue" },
        { label: "ISED members", value: counts.ISED, detail: counts.All ? `${Math.round((counts.ISED / counts.All) * 100)}% of all member records` : "No records", icon: MapPin, tone: "emerald" },
        { label: "ISIED members", value: counts.ISIED, detail: counts.All ? `${Math.round((counts.ISIED / counts.All) * 100)}% of all member records` : "No records", icon: MapPin, tone: "violet" },
        { label: "Highest local church", value: churchMembership.highest?.name || "No data", detail: churchMembership.highest ? `${churchMembership.highest.count} registered member${churchMembership.highest.count === 1 ? "" : "s"}` : "No church records", icon: TrendingUp, tone: "emerald", compact: true },
        { label: "Lowest local church", value: churchMembership.lowest?.name || "No data", detail: churchMembership.lowest ? `${churchMembership.lowest.count} registered member${churchMembership.lowest.count === 1 ? "" : "s"}` : "No church records", icon: TrendingDown, tone: "amber", compact: true },
        { label: "Pending review", value: counts.Pending, detail: "Needs admin action", icon: Filter, tone: "amber" },
      ].map(({ label, value, detail, icon: Icon, tone, compact }) => <div key={label} className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold text-slate-500">{label}</p><p className={`mt-1 font-black leading-tight text-slate-950 ${compact ? "break-words text-xl" : "text-2xl sm:text-3xl"}`}>{value}</p></div><span className={`shrink-0 rounded-xl p-2 ${metricTones[tone]}`}><Icon size={18} /></span></div>
        <p className="mt-2 text-xs text-slate-400">{detail}</p>
      </div>)}
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row">
          <label className="relative min-w-0 flex-1">
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, church, district, or contact number..." className={`${controlClass} pl-10 pr-10`} />
            {search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><X size={15} /></button>}
          </label>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button type="button" onClick={() => setFiltersOpen((open) => !open)} className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition ${filtersOpen || activeFilterCount ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}><SlidersHorizontal size={16} /> Filters {activeFilterCount > 0 && <span className="rounded-full bg-blue-700 px-1.5 py-0.5 text-[10px] text-white">{activeFilterCount}</span>}</button>
            <select aria-label="Sort members" value={sort} onChange={(event) => setSort(event.target.value)} className={`${controlClass} sm:w-44`}><option value="name">Name A–Z</option><option value="newest">Newest first</option><option value="church">Local church</option><option value="age-asc">Age: low to high</option><option value="age-desc">Age: high to low</option></select>
          </div>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {["All", "Pending", "Approved", "Rejected"].map((status) => <button type="button" key={status} onClick={() => setReviewFilter(status)} className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-bold transition ${reviewFilter === status ? "bg-slate-900 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{status} <span className={reviewFilter === status ? "text-slate-300" : "text-slate-400"}>{counts[status]}</span></button>)}
        </div>
        {filtersOpen && <div className="mt-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-6">
          <select value={filters.district} onChange={(e) => setFilters((f) => ({ ...f, district: e.target.value }))} className={controlClass}><option value="">All districts</option>{districts.map((value) => <option key={value}>{value}</option>)}</select>
          <select value={filters.church} onChange={(e) => setFilters((f) => ({ ...f, church: e.target.value }))} className={`${controlClass} xl:col-span-2`}><option value="">All local churches</option>{churches.map((value) => <option key={value}>{value}</option>)}</select>
          <select value={filters.activity} onChange={(e) => setFilters((f) => ({ ...f, activity: e.target.value }))} className={controlClass}><option value="">Any activity status</option><option>Active</option><option>Inactive</option></select>
          <select value={filters.confirmation} onChange={(e) => setFilters((f) => ({ ...f, confirmation: e.target.value }))} className={controlClass}><option value="">Any confirmation status</option><option>Completed</option><option>Ongoing</option><option>Not Started</option><option>Dropped</option></select>
          <div className="grid grid-cols-2 gap-2"><input type="number" min="0" placeholder="Min age" value={filters.minAge} onChange={(e) => setFilters((f) => ({ ...f, minAge: e.target.value }))} className={controlClass} /><input type="number" min="0" placeholder="Max age" value={filters.maxAge} onChange={(e) => setFilters((f) => ({ ...f, maxAge: e.target.value }))} className={controlClass} /></div>
          <div className="flex items-center justify-between sm:col-span-2 xl:col-span-6"><p className="text-xs text-slate-500">{filtered.length} matching record{filtered.length === 1 ? "" : "s"}</p><button type="button" onClick={() => setFilters(emptyFilters)} disabled={!activeFilterCount} className="text-xs font-bold text-blue-700 disabled:text-slate-400">Clear filters</button></div>
        </div>}
      </div>

      {filtered.length === 0 ? <div className="p-8"><EmptyState label="No member records match your search and filters." /></div> : <>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[900px] text-left">
            <thead><tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black uppercase tracking-wider text-slate-500"><th className="px-5 py-3.5">Member</th><th className="px-4 py-3.5">Church & district</th><th className="px-4 py-3.5">Contact</th><th className="px-4 py-3.5">Age</th><th className="px-4 py-3.5">Activity</th><th className="px-4 py-3.5">Review</th><th className="px-5 py-3.5 text-right">Actions</th></tr></thead>
            <tbody>{paginated.map((member) => <tr key={member.id} className="border-b border-slate-100 transition hover:bg-blue-50/30">
              <td className="px-5 py-4"><p className="font-bold text-slate-900">{member.name}</p><p className="mt-0.5 text-xs text-slate-500">{member.gender || "Gender not set"} · {member.birthday || "Birthday not set"}</p></td>
              <td className="px-4 py-4"><p className="max-w-[220px] truncate text-sm font-semibold text-slate-700">{member.local_church_name || "Not assigned"}</p><p className="mt-0.5 text-xs text-slate-500">{member.district || "No district"}</p></td>
              <td className="px-4 py-4"><p className="text-sm text-slate-700">{member.contact_number || "—"}</p><p className="mt-0.5 text-xs text-slate-400">Emergency: {member.emergency_contact || "—"}</p></td>
              <td className="px-4 py-4 text-sm font-bold text-slate-700">{member.computed_age ?? "—"}</td>
              <td className="px-4 py-4"><StatusBadge value={member.activity_status} colors={activityStatusColors} /></td>
              <td className="px-4 py-4"><StatusBadge value={member.review_status} colors={verificationColors} /></td>
              <td className="px-5 py-4"><MemberActions member={member} loading={actionLoading} onView={setViewProfile} onReview={requestReview} /></td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="divide-y divide-slate-100 md:hidden">{paginated.map((member) => <article key={member.id} className="p-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-extrabold text-slate-900">{member.name}</h3><p className="mt-1 truncate text-xs text-slate-500">{member.local_church_name || "No church"} · {member.district || "No district"}</p></div><StatusBadge value={member.review_status} colors={verificationColors} /></div>
          <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs"><div><p className="font-bold text-slate-400">CONTACT</p><p className="mt-1 text-sm text-slate-700">{member.contact_number || "—"}</p></div><div><p className="font-bold text-slate-400">AGE / ACTIVITY</p><p className="mt-1 text-sm text-slate-700">{member.computed_age ?? "—"} · {member.activity_status || "—"}</p></div></div>
          <div className="mt-2"><MemberActions member={member} loading={actionLoading} onView={setViewProfile} onReview={requestReview} /></div>
        </article>)}</div>
        <footer className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500"><span>Showing {pageStart + 1}–{Math.min(pageStart + pageSize, filtered.length)} of {filtered.length}</span><select aria-label="Rows per page" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs">{pageSizeOptions.map((size) => <option key={size} value={size}>{size} rows</option>)}</select></div>
          <div className="flex items-center justify-between gap-2 sm:justify-end"><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 disabled:opacity-40"><ChevronLeft size={14} /> Previous</button><span className="text-xs font-semibold text-slate-600">{page} / {pageCount}</span><button type="button" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)} className="flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 disabled:opacity-40">Next <ChevronRight size={14} /></button></div>
        </footer>
      </>}
    </section>

    {viewProfile && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={() => setViewProfile(null)}>
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 p-5 backdrop-blur sm:p-6"><div className="min-w-0"><p className="text-xs font-black uppercase tracking-wider text-blue-700">Member profile</p><h2 className="mt-1 truncate text-xl font-black text-slate-950">{viewProfile.name}</h2><p className="mt-1 text-sm text-slate-500">{viewProfile.local_church_name || "No local church"} · {viewProfile.district || "No district"}</p></div><button type="button" aria-label="Close profile" onClick={() => setViewProfile(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"><X size={18} /></button></div>
        <div className="p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap gap-2"><StatusBadge value={viewProfile.review_status} colors={verificationColors} /><StatusBadge value={viewProfile.activity_status} colors={activityStatusColors} /><StatusBadge value={viewProfile.confirmation_class_status} colors={confirmationStatusColors} /></div>
          <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">{[
            ["Age & birthday", `${viewProfile.computed_age ?? "—"} years · ${viewProfile.birthday || "No birthday"}`], ["Gender", viewProfile.gender || "—"], ["Contact number", viewProfile.contact_number || "—"], ["Emergency contact", viewProfile.emergency_contact || "—"], ["Address", viewProfile.address || "—"], ["Parent / guardian", viewProfile.parent_guardian_name || "—"], ["Professing member", viewProfile.professing_member || "—"], ["Confirmation year", viewProfile.confirmation_class_year || "—"],
          ].map(([label, value]) => <div key={label}><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-sm font-medium leading-relaxed text-slate-700">{value}</p></div>)}</div>
          <div className="mt-7 flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={() => setViewProfile(null)} className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-600">Close</button>{viewProfile.review_status === "Pending" && <><button type="button" onClick={() => requestReview(viewProfile, "Rejected")} className="h-11 rounded-xl bg-red-50 px-5 text-sm font-bold text-red-700">Reject</button><button type="button" onClick={() => requestReview(viewProfile, "Approved")} className="h-11 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white">Approve member</button></>}</div>
        </div>
      </div>
    </div>}
    {confirmAction && <div role="alertdialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${confirmAction.danger ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>{confirmAction.danger ? <XCircle size={22} /> : <CheckCircle2 size={22} />}</div><h2 className="text-lg font-black text-slate-950">{confirmAction.title}</h2><p className="mt-2 text-sm leading-relaxed text-slate-600">{confirmAction.message}</p><div className="mt-6 grid grid-cols-2 gap-2"><button type="button" disabled={actionLoading} onClick={() => setConfirmAction(null)} className="h-11 rounded-xl border border-slate-200 text-sm font-bold text-slate-600">Cancel</button><button type="button" disabled={actionLoading} onClick={executeReview} className={`h-11 rounded-xl text-sm font-bold text-white disabled:opacity-50 ${confirmAction.danger ? "bg-red-600" : "bg-emerald-600"}`}>{actionLoading ? "Saving..." : "Confirm"}</button></div></div></div>}
  </div>;
}

export { YouthDatabase };
