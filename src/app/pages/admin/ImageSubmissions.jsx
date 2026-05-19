import { useState } from "react";
import { Check, X } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { listImageSubmissions, reviewImageSubmission } from "../../lib/supabaseServices";

function ImageSubmissions() {
  const [filter, setFilter] = useState("All");
  const [message, setMessage] = useState("");
  const { data: images, loading, error, reload } = useSupabaseData(() => listImageSubmissions(), []);
  const filtered = filter === "All" ? images : images.filter((image) => image.status === filter);
  const review = async (id, status) => {
    setMessage("");
    try {
      await reviewImageSubmission(id, status);
      await reload();
    } catch (err) {
      setMessage(err.message || "Unable to review image.");
    }
  };
  if (loading) return <LoadingState label="Loading image submissions..." />;
  return <div className="space-y-5">
    <div><h1 className="text-slate-900" style={{ fontSize: "22px", fontWeight: 700 }}>Image Submissions</h1><p className="text-slate-500 text-sm">{images.filter((i) => i.status === "Pending").length} pending review</p></div>
    <ErrorState message={error || message} />
    <div className="flex gap-2">{["All", "Pending", "Approved", "Rejected"].map((tab) => <button key={tab} onClick={() => setFilter(tab)} className={`px-3 py-2 rounded-xl text-sm ${filter === tab ? "bg-blue-700 text-white" : "bg-white text-slate-600 border border-slate-200"}`}>{tab}</button>)}</div>
    {filtered.length === 0 ? <EmptyState label="No image submissions found." /> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {filtered.map((image) => <div key={image.id} className="bg-white rounded-2xl overflow-hidden border border-slate-100">
        <img src={image.image_url} alt={image.caption || "Submitted image"} className="w-full max-h-80 object-contain bg-slate-100" />
        <div className="p-4 space-y-2">
          <div className="flex justify-between"><p className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>{image.caption || "No caption"}</p><span className="text-xs rounded-full bg-slate-100 px-2 py-1">{image.status}</span></div>
          <p className="text-slate-500 text-xs">{image.events?.title || "No event"} · {image.local_churches?.name || "No church"}</p>
          {image.status === "Pending" && <div className="flex gap-2 pt-2"><button onClick={() => review(image.id, "Approved")} className="flex-1 rounded-xl bg-emerald-50 text-emerald-700 py-2 text-sm"><Check style={{ width: 14, height: 14, display: "inline" }} /> Approve</button><button onClick={() => review(image.id, "Rejected")} className="flex-1 rounded-xl bg-red-50 text-red-700 py-2 text-sm"><X style={{ width: 14, height: 14, display: "inline" }} /> Reject</button></div>}
        </div>
      </div>)}
    </div>}
  </div>;
}

export { ImageSubmissions };
