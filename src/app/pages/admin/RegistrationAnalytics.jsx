import { useState } from "react";
import {
  Banknote,
  Building2,
  CheckCircle2,
  Download,
  ExternalLink,
  Package,
  Shirt,
  Users,
} from "lucide-react";
import { ErrorState, LoadingState } from "../../components/DataState";
import {
  createPaymentProofSignedUrl,
  listEventRegistrationAnalytics,
  listEventRegistrations,
  listMerchPreorderAnalytics,
  listMerchPreorders,
  listShirtVariantAnalytics,
  updateEventRegistrationPayment,
  updateMerchPreorderPayment,
} from "../../lib/supabaseServices";
import { useSupabaseData } from "../../lib/useSupabaseData";

const money = (value) =>
  `\u20B1${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function StatCard({ icon: Icon, label, value, color = "blue" }) {
  const colors = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    violet: "bg-violet-50 text-violet-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className={`inline-flex rounded-xl p-2 ${colors[color]}`}>
        <Icon size={18} />
      </div>
      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-slate-900">{value}</p>
    </div>
  );
}

function PdfButton({ busy, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={busy || disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      title={disabled ? "PDF is available after submission" : "Download PDF"}
    >
      <Download size={15} />
      {busy ? "Creating..." : "Download PDF"}
    </button>
  );
}

function RegistrationAnalytics({ initialTab = "events" }) {
  const [tab, setTab] = useState(initialTab);
  const [actionError, setActionError] = useState("");
  const [exportingId, setExportingId] = useState("");
  const eventsData = useSupabaseData(
    () =>
      Promise.all([listEventRegistrationAnalytics(), listEventRegistrations()]),
    [],
  );
  const merchData = useSupabaseData(
    () =>
      Promise.all([
        listMerchPreorderAnalytics(),
        listMerchPreorders(),
        listShirtVariantAnalytics(),
      ]),
    [],
  );
  const [eventAnalytics = [], registrations = []] = eventsData.data;
  const [merchAnalytics = [], preorders = [], variants = []] = merchData.data;

  const openProof = async (bucket, path) => {
    setActionError("");
    try {
      const url = await createPaymentProofSignedUrl(bucket, path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setActionError(error.message || "Unable to open the payment proof.");
    }
  };

  const exportPdf = async (kind, item) => {
    const key = `${kind}-${item.id}`;
    setExportingId(key);
    setActionError("");
    try {
      const { downloadMerchPreorderPdf, downloadPreRegistrationPdf } =
        await import("../../lib/pdfExports");
      if (kind === "event") await downloadPreRegistrationPdf(item);
      else await downloadMerchPreorderPdf(item);
    } catch (error) {
      setActionError(error.message || "Unable to create the PDF.");
    } finally {
      setExportingId("");
    }
  };

  const updatePayment = async (kind, id, status) => {
    setActionError("");
    try {
      if (kind === "event") {
        await updateEventRegistrationPayment(id, status);
        await eventsData.reload();
      } else {
        await updateMerchPreorderPayment(id, status);
        await merchData.reload();
      }
    } catch (error) {
      setActionError(error.message || "Unable to update the payment status.");
    }
  };

  if (eventsData.loading || merchData.loading)
    return <LoadingState label="Loading registration analytics..." />;

  const activeEvent = eventAnalytics.reduce(
    (best, item) =>
      Number(item.total_delegates) > Number(best?.total_delegates || -1)
        ? item
        : best,
    null,
  );
  const eventTotals = eventAnalytics.reduce(
    (sum, item) => ({
      churches: sum.churches + Number(item.registered_churches),
      delegates: sum.delegates + Number(item.total_delegates),
      expected: sum.expected + Number(item.total_expected_payment),
      paid: sum.paid + Number(item.total_submitted_payment),
    }),
    { churches: 0, delegates: 0, expected: 0, paid: 0 },
  );
  const merchTotals = merchAnalytics.reduce(
    (sum, item) => ({
      churches: sum.churches + Number(item.churches_with_orders),
      items: sum.items + Number(item.total_items_ordered),
      expected: sum.expected + Number(item.total_expected_payment),
      paid: sum.paid + Number(item.total_submitted_payment),
    }),
    { churches: 0, items: 0, expected: 0, paid: 0 },
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">
          Registration & Pre-Order Analytics
        </h1>
        <p className="text-sm text-slate-500">
          Monitor churches, delegates, orders, payments, and download official
          submission PDFs.
        </p>
      </div>
      <ErrorState
        message={eventsData.error || merchData.error || actionError}
      />
      <div className="inline-flex rounded-xl bg-slate-200 p-1">
        <button
          onClick={() => setTab("events")}
          className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "events" ? "bg-white text-blue-700 shadow" : "text-slate-500"}`}
        >
          Event Registrations
        </button>
        <button
          onClick={() => setTab("merch")}
          className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "merch" ? "bg-white text-violet-700 shadow" : "text-slate-500"}`}
        >
          Merch Pre-Orders
        </button>
      </div>

      {tab === "events" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Building2}
              label="Registered Churches"
              value={eventTotals.churches}
            />
            <StatCard
              icon={Users}
              label="Total Delegates"
              value={eventTotals.delegates}
              color="violet"
            />
            <StatCard
              icon={Banknote}
              label="Expected Payment"
              value={money(eventTotals.expected)}
              color="amber"
            />
            <StatCard
              icon={CheckCircle2}
              label="Submitted Payment"
              value={money(eventTotals.paid)}
              color="emerald"
            />
          </div>
          {activeEvent && (
            <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              Highest attendance: <strong>{activeEvent.event_title}</strong>{" "}
              with {activeEvent.total_delegates} delegates.
            </p>
          )}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-4">Church / Event</th>
                    <th className="p-4">Delegates</th>
                    <th className="p-4">Payment</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="p-4">
                        <strong className="block text-slate-900">
                          {item.local_churches?.name}
                        </strong>
                        <span className="text-xs text-slate-500">
                          {item.events?.title} · {item.local_churches?.district}
                        </span>
                        <span className="mt-1 block text-[11px] font-bold uppercase text-slate-400">
                          {item.submission_status}
                        </span>
                      </td>
                      <td className="p-4">
                        <strong>{item.total_delegate_count}</strong>
                        <span className="block text-xs text-slate-500">
                          {item.male_delegate_count} M ·{" "}
                          {item.female_delegate_count} F
                        </span>
                      </td>
                      <td className="p-4">
                        {money(item.expected_total)}
                        <span className="block text-xs text-slate-500">
                          Ref: {item.reference_number || "—"}
                        </span>
                      </td>
                      <td className="p-4">
                        <select
                          value={item.payment_status}
                          onChange={(event) =>
                            updatePayment("event", item.id, event.target.value)
                          }
                          className="rounded-lg border px-2 py-1.5 text-xs"
                        >
                          <option>Pending</option>
                          <option>Partial</option>
                          <option>Paid</option>
                          <option>Verified</option>
                          <option>Rejected</option>
                        </select>
                      </td>
                      <td className="p-4">
                        <div className="flex min-w-max gap-2">
                          <PdfButton
                            disabled={item.submission_status !== "Submitted"}
                            busy={exportingId === `event-${item.id}`}
                            onClick={() => exportPdf("event", item)}
                          />
                          {item.proof_of_payment_url && (
                            <button
                              type="button"
                              onClick={() =>
                                openProof(
                                  "registration-payment-proofs",
                                  item.proof_of_payment_url,
                                )
                              }
                              className="rounded-lg border p-2 text-emerald-700"
                              title="Open payment proof"
                            >
                              <ExternalLink size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Building2}
              label="Church Orders"
              value={merchTotals.churches}
              color="violet"
            />
            <StatCard
              icon={Package}
              label="Items Ordered"
              value={merchTotals.items}
            />
            <StatCard
              icon={Banknote}
              label="Expected Payment"
              value={money(merchTotals.expected)}
              color="amber"
            />
            <StatCard
              icon={CheckCircle2}
              label="Submitted Payment"
              value={money(merchTotals.paid)}
              color="emerald"
            />
          </div>
          {variants.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Shirt className="text-violet-700" size={19} />
                <h2 className="font-extrabold">
                  Shirt totals by color and size
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {variants.map((item, index) => (
                  <span
                    key={`${item.form_id}-${item.color}-${item.size}-${index}`}
                    className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-800"
                  >
                    {item.color} · {item.size}: {item.total_quantity}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-4">Church / Merch</th>
                    <th className="p-4">Quantity</th>
                    <th className="p-4">Payment</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {preorders.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-4">
                        <strong className="block">
                          {item.local_churches?.name}
                        </strong>
                        <span className="text-xs text-slate-500">
                          {item.merch_preorder_forms?.title} ·{" "}
                          {item.merch_preorder_forms?.merch_type}
                        </span>
                        <span className="mt-1 block text-[11px] font-bold uppercase text-slate-400">
                          {item.submission_status}
                        </span>
                      </td>
                      <td className="p-4 font-bold">{item.total_quantity}</td>
                      <td className="p-4">
                        {money(item.expected_total)}
                        <span className="block text-xs text-slate-500">
                          Ref: {item.reference_number || "—"}
                        </span>
                      </td>
                      <td className="p-4">
                        <select
                          value={item.payment_status}
                          onChange={(event) =>
                            updatePayment("merch", item.id, event.target.value)
                          }
                          className="rounded-lg border px-2 py-1.5 text-xs"
                        >
                          <option>Pending</option>
                          <option>Partial</option>
                          <option>Paid</option>
                          <option>Verified</option>
                          <option>Rejected</option>
                        </select>
                      </td>
                      <td className="p-4">
                        <div className="flex min-w-max gap-2">
                          <PdfButton
                            disabled={item.submission_status !== "Submitted"}
                            busy={exportingId === `merch-${item.id}`}
                            onClick={() => exportPdf("merch", item)}
                          />
                          {item.proof_of_payment_url && (
                            <button
                              type="button"
                              onClick={() =>
                                openProof(
                                  "merch-payment-proofs",
                                  item.proof_of_payment_url,
                                )
                              }
                              className="rounded-lg border p-2 text-emerald-700"
                              title="Open payment proof"
                            >
                              <ExternalLink size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export { RegistrationAnalytics };
