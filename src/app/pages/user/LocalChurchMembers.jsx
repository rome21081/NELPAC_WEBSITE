import { useEffect, useState } from "react";
import { Plus, Save } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { useAuth } from "../../lib/authContext";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { getActiveLocalChurchesByDistrict } from "../../lib/localChurches";
import { createLocalChurchMember, saveMyMemberApplication } from "../../lib/localChurchMembers";
import { getMyMembers } from "../../lib/supabaseServices";

const emptyForm = { name: "", birthday: "", contactNumber: "", emergencyContact: "", gender: "", address: "", parentGuardianName: "", district: "ISED", localChurchId: "", professingMember: "No", confirmationClassYear: "", confirmationClassStatus: "Not Started", activityStatus: "Active" };
const inputClass = "w-full px-3 py-2 rounded-xl border border-slate-200 text-sm";

function LocalChurchMembers() {
  const { user } = useAuth();
  const { data: members, loading, error, reload } = useSupabaseData(() => getMyMembers(user.id), [user?.id]);
  const [churches, setChurches] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { getActiveLocalChurchesByDistrict(form.district).then(setChurches).catch(() => setChurches([])); }, [form.district]);
  const update = (field, value) => setForm((f) => ({ ...f, [field]: value, ...(field === "district" ? { localChurchId: "" } : {}) }));
  const submit = async (event) => {
    event.preventDefault();
    try {
      if (editingId) await saveMyMemberApplication(editingId, form);
      else await createLocalChurchMember(form, user.id);
      setForm(emptyForm);
      setEditingId("");
      await reload();
      setMessage("Member application saved for admin review.");
    } catch (err) {
      setMessage(err.message || "Unable to save member application.");
    }
  };
  const edit = (member) => {
    setEditingId(member.id);
    setForm({ name: member.name || "", birthday: member.birthday || "", contactNumber: member.contact_number || "", emergencyContact: member.emergency_contact || "", gender: member.gender || "", address: member.address || "", parentGuardianName: member.parent_guardian_name || "", district: member.district || "ISED", localChurchId: member.local_church_id || "", professingMember: member.professing_member || "No", confirmationClassYear: member.confirmation_class_year || "", confirmationClassStatus: member.confirmation_class_status || "Not Started", activityStatus: member.activity_status || "Active" });
  };
  if (loading) return <LoadingState label="Loading local church members..." />;
  return <div className="space-y-5"><div><h1 className="text-slate-900" style={{ fontSize: "22px", fontWeight: 700 }}>Local Church Members</h1><p className="text-slate-500 text-sm">Submit and manage your editable pending/rejected member applications</p></div><ErrorState message={error || (message.includes("Unable") ? message : "")} />{message && !message.includes("Unable") && <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">{message}</p>}<form onSubmit={submit} className="bg-white rounded-2xl p-5 border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3"><input required className={inputClass} placeholder="Name" value={form.name} onChange={(e) => update("name", e.target.value)} /><input required type="date" className={inputClass} value={form.birthday} onChange={(e) => update("birthday", e.target.value)} /><input className={inputClass} placeholder="Contact number" value={form.contactNumber} onChange={(e) => update("contactNumber", e.target.value)} /><input className={inputClass} placeholder="Emergency contact" value={form.emergencyContact} onChange={(e) => update("emergencyContact", e.target.value)} /><select className={inputClass} value={form.gender} onChange={(e) => update("gender", e.target.value)}><option value="">Gender</option><option>Male</option><option>Female</option><option>Prefer not to say</option></select><input className={inputClass} placeholder="Parent or guardian" value={form.parentGuardianName} onChange={(e) => update("parentGuardianName", e.target.value)} /><input className={`${inputClass} md:col-span-2`} placeholder="Address" value={form.address} onChange={(e) => update("address", e.target.value)} /><select className={inputClass} value={form.district} onChange={(e) => update("district", e.target.value)}><option>ISED</option><option>ISIED</option></select><select required className={inputClass} value={form.localChurchId} onChange={(e) => update("localChurchId", e.target.value)}><option value="">Select local church</option>{churches.map((church) => <option key={church.id} value={church.id}>{church.name}</option>)}</select><select className={inputClass} value={form.professingMember} onChange={(e) => update("professingMember", e.target.value)}><option>Yes</option><option>No</option></select><input className={inputClass} placeholder="Confirmation class year" value={form.confirmationClassYear} onChange={(e) => update("confirmationClassYear", e.target.value)} /><select className={inputClass} value={form.confirmationClassStatus} onChange={(e) => update("confirmationClassStatus", e.target.value)}><option>Not Started</option><option>Ongoing</option><option>Completed</option><option>Dropped</option></select><select className={inputClass} value={form.activityStatus} onChange={(e) => update("activityStatus", e.target.value)}><option>Active</option><option>Inactive</option></select><button className="md:col-span-2 flex justify-center items-center gap-2 rounded-xl bg-blue-700 text-white py-2 text-sm">{editingId ? <Save style={{ width: 14, height: 14 }} /> : <Plus style={{ width: 14, height: 14 }} />} {editingId ? "Resubmit Application" : "Submit Application"}</button></form>{members.length === 0 ? <EmptyState label="No member applications yet." /> : <div className="bg-white rounded-2xl p-5 border border-slate-100 space-y-2">{members.map((member) => <div key={member.id} className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm"><span>{member.name} · {member.local_church_name}</span><span>{member.review_status}</span>{["Pending", "Rejected"].includes(member.review_status) && <button onClick={() => edit(member)} className="text-blue-700">Edit</button>}</div>)}</div>}</div>;
}

export { LocalChurchMembers };
