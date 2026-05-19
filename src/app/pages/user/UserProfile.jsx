import { useEffect, useState } from "react";
import { Edit2, Save, X } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { useAuth } from "../../lib/authContext";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { getMyMembers, listPointBalances, updateMyProfile, uploadProfileAvatar } from "../../lib/supabaseServices";
import { supabase } from "../../lib/supabaseClient";

function UserProfile() {
  const { user, profile, refreshProfile } = useAuth();
  const { data, loading, error } = useSupabaseData(async () => {
    const [members, balances] = await Promise.all([getMyMembers(user.id), listPointBalances()]);
    return [{ members, balances }];
  }, [user?.id]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: "", contact_number: "", avatar_url: "", avatarFile: null });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ password: "", confirmPassword: "" });

  useEffect(() => {
    setForm({
      full_name: profile.full_name || "",
      contact_number: profile.contact_number || "",
      avatar_url: profile.avatar_url || "",
      avatarFile: null,
    });
  }, [profile]);

  if (loading) return <LoadingState label="Loading profile..." />;
  const { members = [], balances = [] } = data[0] || {};
  const member = members[0];
  const points = balances.find((balance) => balance.user_id === user.id)?.points_balance || 0;

  const cancelEdit = () => {
    setEditing(false);
    setMessage("");
    setForm({
      full_name: profile.full_name || "",
      contact_number: profile.contact_number || "",
      avatar_url: profile.avatar_url || "",
      avatarFile: null,
    });
  };

  const save = async (event) => {
    event.preventDefault();
    setMessage("");
    setSaving(true);
    try {
      let avatarUrl = form.avatar_url;
      if (form.avatarFile) {
        setMessage("Compressing and uploading profile photo...");
        avatarUrl = await uploadProfileAvatar(form.avatarFile, user.id);
      }
      await updateMyProfile({
        full_name: form.full_name,
        contact_number: form.contact_number,
        avatar_url: avatarUrl,
      });
      await refreshProfile();
      setEditing(false);
      setMessage("Profile updated.");
    } catch (err) {
      setMessage(err.message || "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setMessage("");
    if (passwordForm.password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }
    if (passwordForm.password !== passwordForm.confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    const { error: passwordError } = await supabase.auth.updateUser({ password: passwordForm.password });
    if (passwordError) {
      setMessage(passwordError.message || "Unable to change password.");
      return;
    }
    setPasswordForm({ password: "", confirmPassword: "" });
    setMessage("Password changed.");
  };

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-slate-900" style={{ fontSize: "22px", fontWeight: 700 }}>My Profile</h1>
        <p className="text-slate-500 text-sm">Profile details, member details, and One Card balance</p>
      </div>
      {!editing ? <button onClick={() => setEditing(true)} className="flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm text-white"><Edit2 style={{ width: 14, height: 14 }} /> Edit Profile</button> : <button onClick={cancelEdit} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600"><X style={{ width: 14, height: 14 }} /> Cancel</button>}
    </div>
    <ErrorState message={error || (message.includes("Unable") ? message : "")} />
    {message && !message.includes("Unable") && <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">{message}</p>}

    <section className="bg-white rounded-2xl p-5 border border-slate-100">
      <form onSubmit={save} className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="flex flex-col items-center text-center">
          <div className="h-24 w-24 overflow-hidden rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500" style={{ fontSize: "32px", fontWeight: 800 }}>
            {form.avatar_url ? <img src={form.avatar_url} alt="Profile" className="h-full w-full object-contain" /> : (profile.full_name || profile.email || "U").charAt(0).toUpperCase()}
          </div>
          {editing && <input type="file" accept="image/*" onChange={(e) => setForm((f) => ({ ...f, avatarFile: e.target.files?.[0] || null }))} className="mt-3 block w-full text-xs text-slate-600" />}
        </div>

        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm text-slate-600">Full name
            <input readOnly={!editing} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm read-only:bg-slate-50" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
          </label>
          <label className="text-sm text-slate-600">Contact number
            <input readOnly={!editing} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm read-only:bg-slate-50" value={form.contact_number} onChange={(e) => setForm((f) => ({ ...f, contact_number: e.target.value }))} />
          </label>
          <label className="text-sm text-slate-600">Email
            <input readOnly className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" value={profile.email || ""} />
          </label>
          <div className="rounded-2xl bg-blue-700 p-4 text-white">
            <p className="text-blue-100 text-xs">NELPAC One Card Balance</p>
            <p style={{ fontSize: "34px", fontWeight: 900 }}>{points.toLocaleString()} pts</p>
          </div>
          {editing && <button disabled={saving} className="md:col-span-2 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm text-white disabled:opacity-60"><Save style={{ width: 14, height: 14 }} /> {saving ? "Saving..." : "Save Profile Changes"}</button>}
        </div>
      </form>
    </section>

    <section className="bg-white rounded-2xl p-5 border border-slate-100">
      <h2 className="mb-3" style={{ fontWeight: 700 }}>Local Church Member Details</h2>
      {!member ? <EmptyState label="No member application found." /> : <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        {[
          ["Member name", member.name],
          ["Computed age", member.computed_age],
          ["Birthday", member.birthday],
          ["Gender", member.gender],
          ["Local church", member.local_church_name],
          ["District", member.district],
          ["Contact number", member.contact_number],
          ["Emergency contact", member.emergency_contact],
          ["Parent/guardian", member.parent_guardian_name],
          ["Professing member", member.professing_member],
          ["Confirmation", `${member.confirmation_class_year || "No year"} - ${member.confirmation_class_status}`],
          ["Activity status", member.activity_status],
          ["Review status", member.review_status],
        ].map(([label, value]) => <div key={label}><p className="text-slate-400 text-xs">{label}</p><p className="text-slate-800">{value || "-"}</p></div>)}
      </div>}
    </section>

    <section className="bg-white rounded-2xl p-5 border border-slate-100">
      <h2 className="mb-3" style={{ fontWeight: 700 }}>Change Password</h2>
      <form onSubmit={changePassword} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input type="password" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="New password" value={passwordForm.password} onChange={(e) => setPasswordForm((f) => ({ ...f, password: e.target.value }))} />
        <input type="password" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Confirm new password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))} />
        <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">Change Password</button>
      </form>
    </section>
  </div>;
}

export { UserProfile };
