import { useState } from "react";
import { Archive, Edit2, Package, Plus, RotateCcw, X } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { useAuth } from "../../lib/authContext";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { listEvents, listMerchForms, listRewards, saveReward, uploadStorageImage } from "../../lib/supabaseServices";

const sizes = ["XS", "S", "M", "L", "XL", "XXL"];
const emptyForm = { name: "", description: "", reward_type: "Others", custom_type: "", merch_form_id: "", available_sizes: [], discount_percentage: 10, discount_event_id: "", discount_registration_types: ["Pre-Registration"], required_points: "", stock_quantity: 0, image_url: "", is_active: true };

function RewardsManagement() {
  const { profile } = useAuth();
  const { data, loading, error, reload } = useSupabaseData(() => Promise.all([listRewards(), listMerchForms(), listEvents()]), []);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rewardView, setRewardView] = useState("active");
  const [archivingId, setArchivingId] = useState("");
  const [rewards = [], merchForms = [], events = []] = data;
  const activeRewards = rewards.filter((reward) => reward.is_active !== false);
  const archivedRewards = rewards.filter((reward) => reward.is_active === false);
  const visibleRewards = rewardView === "archived" ? archivedRewards : activeRewards;

  const resetForm = () => {
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview("");
  };

  const chooseImage = (file) => {
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : form.image_url || "");
  };

  const editReward = (reward) => {
    setMessage("");
    setForm({
      id: reward.id,
      name: reward.name || "",
      description: reward.description || "",
      required_points: reward.required_points || "",
      stock_quantity: reward.stock_quantity ?? 0,
      image_url: reward.image_url || "",
      is_active: reward.is_active !== false,
      reward_type: reward.reward_type || "Others",
      custom_type: reward.custom_type || "",
      merch_form_id: reward.merch_form_id || "",
      available_sizes: reward.available_sizes || [],
      discount_percentage: reward.discount_percentage || 10,
      discount_event_id: reward.discount_event_id || "",
      discount_registration_types: reward.discount_registration_types || [],
      created_by: reward.created_by || profile.id,
    });
    setImageFile(null);
    setImagePreview(reward.image_url || "");
  };

  const saveConfirmed = async () => {
    setSaving(true);
    setMessage("");
    try {
      if (imageFile) setMessage("Compressing and uploading reward image...");
      const imageUrl = imageFile ? await uploadStorageImage("reward-images", imageFile, "rewards", profile.id) : form.image_url;
      await saveReward({
        ...form,
        image_url: imageUrl || null,
        required_points: Number(form.required_points),
        stock_quantity: Number(form.stock_quantity),
        created_by: form.created_by || profile.id,
        custom_type: form.reward_type === "Others" ? form.custom_type || null : null,
        merch_form_id: ["Shirt", "ID Lace"].includes(form.reward_type) ? form.merch_form_id || null : null,
        available_sizes: form.reward_type === "Shirt" ? form.available_sizes : [],
        discount_percentage: form.reward_type === "Discount" ? Number(form.discount_percentage) : null,
        discount_event_id: form.reward_type === "Discount" ? form.discount_event_id || null : null,
        discount_registration_types: form.reward_type === "Discount" ? form.discount_registration_types : [],
      });
      const wasEditing = Boolean(form.id);
      resetForm();
      await reload();
      setConfirmOpen(false);
      setMessage(wasEditing ? "Reward updated." : "Reward saved.");
    } catch (err) {
      setMessage(err.message || "Unable to save reward.");
    } finally {
      setSaving(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    if (form.reward_type === "Shirt" && !form.available_sizes.length) return setMessage("Unable to save: select at least one shirt size.");
    if (form.reward_type === "Discount" && (!form.discount_event_id || !form.discount_registration_types.length)) return setMessage("Unable to save: select an event and at least one registration type.");
    setConfirmOpen(true);
  };

  const toggleArchive = async (reward) => {
    const willArchive = reward.is_active !== false;
    setArchivingId(reward.id);
    setMessage("");
    try {
      await saveReward({ ...reward, is_active: !willArchive });
      await reload();
      setMessage(willArchive ? `${reward.name} archived and hidden from the active catalog.` : `${reward.name} restored to the active catalog.`);
    } catch (err) {
      setMessage(err.message || `Unable to ${willArchive ? "archive" : "restore"} reward.`);
    } finally {
      setArchivingId("");
    }
  };

  if (loading) return <LoadingState label="Loading rewards..." />;
  return <div className="space-y-5">
    <div><h1 className="text-slate-900" style={{ fontSize: "22px", fontWeight: 700 }}>Rewards Management</h1><p className="text-slate-500 text-sm">Manage redeemable rewards</p></div>
    <ErrorState message={error || (message.includes("Unable") ? message : "")} />
    {message && !message.includes("Unable") && <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">{message}</p>}
    <form onSubmit={submit} className="bg-white rounded-2xl p-5 border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
      <select className="border rounded-xl px-3 py-2 text-sm" value={form.reward_type} onChange={(e) => setForm((f) => ({ ...f, reward_type: e.target.value }))}><option>Shirt</option><option>ID Lace</option><option>Discount</option><option>Others</option></select>
      <input required className="border rounded-xl px-3 py-2 text-sm" placeholder="Reward name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      <input required type="number" min="1" className="border rounded-xl px-3 py-2 text-sm" placeholder="Required points" value={form.required_points} onChange={(e) => setForm((f) => ({ ...f, required_points: e.target.value }))} />
      <input required type="number" min="0" className="border rounded-xl px-3 py-2 text-sm" placeholder="Stock" value={form.stock_quantity} onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))} />
      {form.reward_type === "Others" && <input required className="border rounded-xl px-3 py-2 text-sm md:col-span-3" placeholder="Specify reward type" value={form.custom_type} onChange={(e) => setForm((f) => ({ ...f, custom_type: e.target.value }))} />}
      {["Shirt", "ID Lace"].includes(form.reward_type) && <label className="text-sm font-bold text-slate-700 md:col-span-3">Connect to Merch Pre-Order (optional)<select value={form.merch_form_id} onChange={(e) => { const selected = merchForms.find((item) => item.id === e.target.value); setForm((f) => ({ ...f, merch_form_id: e.target.value, name: selected?.title || f.name })); }} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal"><option value="">Manual reward</option>{merchForms.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
      {form.reward_type === "Shirt" && <div className="md:col-span-3 rounded-2xl border border-slate-200 p-4"><p className="text-sm font-bold text-slate-700">Available sizes</p><div className="mt-3 flex flex-wrap gap-2">{sizes.map((size) => <label key={size} className={`cursor-pointer rounded-xl border px-3 py-2 text-sm font-bold ${form.available_sizes.includes(size) ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500"}`}><input type="checkbox" className="sr-only" checked={form.available_sizes.includes(size)} onChange={() => setForm((f) => ({ ...f, available_sizes: f.available_sizes.includes(size) ? f.available_sizes.filter((item) => item !== size) : [...f.available_sizes, size] }))} />{size}</label>)}</div></div>}
      {form.reward_type === "Discount" && <div className="grid gap-3 md:col-span-3 md:grid-cols-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><label className="text-sm font-bold text-slate-700">Discount percentage<select value={form.discount_percentage} onChange={(e) => setForm((f) => ({ ...f, discount_percentage: e.target.value }))} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal">{Array.from({ length: 10 }, (_, index) => (index + 1) * 10).map((value) => <option key={value} value={value}>{value}%</option>)}</select></label><label className="text-sm font-bold text-slate-700">Applicable event<select required value={form.discount_event_id} onChange={(e) => setForm((f) => ({ ...f, discount_event_id: e.target.value }))} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal"><option value="">Select event</option>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label><div className="md:col-span-2 flex flex-wrap gap-3">{["Pre-Registration", "Onsite"].map((type) => <label key={type} className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.discount_registration_types.includes(type)} onChange={() => setForm((f) => ({ ...f, discount_registration_types: f.discount_registration_types.includes(type) ? f.discount_registration_types.filter((item) => item !== type) : [...f.discount_registration_types, type] }))} /> {type === "Onsite" ? "Onsite Registration" : type}</label>)}</div></div>}
      <label className="md:col-span-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        <span className="block mb-2" style={{ fontWeight: 700 }}>Merch / reward image</span>
        <input type="file" accept="image/*" className="block w-full file:mr-4 file:rounded-xl file:border-0 file:bg-blue-700 file:px-4 file:py-2 file:text-sm file:text-white" onChange={(e) => chooseImage(e.target.files?.[0] || null)} />
        {imagePreview && <img src={imagePreview} alt="Reward preview" className="mt-3 max-h-72 w-full rounded-xl object-contain bg-slate-100" />}
      </label>
      <input className="border rounded-xl px-3 py-2 text-sm md:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      <label className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600">Active / Claimable<input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} /></label>
      {form.id && <button type="button" onClick={resetForm} className="flex justify-center items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"><X style={{ width: 14, height: 14 }} /> Cancel Edit</button>}
      <button disabled={saving} className="flex justify-center items-center gap-2 rounded-xl bg-blue-700 px-3 py-2 text-white text-sm disabled:opacity-60"><Plus style={{ width: 14, height: 14 }} /> {saving ? "Saving..." : form.id ? "Update Reward" : "Save Reward"}</button>
    </form>
    <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-lg font-black text-slate-950">Reward catalog</h2><p className="text-sm text-slate-500">Inactive rewards stay archived and out of the active catalog.</p></div>
      <div className="inline-flex w-fit rounded-xl bg-slate-100 p-1">
        <button type="button" onClick={() => setRewardView("active")} className={`rounded-lg px-3 py-2 text-xs font-black transition ${rewardView === "active" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>Active {activeRewards.length}</button>
        <button type="button" onClick={() => setRewardView("archived")} className={`rounded-lg px-3 py-2 text-xs font-black transition ${rewardView === "archived" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Archived {archivedRewards.length}</button>
      </div>
    </section>
    {visibleRewards.length === 0 ? <EmptyState label={rewardView === "archived" ? "No archived rewards." : "No active rewards yet."} /> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {visibleRewards.map((reward) => <div key={reward.id} className={`bg-white rounded-2xl p-5 border ${reward.is_active === false ? "border-slate-200 opacity-90" : "border-slate-100"}`}>
        {reward.image_url ? <img src={reward.image_url} alt={reward.name} className="mb-3 max-h-56 w-full rounded-xl object-contain bg-slate-100" /> : <Package className="text-blue-700 mb-3" />}
        <p className="text-xs font-black uppercase tracking-wide text-blue-600">{reward.reward_type || "Reward"}</p><h2 className="text-slate-900" style={{ fontWeight: 700 }}>{reward.name}</h2>
        <p className="text-slate-500 text-sm">{reward.description || "No description"}</p>
        <div className="flex justify-between mt-4 text-sm"><span>{reward.required_points} pts</span><span>{reward.stock_quantity} stock</span><span>{reward.is_active ? "Active" : "Inactive"}</span></div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => editReward(reward)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600"><Edit2 style={{ width: 14, height: 14 }} /> Edit</button>
          <button type="button" disabled={archivingId === reward.id} onClick={() => toggleArchive(reward)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold disabled:opacity-50 ${reward.is_active === false ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>{reward.is_active === false ? <RotateCcw size={14} /> : <Archive size={14} />} {archivingId === reward.id ? "Saving..." : reward.is_active === false ? "Restore" : "Archive"}</button>
        </div>
      </div>)}
    </div>}
    {confirmOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-slate-900" style={{ fontWeight: 800 }}>{form.id ? "Update reward?" : "Create reward?"}</h2>
        <p className="mt-2 text-sm text-slate-600">This will save the merch/reward details, stock, points, active status, and image to Supabase.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button disabled={saving} onClick={() => setConfirmOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm">Cancel</button>
          <button disabled={saving} onClick={saveConfirmed} className="rounded-xl bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-60">{saving ? "Saving..." : "Confirm"}</button>
        </div>
      </div>
    </div>}
  </div>;
}

export { RewardsManagement };
