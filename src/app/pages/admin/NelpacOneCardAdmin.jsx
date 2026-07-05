import { useState } from "react";
import { useSearchParams } from "react-router";
import { CheckCircle2, ChevronLeft, ChevronRight, Coins, Edit2, Gift, KeyRound, PackageCheck, Plus, ShieldCheck, UserRound, XCircle } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { useAuth } from "../../lib/authContext";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { createPointsEntry, listEvents, listOneCardRedeemCodes, listPointBalances, listPointLedger, listRewardClaims, markRewardClaimClaimed, reviewRewardClaim, saveOneCardRedeemCode } from "../../lib/supabaseServices";
import { RewardsManagement } from "./RewardsManagement";

const emptyCode = { id: "", code: "", points: "", claim_limit: "", expires_at: "", is_active: true, event_id: "" };

function NelpacOneCardAdmin() {
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const initialSection = ["codes", "rewards", "claims"].includes(params.get("section")) ? params.get("section") : "codes";
  const [section, setSection] = useState(initialSection);
  const chooseSection = (value) => { setSection(value); setParams({ section: value }, { replace: true }); };
  const { data, loading, error, reload } = useSupabaseData(async () => {
    const [balances, ledger, claims, events, codes] = await Promise.all([listPointBalances(), listPointLedger(), listRewardClaims(), listEvents(), listOneCardRedeemCodes()]);
    return [{ balances, ledger, claims, events, codes }];
  }, []);
  const [pointsForm, setPointsForm] = useState({ user_id: "", points: "", description: "", event_id: "" });
  const [codeForm, setCodeForm] = useState(emptyCode);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(1);

  if (loading) return <LoadingState label="Loading One Card workspace…" />;
  const { balances = [], ledger = [], claims = [], events = [], codes = [] } = data[0] || {};
  const ledgerPageCount = Math.max(Math.ceil(ledger.length / 5), 1);
  const safeLedgerPage = Math.min(ledgerPage, ledgerPageCount);
  const ledgerRows = ledger.slice((safeLedgerPage - 1) * 5, safeLedgerPage * 5);
  const memberNames = new Map(balances.map((member) => [member.user_id, member.full_name]));

  const addPoints = async (event) => {
    event.preventDefault(); setMessage(""); setSaving(true);
    try { await createPointsEntry({ ...pointsForm, points: Number(pointsForm.points), entry_type: "earned", event_id: pointsForm.event_id || null, created_by: profile.id }); setPointsForm({ user_id: "", points: "", description: "", event_id: "" }); await reload(); setLedgerPage(1); setMessage("Points entry added."); }
    catch (err) { setMessage(err.message || "Unable to add points."); } finally { setSaving(false); }
  };
  const saveCode = async (event) => {
    event.preventDefault(); setMessage(""); setSaving(true);
    try { await saveOneCardRedeemCode(codeForm); setCodeForm(emptyCode); await reload(); setMessage("Reward code saved."); }
    catch (err) { setMessage(err.message || "Unable to save reward code."); } finally { setSaving(false); }
  };
  const claimAction = async (id, action) => {
    setMessage("");
    try { if (action === "Claimed") await markRewardClaimClaimed(id); else await reviewRewardClaim(id, action); await reload(); setMessage(`Claim ${action.toLowerCase()}.`); }
    catch (err) { setMessage(err.message || "Unable to update claim."); }
  };
  const editCode = (code) => setCodeForm({ id: code.id, code: code.code, points: code.points, claim_limit: code.claim_limit, expires_at: code.expires_at?.slice(0, 16) || "", is_active: code.is_active, event_id: code.event_id || "" });

  const tabs = [
    { id: "codes", label: "Codes & Points", icon: KeyRound },
    { id: "rewards", label: "Rewards Management", icon: Gift },
    { id: "claims", label: "Claim Management", icon: ShieldCheck },
  ];
  return <div className="space-y-6">
    <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 p-6 text-white shadow-xl sm:p-8"><p className="text-xs font-black uppercase tracking-[.22em] text-blue-200">NELPAC One Card Administration</p><h1 className="mt-2 text-3xl font-black">Rewards and points, beautifully organized.</h1><p className="mt-2 max-w-2xl text-sm text-slate-300">Configure earning codes, publish rewards, and verify every claim from one focused workspace.</p><div className="mt-6 grid gap-2 md:grid-cols-3">{tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => chooseSection(id)} className={`flex items-center gap-3 rounded-2xl border p-4 text-left text-sm font-black transition ${section === id ? "border-white bg-white text-slate-950 shadow-lg" : "border-white/15 bg-white/5 text-white hover:bg-white/10"}`}><span className={`rounded-xl p-2 ${section === id ? "bg-blue-50 text-blue-700" : "bg-white/10"}`}><Icon size={18} /></span>{label}</button>)}</div></header>
    <ErrorState message={error || (message.includes("Unable") ? message : "")} />
    {message && !message.includes("Unable") && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p>}

    {section === "rewards" && <RewardsManagement />}
    {section === "codes" && <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border bg-white p-4"><Coins className="text-amber-600" /><p className="mt-3 text-2xl font-black">{balances.reduce((sum, row) => sum + Number(row.points_balance || 0), 0)}</p><span className="text-xs font-bold uppercase text-slate-400">Points in circulation</span></div><div className="rounded-2xl border bg-white p-4"><KeyRound className="text-blue-600" /><p className="mt-3 text-2xl font-black">{codes.filter((code) => code.is_active).length}</p><span className="text-xs font-bold uppercase text-slate-400">Active codes</span></div><div className="rounded-2xl border bg-white p-4"><PackageCheck className="text-emerald-600" /><p className="mt-3 text-2xl font-black">{ledger.length}</p><span className="text-xs font-bold uppercase text-slate-400">Ledger entries</span></div></div>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4"><h2 className="text-lg font-black text-slate-950">Manage member points</h2><p className="text-sm text-slate-500">Add an auditable points entry to a member account.</p></div><form onSubmit={addPoints} className="grid gap-3 md:grid-cols-5"><select required value={pointsForm.user_id} onChange={(e) => setPointsForm((f) => ({ ...f, user_id: e.target.value }))} className="rounded-xl border px-3 py-2.5 text-sm"><option value="">Select member</option>{balances.map((row) => <option key={row.user_id} value={row.user_id}>{row.full_name}</option>)}</select><input required type="number" placeholder="Points" value={pointsForm.points} onChange={(e) => setPointsForm((f) => ({ ...f, points: e.target.value }))} className="rounded-xl border px-3 py-2.5 text-sm"/><input required placeholder="Reason / description" value={pointsForm.description} onChange={(e) => setPointsForm((f) => ({ ...f, description: e.target.value }))} className="rounded-xl border px-3 py-2.5 text-sm"/><select value={pointsForm.event_id} onChange={(e) => setPointsForm((f) => ({ ...f, event_id: e.target.value }))} className="rounded-xl border px-3 py-2.5 text-sm"><option value="">No event</option>{events.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><button disabled={saving} className="flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white"><Plus size={16}/> Add points</button></form></section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><h2 className="text-lg font-black text-slate-950">Reward earning codes</h2><p className="text-sm text-slate-500">Control points, claim limits, availability, expiration, and event scope.</p></div>{codeForm.id && <button onClick={() => setCodeForm(emptyCode)} className="text-sm font-bold text-slate-500">Cancel edit</button>}</div><form onSubmit={saveCode} className="mt-4 grid gap-3 md:grid-cols-6"><input required placeholder="CODE" value={codeForm.code} onChange={(e) => setCodeForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} className="rounded-xl border px-3 py-2.5 font-mono text-sm uppercase"/><input required type="number" min="1" placeholder="Points" value={codeForm.points} onChange={(e) => setCodeForm((f) => ({ ...f, points: e.target.value }))} className="rounded-xl border px-3 py-2.5 text-sm"/><input required type="number" min="1" placeholder="Usage limit" value={codeForm.claim_limit} onChange={(e) => setCodeForm((f) => ({ ...f, claim_limit: e.target.value }))} className="rounded-xl border px-3 py-2.5 text-sm"/><input required type="datetime-local" value={codeForm.expires_at} onChange={(e) => setCodeForm((f) => ({ ...f, expires_at: e.target.value }))} className="rounded-xl border px-3 py-2.5 text-sm"/><select value={codeForm.event_id} onChange={(e) => setCodeForm((f) => ({ ...f, event_id: e.target.value }))} className="rounded-xl border px-3 py-2.5 text-sm"><option value="">All / no event</option>{events.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><button disabled={saving} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white">{codeForm.id ? "Save changes" : "Create code"}</button><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={codeForm.is_active} onChange={(e) => setCodeForm((f) => ({ ...f, is_active: e.target.checked }))}/> Available for use</label></form>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-400"><tr><th className="p-3">Code</th><th>Points</th><th>Usage</th><th>Expires</th><th>Event</th><th>Status</th><th></th></tr></thead><tbody className="divide-y">{codes.map((code) => <tr key={code.id}><td className="p-3 font-mono font-black">{code.code}</td><td>{code.points}</td><td>{code.used_count}/{code.claim_limit}</td><td>{new Date(code.expires_at).toLocaleString()}</td><td>{code.event_title || "All"}</td><td>{code.is_active ? "Active" : "Inactive"}</td><td><button onClick={() => editCode(code)} className="rounded-lg p-2 text-blue-700"><Edit2 size={15}/></button></td></tr>)}</tbody></table></div></section>
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-5 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-black text-slate-950">Recent points ledger</h2><p className="mt-1 text-sm text-slate-500">See exactly who received or used each points entry.</p></div><span className="text-xs font-bold text-slate-400">{ledger.length} total entries</span></div>
        {ledger.length === 0 ? <div className="p-6"><EmptyState label="No points ledger entries yet." /></div> : <>
          <div className="divide-y divide-slate-100">{ledgerRows.map((entry) => <article key={entry.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(180px,0.8fr)_minmax(220px,1.4fr)_auto] sm:items-center sm:px-5">
            <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><UserRound size={17} /></span><div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{memberNames.get(entry.user_id) || "Unknown member"}</p><p className="mt-0.5 text-xs text-slate-400">{entry.created_at ? new Date(entry.created_at).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Date unavailable"}</p></div></div>
            <div className="min-w-0 sm:border-l sm:border-slate-100 sm:pl-5"><p className="text-sm font-semibold text-slate-700">{entry.description}</p><p className="mt-0.5 text-xs text-slate-400">{entry.events?.title || "General points entry"}</p></div>
            <strong className={`w-fit rounded-full px-3 py-1.5 text-sm ${Number(entry.points) > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{Number(entry.points) > 0 ? "+" : ""}{entry.points} pts</strong>
          </article>)}</div>
          <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-4 py-3 sm:px-5"><p className="text-xs text-slate-500">Showing {(safeLedgerPage - 1) * 5 + 1}–{Math.min(safeLedgerPage * 5, ledger.length)} of {ledger.length}</p><div className="flex items-center gap-2"><button type="button" aria-label="Previous ledger page" disabled={safeLedgerPage === 1} onClick={() => setLedgerPage((page) => Math.max(1, page - 1))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40"><ChevronLeft size={16} /></button><span className="min-w-12 text-center text-xs font-black text-slate-600">{safeLedgerPage} / {ledgerPageCount}</span><button type="button" aria-label="Next ledger page" disabled={safeLedgerPage === ledgerPageCount} onClick={() => setLedgerPage((page) => Math.min(ledgerPageCount, page + 1))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40"><ChevronRight size={16} /></button></div></footer>
        </>}
      </section>
    </div>}

    {section === "claims" && <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div><h2 className="text-xl font-black text-slate-950">Reward claim management</h2><p className="text-sm text-slate-500">Verify claimant information, approve rewards, and monitor fulfillment.</p></div>{claims.length === 0 ? <EmptyState label="No reward claims submitted." /> : <div className="mt-5 grid gap-4 lg:grid-cols-2">{claims.map((claim) => <article key={claim.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><span className="text-xs font-black uppercase tracking-wide text-blue-600">{claim.reward_type || "Reward"}</span><h3 className="font-black text-slate-950">{claim.reward_name}</h3><p className="text-sm text-slate-500">{claim.claimant_name || "Unknown member"}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{claim.claim_status}</span></div><div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs"><div><span className="text-slate-400">Church</span><p className="font-bold">{claim.local_church_name || "—"}</p></div><div><span className="text-slate-400">District</span><p className="font-bold">{claim.district || "—"}</p></div><div><span className="text-slate-400">Points</span><p className="font-bold">{claim.points_used}</p></div><div><span className="text-slate-400">Size</span><p className="font-bold">{claim.selected_size || "N/A"}</p></div></div>{claim.voucher_code && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-[10px] font-black uppercase text-emerald-700">{claim.voucher_type}</p><code className="font-black tracking-widest text-emerald-950">{claim.voucher_code}</code></div>}<div className="mt-4 flex flex-wrap gap-2">{claim.claim_status === "Pending" && <><button onClick={() => claimAction(claim.id, "Approved")} className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700"><CheckCircle2 size={14}/> Approve</button><button onClick={() => claimAction(claim.id, "Rejected")} className="inline-flex items-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700"><XCircle size={14}/> Reject</button></>}{claim.claim_status === "Approved" && claim.reward_type !== "Discount" && <button onClick={() => claimAction(claim.id, "Claimed")} className="inline-flex items-center gap-1 rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700"><Gift size={14}/> Mark claimed</button>}</div></article>)}</div>}</section>}
  </div>;
}

export { NelpacOneCardAdmin };
