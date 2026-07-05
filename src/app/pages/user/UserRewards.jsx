import { useState } from "react";
import { Gift, MapPin, Shirt, X } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/DataState";
import { ImageLightbox } from "../../components/ImageLightbox";
import { useAuth } from "../../lib/authContext";
import { useSupabaseData } from "../../lib/useSupabaseData";
import {
  listPointBalances,
  listLocalChurches,
  listRewardClaims,
  listRewards,
  submitRewardClaim,
} from "../../lib/supabaseServices";

function getClaimMessage(error) {
  const message = error?.message || "";
  if (message.includes("Insufficient points"))
    return "You do not have enough points for this reward.";
  if (message.includes("out of stock")) return "This reward is out of stock.";
  if (message.includes("not available"))
    return "This reward is not available right now.";
  if (message.includes("shirt size")) return "Select an available shirt size.";
  return "Unable to submit reward claim. Please try again.";
}

function RewardPlaceholder() {
  return (
    <div className="mb-3 flex h-36 w-full items-center justify-center rounded-xl bg-slate-100 text-slate-400">
      <div className="text-center">
        <Gift className="mx-auto mb-2" style={{ width: 24, height: 24 }} />
        <p className="text-xs">No reward image</p>
      </div>
    </div>
  );
}

function UserRewards({ embedded = false }) {
  const { user, profile } = useAuth();
  const { data, loading, error, reload } = useSupabaseData(async () => {
    const [rewards, balances, claims, churches] = await Promise.all([
      listRewards({ activeOnly: true }),
      listPointBalances(),
      listRewardClaims(),
      listLocalChurches(),
    ]);
    return [{ rewards, balances, claims, churches }];
  }, [user?.id]);
  const [message, setMessage] = useState("");
  const [claiming, setClaiming] = useState("");
  const [viewer, setViewer] = useState(null);
  const [claimReward, setClaimReward] = useState(null);
  const [selectedSize, setSelectedSize] = useState("");

  if (loading) return <LoadingState label="Loading rewards..." />;
  const { rewards = [], balances = [], claims = [], churches = [] } = data[0] || {};
  const points =
    balances.find((balance) => balance.user_id === user.id)?.points_balance ||
    0;
  const myClaims = claims.filter((claim) => claim.user_id === user.id);

  const church = churches.find((item) => item.id === profile?.local_church_id);

  const claim = async () => {
    if (!claimReward) return;
    if (claimReward.reward_type === "Shirt" && !selectedSize) {
      setMessage("Select an available shirt size.");
      return;
    }
    setMessage("");
    setClaiming(claimReward.id);
    try {
      await submitRewardClaim(claimReward.id, selectedSize || null);
      await reload();
      setMessage("Reward claim submitted.");
      setClaimReward(null);
      setSelectedSize("");
    } catch (err) {
      setMessage(getClaimMessage(err));
    } finally {
      setClaiming("");
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
            Rewards
          </h1>
          <p className="text-slate-500 text-sm">
            Current balance: {points.toLocaleString()} pts
          </p>
        </div>
      )}
      {embedded && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-amber-700">
              Available balance
            </p>
            <p className="mt-1 text-2xl font-black text-slate-950">
              {points.toLocaleString()} points
            </p>
          </div>
          <Gift className="text-amber-700" size={28} />
        </div>
      )}
      <ErrorState message={error} />
      {message && (
        <p
          className={`rounded-xl border p-3 text-sm ${message.includes("submitted") ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}
        >
          {message}
        </p>
      )}
      {rewards.length === 0 ? (
        <EmptyState label="No active rewards." />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {rewards.map((reward) => {
            const canClaim =
              points >= reward.required_points && reward.stock_quantity > 0;
            return (
              <article
                key={reward.id}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                {reward.image_url ? (
                  <button
                    type="button"
                    onClick={() =>
                      setViewer({ src: reward.image_url, alt: reward.name })
                    }
                    className="mb-3 block w-full rounded-xl bg-slate-100"
                  >
                    <img
                      src={reward.image_url}
                      alt={reward.name}
                      className="max-h-56 w-full rounded-xl object-contain"
                    />
                  </button>
                ) : (
                  <RewardPlaceholder />
                )}
                <h2 className="text-lg font-black text-slate-950">
                  {reward.name}
                </h2>
                <p className="mt-1 min-h-10 text-sm leading-5 text-slate-500">
                  {reward.description || "A NELPAC One Card reward."}
                </p>
                <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                  <strong className="text-amber-800">
                    {reward.required_points.toLocaleString()} pts
                  </strong>
                  <span className="text-slate-500">
                    {reward.stock_quantity} available
                  </span>
                </div>
                <button
                  disabled={!canClaim || claiming === reward.id}
                  onClick={() => { setClaimReward(reward); setSelectedSize(""); setMessage(""); }}
                  className="mt-4 w-full rounded-xl bg-slate-950 py-3 text-sm font-extrabold text-white transition hover:bg-amber-800 disabled:bg-slate-200 disabled:text-slate-500"
                >
                  {claiming === reward.id
                    ? "Submitting..."
                    : canClaim
                      ? "Claim Reward"
                      : "Unavailable"}
                </button>
              </article>
            );
          })}
        </div>
      )}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-4 font-black text-slate-950">Claim History</h2>
        {myClaims.length === 0 ? (
          <EmptyState label="No claims yet." />
        ) : (
          <div className="divide-y divide-slate-100">
            {myClaims.map((claim) => (
              <div key={claim.id} className="py-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-bold text-slate-800">
                    {claim.reward_name}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                    {claim.claim_status}
                  </span>
                </div>
                <div className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-3">
                  <span>{claim.claimant_name || "Name not recorded"}</span>
                  <span>{claim.district || "No district"} · {claim.local_church_name || "No local church"}</span>
                  <span>{claim.selected_size ? `Size: ${claim.selected_size}` : `${claim.points_used} points`}</span>
                </div>
                {claim.voucher_code && (
                  <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                      {claim.voucher_type || "Voucher / reference code"}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                      <code className="text-lg font-black tracking-[0.18em] text-emerald-950">
                        {claim.voucher_code}
                      </code>
                      <span className="text-xs font-semibold text-emerald-800">
                        {claim.voucher_used
                          ? "Already claimed"
                          : claim.voucher_type === "Registration Discount"
                            ? `Valid until ${claim.voucher_expires_at?.slice(0, 10)}`
                            : "No expiration · valid until claimed"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-emerald-800">
                      {claim.voucher_type === "Registration Discount" ? "Use this one-time code in the event registration payment summary." : "Show this code to a NELPAC officer when receiving your reward."}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      {claimReward && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
        <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-amber-700">Review claim details</p><h2 className="mt-1 text-xl font-black text-slate-950">{claimReward.name}</h2></div><button onClick={() => setClaimReward(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-400">NAME</p><p className="mt-1 font-bold text-slate-900">{profile?.full_name || profile?.name || "Not provided"}</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-400">DISTRICT</p><p className="mt-1 font-bold text-slate-900">{church?.district || "Not assigned"}</p></div>
            <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2"><p className="text-xs font-bold text-slate-400">LOCAL CHURCH</p><p className="mt-1 flex items-center gap-2 font-bold text-slate-900"><MapPin size={15} /> {church?.name || "Not assigned"}</p></div>
          </div>
          {claimReward.reward_type === "Shirt" && <label className="mt-4 block text-sm font-bold text-slate-700"><span className="flex items-center gap-2"><Shirt size={16} /> Select shirt size</span><select required value={selectedSize} onChange={(event) => setSelectedSize(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3"><option value="">Choose an available size</option>{(claimReward.available_sizes || []).map((size) => <option key={size}>{size}</option>)}</select></label>}
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm"><div className="flex justify-between"><span>Points required</span><strong>{claimReward.required_points.toLocaleString()} pts</strong></div><div className="mt-2 flex justify-between"><span>Your balance after approval</span><strong>{(points - claimReward.required_points).toLocaleString()} pts</strong></div></div>
          <button onClick={claim} disabled={claiming === claimReward.id} className="mt-5 w-full rounded-xl bg-slate-950 py-3 text-sm font-black text-white disabled:opacity-50">{claiming ? "Submitting…" : "Submit Reward Claim"}</button>
        </div>
      </div>}
      <ImageLightbox image={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}

export { UserRewards };
