import { useState } from "react";
import { Gift } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { ImageLightbox } from "../../components/ImageLightbox";
import { useAuth } from "../../lib/authContext";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { listPointBalances, listRewardClaims, listRewards, submitRewardClaim } from "../../lib/supabaseServices";

function getClaimMessage(error) {
  const message = error?.message || "";
  if (message.includes("Insufficient points")) return "You do not have enough points for this reward.";
  if (message.includes("out of stock")) return "This reward is out of stock.";
  if (message.includes("not available")) return "This reward is not available right now.";
  return "Unable to submit reward claim. Please try again.";
}

function RewardPlaceholder() {
  return <div className="mb-3 flex h-36 w-full items-center justify-center rounded-xl bg-slate-100 text-slate-400">
    <div className="text-center"><Gift className="mx-auto mb-2" style={{ width: 24, height: 24 }} /><p className="text-xs">No reward image</p></div>
  </div>;
}

function UserRewards() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useSupabaseData(async () => {
    const [rewards, balances, claims] = await Promise.all([listRewards({ activeOnly: true }), listPointBalances(), listRewardClaims()]);
    return [{ rewards, balances, claims }];
  }, [user?.id]);
  const [message, setMessage] = useState("");
  const [claiming, setClaiming] = useState("");
  const [viewer, setViewer] = useState(null);

  if (loading) return <LoadingState label="Loading rewards..." />;
  const { rewards = [], balances = [], claims = [] } = data[0] || {};
  const points = balances.find((balance) => balance.user_id === user.id)?.points_balance || 0;
  const myClaims = claims.filter((claim) => claim.user_id === user.id);

  const claim = async (rewardId) => {
    setMessage("");
    setClaiming(rewardId);
    try {
      await submitRewardClaim(rewardId);
      await reload();
      setMessage("Reward claim submitted.");
    } catch (err) {
      setMessage(getClaimMessage(err));
    } finally {
      setClaiming("");
    }
  };

  return <div className="space-y-5">
    <div><h1 className="text-slate-900" style={{ fontSize: "22px", fontWeight: 700 }}>Rewards / Merch</h1><p className="text-slate-500 text-sm">Current balance: {points.toLocaleString()} pts</p></div>
    <ErrorState message={error} />
    {message && <p className={`rounded-xl border p-3 text-sm ${message.includes("submitted") ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>{message}</p>}
    {rewards.length === 0 ? <EmptyState label="No active rewards." /> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {rewards.map((reward) => {
        const canClaim = points >= reward.required_points && reward.stock_quantity > 0;
        return <div key={reward.id} className="bg-white rounded-2xl p-5 border border-slate-100">
          {reward.image_url ? <button type="button" onClick={() => setViewer({ src: reward.image_url, alt: reward.name })} className="mb-3 block w-full rounded-xl bg-slate-100"><img src={reward.image_url} alt={reward.name} className="max-h-56 w-full rounded-xl object-contain" /></button> : <RewardPlaceholder />}
          <h2 style={{ fontWeight: 700 }}>{reward.name}</h2>
          <p className="text-slate-500 text-sm">{reward.description || "No description"}</p>
          <p className="mt-3 text-sm">{reward.required_points} pts - {reward.stock_quantity} stock</p>
          <button disabled={!canClaim || claiming === reward.id} onClick={() => claim(reward.id)} className="mt-4 w-full rounded-xl bg-blue-700 text-white py-2 text-sm disabled:bg-slate-200 disabled:text-slate-500">{claiming === reward.id ? "Submitting..." : canClaim ? "Claim Reward" : "Unavailable"}</button>
        </div>;
      })}
    </div>}
    <section className="bg-white rounded-2xl p-5 border border-slate-100"><h2 className="mb-3" style={{ fontWeight: 700 }}>Claim History</h2>{myClaims.length === 0 ? <EmptyState label="No claims yet." /> : myClaims.map((claim) => <div key={claim.id} className="flex justify-between border-b border-slate-50 py-2 text-sm"><span>{claim.reward_name}</span><span>{claim.claim_status}</span></div>)}</section>
    <ImageLightbox image={viewer} onClose={() => setViewer(null)} />
  </div>;
}

export { UserRewards };
