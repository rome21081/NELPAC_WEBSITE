import { FileText } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { listPosts } from "../../lib/supabaseServices";

function PostPlaceholder() {
  return <div className="mb-3 flex h-40 w-full items-center justify-center rounded-xl bg-slate-100 text-slate-400">
    <div className="text-center"><FileText className="mx-auto mb-2" style={{ width: 24, height: 24 }} /><p className="text-xs">No post image</p></div>
  </div>;
}

function UserPosts() {
  const { data: posts, loading, error } = useSupabaseData(() => listPosts({ publishedOnly: true }), []);
  if (loading) return <LoadingState label="Loading posts..." />;
  return <div className="space-y-5">
    <div><h1 className="text-slate-900" style={{ fontSize: "22px", fontWeight: 700 }}>Posts & News</h1><p className="text-slate-500 text-sm">Published announcements and activities</p></div>
    <ErrorState message={error} />
    {posts.length === 0 ? <EmptyState label="No published posts." /> : <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {posts.map((post) => <article key={post.id} className="bg-white rounded-2xl p-5 border border-slate-100">
        {post.image_url ? <img src={post.image_url} alt={post.title} className="mb-3 max-h-72 w-full rounded-xl object-contain bg-slate-100" /> : <PostPlaceholder />}
        <div className="flex justify-between gap-3"><h2 style={{ fontWeight: 700 }}>{post.title}</h2><span className="text-xs bg-slate-100 rounded-full px-2 py-1">{post.category}</span></div>
        <p className="text-slate-500 text-xs mt-1">{post.published_at?.slice(0, 10)}</p>
        <p className="text-slate-600 text-sm mt-3">{post.body}</p>
      </article>)}
    </div>}
  </div>;
}

export { UserPosts };
