import { useState } from "react";
import { CalendarDays, ClipboardPenLine, MapPin } from "lucide-react";
import { Link } from "react-router";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/DataState";
import { ImageLightbox } from "../../components/ImageLightbox";
import { listEvents } from "../../lib/supabaseServices";
import { useSupabaseData } from "../../lib/useSupabaseData";

function ImagePlaceholder() {
  return (
    <div className="flex h-48 w-full items-center justify-center bg-slate-100 text-slate-400">
      <div className="text-center">
        <CalendarDays className="mx-auto mb-2" size={27} />
        <p className="text-xs font-semibold">No event image</p>
      </div>
    </div>
  );
}

function UserEvents({ embedded = false, viewMode = "tiles" }) {
  const {
    data: events,
    loading,
    error,
  } = useSupabaseData(() => listEvents(), []);
  const [viewer, setViewer] = useState(null);
  const visible = events.filter((event) =>
    ["Published", "Completed"].includes(event.status),
  );
  if (loading) return <LoadingState label="Loading events..." />;

  return (
    <div className="space-y-5">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-black text-slate-900">Events</h1>
          <p className="text-sm text-slate-500">Published NELPAC events</p>
        </div>
      )}
      <ErrorState message={error} />
      {visible.length === 0 ? (
        <EmptyState label="No published events." />
      ) : (
        <div
          className={
            viewMode === "tiles"
              ? "grid gap-5 md:grid-cols-2 xl:grid-cols-3"
              : "space-y-4"
          }
        >
          {visible.map((event) => (
            <article
              key={event.id}
              className={`overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${viewMode === "content" ? "md:grid md:grid-cols-[18rem_1fr]" : ""}`}
            >
              {event.image_url ? (
                <button
                  type="button"
                  onClick={() =>
                    setViewer({ src: event.image_url, alt: event.title })
                  }
                  className={`block w-full bg-slate-100 ${viewMode === "content" ? "h-full min-h-56" : "h-52"}`}
                >
                  <img
                    src={event.image_url}
                    alt={event.title}
                    className="h-full w-full object-cover"
                  />
                </button>
              ) : (
                <ImagePlaceholder />
              )}
              <div className="flex flex-col p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-black leading-snug text-slate-950">
                    {event.title}
                  </h2>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600">
                    {event.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={14} /> {event.event_date}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={14} /> {event.venue || "Venue TBA"}
                  </span>
                </div>
                <p
                  className={`mt-4 text-sm leading-6 text-slate-600 ${viewMode === "tiles" ? "line-clamp-3" : "whitespace-pre-line"}`}
                >
                  {event.description || "No description provided."}
                </p>
                {event.status === "Published" &&
                  event.pre_registration_enabled && (
                    <Link
                      to={`/user/forms?type=registration&event=${event.id}`}
                      className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-blue-800"
                    >
                      <ClipboardPenLine size={17} /> Pre-Register · ₱
                      {Number(event.registration_fee).toLocaleString()}
                    </Link>
                  )}
              </div>
            </article>
          ))}
        </div>
      )}
      <ImageLightbox image={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}

export { UserEvents };
