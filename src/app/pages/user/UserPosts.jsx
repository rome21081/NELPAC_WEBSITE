import { useState } from "react";
import { FileText } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { ImageLightbox } from "../../components/ImageLightbox";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { listPosts } from "../../lib/supabaseServices";

function PostPlaceholder() {
  return <div className="mb-3 flex h-40 w-full items-center justify-center rounded-xl bg-slate-100 text-slate-400">
    <div className="text-center"><FileText className="mx-auto mb-2" style={{ width: 24, height: 24 }} /><p className="text-xs">No post image</p></div>
  </div>;
}

function UserPosts() {
  const { data: posts, loading, error } = useSupabaseData(() => listPosts({ publishedOnly: true }), []);
  const [viewer, setViewer] = useState(null);
  const [expanded, setExpanded] = useState({});
  if (loading) return <LoadingState label="Loading posts..." />;
  return <div className="space-y-5">
    <div><h1 className="text-slate-900" style={{ fontSize: "22px", fontWeight: 700 }}>Posts & News</h1><p className="text-slate-500 text-sm">Published announcements and activities</p></div>
    <ErrorState message={error} />
    {posts.length === 0 ? <EmptyState label="No published posts." /> : <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {posts.map((post) => {
        const isExpanded = Boolean(expanded[post.id]);
        const body = post.body || "";
        const preview = body.length > 220 ? `${body.slice(0, 220).trim()}...` : body;
        return <article key={post.id} className="bg-white rounded-2xl p-5 border border-slate-100">
        {post.image_url ? <button type="button" onClick={() => setViewer({ src: post.image_url, alt: post.title })} className="mb-4 block w-full rounded-xl bg-slate-100"><img src={post.image_url} alt={post.title} className="max-h-72 w-full rounded-xl object-contain" /></button> : <PostPlaceholder />}
        <div className="flex items-start justify-between gap-3"><h2 className="text-slate-900" style={{ fontWeight: 800 }}>{post.title}</h2><span className="shrink-0 text-xs bg-slate-100 rounded-full px-2 py-1">{post.category}</span></div>
        <p className="text-slate-500 text-xs mt-1">{post.published_at?.slice(0, 10)}</p>
        <p className="text-slate-600 text-sm mt-3 leading-6 whitespace-pre-line">{isExpanded ? body : preview}</p>
        {body.length > 220 && <button onClick={() => setExpanded((current) => ({ ...current, [post.id]: !isExpanded }))} className="mt-3 rounded-xl border border-slate-200 px-3 py-2 text-sm text-blue-700">{isExpanded ? "See less" : "See more"}</button>}
      </article>;
      })}
    </div>}
    <ImageLightbox image={viewer} onClose={() => setViewer(null)} />
  </div>;
}

export { UserPosts };
