import { CreditCard, Gift, Sparkles } from "lucide-react";
import { useSearchParams } from "react-router";
import { UserOneCard } from "./UserOneCard";
import { UserRewards } from "./UserRewards";

function OneCardCenter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const section =
    searchParams.get("section") === "rewards" ? "rewards" : "card";

  const choose = (value) => {
    const next = new URLSearchParams(searchParams);
    next.set("section", value);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <header className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-amber-700">
              <Sparkles size={14} /> NELPAC One Card
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              Points, activity, and rewards
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage your One Card balance and redeem meaningful rewards from
              one place.
            </p>
          </div>
          <div className="inline-flex rounded-2xl bg-slate-100 p-1.5">
            <button
              type="button"
              onClick={() => choose("card")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold ${section === "card" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}
            >
              <CreditCard size={17} /> One Card
            </button>
            <button
              type="button"
              onClick={() => choose("rewards")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold ${section === "rewards" ? "bg-white text-amber-800 shadow-sm" : "text-slate-500"}`}
            >
              <Gift size={17} /> Rewards
            </button>
          </div>
        </div>
      </header>
      {section === "card" ? <UserOneCard /> : <UserRewards embedded />}
    </div>
  );
}

export { OneCardCenter };
