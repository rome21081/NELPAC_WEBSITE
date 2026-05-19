import { useState } from "react";
import { Edit2, Plus, X } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { useAuth } from "../../lib/authContext";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { listPosts, savePost, uploadStorageImage } from "../../lib/supabaseServices";

const emptyForm = { title: "", body: "", category: "Announcement", status: "Draft", featured: false, image_url: "" };

function PostsManagement() {
  const { profile } = useAuth();
  const { data: posts, loading, error, reload } = useSupabaseData(() => listPosts(), []);
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

  const editPost = (post) => {
    setMessage("");
    setForm({
      id: post.id,
      title: post.title || "",
      body: post.body || "",
      category: post.category || "Announcement",
      status: post.status || "Draft",
      featured: Boolean(post.featured),
      published_at: post.published_at || null,
      image_url: post.image_url || "",
      created_by: post.created_by || profile.id,
    });
    setImageFile(null);
    setImagePreview(post.image_url || "");
  };

  const saveConfirmed = async () => {
    setSaving(true);
    setMessage("");
    try {
      const imageUrl = imageFile ? await uploadStorageImage("post-images", imageFile, "posts", profile.id) : form.image_url;
      await savePost({ ...form, image_url: imageUrl || null, created_by: form.created_by || profile.id });
      const wasEditing = Boolean(form.id);
      resetForm();
      await reload();
      setConfirmOpen(false);
      setMessage(wasEditing ? "Post updated." : "Post saved.");
    } catch (err) {
      setMessage(err.message || "Unable to save post.");
    } finally {
      setSaving(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    setConfirmOpen(true);
  };

  if (loading) return <LoadingState label="Loading posts..." />;
  return <div className="space-y-5">
    <div><h1 className="text-slate-900" style={{ fontSize: "22px", fontWeight: 700 }}>Posts & Announcements</h1><p className="text-slate-500 text-sm">{posts.length} total posts</p></div>
    <ErrorState message={error || (message.includes("Unable") ? message : "")} />
    {message && !message.includes("Unable") && <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">{message}</p>}
    <form onSubmit={submit} className="bg-white rounded-2xl p-5 border border-slate-100 grid gap-3">
      <input required className="border rounded-xl px-3 py-2 text-sm" placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
      <label className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        <span className="block mb-2" style={{ fontWeight: 700 }}>Post / activity image</span>
        <input type="file" accept="image/*" className="block w-full file:mr-4 file:rounded-xl file:border-0 file:bg-blue-700 file:px-4 file:py-2 file:text-sm file:text-white" onChange={(e) => chooseImage(e.target.files?.[0] || null)} />
        {imagePreview && <img src={imagePreview} alt="Post preview" className="mt-3 max-h-72 w-full rounded-xl object-contain bg-slate-100" />}
      </label>
      <textarea required className="border rounded-xl px-3 py-2 text-sm min-h-28" placeholder="Body" value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <input className="border rounded-xl px-3 py-2 text-sm" placeholder="Category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
        <select className="border rounded-xl px-3 py-2 text-sm" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}><option>Draft</option><option>Published</option><option>Archived</option></select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.featured} onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))} /> Featured</label>
        {form.id && <button type="button" onClick={resetForm} className="flex justify-center items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"><X style={{ width: 14, height: 14 }} /> Cancel</button>}
        <button disabled={saving} className="flex justify-center items-center gap-2 rounded-xl bg-blue-700 px-3 py-2 text-white text-sm disabled:opacity-60"><Plus style={{ width: 14, height: 14 }} /> {saving ? "Saving..." : form.id ? "Update" : "Save"}</button>
      </div>
    </form>
    {posts.length === 0 ? <EmptyState label="No posts yet." /> : <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {posts.map((post) => <article key={post.id} className="bg-white rounded-2xl p-5 border border-slate-100">
        {post.image_url && <img src={post.image_url} alt={post.title} className="mb-3 max-h-64 w-full rounded-xl object-contain bg-slate-100" />}
        <div className="flex justify-between"><h2 className="text-slate-900" style={{ fontWeight: 700 }}>{post.title}</h2><span className="text-xs bg-slate-100 rounded-full px-2 py-1">{post.status}</span></div>
        <p className="text-slate-500 text-xs mt-1">{post.category} - {post.published_at?.slice(0, 10) || "Unpublished"}</p>
        <p className="text-slate-600 text-sm mt-3 line-clamp-3">{post.body}</p>
        <button onClick={() => editPost(post)} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"><Edit2 style={{ width: 14, height: 14 }} /> Edit</button>
      </article>)}
    </div>}
    {confirmOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-slate-900" style={{ fontWeight: 800 }}>{form.id ? "Update post?" : "Create post?"}</h2>
        <p className="mt-2 text-sm text-slate-600">This will save the post details, status, and image to Supabase.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button disabled={saving} onClick={() => setConfirmOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm">Cancel</button>
          <button disabled={saving} onClick={saveConfirmed} className="rounded-xl bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-60">{saving ? "Saving..." : "Confirm"}</button>
        </div>
      </div>
    </div>}
  </div>;
}

export { PostsManagement };
