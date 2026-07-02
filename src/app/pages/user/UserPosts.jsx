import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp, Newspaper } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/DataState";
import { ImageLightbox } from "../../components/ImageLightbox";
import { listPosts } from "../../lib/supabaseServices";
import { useSupabaseData } from "../../lib/useSupabaseData";

function PostPlaceholder() {
  return (
    <div className="flex h-48 w-full items-center justify-center bg-slate-100 text-slate-400">
      <div className="text-center">
        <Newspaper className="mx-auto mb-2" size={27} />
        <p className="text-xs font-semibold">No post image</p>
      </div>
    </div>
  );
}

function UserPosts({ embedded = false, viewMode = "tiles" }) {
  const {
    data: posts,
    loading,
    error,
  } = useSupabaseData(() => listPosts({ publishedOnly: true }), []);
  const [viewer, setViewer] = useState(null);
  const [expanded, setExpanded] = useState({});
  if (loading) return <LoadingState label="Loading posts..." />;

  return (
    <div className="space-y-5">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            Posts & Activities
          </h1>
          <p className="text-sm text-slate-500">
            Published announcements and community updates
          </p>
        </div>
      )}
      <ErrorState message={error} />
      {posts.length === 0 ? (
        <EmptyState label="No published posts." />
      ) : (
        <div
          className={
            viewMode === "tiles"
              ? "grid gap-5 md:grid-cols-2 xl:grid-cols-3"
              : "space-y-4"
          }
        >
          {posts.map((post) => {
            const isExpanded = Boolean(expanded[post.id]);
            const body = post.body || "";
            const previewLength = viewMode === "content" ? 420 : 180;
            const preview =
              body.length > previewLength
                ? `${body.slice(0, previewLength).trim()}...`
                : body;
            return (
              <article
                key={post.id}
                className={`overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-lg ${viewMode === "content" ? "md:grid md:grid-cols-[18rem_1fr]" : ""}`}
              >
                {post.image_url ? (
                  <button
                    type="button"
                    onClick={() =>
                      setViewer({ src: post.image_url, alt: post.title })
                    }
                    className={`block w-full bg-slate-100 ${viewMode === "content" ? "h-full min-h-56" : "h-52"}`}
                  >
                    <img
                      src={post.image_url}
                      alt={post.title}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ) : (
                  <PostPlaceholder />
                )}
                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-black leading-snug text-slate-950">
                      {post.title}
                    </h2>
                    <span className="shrink-0 rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-cyan-800">
                      {post.category}
                    </span>
                  </div>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                    <CalendarDays size={13} />{" "}
                    {post.published_at?.slice(0, 10) || "Recently published"}
                  </p>
                  <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-600">
                    {isExpanded ? body : preview}
                  </p>
                  {body.length > previewLength && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((current) => ({
                          ...current,
                          [post.id]: !isExpanded,
                        }))
                      }
                      className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      {isExpanded ? (
                        <ChevronUp size={15} />
                      ) : (
                        <ChevronDown size={15} />
                      )}
                      {isExpanded ? "Show less" : "Read full post"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <ImageLightbox image={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}

export { UserPosts };
