import { CheckCircle2, Clock3 } from "lucide-react";
import { Link, useSearchParams } from "react-router";

function PaymentConfirmation() {
  const [params] = useSearchParams();
  const module = params.get("module");
  const source = params.get("source");
  const status = params.get("status") || "Pending Verification";
  const label =
    module === "merch-preorder"
      ? "Merch pre-order payment"
      : module === "onsite-registration"
        ? "Onsite registration payment"
        : "Registration payment";

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
      <CheckCircle2 className="mx-auto text-emerald-500" size={52} />
      <h1 className="mt-4 text-2xl font-extrabold text-slate-900">
        Payment submitted
      </h1>
      <p className="mt-2 text-slate-500">
        Your {label.toLowerCase()} proof is safely recorded and queued for
        administrator review.
      </p>
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
        <div className="flex items-center gap-2 text-sm font-black text-amber-900">
          <Clock3 size={17} /> {status}
        </div>
        {source && (
          <p className="mt-2 break-all text-xs text-amber-800">
            Reference record: {source}
          </p>
        )}
      </div>
      <Link
        to="/user/forms"
        className="mt-6 inline-flex rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white"
      >
        Back to forms
      </Link>
    </div>
  );
}

export { PaymentConfirmation };
