import { useMemo, useState } from "react";
import { CheckCircle2, Eye, Filter, Search, XCircle } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { listMembers, reviewMember } from "../../lib/supabaseServices";
import { activityStatusColors, confirmationStatusColors, professingMemberColors, verificationColors } from "../../lib/localChurchMembers";

const selectClass = "py-2 px-3 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20";

function YouthDatabase() {
  const { data: members, loading, error, reload } = useSupabaseData(() => listMembers(), []);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ district: "", church: "", review: "", activity: "" });
  const [viewProfile, setViewProfile] = useState(null);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const churches = useMemo(() => [...new Set(members.map((member) => member.local_church_name).filter(Boolean))], [members]);
  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return members.filter((member) => {
      const searchable = `${member.name} ${member.local_church_name} ${member.district} ${member.contact_number} ${member.emergency_contact} ${member.gender} ${member.review_status} ${member.activity_status}`.toLowerCase();
      return searchable.includes(query)
        && (!filters.district || member.district === filters.district)
        && (!filters.church || member.local_church_name === filters.church)
        && (!filters.review || member.review_status === filters.review)
        && (!filters.activity || member.activity_status === filters.activity);
    });
  }, [filters, members, search]);

  const pendingMembers = useMemo(() => members.filter((member) => member.review_status === "Pending"), [members]);

  const executeReview = async (id, status) => {
    setActionError("");
    setActionSuccess("");
    setActionLoading(true);
    try {
      await reviewMember(id, status);
      await reload();
      setViewProfile((current) => current?.id === id ? { ...current, review_status: status } : current);
      setActionSuccess(`Application ${status.toLowerCase()}.`);
    } catch (err) {
      setActionError(err.message || "Unable to update review status.");
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  const executeBulkReview = async (status) => {
    setActionError("");
    setActionSuccess("");
    setActionLoading(true);
    try {
      const pending = members.filter((member) => member.review_status === "Pending");
      for (const member of pending) {
        await reviewMember(member.id, status);
      }
      await reload();
      setActionSuccess(`${pending.length} pending application${pending.length === 1 ? "" : "s"} ${status.toLowerCase()}.`);
    } catch (err) {
      setActionError(err.message || `Unable to ${status.toLowerCase()} all pending applications.`);
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  const runConfirmedAction = () => {
    if (!confirmAction) return;
    if (confirmAction.type === "single") executeReview(confirmAction.id, confirmAction.status);
    if (confirmAction.type === "bulk") executeBulkReview(confirmAction.status);
  };

  if (loading) return <LoadingState label="Loading youth database..." />;

  return <div className="space-y-5">
      <div>
        <h1 className="text-slate-900" style={{ fontSize: "22px", fontWeight: 700 }}>Local Church Members Database</h1>
        <p className="text-slate-500" style={{ fontSize: "13px" }}>{filtered.length} of {members.length} submitted member records</p>
      </div>
      <ErrorState message={error || actionError} />
      {actionSuccess && <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">{actionSuccess}</p>}
      {actionLoading && <p className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">Processing review action...</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["Total Members", members.length],
          ["Active", members.filter((m) => m.activity_status === "Active").length],
          ["Professing", members.filter((m) => m.professing_member === "Yes").length],
          ["Pending Review", members.filter((m) => m.review_status === "Pending").length],
        ].map(([label, value]) => <div key={label} className="bg-white rounded-2xl p-4 border border-slate-100">
            <p className="text-slate-400" style={{ fontSize: "11px", fontWeight: 700 }}>{label.toUpperCase()}</p>
            <p className="mt-2 text-blue-700" style={{ fontSize: "24px", fontWeight: 800 }}>{value}</p>
          </div>)}
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-100 bg-white p-4">
        <button
          disabled={pendingMembers.length === 0 || actionLoading}
          onClick={() => setConfirmAction({ type: "bulk", status: "Approved", title: "Approve all pending applications?", message: `This will approve ${pendingMembers.length} pending church member application${pendingMembers.length === 1 ? "" : "s"} using the admin review RPC.` })}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white disabled:bg-slate-200 disabled:text-slate-500"
        >
          Approve All Pending
        </button>
        <button
          disabled={pendingMembers.length === 0 || actionLoading}
          onClick={() => setConfirmAction({ type: "bulk", status: "Rejected", danger: true, title: "Reject all pending applications?", message: `Warning: this will reject ${pendingMembers.length} pending church member application${pendingMembers.length === 1 ? "" : "s"}. Please confirm you really want to reject all pending applications.` })}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white disabled:bg-slate-200 disabled:text-slate-500"
        >
          Reject All Pending
        </button>
        <span className="self-center text-sm text-slate-500">{pendingMembers.length} pending</span>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-slate-100">
        <div className="flex items-center gap-2 mb-3">
          <Filter style={{ width: 16, height: 16, color: "#64748b" }} />
          <p className="text-slate-800" style={{ fontSize: "14px", fontWeight: 700 }}>Filters and Search</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ width: 15, height: 15 }} />
            <input placeholder="Search records..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <select value={filters.district} onChange={(e) => setFilters((f) => ({ ...f, district: e.target.value }))} className={selectClass}>
            <option value="">All Districts</option><option>ISED</option><option>ISIED</option>
          </select>
          <select value={filters.church} onChange={(e) => setFilters((f) => ({ ...f, church: e.target.value }))} className={selectClass}>
            <option value="">All Churches</option>{churches.map((church) => <option key={church}>{church}</option>)}
          </select>
          <select value={filters.review} onChange={(e) => setFilters((f) => ({ ...f, review: e.target.value }))} className={selectClass}>
            <option value="">All Review Status</option><option>Pending</option><option>Approved</option><option>Rejected</option>
          </select>
          <select value={filters.activity} onChange={(e) => setFilters((f) => ({ ...f, activity: e.target.value }))} className={selectClass}>
            <option value="">All Activity Status</option><option>Active</option><option>Inactive</option>
          </select>
          <button onClick={() => setFilters({ district: "", church: "", review: "", activity: "" })} className="py-2 px-3 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Reset</button>
        </div>
      </div>

      {filtered.length === 0 ? <EmptyState label="No member records match the current filters." /> : <div className="bg-white rounded-2xl overflow-hidden border border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-slate-50 border-b border-slate-100">
                {["Name", "Age", "Birthday", "Contact", "Emergency", "Gender", "District", "Local Church", "Professing", "Confirmation", "Activity", "Review", "Actions"].map((h) => <th key={h} className="py-3 px-4 text-left text-slate-500" style={{ fontSize: "11px", fontWeight: 700 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filtered.map((member) => <tr key={member.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="py-3 px-4 text-slate-800" style={{ fontSize: "13px", fontWeight: 700 }}>{member.name}</td>
                  <td className="py-3 px-4 text-slate-600 text-sm">{member.computed_age}</td>
                  <td className="py-3 px-4 text-slate-600 text-sm">{member.birthday}</td>
                  <td className="py-3 px-4 text-slate-600 text-sm">{member.contact_number || "-"}</td>
                  <td className="py-3 px-4 text-slate-600 text-sm">{member.emergency_contact || "-"}</td>
                  <td className="py-3 px-4 text-slate-600 text-sm">{member.gender || "-"}</td>
                  <td className="py-3 px-4 text-slate-600 text-sm">{member.district}</td>
                  <td className="py-3 px-4 text-slate-600 text-sm">{member.local_church_name}</td>
                  <td className="py-3 px-4"><span className={`px-2 py-0.5 rounded-full text-xs ${professingMemberColors[member.professing_member]}`}>{member.professing_member}</span></td>
                  <td className="py-3 px-4"><span className={`px-2 py-0.5 rounded-full text-xs ${confirmationStatusColors[member.confirmation_class_status]}`}>{member.confirmation_class_status}</span></td>
                  <td className="py-3 px-4"><span className={`px-2 py-0.5 rounded-full text-xs ${activityStatusColors[member.activity_status]}`}>{member.activity_status}</span></td>
                  <td className="py-3 px-4"><span className={`px-2 py-0.5 rounded-full text-xs ${verificationColors[member.review_status]}`}>{member.review_status}</span></td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1">
                      <button onClick={() => setViewProfile(member)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"><Eye style={{ width: 14, height: 14 }} /></button>
                      <button onClick={() => setConfirmAction({ type: "single", id: member.id, status: "Approved", title: "Approve this application?", message: `Approve ${member.name}'s church member application using the admin review RPC?` })} disabled={member.review_status !== "Pending" || actionLoading} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-30"><CheckCircle2 style={{ width: 14, height: 14 }} /></button>
                      <button onClick={() => setConfirmAction({ type: "single", id: member.id, status: "Rejected", danger: true, title: "Reject this application?", message: `Reject ${member.name}'s church member application using the admin review RPC?` })} disabled={member.review_status !== "Pending" || actionLoading} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30"><XCircle style={{ width: 14, height: 14 }} /></button>
                    </div>
                  </td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>}

      {viewProfile && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewProfile(null)}>
        <div className="bg-white rounded-2xl p-6 w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between gap-4 mb-5">
            <div><h3 className="text-slate-900" style={{ fontSize: "20px", fontWeight: 800 }}>{viewProfile.name}</h3><p className="text-slate-500 text-sm">{viewProfile.local_church_name} · {viewProfile.district}</p></div>
            <span className={`h-fit px-2.5 py-1 rounded-full text-xs ${verificationColors[viewProfile.review_status]}`}>{viewProfile.review_status}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              ["Computed Age", viewProfile.computed_age], ["Birthday", viewProfile.birthday], ["Contact Number", viewProfile.contact_number || "-"], ["Emergency Contact", viewProfile.emergency_contact || "-"], ["Gender", viewProfile.gender || "-"], ["Address", viewProfile.address || "-"], ["Parent/Guardian", viewProfile.parent_guardian_name || "-"], ["Professing Member", viewProfile.professing_member], ["Confirmation", `${viewProfile.confirmation_class_year || "No year"} · ${viewProfile.confirmation_class_status}`], ["Activity Status", viewProfile.activity_status],
            ].map(([label, value]) => <div key={label}><p className="text-slate-400" style={{ fontSize: "11px", fontWeight: 700 }}>{label.toUpperCase()}</p><p className="text-slate-700 text-sm">{value}</p></div>)}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <button disabled={viewProfile.review_status !== "Pending" || actionLoading} onClick={() => setConfirmAction({ type: "single", id: viewProfile.id, status: "Approved", title: "Approve this application?", message: `Approve ${viewProfile.name}'s church member application using the admin review RPC?` })} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 text-sm disabled:opacity-40"><CheckCircle2 style={{ width: 14, height: 14 }} /> Approve</button>
            <button disabled={viewProfile.review_status !== "Pending" || actionLoading} onClick={() => setConfirmAction({ type: "single", id: viewProfile.id, status: "Rejected", danger: true, title: "Reject this application?", message: `Reject ${viewProfile.name}'s church member application using the admin review RPC?` })} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 text-red-700 text-sm disabled:opacity-40"><XCircle style={{ width: 14, height: 14 }} /> Reject</button>
            <button onClick={() => setViewProfile(null)} className="ml-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm">Close</button>
          </div>
        </div>
      </div>}
      {confirmAction && <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => !actionLoading && setConfirmAction(null)}>
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-slate-900" style={{ fontSize: "18px", fontWeight: 800 }}>{confirmAction.title}</h3>
          <p className="mt-2 text-sm text-slate-600">{confirmAction.message}</p>
          <div className="mt-6 flex gap-2">
            <button disabled={actionLoading} onClick={() => setConfirmAction(null)} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 disabled:opacity-50">Cancel</button>
            <button disabled={actionLoading} onClick={runConfirmedAction} className={`flex-1 rounded-xl px-4 py-2.5 text-sm text-white disabled:opacity-50 ${confirmAction.danger ? "bg-red-600" : "bg-emerald-600"}`}>
              {actionLoading ? "Processing..." : "Confirm"}
            </button>
          </div>
        </div>
      </div>}
    </div>;
}

export { YouthDatabase };
