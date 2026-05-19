import { useState } from "react";
import { Edit2, Package, Plus, X } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { useAuth } from "../../lib/authContext";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { listRewards, saveReward, uploadStorageImage } from "../../lib/supabaseServices";

const emptyForm = { name: "", description: "", required_points: "", stock_quantity: 0, image_url: "", is_active: true };

function RewardsManagement() {
  const { profile } = useAuth();
  const { data: rewards, loading, error, reload } = useSupabaseData(() => listRewards(), []);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

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
    setConfirmOpen(true);
  };

  if (loading) return <LoadingState label="Loading rewards..." />;
  return <div className="space-y-5">
    <div><h1 className="text-slate-900" style={{ fontSize: "22px", fontWeight: 700 }}>Rewards Management</h1><p className="text-slate-500 text-sm">Manage redeemable rewards</p></div>
    <ErrorState message={error || (message.includes("Unable") ? message : "")} />
    {message && !message.includes("Unable") && <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">{message}</p>}
    <form onSubmit={submit} className="bg-white rounded-2xl p-5 border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
      <input required className="border rounded-xl px-3 py-2 text-sm" placeholder="Reward name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      <input required type="number" min="1" className="border rounded-xl px-3 py-2 text-sm" placeholder="Required points" value={form.required_points} onChange={(e) => setForm((f) => ({ ...f, required_points: e.target.value }))} />
      <input required type="number" min="0" className="border rounded-xl px-3 py-2 text-sm" placeholder="Stock" value={form.stock_quantity} onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))} />
      <label className="md:col-span-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        <span className="block mb-2" style={{ fontWeight: 700 }}>Merch / reward image</span>
        <input type="file" accept="image/*" className="block w-full file:mr-4 file:rounded-xl file:border-0 file:bg-blue-700 file:px-4 file:py-2 file:text-sm file:text-white" onChange={(e) => chooseImage(e.target.files?.[0] || null)} />
        {imagePreview && <img src={imagePreview} alt="Reward preview" className="mt-3 max-h-72 w-full rounded-xl object-contain bg-slate-100" />}
      </label>
      <input className="border rounded-xl px-3 py-2 text-sm md:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} /> Active</label>
      {form.id && <button type="button" onClick={resetForm} className="flex justify-center items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"><X style={{ width: 14, height: 14 }} /> Cancel Edit</button>}
      <button disabled={saving} className="flex justify-center items-center gap-2 rounded-xl bg-blue-700 px-3 py-2 text-white text-sm disabled:opacity-60"><Plus style={{ width: 14, height: 14 }} /> {saving ? "Saving..." : form.id ? "Update Reward" : "Save Reward"}</button>
    </form>
    {rewards.length === 0 ? <EmptyState label="No rewards yet." /> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {rewards.map((reward) => <div key={reward.id} className="bg-white rounded-2xl p-5 border border-slate-100">
        {reward.image_url ? <img src={reward.image_url} alt={reward.name} className="mb-3 max-h-56 w-full rounded-xl object-contain bg-slate-100" /> : <Package className="text-blue-700 mb-3" />}
        <h2 className="text-slate-900" style={{ fontWeight: 700 }}>{reward.name}</h2>
        <p className="text-slate-500 text-sm">{reward.description || "No description"}</p>
        <div className="flex justify-between mt-4 text-sm"><span>{reward.required_points} pts</span><span>{reward.stock_quantity} stock</span><span>{reward.is_active ? "Active" : "Inactive"}</span></div>
        <button onClick={() => editReward(reward)} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"><Edit2 style={{ width: 14, height: 14 }} /> Edit</button>
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
