import { useEffect, useState } from "react";
import { Edit2, Save, UserRound, X } from "lucide-react";
import { useSearchParams } from "react-router";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/DataState";
import { useAuth } from "../../lib/authContext";
import {
  buildFullName,
  getProfileDisplayName,
  normalizeNamePart,
} from "../../lib/profileNames";
import {
  isValidPhilippineMobile,
  normalizePhilippineMobile,
  philippineMobileError,
  philippineMobileInputProps,
} from "../../lib/phoneNumbers";
import {
  getMyMembers,
  listLocalChurches,
  listPointBalances,
  updateMyProfile,
  uploadProfileAvatar,
} from "../../lib/supabaseServices";
import { supabase } from "../../lib/supabaseClient";
import { useSupabaseData } from "../../lib/useSupabaseData";

const emptyNameFields = { first_name: "", middle_name: "", last_name: "" };
const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 read-only:bg-slate-50 read-only:text-slate-500";

function UserProfile() {
  const { user, profile, refreshProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const mustCompleteName = searchParams.get("completeName") === "1";
  const { data, loading, error } = useSupabaseData(async () => {
    const [members, balances, churches] = await Promise.all([
      getMyMembers(user.id),
      listPointBalances(),
      listLocalChurches({ activeOnly: true }),
    ]);
    return [{ members, balances, churches }];
  }, [user?.id]);
  const [editing, setEditing] = useState(mustCompleteName);
  const [form, setForm] = useState({
    ...emptyNameFields,
    contact_number: "",
    local_church_id: "",
    avatar_url: "",
    avatarFile: null,
  });
  const [notice, setNotice] = useState({ type: "", text: "" });
  const [saving, setSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    setForm((current) => ({
      ...current,
      contact_number: profile.contact_number || "",
      local_church_id: profile.local_church_id || "",
      avatar_url: profile.avatar_url || "",
      avatarFile: null,
    }));
  }, [profile]);

  useEffect(() => {
    if (mustCompleteName) setEditing(true);
  }, [mustCompleteName]);

  if (loading) return <LoadingState label="Loading profile..." />;
  const { members = [], balances = [], churches = [] } = data[0] || {};
  const member = members[0];
  const points =
    balances.find((balance) => balance.user_id === user.id)?.points_balance ||
    0;
  const displayName = getProfileDisplayName(profile);
  const selectedProfileChurch = churches.find(
    (church) => church.id === form.local_church_id,
  );

  const beginEdit = () => {
    setForm((current) => ({ ...current, ...emptyNameFields }));
    setNotice({ type: "", text: "" });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setNotice({ type: "", text: "" });
    setForm({
      ...emptyNameFields,
      contact_number: profile.contact_number || "",
      local_church_id: profile.local_church_id || "",
      avatar_url: profile.avatar_url || "",
      avatarFile: null,
    });
  };

  const update = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  const save = async (event) => {
    event.preventDefault();
    setNotice({ type: "", text: "" });
    const firstName = normalizeNamePart(form.first_name);
    const middleName = normalizeNamePart(form.middle_name);
    const lastName = normalizeNamePart(form.last_name);
    if (!firstName || !lastName) {
      setNotice({
        type: "error",
        text: "Please enter your first name and last name before continuing.",
      });
      return;
    }
    if (!isValidPhilippineMobile(form.contact_number)) {
      setNotice({
        type: "error",
        text: philippineMobileError,
      });
      return;
    }
    if (!form.local_church_id) {
      setNotice({ type: "error", text: "Please select your local church." });
      return;
    }
    const fullName = buildFullName(firstName, middleName, lastName);
    setSaving(true);
    try {
      let avatarUrl = form.avatar_url;
      if (form.avatarFile) {
        setNotice({
          type: "info",
          text: "Compressing and uploading profile photo...",
        });
        avatarUrl = await uploadProfileAvatar(form.avatarFile, user.id);
      }
      await updateMyProfile({
        full_name: fullName,
        contact_number: normalizePhilippineMobile(form.contact_number),
        local_church_id: form.local_church_id,
        avatar_url: avatarUrl,
      });
      await refreshProfile();
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("completeName");
      nextParams.delete("mandatory");
      setSearchParams(nextParams, { replace: true });
      setEditing(false);
      setForm((current) => ({
        ...current,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        avatarFile: null,
        avatar_url: avatarUrl,
      }));
      setNotice({
        type: "success",
        text: "Profile updated with your complete name.",
      });
    } catch (saveError) {
      setNotice({
        type: "error",
        text: saveError.message || "Unable to update profile.",
      });
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setNotice({ type: "", text: "" });
    if (passwordForm.password.length < 6)
      return setNotice({
        type: "error",
        text: "Password must be at least 6 characters.",
      });
    if (passwordForm.password !== passwordForm.confirmPassword)
      return setNotice({ type: "error", text: "Passwords do not match." });
    const { error: passwordError } = await supabase.auth.updateUser({
      password: passwordForm.password,
    });
    if (passwordError)
      return setNotice({
        type: "error",
        text: passwordError.message || "Unable to change password.",
      });
    setPasswordForm({ password: "", confirmPassword: "" });
    setNotice({ type: "success", text: "Password changed." });
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
            Account
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
            My Profile
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Keep your identity and account details accurate.
          </p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={beginEdit}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800"
          >
            <Edit2 size={15} /> Edit Profile
          </button>
        ) : !mustCompleteName ? (
          <button
            type="button"
            onClick={cancelEdit}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-white"
          >
            <X size={15} /> Cancel
          </button>
        ) : null}
      </header>

      {mustCompleteName && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 shadow-sm"
        >
          <strong className="block">Profile update required</strong>
          <span className="mt-1 block text-red-800">
            Complete all required profile details to continue using the NELPAC
            System. Other user pages are locked until this is completed.
          </span>
        </div>
      )}
      <ErrorState
        message={error || (notice.type === "error" ? notice.text : "")}
      />
      {notice.text && notice.type !== "error" && (
        <p
          className={`rounded-xl border p-3 text-sm ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}
        >
          {notice.text}
        </p>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <form onSubmit={save} className="grid gap-6 lg:grid-cols-[10rem_1fr]">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl bg-slate-100 text-3xl font-black text-slate-500">
              {form.avatar_url ? (
                <img
                  src={form.avatar_url}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                displayName.charAt(0).toUpperCase()
              )}
            </div>
            {editing && (
              <label className="mt-3 cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                Change photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    update("avatarFile", event.target.files?.[0] || null)
                  }
                  className="sr-only"
                />
              </label>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm font-bold text-blue-950">
                Current saved name: {displayName}
              </p>
              <p className="mt-1 text-xs leading-5 text-blue-700">
                Update Your{" "}
                <strong>Full name.</strong> 
              </p>
            </div>
            <label className="text-sm font-semibold text-slate-600">
              First Name <span className="text-red-500">*</span>
              <input
                required={editing}
                readOnly={!editing}
                autoComplete="given-name"
                placeholder={
                  editing ? "Enter first name" : "Click Edit Profile to enter"
                }
                className={inputClass}
                value={form.first_name}
                onChange={(event) => update("first_name", event.target.value)}
              />
            </label>
            <label className="text-sm font-semibold text-slate-600">
              Middle Name{" "}
              <span className="font-normal text-slate-400">(optional)</span>
              <input
                readOnly={!editing}
                autoComplete="additional-name"
                placeholder={editing ? "Enter middle name" : "Optional"}
                className={inputClass}
                value={form.middle_name}
                onChange={(event) => update("middle_name", event.target.value)}
              />
            </label>
            <label className="text-sm font-semibold text-slate-600">
              Last Name <span className="text-red-500">*</span>
              <input
                required={editing}
                readOnly={!editing}
                autoComplete="family-name"
                placeholder={
                  editing ? "Enter last name" : "Click Edit Profile to enter"
                }
                className={inputClass}
                value={form.last_name}
                onChange={(event) => update("last_name", event.target.value)}
              />
            </label>
            <label className="text-sm font-semibold text-slate-600">
              Contact number <span className="text-red-500">*</span>
              <input
                {...philippineMobileInputProps}
                required={editing}
                readOnly={!editing}
                className={inputClass}
                value={form.contact_number}
                onChange={(event) =>
                  update(
                    "contact_number",
                    normalizePhilippineMobile(event.target.value),
                  )
                }
              />
            </label>
            <label className="text-sm font-semibold text-slate-600">
              Local church <span className="text-red-500">*</span>
              <select
                required={editing}
                disabled={!editing}
                className={inputClass}
                value={form.local_church_id}
                onChange={(event) => update("local_church_id", event.target.value)}
              >
                <option value="">Select local church</option>
                {churches.map((church) => (
                  <option key={church.id} value={church.id}>
                    {church.name} - {church.district}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-slate-400">
                District: {selectedProfileChurch?.district || "Not selected"}
              </span>
            </label>
            <label className="text-sm font-semibold text-slate-600">
              Email
              <input
                readOnly
                className={inputClass}
                value={profile.email || ""}
              />
            </label>
            <div className="rounded-2xl bg-slate-950 p-4 text-white">
              <p className="text-xs text-slate-300">NELPAC One Card Balance</p>
              <p className="mt-1 text-3xl font-black">
                {points.toLocaleString()} pts
              </p>
            </div>
            {editing && (
              <button
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-extrabold text-white hover:bg-emerald-800 disabled:opacity-60 md:col-span-2"
              >
                <Save size={16} />{" "}
                {saving ? "Saving..." : "Save Profile Changes"}
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="mb-4 text-lg font-black text-slate-950">
          Local Church Member Details
        </h2>
        {!member ? (
          <EmptyState label="No member application found." />
        ) : (
          <div className="grid gap-4 text-sm md:grid-cols-3">
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
              [
                "Confirmation",
                `${member.confirmation_class_year || "No year"} - ${member.confirmation_class_status}`,
              ],
              ["Activity status", member.activity_status],
              ["Review status", member.review_status],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-400">{label}</p>
                <p className="mt-1 font-semibold text-slate-800">
                  {value || "-"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-4 flex items-center gap-2">
          <UserRound size={18} className="text-slate-500" />
          <h2 className="font-black text-slate-950">Account Security</h2>
        </div>
        <form onSubmit={changePassword} className="grid gap-3 md:grid-cols-3">
          <input
            type="password"
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            placeholder="New password"
            value={passwordForm.password}
            onChange={(event) =>
              setPasswordForm((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
          />
          <input
            type="password"
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            placeholder="Confirm new password"
            value={passwordForm.confirmPassword}
            onChange={(event) =>
              setPasswordForm((current) => ({
                ...current,
                confirmPassword: event.target.value,
              }))
            }
          />
          <button className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800">
            Change Password
          </button>
        </form>
      </section>
    </div>
  );
}

export { UserProfile };
