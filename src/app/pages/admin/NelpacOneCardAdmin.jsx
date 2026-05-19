import { useState } from "react";
import { Edit2, Gift, Plus, X } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { useAuth } from "../../lib/authContext";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { createPointsEntry, listEvents, listOneCardRedeemCodes, listPointBalances, listPointLedger, listRewardClaims, markRewardClaimClaimed, reviewRewardClaim, saveOneCardRedeemCode } from "../../lib/supabaseServices";

const emptyCode = { id: "", code: "", points: "", claim_limit: "", expires_at: "", is_active: true, event_id: "" };

function NelpacOneCardAdmin() {
  const { profile } = useAuth();
  const { data, loading, error, reload } = useSupabaseData(async () => {
    const [balances, ledger, claims, events, codes] = await Promise.all([listPointBalances(), listPointLedger(), listRewardClaims(), listEvents(), listOneCardRedeemCodes()]);
    return [{ balances, ledger, claims, events, codes }];
  }, []);
  const [form, setForm] = useState({ user_id: "", points: "", description: "", event_id: "" });
  const [codeForm, setCodeForm] = useState(emptyCode);
  const [message, setMessage] = useState("");
  const [savingCode, setSavingCode] = useState(false);
  const [confirmCode, setConfirmCode] = useState(false);

  if (loading) return <LoadingState label="Loading One Card admin..." />;
  const { balances = [], ledger = [], claims = [], events = [], codes = [] } = data[0] || {};

  const submit = async (event) => {
    event.preventDefault();
    try {
      await createPointsEntry({ ...form, points: Number(form.points), entry_type: "earned", event_id: form.event_id || null, created_by: profile.id });
      setForm({ user_id: "", points: "", description: "", event_id: "" });
      await reload();
      setMessage("Points entry added.");
    } catch (err) {
      setMessage(err.message || "Unable to add points.");
    }
  };

  const saveCode = async () => {
    setSavingCode(true);
    setMessage("");
    try {
      await saveOneCardRedeemCode(codeForm);
      setCodeForm(emptyCode);
      setConfirmCode(false);
      await reload();
      setMessage("Redeem code saved.");
    } catch (err) {
      setMessage(err.message || "Unable to save redeem code.");
    } finally {
      setSavingCode(false);
    }
  };

  const editCode = (code) => setCodeForm({
    id: code.id,
    code: code.code,
    points: code.points,
    claim_limit: code.claim_limit,
    expires_at: code.expires_at?.slice(0, 16) || "",
    is_active: code.is_active,
    event_id: code.event_id || "",
  });

  const claimAction = async (id, action) => {
    try {
      if (action === "Claimed") await markRewardClaimClaimed(id);
      else await reviewRewardClaim(id, action);
      await reload();
    } catch (err) {
      setMessage(err.message || "Unable to update claim.");
    }
  };

  return <div className="space-y-5">
    <div><h1 className="text-slate-900" style={{ fontSize: "22px", fontWeight: 700 }}>NELPAC One Card Admin</h1><p className="text-slate-500 text-sm">Points ledger, balances, reward claims, and reusable redeem codes</p></div>
    <ErrorState message={error || (message.includes("Unable") ? message : "")} />
    {message && !message.includes("Unable") && <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">{message}</p>}

    <form onSubmit={submit} className="bg-white rounded-2xl p-5 border border-slate-100 grid grid-cols-1 md:grid-cols-5 gap-3">
      <select required className="border rounded-xl px-3 py-2 text-sm" value={form.user_id} onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}><option value="">Select member</option>{balances.map((b) => <option key={b.user_id} value={b.user_id}>{b.full_name}</option>)}</select>
      <input required type="number" className="border rounded-xl px-3 py-2 text-sm" placeholder="Points" value={form.points} onChange={(e) => setForm((f) => ({ ...f, points: e.target.value }))} />
      <input required className="border rounded-xl px-3 py-2 text-sm" placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      <select className="border rounded-xl px-3 py-2 text-sm" value={form.event_id} onChange={(e) => setForm((f) => ({ ...f, event_id: e.target.value }))}><option value="">No event</option>{events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select>
      <button className="flex items-center justify-center gap-2 rounded-xl bg-blue-700 text-white text-sm"><Plus style={{ width: 14, height: 14 }} /> Add Points</button>
    </form>

    <section className="bg-white rounded-2xl p-5 border border-slate-100 space-y-4">
      <div className="flex items-center justify-between">
        <h2 style={{ fontWeight: 700 }}>Redeem Codes Management</h2>
        {codeForm.id && <button onClick={() => setCodeForm(emptyCode)} className="flex items-center gap-1 text-sm text-slate-500"><X style={{ width: 14, height: 14 }} /> Cancel edit</button>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); setConfirmCode(true); }} className="grid grid-cols-1 md:grid-cols-7 gap-3">
        <input required className="border rounded-xl px-3 py-2 text-sm uppercase" placeholder="Code" value={codeForm.code} onChange={(e) => setCodeForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
        <input required type="number" min="1" className="border rounded-xl px-3 py-2 text-sm" placeholder="Points" value={codeForm.points} onChange={(e) => setCodeForm((f) => ({ ...f, points: e.target.value }))} />
        <input required type="number" min="1" className="border rounded-xl px-3 py-2 text-sm" placeholder="Claim limit" value={codeForm.claim_limit} onChange={(e) => setCodeForm((f) => ({ ...f, claim_limit: e.target.value }))} />
        <input required type="datetime-local" className="border rounded-xl px-3 py-2 text-sm" value={codeForm.expires_at} onChange={(e) => setCodeForm((f) => ({ ...f, expires_at: e.target.value }))} />
        <select className="border rounded-xl px-3 py-2 text-sm" value={codeForm.event_id} onChange={(e) => setCodeForm((f) => ({ ...f, event_id: e.target.value }))}><option value="">No event</option>{events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={codeForm.is_active} onChange={(e) => setCodeForm((f) => ({ ...f, is_active: e.target.checked }))} /> Active</label>
        <button disabled={savingCode} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-60">{codeForm.id ? "Save Changes" : "Generate Code"}</button>
      </form>
      {codes.length === 0 ? <EmptyState label="No generated redeem codes yet." /> : <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-100 text-left text-slate-500"><th className="py-2">Code</th><th>Points</th><th>Used</th><th>Remaining</th><th>Expires</th><th>Status</th><th>Event</th><th>Action</th></tr></thead>
          <tbody>{codes.map((code) => <tr key={code.id} className="border-b border-slate-50">
            <td className="py-2 font-mono font-bold">{code.code}</td><td>{code.points}</td><td>{code.used_count}</td><td>{code.remaining_claims}</td><td>{new Date(code.expires_at).toLocaleString()}</td><td>{code.is_active ? "Active" : "Inactive"}</td><td>{code.event_title || "-"}</td><td><button onClick={() => editCode(code)} className="inline-flex items-center gap-1 text-blue-700"><Edit2 style={{ width: 13, height: 13 }} /> Edit</button></td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      <section className="bg-white rounded-2xl p-5 border border-slate-100"><h2 className="mb-3" style={{ fontWeight: 700 }}>Point Balances</h2>{balances.length === 0 ? <EmptyState /> : balances.map((b) => <div key={b.user_id} className="flex justify-between border-b border-slate-50 py-2 text-sm"><span>{b.full_name}</span><b>{b.points_balance} pts</b></div>)}</section>
      <section className="bg-white rounded-2xl p-5 border border-slate-100"><h2 className="mb-3" style={{ fontWeight: 700 }}>Reward Claims</h2>{claims.length === 0 ? <EmptyState /> : claims.map((c) => <div key={c.id} className="rounded-xl bg-slate-50 p-3 mb-2 text-sm"><div className="flex justify-between"><b>{c.reward_name}</b><span>{c.claim_status}</span></div>{c.claim_status === "Pending" && <div className="flex gap-2 mt-2"><button onClick={() => claimAction(c.id, "Approved")} className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700">Approve</button><button onClick={() => claimAction(c.id, "Rejected")} className="px-3 py-1 rounded-lg bg-red-50 text-red-700">Reject</button></div>}{c.claim_status === "Approved" && <button onClick={() => claimAction(c.id, "Claimed")} className="mt-2 px-3 py-1 rounded-lg bg-blue-50 text-blue-700"><Gift style={{ width: 13, height: 13, display: "inline" }} /> Mark claimed</button>}</div>)}</section>
    </div>
    <section className="bg-white rounded-2xl p-5 border border-slate-100"><h2 className="mb-3" style={{ fontWeight: 700 }}>Recent Ledger</h2>{ledger.slice(0, 20).map((entry) => <div key={entry.id} className="flex justify-between border-b border-slate-50 py-2 text-sm"><span>{entry.description}</span><span>{entry.points}</span></div>)}</section>
    {confirmCode && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6"><h3 style={{ fontWeight: 800 }}>Save redeem code?</h3><p className="mt-2 text-sm text-slate-600">This will save code {codeForm.code || "without a value"} with {codeForm.points || 0} points and a claim limit of {codeForm.claim_limit || 0}.</p><div className="mt-5 flex gap-2"><button onClick={() => setConfirmCode(false)} className="flex-1 rounded-xl border border-slate-200 py-2 text-sm">Cancel</button><button onClick={saveCode} disabled={savingCode} className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm text-white disabled:opacity-60">{savingCode ? "Saving..." : "Confirm"}</button></div></div></div>}
  </div>;
}

export { NelpacOneCardAdmin };
