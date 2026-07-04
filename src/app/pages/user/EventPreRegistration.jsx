import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MapPin,
  Plus,
  Trash2,
  UploadCloud,
  Users,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { ErrorState, LoadingState } from "../../components/DataState";
import { CustomFormSections } from "../../components/CustomFormSections";
import { useAuth } from "../../lib/authContext";
import {
  clearFormDraft,
  loadFormDraft,
  saveFormDraftData,
  saveFormDraftFile,
} from "../../lib/formDraftStorage";
import { hasCompleteProfileName } from "../../lib/profileNames";
import {
  isValidPhilippineMobile,
  normalizePhilippineMobile,
  philippineMobileError,
  philippineMobileInputProps,
} from "../../lib/phoneNumbers";
import {
  appendEventRegistrationSupplement,
  getEvent,
  getMyMembers,
  getMyEventRegistration,
  listLocalChurches,
  listMyChurchMembers,
  submitEventRegistration,
  uploadPrivatePaymentProof,
} from "../../lib/supabaseServices";
import nelpacLogo from "../../../../NELPAC-LOGO.jpg";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100";
const emptyDelegate = () => ({
  selected_member_id: "",
  name: "",
  age: "",
  gender: "Male",
  health_condition: "",
});

function ageFromBirthday(birthday) {
  if (!birthday) return "";
  const today = new Date();
  const born = new Date(`${birthday}T00:00:00`);
  let age = today.getFullYear() - born.getFullYear();
  if (today < new Date(today.getFullYear(), born.getMonth(), born.getDate()))
    age -= 1;
  return Math.max(age, 0);
}

function EventPreRegistration({ selectedEventId = null, onBack = null }) {
  const { eventId: routeEventId } = useParams();
  const eventId = selectedEventId || routeEventId;
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [churches, setChurches] = useState([]);
  const [members, setMembers] = useState([]);
  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [addingAnother, setAddingAnother] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const proofInputRef = useRef(null);
  const [proofFile, setProofFile] = useState(null);
  const [proofSelection, setProofSelection] = useState(null);
  const [district, setDistrict] = useState("");
  const [form, setForm] = useState({
    local_church_id: "",
    local_church_worker: "",
    worker_contact_number: "",
    local_church_president: "",
    president_contact_number: "",
    male_delegate_count: 0,
    female_delegate_count: 0,
    gcash_mode_of_payment: "GCash",
    payment_sender_name: "",
    payment_date: "",
    reference_number: "",
    custom_field_responses: {},
  });
  const [delegates, setDelegates] = useState([]);
  const [expandedDelegate, setExpandedDelegate] = useState(null);
  const draftKey = `nelpac:event-registration-draft:${user.id}:${eventId}`;

  useEffect(() => {
    Promise.all([
      getEvent(eventId),
      listLocalChurches({ activeOnly: true }),
      listMyChurchMembers(),
      getMyEventRegistration(eventId),
      getMyMembers(user.id),
    ])
      .then(async ([eventData, churchData, memberData, registration, ownMembers]) => {
        setEvent(eventData);
        setChurches(churchData);
        setMembers(memberData);
        setExisting(registration);
        const registeredMember =
          ownMembers.find((member) => member.review_status === "Approved") ||
          ownMembers[0];
        const registeredChurchId =
          registration?.local_church_id ||
          registeredMember?.local_church_id ||
          "";
        const registeredChurch = churchData.find(
          (item) => item.id === registeredChurchId,
        );
        setDistrict(
          registeredChurch?.district || registeredMember?.district || "",
        );
        if (registration) {
          setForm({
            local_church_id: registration.local_church_id,
            local_church_worker: registration.local_church_worker,
            worker_contact_number: registration.worker_contact_number,
            local_church_president: registration.local_church_president,
            president_contact_number: registration.president_contact_number,
            male_delegate_count: registration.male_delegate_count,
            female_delegate_count: registration.female_delegate_count,
            gcash_mode_of_payment:
              registration.gcash_mode_of_payment || "GCash",
            payment_sender_name: registration.payment_sender_name || "",
            payment_date: registration.payment_date || "",
            reference_number: registration.reference_number || "",
            custom_field_responses:
              registration.custom_field_responses || {},
          });
          setDelegates(
            (registration.event_registration_delegates || []).sort(
              (a, b) => a.row_number - b.row_number,
            ),
          );
        } else if (registeredChurchId) {
          setForm((current) => ({
            ...current,
            local_church_id: registeredChurchId,
          }));
        }

        const savedDraft = await loadFormDraft(draftKey);
        if (savedDraft.data?.form) {
          setForm((current) => ({ ...current, ...savedDraft.data.form }));
          setDelegates(savedDraft.data.delegates || []);
          setAddingAnother(Boolean(savedDraft.data.addingAnother));
          setExpandedDelegate(savedDraft.data.expandedDelegate ?? null);
          const draftChurch = churchData.find(
            (item) => item.id === savedDraft.data.form.local_church_id,
          );
          if (draftChurch) setDistrict(draftChurch.district || "");
        }
        if (savedDraft.data && savedDraft.proofFile) {
          setProofFile(savedDraft.proofFile);
          setProofSelection({
            name: savedDraft.proofFile.name,
            size: savedDraft.proofFile.size,
          });
        }
      })
      .catch((err) =>
        setError(err.message || "Unable to load the registration form."),
      )
      .finally(() => {
        setDraftReady(true);
        setLoading(false);
      });
  }, [draftKey, eventId, user.id]);

  useEffect(() => {
    if (!draftReady || loading || success) return undefined;
    if (existing?.submission_status === "Submitted" && !addingAnother)
      return undefined;

    const timeout = window.setTimeout(() => {
      saveFormDraftData(draftKey, {
        form,
        delegates,
        addingAnother,
        expandedDelegate,
      });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [
    addingAnother,
    delegates,
    draftKey,
    draftReady,
    existing?.submission_status,
    expandedDelegate,
    form,
    loading,
    success,
  ]);

  const selectedChurch = churches.find(
    (item) => item.id === form.local_church_id,
  );
  const maleDelegateCount = delegates.filter(
    (delegate) => delegate.gender === "Male",
  ).length;
  const femaleDelegateCount = delegates.filter(
    (delegate) => delegate.gender === "Female",
  ).length;
  const totalDelegates = delegates.length;
  const totalPayment = totalDelegates * Number(event?.registration_fee || 0);
  const churchMembers = useMemo(
    () =>
      form.local_church_id
        ? members.filter(
            (member) => member.local_church_id === form.local_church_id,
          )
        : [],
    [members, form.local_church_id],
  );

  const updateDelegate = (index, field, value) => {
    setDelegates((current) =>
      current.map((delegate, row) =>
        row === index ? { ...delegate, [field]: value } : delegate,
      ),
    );
  };

  const addDelegate = () => {
    setExpandedDelegate(delegates.length);
    setDelegates((current) => [...current, emptyDelegate()]);
  };

  const removeDelegate = (index) => {
    setDelegates((current) => current.filter((_, row) => row !== index));
    setExpandedDelegate((current) =>
      current === index ? null : current > index ? current - 1 : current,
    );
  };

  const selectMember = (index, memberId) => {
    const member = churchMembers.find((item) => item.id === memberId);
    setDelegates((current) =>
      current.map((delegate, row) =>
        row === index
          ? {
              ...delegate,
              selected_member_id: memberId,
              name: member?.name || delegate.name,
              age: member ? ageFromBirthday(member.birthday) : delegate.age,
              gender: member?.gender === "Female" ? "Female" : "Male",
            }
          : delegate,
      ),
    );
  };

  const chooseProof = (file) => {
    setError("");
    if (!file) {
      if (proofInputRef.current) proofInputRef.current.value = "";
      setProofFile(null);
      setProofSelection(null);
      void saveFormDraftFile(draftKey, null);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      if (proofInputRef.current) proofInputRef.current.value = "";
      setProofFile(null);
      setProofSelection(null);
      void saveFormDraftFile(draftKey, null);
      setError("Proof of payment must be a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      if (proofInputRef.current) proofInputRef.current.value = "";
      setProofFile(null);
      setProofSelection(null);
      void saveFormDraftFile(draftKey, null);
      setError("Proof of payment must be 10 MB or smaller.");
      return;
    }
    setProofFile(file);
    setProofSelection({ name: file.name, size: file.size });
    void saveFormDraftFile(draftKey, file);
  };

  const submit = async (submitEvent) => {
    submitEvent.preventDefault();
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
    if (
      !isValidPhilippineMobile(form.worker_contact_number) ||
      !isValidPhilippineMobile(form.president_contact_number)
    )
      return setError(philippineMobileError);
    if (!totalDelegates) return setError("Enter at least one delegate.");
    if (
      delegates.some((delegate) => !delegate.name.trim() || delegate.age === "")
    )
      return setError("Complete every delegate row before submitting.");
    const selectedProofFile =
      proofFile || proofInputRef.current?.files?.[0] || null;
    if (
      !selectedProofFile &&
      (addingAnother || !existing?.proof_of_payment_url)
    )
      return setError(
        "Attach a clear proof-of-payment image before submitting.",
      );
    setSaving(true);
    try {
      const proofPath = selectedProofFile
        ? await uploadPrivatePaymentProof(
            "registration-payment-proofs",
            selectedProofFile,
            user.id,
            eventId,
          )
        : existing?.proof_of_payment_url || null;
      if (existing?.submission_status === "Submitted" && addingAnother) {
        await appendEventRegistrationSupplement({
          registration_id: existing.id,
          submitted_by: user.id,
          submission_details: {
            local_church_worker: form.local_church_worker,
            worker_contact_number: form.worker_contact_number,
            local_church_president: form.local_church_president,
            president_contact_number: form.president_contact_number,
          },
          delegates: delegates.map((delegate, index) => ({
            row_number: index + 1,
            selected_member_id: delegate.selected_member_id || null,
            name: delegate.name.trim(),
            age: Number(delegate.age),
            gender: delegate.gender,
            health_condition: delegate.health_condition?.trim() || null,
          })),
          male_delegate_count: maleDelegateCount,
          female_delegate_count: femaleDelegateCount,
          fee_per_delegate: Number(event.registration_fee),
          gcash_mode_of_payment: form.gcash_mode_of_payment,
          payment_sender_name: form.payment_sender_name,
          payment_date: form.payment_date || null,
          reference_number: form.reference_number || null,
          proof_of_payment_url: proofPath,
          custom_field_responses: form.custom_field_responses || {},
        });
      } else {
        await submitEventRegistration({
          registration: {
            ...(existing?.id ? { id: existing.id } : {}),
            event_id: eventId,
            submitted_by: user.id,
            ...form,
            male_delegate_count: maleDelegateCount,
            female_delegate_count: femaleDelegateCount,
            payment_date: form.payment_date || null,
            reference_number: form.reference_number || null,
            proof_of_payment_url: proofPath,
            amount_paid: 0,
          },
          delegates,
        });
      }
      await clearFormDraft(draftKey);
      setAddingAnother(false);
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Unable to submit registration.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading pre-registration form..." />;
  if (!event) return <ErrorState message={error || "Event not found."} />;
  if ((success || existing?.submission_status === "Submitted") && !addingAnother)
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto text-emerald-500" size={52} />
        <h1 className="mt-4 text-2xl font-extrabold text-slate-900">
          Registration submitted
        </h1>
        <p className="mt-2 text-slate-500">
          Your church registration for {event.title} is safely recorded. The
          NELPAC admin can now review its payment.
        </p>
        <button
          type="button"
          onClick={() => {
            setSuccess(false);
            setAddingAnother(true);
            setDelegates([]);
            setExpandedDelegate(null);
            setProofFile(null);
            setProofSelection(null);
            void saveFormDraftFile(draftKey, null);
            if (proofInputRef.current) proofInputRef.current.value = "";
            setForm((current) => ({
              ...current,
              male_delegate_count: 0,
              female_delegate_count: 0,
              payment_sender_name: "",
              payment_date: "",
              reference_number: "",
              custom_field_responses: {},
            }));
          }}
          className="mt-6 inline-flex rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white"
        >
          Add Another Submission
        </button>
        {onBack ? (
          <button
            onClick={onBack}
            className="mt-6 inline-flex rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white"
          >
            Back to forms
          </button>
        ) : (
          <Link
            to="/user/forms?type=registration"
            className="mt-6 inline-flex rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white"
          >
            Back to forms
          </Link>
        )}
      </div>
    );

  const registrationOpen =
    event.status === "Published" && event.pre_registration_enabled;
  return (
    <div className="mx-auto max-w-5xl pb-10">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-700"
        >
          <ArrowLeft size={16} /> Form selection
        </button>
      ) : (
        <Link
          to="/user/forms?type=registration"
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-700"
        >
          <ArrowLeft size={16} /> Form selection
        </Link>
      )}
      <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-800 text-white shadow-xl">
        {event.image_url && (
          <img
            src={event.image_url}
            alt=""
            className="h-52 w-full object-cover opacity-80 sm:h-64"
          />
        )}
        <div className="p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <img
              src={nelpacLogo}
              alt="NELPAC"
              className="h-14 w-14 rounded-xl bg-white object-contain p-1"
            />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">
                NELPAC Event Pre-Registration
              </p>
              <h1 className="mt-1 text-2xl font-black sm:text-3xl">
                {event.title}
              </h1>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-blue-100">
            {event.description}
          </p>
          <div className="mt-5 flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-2">
              <CalendarDays size={17} /> {event.event_date}
            </span>
            <span className="flex items-center gap-2">
              <MapPin size={17} /> {event.venue || "Venue to be announced"}
            </span>
          </div>
        </div>
      </header>

      {!registrationOpen ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
          Pre-registration is not currently open for this event.
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-5">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Your progress is saved automatically on this device. You can leave,
            reload, and return without re-entering your details.
          </div>
          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <p className="font-bold text-blue-950">Before you begin</p>
            <p className="mt-1 text-sm leading-6 text-blue-800">
              {event.registration_guide}
            </p>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
              <strong className="block">Important Notice</strong>
              <p className="mt-1">
                Receipts must remain authentic and unaltered. Any tampering or
                falsification of payment proof is strictly prohibited and may
                subject the responsible party to legal action.
              </p>
            </div>
          </section>
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-blue-100 p-2 text-blue-700">
                <Users size={20} />
              </div>
              <div>
                <h2 className="font-extrabold text-slate-900">
                  {event.registration_form_config?.section_one_title ||
                    "Church and delegate information"}
                </h2>
                <p className="text-xs text-slate-500">
                  Tell us who will represent your local church.
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
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
              <label className="text-sm font-semibold text-slate-700">
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
              <label className="text-sm font-semibold text-slate-700">
                Local Church Worker
                <input
                  required
                  value={form.local_church_worker}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      local_church_worker: e.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Worker Contact Number
                <input
                  {...philippineMobileInputProps}
                  required
                  value={form.worker_contact_number}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      worker_contact_number: normalizePhilippineMobile(
                        e.target.value,
                      ),
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
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
              <label className="text-sm font-semibold text-slate-700">
                President Contact Number
                <input
                  {...philippineMobileInputProps}
                  required
                  value={form.president_contact_number}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      president_contact_number: normalizePhilippineMobile(
                        e.target.value,
                      ),
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Male Delegates{" "}
                <span className="text-xs font-normal text-slate-400">
                  (from delegate list)
                </span>
                <input
                  readOnly
                  value={maleDelegateCount}
                  className={`${inputClass} bg-blue-50 font-bold text-blue-900`}
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Female Delegates{" "}
                <span className="text-xs font-normal text-slate-400">
                  (from delegate list)
                </span>
                <input
                  readOnly
                  value={femaleDelegateCount}
                  className={`${inputClass} bg-pink-50 font-bold text-pink-900`}
                />
              </label>
            </div>
            <div className="mt-5 rounded-2xl bg-slate-900 p-4 text-white">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">
                  {totalDelegates} delegates × ₱
                  {Number(event.registration_fee).toLocaleString()}
                </span>
                <strong className="text-xl">
                  ₱{totalPayment.toLocaleString()}
                </strong>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div>
              <h2 className="font-extrabold text-slate-900">
                Delegate List Table
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Add each delegate and select Male or Female. Completed entries
                minimize so the next delegate is easier to fill out.
              </p>
            </div>
            {delegates.length === 0 ? (
              <div className="mt-5 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50 p-6 text-center text-sm text-blue-800">
                No delegates yet. Use <strong>Add Delegate</strong> below to
                create the first row.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {delegates.map((delegate, index) => {
                  const isExpanded = expandedDelegate === index;
                  const isComplete = Boolean(
                    delegate.name?.trim() && delegate.age !== "",
                  );
                  return (
                    <div
                      key={index}
                      className={`overflow-hidden rounded-2xl border transition ${isExpanded ? "border-blue-300 bg-blue-50/40 ring-2 ring-blue-100" : "border-slate-200 bg-slate-50"}`}
                    >
                      <div className="flex items-center gap-3 p-4">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedDelegate(isExpanded ? null : index)
                          }
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${isComplete ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}
                          >
                            {index + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <strong className="block truncate text-sm text-slate-900">
                              {delegate.name?.trim() || `Delegate ${index + 1}`}
                            </strong>
                            <span className="block truncate text-xs text-slate-500">
                              {isComplete
                                ? `${delegate.age} years old · ${delegate.gender} · ${delegate.health_condition || "No health condition"}`
                                : "Details not completed"}
                            </span>
                          </span>
                          {isExpanded ? (
                            <ChevronUp
                              className="shrink-0 text-slate-400"
                              size={18}
                            />
                          ) : (
                            <ChevronDown
                              className="shrink-0 text-slate-400"
                              size={18}
                            />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeDelegate(index)}
                          className="rounded-lg border border-red-200 bg-white p-2 text-red-600"
                          title="Remove delegate"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="border-t border-blue-100 bg-white p-4">
                          <div className="mb-3">
                            <label className="text-xs font-semibold text-slate-600">
                              Select registered member from this church
                              <select
                                value={delegate.selected_member_id || ""}
                                onChange={(e) =>
                                  selectMember(index, e.target.value)
                                }
                                className={inputClass}
                              >
                                <option value="">
                                  Enter delegate manually
                                </option>
                                {churchMembers.map((member) => (
                                  <option key={member.id} value={member.id}>
                                    {member.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_5rem_8rem_1fr]">
                            <label className="text-xs font-semibold text-slate-600">
                              Name
                              <input
                                required
                                value={delegate.name}
                                onChange={(e) =>
                                  updateDelegate(index, "name", e.target.value)
                                }
                                className={inputClass}
                              />
                            </label>
                            <label className="text-xs font-semibold text-slate-600">
                              Age
                              <input
                                required
                                min="0"
                                max="120"
                                type="number"
                                value={delegate.age}
                                onChange={(e) =>
                                  updateDelegate(index, "age", e.target.value)
                                }
                                className={inputClass}
                              />
                            </label>
                            <label className="text-xs font-semibold text-slate-600">
                              Male or Female
                              <select
                                value={delegate.gender}
                                onChange={(e) =>
                                  updateDelegate(
                                    index,
                                    "gender",
                                    e.target.value,
                                  )
                                }
                                className={inputClass}
                              >
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                              </select>
                            </label>
                            <label className="text-xs font-semibold text-slate-600">
                              Health Condition
                              <input
                                value={delegate.health_condition || ""}
                                placeholder="None, allergy, medication, etc."
                                onChange={(e) =>
                                  updateDelegate(
                                    index,
                                    "health_condition",
                                    e.target.value,
                                  )
                                }
                                className={inputClass}
                              />
                            </label>
                          </div>
                          <div className="mt-4 flex justify-end">
                            <button
                              type="button"
                              onClick={() => setExpandedDelegate(null)}
                              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
                            >
                              Done with Delegate {index + 1}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              onClick={addDelegate}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 hover:bg-blue-100"
            >
              <Plus size={16} /> Add Another Delegate
            </button>
          </section>

          <CustomFormSections
            sections={event.registration_form_config?.custom_sections || []}
            values={form.custom_field_responses}
            onChange={(fieldId, value) =>
              setForm((current) => ({
                ...current,
                custom_field_responses: {
                  ...current.custom_field_responses,
                  [fieldId]: value,
                },
              }))
            }
          />

          {(event.registration_gcash_recipient_name ||
            event.registration_gcash_number) && (
            <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm sm:p-7">
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                GCash Account Details
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-200 bg-white p-4">
                  <span className="text-xs font-semibold text-emerald-700">
                    Name of the Recipient
                  </span>
                  <strong className="mt-1 block text-emerald-950">
                    {event.registration_gcash_recipient_name || "Not provided"}
                  </strong>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-white p-4">
                  <span className="text-xs font-semibold text-emerald-700">
                    GCash Number
                  </span>
                  <strong className="mt-1 block text-emerald-950">
                    {event.registration_gcash_number || "Not provided"}
                  </strong>
                </div>
              </div>
            </section>
          )}

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="font-extrabold text-slate-900">Payment details</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                Registration Fee
                <input
                  readOnly
                  value={`₱${Number(event.registration_fee).toLocaleString()} per delegate`}
                  className={`${inputClass} bg-slate-50`}
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
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
              <label className="text-sm font-semibold text-slate-700">
                Payment Sender Name
                <input
                  required
                  autoComplete="name"
                  placeholder="Name shown on the GCash account or receipt"
                  value={form.payment_sender_name}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      payment_sender_name: e.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
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
              <label className="text-sm font-semibold text-slate-700">
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
                <p className="text-sm font-semibold text-slate-700">
                  Proof of Payment
                </p>
                <input
                  ref={proofInputRef}
                  id="event-proof-payment"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="mt-1.5 block w-full rounded-2xl border-2 border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-700 file:px-4 file:py-2 file:font-bold file:text-white"
                  onChange={(e) => chooseProof(e.target.files?.[0] || null)}
                />
                {existing?.proof_of_payment_url && !proofSelection && (
                  <p className="mt-2 text-xs text-emerald-700">
                    An existing proof of payment is attached. Choosing a new
                    file will replace it.
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
            <div className="mt-5 flex items-center justify-between rounded-2xl bg-emerald-50 p-4 text-emerald-900">
              <span className="font-semibold">Total Payment</span>
              <strong className="text-2xl">
                ₱{totalPayment.toLocaleString()}
              </strong>
            </div>
          </section>
          <ErrorState message={error} />
          <button
            disabled={saving}
            className="w-full rounded-2xl bg-blue-700 px-6 py-4 text-sm font-extrabold text-white shadow-lg shadow-blue-200 hover:bg-blue-800 disabled:opacity-60"
          >
            {saving ? "Submitting registration..." : "Submit Pre-Registration"}
          </button>
        </form>
      )}
    </div>
  );
}

export { EventPreRegistration };
