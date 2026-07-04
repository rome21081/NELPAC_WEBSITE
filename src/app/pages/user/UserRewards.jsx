import { useState } from "react";
import { Gift } from "lucide-react";
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
  const { user } = useAuth();
  const { data, loading, error, reload } = useSupabaseData(async () => {
    const [rewards, balances, claims] = await Promise.all([
      listRewards({ activeOnly: true }),
      listPointBalances(),
      listRewardClaims(),
    ]);
    return [{ rewards, balances, claims }];
  }, [user?.id]);
  const [message, setMessage] = useState("");
  const [claiming, setClaiming] = useState("");
  const [viewer, setViewer] = useState(null);

  if (loading) return <LoadingState label="Loading rewards..." />;
  const { rewards = [], balances = [], claims = [] } = data[0] || {};
  const points =
    balances.find((balance) => balance.user_id === user.id)?.points_balance ||
    0;
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
                  onClick={() => claim(reward.id)}
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
                {claim.voucher_code && (
                  <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                      Officer verification voucher
                    </p>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                      <code className="text-lg font-black tracking-[0.18em] text-emerald-950">
                        {claim.voucher_code}
                      </code>
                      <span className="text-xs font-semibold text-emerald-800">
                        {claim.voucher_used
                          ? "Already claimed"
                          : `Valid until ${claim.voucher_expires_at?.slice(0, 10)}`}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-emerald-800">
                      Show this code to a NELPAC officer when receiving your reward.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      <ImageLightbox image={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}

export { UserRewards };
