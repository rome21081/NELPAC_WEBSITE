import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Maximize2,
  Plus,
  Shirt,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { ErrorState, LoadingState } from "../../components/DataState";
import { ImageLightbox } from "../../components/ImageLightbox";
import { useAuth } from "../../lib/authContext";
import { hasCompleteProfileName } from "../../lib/profileNames";
import {
  getMerchForm,
  getMyMembers,
  getMyMerchPreorder,
  listLocalChurches,
  submitMerchPreorder,
  uploadPrivatePaymentProof,
} from "../../lib/supabaseServices";
import nelpacLogo from "../../../../NELPAC-LOGO.jpg";

const sizes = ["XS", "S", "M", "L", "XL", "XXL"];
const dimensions = {
  XS: "18×25",
  S: "19×26",
  M: "20×27",
  L: "21×28",
  XL: "22×29",
  XXL: "23×30",
};
const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100";
const newColor = () => ({
  color: "",
  quantities: Object.fromEntries(sizes.map((size) => [size, 0])),
});

function MerchPreorderForm({ selectedFormId = null, onBack = null }) {
  const { formId: routeFormId } = useParams();
  const formId = selectedFormId || routeFormId;
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [merch, setMerch] = useState(null);
  const [churches, setChurches] = useState([]);
  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const proofInputRef = useRef(null);
  const [proofSelection, setProofSelection] = useState(null);
  const [imageViewer, setImageViewer] = useState(null);
  const [district, setDistrict] = useState("");
  const [colors, setColors] = useState([newColor()]);
  const [form, setForm] = useState({
    local_church_id: "",
    local_church_president: "",
    president_contact_number: "",
    total_quantity: 0,
    gcash_mode_of_payment: "GCash",
    payment_date: "",
    reference_number: "",
  });

  useEffect(() => {
    Promise.all([
      getMerchForm(formId),
      listLocalChurches({ activeOnly: true }),
      getMyMerchPreorder(formId),
      getMyMembers(user.id),
    ])
      .then(([merchData, churchData, order, ownMembers]) => {
        setMerch(merchData);
        setChurches(churchData);
        setExisting(order);
        const registeredMember =
          ownMembers.find((member) => member.review_status === "Approved") ||
          ownMembers[0];
        const registeredChurchId =
          order?.local_church_id || registeredMember?.local_church_id || "";
        const registeredChurch = churchData.find(
          (item) => item.id === registeredChurchId,
        );
        setDistrict(
          registeredChurch?.district || registeredMember?.district || "",
        );
        if (order) {
          setForm({
            local_church_id: order.local_church_id,
            local_church_president: order.local_church_president,
            president_contact_number: order.president_contact_number,
            total_quantity: order.total_quantity,
            gcash_mode_of_payment: order.gcash_mode_of_payment || "GCash",
            payment_date: order.payment_date || "",
            reference_number: order.reference_number || "",
          });
          if (
            merchData.merch_type === "Shirt" &&
            order.merch_shirt_order_items?.length
          ) {
            const grouped = {};
            order.merch_shirt_order_items.forEach((item) => {
              grouped[item.color] ||= newColor();
              grouped[item.color].color = item.color;
              grouped[item.color].quantities[item.size] = item.quantity;
            });
            setColors(Object.values(grouped));
          }
        } else if (registeredChurchId) {
          setForm((current) => ({
            ...current,
            local_church_id: registeredChurchId,
          }));
        }
      })
      .catch((err) => setError(err.message || "Unable to load pre-order form."))
      .finally(() => setLoading(false));
  }, [formId, user.id]);

  const selectedChurch = churches.find(
    (item) => item.id === form.local_church_id,
  );
  const shirtTotal = useMemo(
    () =>
      colors.reduce(
        (sum, color) =>
          sum +
          sizes.reduce(
            (subtotal, size) => subtotal + Number(color.quantities[size] || 0),
            0,
          ),
        0,
      ),
    [colors],
  );
  const totalQuantity =
    merch?.merch_type === "Shirt"
      ? shirtTotal
      : Number(form.total_quantity || 0);
  const totalPayment = totalQuantity * Number(merch?.item_fee || 0);
  const merchName =
    merch?.merch_type === "Others"
      ? merch.custom_merch_name
      : merch?.merch_type;
  const availableShirtColors = useMemo(
    () => [
      ...new Set(
        (merch?.form_config?.shirt_colors || [])
          .map((color) => color.trim())
          .filter(Boolean),
      ),
    ],
    [merch?.form_config?.shirt_colors],
  );

  const updateColor = (index, updater) =>
    setColors((current) =>
      current.map((color, row) => (row === index ? updater(color) : color)),
    );
  const chooseProof = (file) => {
    setError("");
    if (!file) {
      if (proofInputRef.current) proofInputRef.current.value = "";
      setProofSelection(null);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      if (proofInputRef.current) proofInputRef.current.value = "";
      setProofSelection(null);
      setError("Proof of payment must be a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      if (proofInputRef.current) proofInputRef.current.value = "";
      setProofSelection(null);
      setError("Proof of payment must be 10 MB or smaller.");
      return;
    }
    setProofSelection({ name: file.name, size: file.size });
  };
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!hasCompleteProfileName(profile)) {
      navigate("/user/profile?completeName=1", {
        state: {
          message:
            "Please complete your profile name before submitting this form.",
        },
      });
      return;
    }
    if (!form.local_church_id)
      return setError(
        "Your account has no registered local church. Update your member registration before using this form.",
      );
    if (totalQuantity <= 0)
      return setError("Add at least one item to the order.");
    if (merch.merch_type === "Shirt" && availableShirtColors.length === 0)
      return setError(
        "This shirt form has no available colors configured. Please contact the administrator.",
      );
    if (
      merch.merch_type === "Shirt" &&
      colors.some(
        (color) =>
          !color.color.trim() &&
          sizes.some((size) => Number(color.quantities[size]) > 0),
      )
    )
      return setError(
        "Enter a color name for every shirt row with quantities.",
      );
    if (
      merch.merch_type === "Shirt" &&
      colors.some(
        (color) => color.color && !availableShirtColors.includes(color.color),
      )
    )
      return setError(
        "Select a shirt color from the administrator's available colors.",
      );
    const selectedProofFile = proofInputRef.current?.files?.[0] || null;
    if (!selectedProofFile && !existing?.proof_of_payment_url)
      return setError(
        "Attach a clear proof-of-payment image before submitting.",
      );
    setSaving(true);
    try {
      const proofPath = selectedProofFile
        ? await uploadPrivatePaymentProof(
            "merch-payment-proofs",
            selectedProofFile,
            user.id,
            formId,
          )
        : existing?.proof_of_payment_url || null;
      const shirtItems =
        merch.merch_type === "Shirt"
          ? colors.flatMap((color) =>
              sizes.map((size) => ({
                color: color.color,
                size,
                quantity: Number(color.quantities[size] || 0),
              })),
            )
          : [];
      await submitMerchPreorder({
        preorder: {
          ...(existing?.id ? { id: existing.id } : {}),
          form_id: formId,
          submitted_by: user.id,
          ...form,
          total_quantity: totalQuantity,
          payment_date: form.payment_date || null,
          reference_number: form.reference_number || null,
          proof_of_payment_url: proofPath,
          amount_paid: proofPath ? totalPayment : 0,
        },
        shirtItems,
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Unable to submit pre-order.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading merch form..." />;
  if (!merch)
    return <ErrorState message={error || "Pre-order form not found."} />;
  if (success || existing?.submission_status === "Submitted")
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-emerald-200 bg-white p-8 text-center">
        <CheckCircle2 className="mx-auto text-emerald-500" size={52} />
        <h1 className="mt-4 text-2xl font-black">Pre-order submitted</h1>
        <p className="mt-2 text-slate-500">
          Your {merchName} order has been sent to the NELPAC admin.
        </p>
        {onBack ? (
          <button
            onClick={onBack}
            className="mt-6 inline-flex rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white"
          >
            Back to forms
          </button>
        ) : (
          <Link
            to="/user/forms?type=merch"
            className="mt-6 inline-flex rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white"
          >
            Back to forms
          </Link>
        )}
      </div>
    );

  return (
    <div className="mx-auto max-w-5xl pb-10">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500"
        >
          <ArrowLeft size={16} /> Form selection
        </button>
      ) : (
        <Link
          to="/user/forms?type=merch"
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500"
        >
          <ArrowLeft size={16} /> Form selection
        </Link>
      )}
      <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-violet-950 via-indigo-900 to-blue-800 text-white shadow-xl">
        {merch.image_url && (
          <img
            src={merch.image_url}
            alt={merch.title}
            className="h-56 w-full object-cover sm:h-72"
          />
        )}
        <div className="p-6 sm:p-8">
          <div className="flex gap-4">
            <img
              src={nelpacLogo}
              className="h-14 w-14 rounded-xl bg-white object-contain p-1"
              alt="NELPAC"
            />
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-violet-200">
                NELPAC Merch Pre-Order
              </p>
              <h1 className="mt-1 text-2xl font-black sm:text-3xl">
                {merch.title}
              </h1>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-violet-100">
            {merch.description}
          </p>
        </div>
      </header>
      <form onSubmit={submit} className="mt-5 space-y-5">
        <section className="rounded-2xl border border-violet-200 bg-violet-50 p-5 text-sm leading-6 text-violet-900">
          <strong className="block">Before you begin</strong>
          <p>{merch.guide_text}</p>
          <div className="mt-4 border-t border-violet-200 pt-4">
            <strong className="block text-xs font-black uppercase tracking-wide">
              Payment Details
            </strong>
            <p className="mt-1">
              Please send your payment through GCASH and attach a clear copy of
              your proof of payment. The proof must show the date, time, and
              reference number clearly and legibly.
            </p>
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
              <strong className="block">Important Notice</strong>
              <p className="mt-1">
                Receipts must remain authentic and unaltered. Any tampering or
                falsification of payment proof is strictly prohibited and may
                subject the responsible party to legal action.
              </p>
            </div>
          </div>
        </section>
        {merch.image_url && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-violet-700">
                  Merch Image
                </p>
                <h2 className="mt-1 text-lg font-extrabold text-slate-900">
                  View the complete {merchName} design
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  The complete uploaded image is shown below. Select it to view
                  a larger version.
                </p>
              </div>
              <Maximize2 className="shrink-0 text-violet-600" size={20} />
            </div>
            <button
              type="button"
              onClick={() =>
                setImageViewer({
                  src: merch.image_url,
                  alt: `${merch.title} merch image`,
                })
              }
              className="mt-5 block w-full cursor-zoom-in overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(45deg,#f8fafc_25%,transparent_25%),linear-gradient(-45deg,#f8fafc_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f8fafc_75%),linear-gradient(-45deg,transparent_75%,#f8fafc_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px] p-3"
            >
              <img
                src={merch.image_url}
                alt={`${merch.title} complete merch design`}
                className="mx-auto max-h-[32rem] w-full object-contain"
              />
              <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">
                <Maximize2 size={13} /> Click to enlarge
              </span>
            </button>
          </section>
        )}
        {(merch.form_config?.custom_sections || [])
          .filter((section) => section.title || section.description)
          .map((section, index) => (
            <section
              key={index}
              className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7"
            >
              <h2 className="font-extrabold text-slate-900">
                {section.title || `Additional information ${index + 1}`}
              </h2>
              {section.description && (
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
                  {section.description}
                </p>
              )}
            </section>
          ))}
        <section className="rounded-3xl border border-violet-200 bg-white p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">
                {merchName} Pre-Order
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Complete the order details for this merch item.
              </p>
            </div>
            <div className="rounded-2xl bg-violet-50 px-5 py-3 text-right">
              <span className="block text-xs font-bold text-violet-600">
                {merchName} Price
              </span>
              <strong className="text-xl text-violet-900">
                ₱{Number(merch.item_fee).toLocaleString()} / item
              </strong>
            </div>
          </div>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
          <h2 className="font-extrabold">Church information</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              District{" "}
              <span className="text-xs font-normal text-slate-400">
                (from your registration)
              </span>
              <input
                readOnly
                value={district || "No registered district"}
                className={`${inputClass} bg-slate-100 font-semibold text-slate-700`}
              />
            </label>
            <label className="text-sm font-semibold">
              Local Church{" "}
              <span className="text-xs font-normal text-slate-400">
                (from your registration)
              </span>
              <input
                readOnly
                value={selectedChurch?.name || "No registered local church"}
                className={`${inputClass} bg-slate-100 font-semibold text-slate-700`}
              />
            </label>
            <label className="text-sm font-semibold">
              Local Church President
              <input
                required
                value={form.local_church_president}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    local_church_president: e.target.value,
                  }))
                }
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold">
              President Contact Number
              <input
                required
                value={form.president_contact_number}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    president_contact_number: e.target.value,
                  }))
                }
                className={inputClass}
              />
            </label>
          </div>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <Shirt className="text-violet-700" />
            <div>
              <h2 className="font-extrabold">{merchName} order</h2>
              <p className="text-xs text-slate-500">
                ₱{Number(merch.item_fee).toLocaleString()} per item
              </p>
            </div>
          </div>
          {merch.merch_type === "Shirt" ? (
            <>
              <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {sizes.map((size) => (
                  <div
                    key={size}
                    className="rounded-xl bg-slate-50 p-3 text-center"
                  >
                    <strong className="block text-sm">{size}</strong>
                    <span className="text-xs text-slate-500">
                      {dimensions[size]}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-5 space-y-4">
                {colors.map((color, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-end gap-3">
                      <label className="flex-1 text-xs font-semibold text-slate-600">
                        Color
                        <select
                          required
                          value={color.color}
                          onChange={(e) =>
                            updateColor(index, (row) => ({
                              ...row,
                              color: e.target.value,
                            }))
                          }
                          className={inputClass}
                        >
                          <option value="">Select available color</option>
                          {availableShirtColors
                            .filter(
                              (option) =>
                                option === color.color ||
                                !colors.some(
                                  (row, rowIndex) =>
                                    rowIndex !== index && row.color === option,
                                ),
                            )
                            .map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                        </select>
                      </label>
                      {colors.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setColors((rows) =>
                              rows.filter((_, row) => row !== index),
                            )
                          }
                          className="mb-0.5 rounded-xl border border-red-200 p-2.5 text-red-600"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {sizes.map((size) => (
                        <label
                          key={size}
                          className="text-center text-xs font-bold text-slate-500"
                        >
                          {size}
                          <input
                            min="0"
                            type="number"
                            value={color.quantities[size]}
                            onChange={(e) =>
                              updateColor(index, (row) => ({
                                ...row,
                                quantities: {
                                  ...row.quantities,
                                  [size]: e.target.value,
                                },
                              }))
                            }
                            className={`${inputClass} text-center`}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={colors.length >= availableShirtColors.length}
                onClick={() => setColors((rows) => [...rows, newColor()])}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-violet-200 px-4 py-2 text-sm font-bold text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={16} />
                {colors.length >= availableShirtColors.length
                  ? "All available colors added"
                  : "Add another color"}
              </button>
            </>
          ) : (
            <label className="mt-5 block max-w-sm text-sm font-semibold">
              Total Number of Orders
              <input
                required
                min="1"
                type="number"
                value={form.total_quantity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, total_quantity: e.target.value }))
                }
                className={inputClass}
              />
            </label>
          )}
          <div className="mt-5 flex items-center justify-between rounded-2xl bg-slate-900 p-4 text-white">
            <span className="text-sm text-slate-300">
              {totalQuantity} total items
            </span>
            <strong className="text-2xl">
              ₱{totalPayment.toLocaleString()}
            </strong>
          </div>
        </section>
        {(merch.gcash_recipient_name || merch.gcash_number) && (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
              GCash Account Details
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <span className="text-xs text-emerald-700">
                  Name of the Recipient
                </span>
                <strong className="block text-emerald-950">
                  {merch.gcash_recipient_name || "Not provided"}
                </strong>
              </div>
              <div>
                <span className="text-xs text-emerald-700">GCash Number</span>
                <strong className="block text-emerald-950">
                  {merch.gcash_number || "Not provided"}
                </strong>
              </div>
            </div>
          </section>
        )}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
          <h2 className="font-extrabold">Payment details</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              {merchName} Fee
              <input
                readOnly
                value={`₱${Number(merch.item_fee).toLocaleString()} per item`}
                className={`${inputClass} bg-slate-50`}
              />
            </label>
            <label className="text-sm font-semibold">
              GCash Mode of Payment
              <input
                required
                value={form.gcash_mode_of_payment}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    gcash_mode_of_payment: e.target.value,
                  }))
                }
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold">
              Date of Payment
              <input
                required
                type="date"
                value={form.payment_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, payment_date: e.target.value }))
                }
                className={inputClass}
              />
            </label>
            <label className="text-sm font-semibold">
              Reference Number
              <input
                required
                value={form.reference_number}
                onChange={(e) =>
                  setForm((f) => ({ ...f, reference_number: e.target.value }))
                }
                className={inputClass}
              />
            </label>
            <div className="sm:col-span-2">
              <p className="text-sm font-semibold">Proof of Payment</p>
              <input
                ref={proofInputRef}
                id="merch-proof-payment"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="mt-1.5 block w-full rounded-2xl border-2 border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-violet-700 file:px-4 file:py-2 file:font-bold file:text-white"
                onChange={(e) => chooseProof(e.target.files?.[0] || null)}
              />
              {existing?.proof_of_payment_url && !proofSelection && (
                <p className="mt-2 text-xs text-emerald-700">
                  An existing proof of payment is attached. Choosing a new file
                  will replace it.
                </p>
              )}
              {proofSelection && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="min-w-0">
                    <strong className="block text-sm text-emerald-800">
                      Receipt image selected
                    </strong>
                    <span className="block truncate text-xs text-emerald-700">
                      {proofSelection.name} ·{" "}
                      {(proofSelection.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => chooseProof(null)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600"
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
        <ErrorState message={error} />
        <button
          disabled={saving}
          className="w-full rounded-2xl bg-violet-700 px-6 py-4 text-sm font-extrabold text-white shadow-lg disabled:opacity-60"
        >
          {saving ? "Submitting pre-order..." : `Submit ${merchName} Pre-Order`}
        </button>
      </form>
      <ImageLightbox image={imageViewer} onClose={() => setImageViewer(null)} />
    </div>
  );
}

export { MerchPreorderForm };
