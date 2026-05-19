import { useEffect, useState } from "react";
import { Plus, Save } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { useAuth } from "../../lib/authContext";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { getActiveLocalChurchesByDistrict } from "../../lib/localChurches";
import { createLocalChurchMember, saveMyMemberApplication } from "../../lib/localChurchMembers";
import { getMyMembers } from "../../lib/supabaseServices";

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
  ["district", "District"],
  ["localChurchId", "Local church"],
  ["professingMember", "Professing member"],
  ["confirmationClassStatus", "Confirmation class status"],
  ["activityStatus", "Activity status"],
];

const inputClass = "mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white";
const labelClass = "text-sm text-slate-600";

function fieldError(errors, field) {
  return errors[field] ? <p className="mt-1 text-xs text-red-600">{errors[field]}</p> : null;
}

function LocalChurchMembers() {
  const { user } = useAuth();
  const { data: members, loading, error, reload } = useSupabaseData(() => getMyMembers(user.id), [user?.id]);
  const [churches, setChurches] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    getActiveLocalChurchesByDistrict(form.district).then(setChurches).catch(() => setChurches([]));
  }, [form.district]);

  const update = (field, value) => {
    setMessage("");
    setFormErrors((current) => ({ ...current, [field]: "" }));
    setForm((current) => ({ ...current, [field]: value, ...(field === "district" ? { localChurchId: "" } : {}) }));
  };

  const validate = () => {
    const nextErrors = {};
    requiredFields.forEach(([field, label]) => {
      if (!String(form[field] || "").trim()) nextErrors[field] = `${label} is required.`;
    });
    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    if (!validate()) {
      setMessage("Please complete all required member details before submitting.");
      return;
    }
    try {
      if (editingId) await saveMyMemberApplication(editingId, form);
      else await createLocalChurchMember(form, user.id);
      setForm(emptyForm);
      setEditingId("");
      setFormErrors({});
      await reload();
      setMessage("Member application saved for admin review.");
    } catch (err) {
      setMessage(err.message || "Unable to save member application.");
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
      district: member.district || "ISED",
      localChurchId: member.local_church_id || "",
      professingMember: member.professing_member || "No",
      confirmationClassYear: member.confirmation_class_year || "",
      confirmationClassStatus: member.confirmation_class_status || "Not Started",
      activityStatus: member.activity_status || "Active",
    });
  };

  if (loading) return <LoadingState label="Loading local church members..." />;

  return <div className="space-y-5">
    <div><h1 className="text-slate-900" style={{ fontSize: "22px", fontWeight: 700 }}>Local Church Members</h1><p className="text-slate-500 text-sm">Submit and manage your editable pending/rejected member applications</p></div>
    <ErrorState message={error || (message.includes("Unable") ? message : "")} />
    {message && <p className={`rounded-xl border p-3 text-sm ${message.includes("saved") ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>{message}</p>}
    <form onSubmit={submit} className="bg-white rounded-2xl p-5 border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
      <label className={labelClass}>Name *<input className={inputClass} value={form.name} onChange={(e) => update("name", e.target.value)} />{fieldError(formErrors, "name")}</label>
      <label className={labelClass}>Birthday *<input type="date" className={inputClass} value={form.birthday} onChange={(e) => update("birthday", e.target.value)} />{fieldError(formErrors, "birthday")}</label>
      <label className={labelClass}>Contact number *<input className={inputClass} value={form.contactNumber} onChange={(e) => update("contactNumber", e.target.value)} />{fieldError(formErrors, "contactNumber")}</label>
      <label className={labelClass}>Emergency contact *<input className={inputClass} value={form.emergencyContact} onChange={(e) => update("emergencyContact", e.target.value)} />{fieldError(formErrors, "emergencyContact")}</label>
      <label className={labelClass}>Gender *<select className={inputClass} value={form.gender} onChange={(e) => update("gender", e.target.value)}><option value="">Select gender</option><option>Male</option><option>Female</option><option>Prefer not to say</option></select>{fieldError(formErrors, "gender")}</label>
      <label className={labelClass}>Parent/guardian name *<input className={inputClass} value={form.parentGuardianName} onChange={(e) => update("parentGuardianName", e.target.value)} />{fieldError(formErrors, "parentGuardianName")}</label>
      <label className={`${labelClass} md:col-span-2`}>Address *<input className={inputClass} value={form.address} onChange={(e) => update("address", e.target.value)} />{fieldError(formErrors, "address")}</label>
      <label className={labelClass}>District *<select className={inputClass} value={form.district} onChange={(e) => update("district", e.target.value)}><option>ISED</option><option>ISIED</option></select>{fieldError(formErrors, "district")}</label>
      <label className={labelClass}>Local church *<select className={inputClass} value={form.localChurchId} onChange={(e) => update("localChurchId", e.target.value)}><option value="">Select local church</option>{churches.map((church) => <option key={church.id} value={church.id}>{church.name}</option>)}</select>{fieldError(formErrors, "localChurchId")}</label>
      <label className={labelClass}>Professing member *<select className={inputClass} value={form.professingMember} onChange={(e) => update("professingMember", e.target.value)}><option value="">Select answer</option><option>Yes</option><option>No</option></select>{fieldError(formErrors, "professingMember")}</label>
      <label className={labelClass}>Confirmation class year<input className={inputClass} value={form.confirmationClassYear} onChange={(e) => update("confirmationClassYear", e.target.value)} /></label>
      <label className={labelClass}>Confirmation class status *<select className={inputClass} value={form.confirmationClassStatus} onChange={(e) => update("confirmationClassStatus", e.target.value)}><option>Not Started</option><option>Ongoing</option><option>Completed</option><option>Dropped</option></select>{fieldError(formErrors, "confirmationClassStatus")}</label>
      <label className={labelClass}>Activity status *<select className={inputClass} value={form.activityStatus} onChange={(e) => update("activityStatus", e.target.value)}><option>Active</option><option>Inactive</option></select>{fieldError(formErrors, "activityStatus")}</label>
      <button className="md:col-span-2 flex justify-center items-center gap-2 rounded-xl bg-blue-700 text-white py-2 text-sm">{editingId ? <Save style={{ width: 14, height: 14 }} /> : <Plus style={{ width: 14, height: 14 }} />} {editingId ? "Resubmit Application" : "Submit Application"}</button>
    </form>
    {members.length === 0 ? <EmptyState label="No member applications yet." /> : <div className="bg-white rounded-2xl p-5 border border-slate-100 space-y-2">{members.map((member) => <div key={member.id} className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm"><span>{member.name} - {member.local_church_name}</span><span>{member.review_status}</span>{["Pending", "Rejected"].includes(member.review_status) && <button onClick={() => edit(member)} className="text-blue-700">Edit</button>}</div>)}</div>}
  </div>;
}

export { LocalChurchMembers };
