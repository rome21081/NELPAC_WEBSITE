import { useState } from "react";
import { QrCode } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { useAuth } from "../../lib/authContext";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { getMyMembers, listOneCardRedeemCodes, listPointBalances, listPointLedger, listRedeemCodes, redeemOneCardCode } from "../../lib/supabaseServices";
import nelpacLogo from "../../../../NELPAC-LOGO.jpg";

function getRedeemCodeMessage(error) {
  const message = error?.message || "";
  if (message.includes("Redeem code not found")) return "Redeem code not found.";
  if (message.includes("inactive")) return "This redeem code is inactive.";
  if (message.includes("expired")) return "This redeem code has expired.";
  if (message.includes("already claimed")) return "You already claimed this redeem code.";
  if (message.includes("claim limit")) return "This redeem code has reached its claim limit.";
  return "Unable to redeem this code. Please check the code and try again.";
}

function UserOneCard() {
  const { user, profile } = useAuth();
  const { data, loading, error, reload } = useSupabaseData(async () => {
    const [members, balances, ledger, rewardCodes, availableCodes] = await Promise.all([
      getMyMembers(user.id),
      listPointBalances(),
      listPointLedger(user.id),
      listRedeemCodes(user.id),
      listOneCardRedeemCodes(),
    ]);
    return [{ members, balances, ledger, rewardCodes, availableCodes }];
  }, [user?.id]);
  const [codeInput, setCodeInput] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMessage, setRedeemMessage] = useState("");
  const [redeemError, setRedeemError] = useState("");

  const submitRedeemCode = async (event) => {
    event.preventDefault();
    setRedeemMessage("");
    setRedeemError("");
    const code = codeInput.trim();
    if (!code) {
      setRedeemError("Enter a redeem code first.");
      return;
    }
    setRedeeming(true);
    try {
      await redeemOneCardCode(code);
      setCodeInput("");
      await reload();
      setRedeemMessage("Redeem code claimed. Points have been added to your One Card.");
    } catch (err) {
      setRedeemError(getRedeemCodeMessage(err));
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) return <LoadingState label="Loading One Card..." />;
  const { members = [], balances = [], ledger = [], rewardCodes = [], availableCodes = [] } = data[0] || {};
  const member = members[0];
  const points = balances.find((balance) => balance.user_id === user.id)?.points_balance || 0;
  return <div className="space-y-5">
    <ErrorState message={error} />
    <section className="relative overflow-hidden rounded-2xl p-6 text-white shadow-xl" style={{ background: "linear-gradient(135deg, #07142f 0%, #1d4ed8 58%, #0f766e 100%)" }}>
      <img src={nelpacLogo} alt="" aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-56 w-56 object-contain opacity-10 mix-blend-screen" />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-blue-100 text-sm tracking-wide">NELPAC One Card</p>
          <h1 className="mt-2" style={{ fontSize: "40px", fontWeight: 900 }}>{points.toLocaleString()} pts</h1>
          <p className="mt-4 text-lg" style={{ fontWeight: 800 }}>{profile.full_name || profile.email}</p>
          <p className="text-blue-100 text-sm">{member?.local_church_name || "No member record"}</p>
        </div>
        <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl bg-white/95 text-slate-900 shadow-lg">
          <QrCode style={{ width: 44, height: 44 }} />
          <p className="mt-1 text-[10px] font-bold tracking-widest">ONE CARD</p>
        </div>
      </div>
    </section>
    <section className="bg-white rounded-2xl p-5 border border-slate-100">
      <h2 className="mb-3" style={{ fontWeight: 700 }}>Redeem One Card Code</h2>
      <form onSubmit={submitRedeemCode} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
        <input className="border rounded-xl px-3 py-2 text-sm uppercase" placeholder="Enter code" value={codeInput} onChange={(event) => setCodeInput(event.target.value.toUpperCase())} />
        <button disabled={redeeming} className="rounded-xl bg-blue-700 px-5 py-2 text-sm text-white disabled:opacity-60">{redeeming ? "Redeeming..." : "Redeem Code"}</button>
      </form>
      {redeemMessage && <p className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">{redeemMessage}</p>}
      {redeemError && <p className="mt-3 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{redeemError}</p>}
    </section>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <section className="bg-white rounded-2xl p-5 border border-slate-100"><h2 className="mb-3" style={{ fontWeight: 700 }}>Points Ledger</h2>{ledger.length === 0 ? <EmptyState label="No points yet." /> : ledger.map((entry) => <div key={entry.id} className="flex justify-between border-b border-slate-50 py-2 text-sm"><span>{entry.description}</span><span className={entry.points > 0 ? "text-emerald-700" : "text-red-700"}>{entry.points}</span></div>)}</section>
      <section className="bg-white rounded-2xl p-5 border border-slate-100"><h2 className="mb-3" style={{ fontWeight: 700 }}>Available One Card Codes</h2>{availableCodes.length === 0 ? <EmptyState label="No active codes available." /> : availableCodes.map((code) => <div key={code.id} className="flex justify-between gap-3 border-b border-slate-50 py-2 text-sm"><div><b>{code.code}</b><p className="text-xs text-slate-500">{code.points} pts</p></div><span>Expires {code.expires_at?.slice(0, 10)}</span></div>)}</section>
      <section className="bg-white rounded-2xl p-5 border border-slate-100 lg:col-span-2"><h2 className="mb-3" style={{ fontWeight: 700 }}>Reward Claim Codes</h2>{rewardCodes.length === 0 ? <EmptyState label="No reward claim codes yet." /> : rewardCodes.map((code) => <div key={code.id} className="flex justify-between border-b border-slate-50 py-2 text-sm"><b>{code.code}</b><span>{code.is_used ? "Used" : `Expires ${code.expires_at?.slice(0, 10)}`}</span></div>)}</section>
    </div>
  </div>;
}

export { UserOneCard };
