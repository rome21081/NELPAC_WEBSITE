import { useEffect, useState } from "react";
import {
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Save,
  Search,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/DataState";
import { useAuth } from "../../lib/authContext";
import { useSupabaseData } from "../../lib/useSupabaseData";
import {
  isValidPhilippineMobile,
  normalizePhilippineMobile,
  philippineMobileError,
  philippineMobileInputProps,
} from "../../lib/phoneNumbers";
import {
  createLocalChurchMember,
  saveMyMemberApplication,
} from "../../lib/localChurchMembers";
import {
  getMyLocalChurchDirectory,
  getMyMembers,
  listLocalChurches,
} from "../../lib/supabaseServices";

const emptyForm = {
  name: "",
  birthday: "",
  contactNumber: "",
  emergencyContact: "",
  gender: "",
  address: "",
  parentGuardianName: "",
  district: "ISED",
  localChurchId: "",
  professingMember: "No",
  confirmationClassYear: "",
  confirmationClassStatus: "Not Started",
  activityStatus: "Active",
};

const requiredFields = [
  ["name", "Name"],
  ["birthday", "Birthday"],
  ["contactNumber", "Contact number"],
  ["gender", "Gender"],
  ["address", "Address"],
  ["parentGuardianName", "Parent/guardian name"],
  ["emergencyContact", "Emergency contact"],
  ["professingMember", "Professing member"],
  ["confirmationClassStatus", "Confirmation class status"],
  ["activityStatus", "Activity status"],
];

const inputClass =
  "mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white";
const labelClass = "text-sm text-slate-600";

function fieldError(errors, field) {
  return errors[field] ? (
    <p className="mt-1 text-xs text-red-600">{errors[field]}</p>
  ) : null;
}

function LocalChurchMembers() {
  const { user, profile } = useAuth();
  const {
    data: members,
    loading,
    error,
    reload,
  } = useSupabaseData(async () => {
    const [directoryMembers, myApplications] = await Promise.all([
      getMyLocalChurchDirectory(),
      getMyMembers(user.id),
    ]);
    const membersById = new Map(
      directoryMembers.map((member) => [member.id, member]),
    );
    myApplications.forEach((member) => membersById.set(member.id, member));
    return [...membersById.values()].sort((left, right) =>
      String(left.name || "").localeCompare(String(right.name || "")),
    );
  }, [user?.id, profile?.local_church_id]);
  const { data: churches } = useSupabaseData(
    () => listLocalChurches({ activeOnly: true }),
    [],
  );
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [view, setView] = useState("directory");
  const [display, setDisplay] = useState("tiles");
  const [search, setSearch] = useState("");

  const profileChurch = (churches || []).find(
    (church) => church.id === profile?.local_church_id,
  );

  useEffect(() => {
    if (!profileChurch) return;
    setForm((current) => ({
      ...current,
      district: profileChurch.district,
      localChurchId: profileChurch.id,
    }));
  }, [profileChurch]);

  const update = (field, value) => {
    setMessage("");
    setFormErrors((current) => ({ ...current, [field]: "" }));
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const validate = () => {
    const nextErrors = {};
    requiredFields.forEach(([field, label]) => {
      if (!String(form[field] || "").trim())
        nextErrors[field] = `${label} is required.`;
    });
    if (!isValidPhilippineMobile(form.contactNumber))
      nextErrors.contactNumber = philippineMobileError;
    if (!isValidPhilippineMobile(form.emergencyContact))
      nextErrors.emergencyContact = philippineMobileError;
    if (!profileChurch) nextErrors.localChurchId = "Set your local church in My Profile first.";
    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    if (!validate()) {
      setMessage(
        "Please complete all required member details before submitting.",
      );
      return;
    }
    try {
      const memberForm = {
        ...form,
        district: profileChurch.district,
        localChurchId: profileChurch.id,
      };
      if (editingId) await saveMyMemberApplication(editingId, memberForm);
      else await createLocalChurchMember(memberForm, user.id);
      setForm({
        ...emptyForm,
        district: profileChurch.district,
        localChurchId: profileChurch.id,
      });
      setEditingId("");
      setFormErrors({});
      await reload();
      setMessage("Member application saved for admin review.");
      setView("directory");
    } catch (err) {
      const errorMessage = err.message || "";
      setMessage(
        errorMessage.includes("MEMBER_CONTACT_ALREADY_HAS_ACCOUNT")
          ? "This contact number already belongs to a registered user account. That person cannot be added again."
          : errorMessage.includes("MEMBER_ALREADY_REGISTERED_CONTACT")
            ? "A local church member with this contact number is already registered."
            : errorMessage.includes("MEMBER_ALREADY_REGISTERED_NAME_BIRTHDAY")
              ? "A member with the same name and birthday is already registered. Please check the member directory."
              : errorMessage || "Unable to save member application.",
      );
    }
  };

  const edit = (member) => {
    setEditingId(member.id);
    setMessage("");
    setFormErrors({});
    setForm({
      name: member.name || "",
      birthday: member.birthday || "",
      contactNumber: member.contact_number || "",
      emergencyContact: member.emergency_contact || "",
      gender: member.gender || "",
      address: member.address || "",
      parentGuardianName: member.parent_guardian_name || "",
      district: profileChurch?.district || "",
      localChurchId: profileChurch?.id || "",
      professingMember: member.professing_member || "No",
      confirmationClassYear: member.confirmation_class_year || "",
      confirmationClassStatus:
        member.confirmation_class_status || "Not Started",
      activityStatus: member.activity_status || "Active",
    });
    setView("add");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId("");
    setForm({
      ...emptyForm,
      district: profileChurch?.district || "",
      localChurchId: profileChurch?.id || "",
    });
    setFormErrors({});
    setMessage("");
  };

  if (loading) return <LoadingState label="Loading local church members..." />;

  const filteredMembers = members.filter((member) =>
    `${member.name || ""} ${member.local_church_name || ""} ${member.review_status || ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <header className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-700">
              Church Directory
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Local Church Members
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Add member applications and monitor their review status from one
              organized workspace.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              cancelEdit();
              setView("add");
            }}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-blue-800"
          >
            <UserPlus size={18} /> Add Local Church Member
          </button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setView("directory")}
            className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${view === "directory" ? "border-blue-300 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 hover:bg-slate-50"}`}
          >
            <span
              className={`rounded-xl p-2.5 ${view === "directory" ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              <Users size={20} />
            </span>
            <span>
              <strong className="block text-slate-950">Member Directory</strong>
              <small className="text-slate-500">
                {members.length} church member
                {members.length === 1 ? "" : "s"}
              </small>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setView("add")}
            className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${view === "add" ? "border-emerald-300 bg-emerald-50 ring-2 ring-emerald-100" : "border-slate-200 hover:bg-slate-50"}`}
          >
            <span
              className={`rounded-xl p-2.5 ${view === "add" ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              <UserPlus size={20} />
            </span>
            <span>
              <strong className="block text-slate-950">
                {editingId ? "Edit Member" : "Add Member"}
              </strong>
              <small className="text-slate-500">
                Complete and submit member details
              </small>
            </span>
          </button>
        </div>
      </header>
      <ErrorState
        message={error || (message.includes("Unable") ? message : "")}
      />
      {message && (
        <p
          className={`rounded-xl border p-3 text-sm ${message.includes("saved") ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}
        >
          {message}
        </p>
      )}
      {view === "add" ? (
        <form
          onSubmit={submit}
          className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 sm:p-7"
        >
          <div className="md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  {editingId
                    ? "Update member application"
                    : "New member application"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Fields marked with an asterisk are required for admin review.
                </p>
              </div>
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                  title="Cancel editing"
                >
                  <X size={18} />
                </button>
              )}
            </div>
            <div className="my-2 h-px bg-slate-100" />
          </div>
          <label className={labelClass}>
            Name *
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
            />
            {fieldError(formErrors, "name")}
          </label>
          <label className={labelClass}>
            Birthday *
            <input
              type="date"
              className={inputClass}
              value={form.birthday}
              onChange={(e) => update("birthday", e.target.value)}
            />
            {fieldError(formErrors, "birthday")}
          </label>
          <label className={labelClass}>
            Contact number *
            <input
              {...philippineMobileInputProps}
              className={inputClass}
              value={form.contactNumber}
              onChange={(e) =>
                update(
                  "contactNumber",
                  normalizePhilippineMobile(e.target.value),
                )
              }
            />
            {fieldError(formErrors, "contactNumber")}
          </label>
          <label className={labelClass}>
            Emergency contact *
            <input
              {...philippineMobileInputProps}
              className={inputClass}
              value={form.emergencyContact}
              onChange={(e) =>
                update(
                  "emergencyContact",
                  normalizePhilippineMobile(e.target.value),
                )
              }
            />
            {fieldError(formErrors, "emergencyContact")}
          </label>
          <label className={labelClass}>
            Gender *
            <select
              className={inputClass}
              value={form.gender}
              onChange={(e) => update("gender", e.target.value)}
            >
              <option value="">Select gender</option>
              <option>Male</option>
              <option>Female</option>
              <option>Prefer not to say</option>
            </select>
            {fieldError(formErrors, "gender")}
          </label>
          <label className={labelClass}>
            Parent/guardian name *
            <input
              className={inputClass}
              value={form.parentGuardianName}
              onChange={(e) => update("parentGuardianName", e.target.value)}
            />
            {fieldError(formErrors, "parentGuardianName")}
          </label>
          <label className={`${labelClass} md:col-span-2`}>
            Address *
            <input
              className={inputClass}
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
            />
            {fieldError(formErrors, "address")}
          </label>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 md:col-span-2">
            <p className="text-xs font-black uppercase tracking-wider text-blue-700">
              Local church assigned automatically
            </p>
            <p className="mt-1 font-bold text-blue-950">
              {profileChurch
                ? `${profileChurch.name} - ${profileChurch.district}`
                : "No local church selected"}
            </p>
            <p className="mt-1 text-xs leading-5 text-blue-700">
              Every member you add belongs to your profile's local church. To
              correct it, update My Profile first.
            </p>
            {fieldError(formErrors, "localChurchId")}
          </div>
          <label className={labelClass}>
            Professing member *
            <select
              className={inputClass}
              value={form.professingMember}
              onChange={(e) => update("professingMember", e.target.value)}
            >
              <option value="">Select answer</option>
              <option>Yes</option>
              <option>No</option>
            </select>
            {fieldError(formErrors, "professingMember")}
          </label>
          <label className={labelClass}>
            Confirmation class year
            <input
              className={inputClass}
              value={form.confirmationClassYear}
              onChange={(e) => update("confirmationClassYear", e.target.value)}
            />
          </label>
          <label className={labelClass}>
            Confirmation class status *
            <select
              className={inputClass}
              value={form.confirmationClassStatus}
              onChange={(e) =>
                update("confirmationClassStatus", e.target.value)
              }
            >
              <option>Not Started</option>
              <option>Ongoing</option>
              <option>Completed</option>
              <option>Dropped</option>
            </select>
            {fieldError(formErrors, "confirmationClassStatus")}
          </label>
          <label className={labelClass}>
            Activity status *
            <select
              className={inputClass}
              value={form.activityStatus}
              onChange={(e) => update("activityStatus", e.target.value)}
            >
              <option>Active</option>
              <option>Inactive</option>
            </select>
            {fieldError(formErrors, "activityStatus")}
          </label>
          <button className="md:col-span-2 flex items-center justify-center gap-2 rounded-xl bg-slate-950 py-3 text-sm font-extrabold text-white transition hover:bg-blue-800">
            {editingId ? (
              <Save style={{ width: 14, height: 14 }} />
            ) : (
              <Plus style={{ width: 14, height: 14 }} />
            )}{" "}
            {editingId ? "Resubmit Application" : "Submit Application"}
          </button>
        </form>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <label className="relative flex-1 sm:max-w-md">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={17}
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search member, church, or status"
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </label>
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setDisplay("tiles")}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${display === "tiles" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
              >
                <LayoutGrid size={15} /> Tiles
              </button>
              <button
                type="button"
                onClick={() => setDisplay("list")}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${display === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
              >
                <List size={15} /> List
              </button>
            </div>
          </div>
          {filteredMembers.length === 0 ? (
            <EmptyState label="No local church members found." />
          ) : (
            <div
              className={
                display === "tiles"
                  ? "grid gap-4 md:grid-cols-2 xl:grid-cols-3"
                  : "space-y-3"
              }
            >
              {filteredMembers.map((member) => (
                <article
                  key={member.id}
                  className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${display === "list" ? "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" : ""}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 font-black text-blue-700">
                        {member.name?.charAt(0)?.toUpperCase() || "M"}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-black text-slate-950">
                          {member.name}
                        </h3>
                        <p className="truncate text-xs text-slate-500">
                          {member.local_church_name ||
                            "Local church not available"}{" "}
                          · {member.district}
                        </p>
                      </div>
                    </div>
                    {display === "tiles" && (
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <span className="block text-slate-400">Activity</span>
                          <strong className="text-slate-700">
                            {member.activity_status}
                          </strong>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <span className="block text-slate-400">
                            Confirmation
                          </span>
                          <strong className="text-slate-700">
                            {member.confirmation_class_status}
                          </strong>
                        </div>
                      </div>
                    )}
                  </div>
                  <div
                    className={`flex items-center gap-2 ${display === "tiles" ? "mt-4 justify-between border-t border-slate-100 pt-4" : "shrink-0"}`}
                  >
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-black ${member.review_status === "Approved" ? "bg-emerald-50 text-emerald-700" : member.review_status === "Rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}
                    >
                      {member.review_status}
                    </span>
                    {member.submitted_by === user.id &&
                      ["Pending", "Rejected"].includes(member.review_status) && (
                      <button
                        type="button"
                        onClick={() => edit(member)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50"
                      >
                        <Pencil size={13} /> Edit
                      </button>
                      )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export { LocalChurchMembers };
