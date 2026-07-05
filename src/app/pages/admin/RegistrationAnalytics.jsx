import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Building2,
  CheckCircle2,
  Download,
  ExternalLink,
  FileDown,
  Gift,
  Package,
  Shirt,
  Users,
  X,
} from "lucide-react";
import { ErrorState, LoadingState } from "../../components/DataState";
import {
  createPaymentProofSignedUrl,
  listEventRegistrationAnalytics,
  listEventRegistrations,
  listMerchPreorderAnalytics,
  listMerchPreorders,
  listRewardClaims,
  listRewardMerchAllocations,
  listShirtVariantAnalytics,
  updateEventRegistrationPayment,
  updateMerchPreorderPayment,
  updateSupplementPayment,
} from "../../lib/supabaseServices";
import { useSupabaseData } from "../../lib/useSupabaseData";

const money = (value) =>
  `₱${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const statusLabel = (status) =>
  ({ Partial: "Verified Partial", Verified: "Verified Paid", Paid: "Pending" })[
    status
  ] || status;

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

function RegistrationAnalytics({ initialTab = "events", registrationType = null }) {
  const [tab, setTab] = useState(initialTab);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedMerchId, setSelectedMerchId] = useState("");
  const [paymentDrafts, setPaymentDrafts] = useState({});
  const [actionError, setActionError] = useState("");
  const [exportingId, setExportingId] = useState("");
  const [overallOpen, setOverallOpen] = useState(false);
  const [overallExporting, setOverallExporting] = useState(false);

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
        listRewardMerchAllocations(),
        listRewardClaims(),
      ]),
    [],
  );
  const [eventAnalytics = [], registrations = []] = eventsData.data;
  const [merchAnalytics = [], preorders = [], variants = [], rewardAllocations = [], rewardClaims = []] = merchData.data;

  useEffect(() => {
    if (!selectedEventId && eventAnalytics[0]?.event_id)
      setSelectedEventId(eventAnalytics[0].event_id);
  }, [eventAnalytics, selectedEventId]);

  useEffect(() => {
    if (!selectedMerchId && merchAnalytics[0]?.form_id)
      setSelectedMerchId(merchAnalytics[0].form_id);
  }, [merchAnalytics, selectedMerchId]);

  const activeId = tab === "events" ? selectedEventId : selectedMerchId;
  const baseSelectedAnalytics =
    tab === "events"
      ? eventAnalytics.find((item) => item.event_id === selectedEventId)
      : merchAnalytics.find((item) => item.form_id === selectedMerchId);
  const visibleSubmissions = useMemo(
    () =>
      tab === "events"
        ? registrations.filter((item) => item.event_id === selectedEventId && (!registrationType || (item.registration_type || "Pre-Registration") === registrationType))
        : preorders.filter((item) => item.form_id === selectedMerchId).map((item) => ({
            ...item,
            reward_merch_allocations: rewardAllocations.filter((allocation) => allocation.merch_form_id === selectedMerchId && allocation.local_church_id === item.local_church_id),
          })),
    [preorders, registrationType, registrations, rewardAllocations, selectedEventId, selectedMerchId, tab],
  );
  const selectedAnalytics = useMemo(() => {
    if (tab !== "events") return baseSelectedAnalytics;
    const submitted = visibleSubmissions.filter((item) => item.submission_status === "Submitted");
    return {
      ...baseSelectedAnalytics,
      registered_churches: submitted.length,
      total_delegates: submitted.reduce((sum, item) => sum + Number(item.total_delegate_count || 0), 0),
      total_expected_payment: submitted.reduce((sum, item) => sum + Number(item.final_expected_total ?? item.expected_total ?? 0), 0),
      total_submitted_payment: submitted.filter((item) => item.payment_status === "Verified").reduce((sum, item) => sum + Number(item.final_expected_total ?? item.expected_total ?? 0), 0),
    };
  }, [baseSelectedAnalytics, tab, visibleSubmissions]);

  const getPaymentDraft = (record) =>
    paymentDrafts[record.id] || {
      status: record.payment_status === "Paid" ? "Pending" : record.payment_status,
      shortfall: record.payment_shortfall || "",
    };

  const changePaymentDraft = (record, updates) =>
    setPaymentDrafts((current) => ({
      ...current,
      [record.id]: { ...getPaymentDraft(record), ...updates },
    }));

  const savePayment = async (kind, record) => {
    setActionError("");
    const draft = getPaymentDraft(record);
    const shortfall = Number(draft.shortfall || 0);
    if (
      draft.status === "Partial" &&
      (shortfall <= 0 || shortfall >= Number(record.final_expected_total ?? record.expected_total))
    ) {
      setActionError(
        "Verified Partial requires an amount lacking greater than zero and below the expected total.",
      );
      return;
    }
    try {
      if (kind === "event") {
        await updateEventRegistrationPayment(record.id, draft.status, shortfall);
        await eventsData.reload({ silent: true });
      } else if (kind === "merch") {
        await updateMerchPreorderPayment(record.id, draft.status, shortfall);
        await merchData.reload({ silent: true });
      } else {
        const isEvent = kind === "event-supplement";
        await updateSupplementPayment(
          isEvent
            ? "event_registration_supplements"
            : "merch_preorder_supplements",
          record.id,
          draft.status,
          shortfall,
        );
        if (isEvent) await eventsData.reload({ silent: true });
        else await merchData.reload({ silent: true });
      }
      setPaymentDrafts((current) => {
        const next = { ...current };
        delete next[record.id];
        return next;
      });
    } catch (error) {
      setActionError(error.message || "Unable to update payment status.");
    }
  };

  const openProof = async (bucket, path) => {
    setActionError("");
    try {
      const url = await createPaymentProofSignedUrl(bucket, path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setActionError(error.message || "Unable to open payment proof.");
    }
  };

  const exportMergedPdf = async (kind, item) => {
    setExportingId(item.id);
    try {
      const { downloadMerchPreorderPdf, downloadPreRegistrationPdf } =
        await import("../../lib/pdfExports");
      if (kind === "event") await downloadPreRegistrationPdf(item);
      else await downloadMerchPreorderPdf(item);
    } catch (error) {
      setActionError(error.message || "Unable to create PDF.");
    } finally {
      setExportingId("");
    }
  };

  const exportOverallPdf = async () => {
    if (!visibleSubmissions.length) return;
    setOverallExporting(true);
    try {
      const { downloadAllMerchPreordersPdf, downloadAllPreRegistrationsPdf } =
        await import("../../lib/pdfExports");
      if (tab === "events")
        await downloadAllPreRegistrationsPdf(
          visibleSubmissions,
          selectedAnalytics?.event_title,
        );
      else
        await downloadAllMerchPreordersPdf(
          visibleSubmissions,
          selectedAnalytics?.title,
        );
      setOverallOpen(false);
    } catch (error) {
      setActionError(error.message || "Unable to create overall PDF.");
    } finally {
      setOverallExporting(false);
    }
  };

  const renderPaymentEditor = (record, kind, accent) => {
    const draft = getPaymentDraft(record);
    return (
      <div className="space-y-2">
        <select
          value={draft.status}
          onChange={(event) =>
            changePaymentDraft(record, {
              status: event.target.value,
              shortfall:
                event.target.value === "Partial" ? draft.shortfall : "",
            })
          }
          className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs"
        >
          <option value="Pending">Pending</option>
          <option value="Partial">Verified Partial</option>
          <option value="Verified">Verified Paid</option>
          <option value="Rejected">Rejected</option>
        </select>
        {draft.status === "Partial" && (
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Amount lacking"
            value={draft.shortfall}
            onChange={(event) =>
              changePaymentDraft(record, { shortfall: event.target.value })
            }
            className="w-full rounded-lg border border-amber-300 px-2 py-2 text-xs"
          />
        )}
        <button
          type="button"
          onClick={() => savePayment(kind, record)}
          className={`w-full rounded-lg px-3 py-2 text-xs font-bold text-white ${accent === "violet" ? "bg-violet-700" : "bg-blue-700"}`}
        >
          Save Status
        </button>
      </div>
    );
  };

  const renderSubmission = ({ record, index, kind, parent, isOriginal }) => {
    const eventMode = kind.startsWith("event");
    const bucket = eventMode
      ? "registration-payment-proofs"
      : "merch-payment-proofs";
    const quantity = eventMode
      ? `${record.total_delegate_count} delegates`
      : `${record.total_quantity} items`;
    return (
      <div
        key={record.id}
        className={`rounded-2xl border p-4 ${isOriginal ? "border-slate-200 bg-white" : eventMode ? "border-blue-100 bg-blue-50/40" : "border-violet-100 bg-violet-50/40"}`}
      >
        <div className="grid gap-4 lg:grid-cols-[1.25fr_.7fr_1fr_.8fr_auto] lg:items-start">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
              {isOriginal ? "Original Submission" : `Additional Submission ${index + 1}`}
            </p>
            <strong className="mt-1 block text-slate-900">
              {parent.local_churches?.name}
            </strong>
            <span className="text-xs text-slate-500">
              {eventMode
                ? parent.events?.title
                : parent.merch_preorder_forms?.title}
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-400">
              {eventMode ? "Delegates" : "Quantity"}
            </span>
            <strong className="block text-slate-900">{quantity}</strong>
          </div>
          <div>
            <span className="text-xs text-slate-400">Payment</span>
            <strong className="block text-slate-900">
              {money(record.final_expected_total ?? record.expected_total)}
            </strong>
            <span className="block text-xs text-slate-500">
              {parent.registration_type === "Onsite" ? "Payor" : "Sender"}: {record.payment_sender_name || "—"}
            </span>
            <span className="block text-xs text-slate-500">
              {parent.registration_type === "Onsite" ? "Officer" : "Ref"}: {record.reference_number || "—"}
            </span>
          </div>
          <div>
            <span className="mb-1 block text-xs text-slate-400">Status</span>
            {renderPaymentEditor(
              record,
              kind,
              eventMode ? "blue" : "violet",
            )}
          </div>
          <div>
            <span className="mb-1 block text-xs text-slate-400">Actions</span>
            {record.proof_of_payment_url && <button
              type="button"
              onClick={() => openProof(bucket, record.proof_of_payment_url)}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-700"
            >
              <ExternalLink size={14} /> Proof
            </button>}
          </div>
        </div>
      </div>
    );
  };

  if (eventsData.loading || merchData.loading)
    return <LoadingState label="Loading submissions and analytics..." />;

  const options = tab === "events" ? eventAnalytics : merchAnalytics;
  const selectedVariants = variants.filter((item) => item.form_id === activeId);
  const selectedDiscountClaims = rewardClaims.filter((item) => item.reward_type === "Discount" && item.discount_event_id === activeId);

  return (
    <div className="space-y-5 pb-24">
      <header>
        <h1 className="text-2xl font-extrabold text-slate-900">
          Submissions & Analytics
        </h1>
        <p className="text-sm text-slate-500">
          Review grouped church submissions, payments, proofs, and reports.
        </p>
      </header>
      <ErrorState
        message={eventsData.error || merchData.error || actionError}
      />

      {!registrationType && <div className="inline-flex rounded-xl bg-slate-200 p-1">
        <button type="button" onClick={() => setTab("events")} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "events" ? "bg-white text-blue-700 shadow" : "text-slate-500"}`}>Event Registrations</button>
        <button type="button" onClick={() => setTab("merch")} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "merch" ? "bg-white text-violet-700 shadow" : "text-slate-500"}`}>Merch Pre-Orders</button>
      </div>}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">
              {tab === "events" ? "Select Event" : "Select Merch Form"}
            </p>
            <select
              value={activeId}
              onChange={(event) =>
                tab === "events"
                  ? setSelectedEventId(event.target.value)
                  : setSelectedMerchId(event.target.value)
              }
              className="mt-2 w-full max-w-xl rounded-xl border border-slate-200 px-4 py-3 font-bold text-slate-800"
            >
              {options.map((item) => (
                <option key={item.event_id || item.form_id} value={item.event_id || item.form_id}>
                  {item.event_title || item.title}
                </option>
              ))}
            </select>
          </div>
          <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600">
            {visibleSubmissions.length} church submission{visibleSubmissions.length === 1 ? "" : "s"}
          </span>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Building2} label="Church Submissions" value={tab === "events" ? selectedAnalytics?.registered_churches || 0 : selectedAnalytics?.churches_with_orders || 0} color={tab === "events" ? "blue" : "violet"} />
        <StatCard icon={tab === "events" ? Users : Package} label={tab === "events" ? "Total Delegates" : "Items Ordered"} value={tab === "events" ? selectedAnalytics?.total_delegates || 0 : selectedAnalytics?.total_items_ordered || 0} />
        <StatCard icon={Banknote} label="Expected Payment" value={money(selectedAnalytics?.total_expected_payment)} color="amber" />
        <StatCard icon={CheckCircle2} label="Verified Paid Total" value={money(selectedAnalytics?.total_submitted_payment)} color="emerald" />
      </div>

      {tab === "merch" && selectedVariants.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2"><Shirt className="text-violet-700" size={19} /><h2 className="font-extrabold">Shirt totals</h2></div>
          <div className="mt-3 flex flex-wrap gap-2">{selectedVariants.map((item, index) => <span key={`${item.color}-${item.size}-${index}`} className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-800">{item.color} · {item.size}: {item.total_quantity}</span>)}</div>
        </section>
      )}
      {tab === "events" && selectedDiscountClaims.length > 0 && <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><h2 className="font-extrabold text-emerald-950">Registration discount reward claims</h2><div className="mt-3 flex flex-wrap gap-2">{selectedDiscountClaims.map((claim) => <span key={claim.id} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-emerald-800">{claim.claimant_name || "Member"} · {claim.discount_percentage}% · {claim.claim_status}</span>)}</div></section>}

      <div className="space-y-4">
        {visibleSubmissions.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-500">No submitted forms for this selection.</div>
        ) : (
          visibleSubmissions.map((parent) => {
            const supplements = tab === "events" ? parent.event_registration_supplements || [] : parent.merch_preorder_supplements || [];
            const claimRewards = tab === "merch" ? parent.reward_merch_allocations || [] : [];
            return (
              <article key={parent.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div><p className="text-xs font-black uppercase tracking-wide text-slate-400">Combined Church Record</p><h2 className="text-lg font-extrabold text-slate-900">{parent.local_churches?.name}</h2><p className="text-xs text-slate-500">1 original + {supplements.length} additional submission{supplements.length === 1 ? "" : "s"}{claimRewards.length ? ` + ${claimRewards.length} claim reward${claimRewards.length === 1 ? "" : "s"}` : ""}</p></div>
                  <button type="button" disabled={exportingId === parent.id} onClick={() => exportMergedPdf(tab === "events" ? "event" : "merch", parent)} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Download size={15} /> {exportingId === parent.id ? "Creating..." : "Merged PDF"}</button>
                </header>
                <div className="space-y-3">
                  {renderSubmission({ record: parent, index: 0, kind: tab === "events" ? "event" : "merch", parent, isOriginal: true })}
                  {supplements.map((record, index) => renderSubmission({ record, index: index + 1, kind: tab === "events" ? "event-supplement" : "merch-supplement", parent, isOriginal: false }))}
                  {claimRewards.length > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2"><Gift className="text-amber-700" size={17}/><h3 className="text-sm font-black text-amber-950">Claim Reward additions</h3></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{claimRewards.map((item) => <div key={item.id} className="rounded-xl border border-amber-200 bg-white p-3 text-sm"><div className="flex items-start justify-between gap-2"><strong className="text-slate-900">{item.reward_name}</strong><span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">Claim Reward</span></div><p className="mt-1 text-xs text-slate-500">{item.reward_type}{item.selected_size ? ` · Size ${item.selected_size}` : ""} · Qty {item.quantity || 1}</p></div>)}</div></section>}
                </div>
              </article>
            );
          })
        )}
      </div>

      <button type="button" disabled={!visibleSubmissions.length} onClick={() => setOverallOpen(true)} className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-2xl bg-blue-800 px-5 py-3.5 text-sm font-extrabold text-white shadow-2xl disabled:opacity-40"><FileDown size={19} /> Overall PDF</button>

      {overallOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-black text-slate-950">Download Overall PDF</h2><p className="mt-2 text-sm leading-6 text-slate-500">Creates one PDF containing all {visibleSubmissions.length} church submissions and their additional forms for <strong>{selectedAnalytics?.event_title || selectedAnalytics?.title}</strong>.</p></div><button type="button" onClick={() => setOverallOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div>
            <button type="button" disabled={overallExporting} onClick={exportOverallPdf} className="mt-6 w-full rounded-xl bg-blue-800 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{overallExporting ? "Creating overall PDF..." : "Download One Overall PDF"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export { RegistrationAnalytics };
