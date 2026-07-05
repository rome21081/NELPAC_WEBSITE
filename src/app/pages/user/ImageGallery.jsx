import { useMemo, useState } from "react";
import { CalendarDays, Filter, Images, MapPin, UserRound, X } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/DataState";
import { ImageLightbox } from "../../components/ImageLightbox";
import { getProfileDisplayName } from "../../lib/profileNames";
import { listImageSubmissions, listProfiles } from "../../lib/supabaseServices";
import { useSupabaseData } from "../../lib/useSupabaseData";

function ImageGallery({ embedded = false, viewMode = "tiles" }) {
  const {
    data: images,
    loading: imagesLoading,
    error: imagesError,
  } = useSupabaseData(() => listImageSubmissions(), []);
  const {
    data: profiles = [],
    loading: profilesLoading,
    error: profilesError,
  } = useSupabaseData(() => listProfiles(), []);
  const [viewer, setViewer] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState("all");
  const approved = images.filter((image) => image.status === "Approved");
  const eventOptions = useMemo(() => {
    const counts = new Map();
    approved.forEach((image) => {
      if (!image.event_id) return;
      const current = counts.get(image.event_id) || { id: image.event_id, title: image.events?.title || "Untitled event", count: 0 };
      current.count += 1;
      counts.set(image.event_id, current);
    });
    return [...counts.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [approved]);
  const visibleImages = selectedEvent === "all" ? approved : approved.filter((image) => String(image.event_id) === selectedEvent);
  const uploaderById = useMemo(
    () =>
      new Map(
        (profiles || []).map((profile) => [
          profile.id,
          getProfileDisplayName(profile),
        ]),
      ),
    [profiles],
  );
  const loading = imagesLoading || profilesLoading;
  const error = imagesError || profilesError;

  if (loading) return <LoadingState label="Loading gallery..." />;
  return (
    <div className="space-y-5">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-black text-slate-900">Image Gallery</h1>
          <p className="text-sm text-slate-500">
            Approved community image submissions
          </p>
        </div>
      )}
      <ErrorState message={error} />
      {approved.length === 0 ? (
        <EmptyState label="No approved images yet." />
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><Filter size={16} /></span><div><p className="text-sm font-black text-slate-900">Filter gallery by event</p><p className="text-xs text-slate-500">{visibleImages.length} of {approved.length} approved images</p></div></div>
              <div className="flex items-center gap-2">
                <select aria-label="Filter images by event" value={selectedEvent} onChange={(event) => setSelectedEvent(event.target.value)} className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 sm:min-w-56"><option value="all">All events ({approved.length})</option>{eventOptions.map((event) => <option key={event.id} value={event.id}>{event.title} ({event.count})</option>)}</select>
                {selectedEvent !== "all" && <button type="button" aria-label="Clear event filter" onClick={() => setSelectedEvent("all")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"><X size={16} /></button>}
              </div>
            </div>
            <div className="app-scrollbar mt-3 hidden gap-2 overflow-x-auto pb-1 sm:flex"><button type="button" onClick={() => setSelectedEvent("all")} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition ${selectedEvent === "all" ? "bg-violet-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>All events · {approved.length}</button>{eventOptions.map((event) => <button type="button" key={event.id} onClick={() => setSelectedEvent(String(event.id))} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition ${selectedEvent === String(event.id) ? "bg-violet-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{event.title} · {event.count}</button>)}</div>
          </section>
          {visibleImages.length === 0 ? <EmptyState label="No approved images are available for this event." /> : <div
            className={
              viewMode === "tiles"
                ? "grid grid-cols-2 gap-2.5 sm:gap-5 xl:grid-cols-3"
                : "space-y-4"
            }
          >
          {visibleImages.map((image) => (
            <article
              key={image.id}
              className={`min-w-0 overflow-hidden border border-slate-200 bg-white shadow-sm transition hover:shadow-lg ${viewMode === "content" ? "rounded-3xl md:grid md:grid-cols-[20rem_1fr]" : "rounded-2xl sm:rounded-3xl"}`}
            >
              <button
                type="button"
                onClick={() =>
                  setViewer({
                    src: image.image_url,
                    alt: image.caption || "Gallery image",
                  })
                }
                className={`group block w-full overflow-hidden bg-slate-100 ${viewMode === "content" ? "h-full min-h-60" : "aspect-square"}`}
              >
                <img
                  src={image.image_url}
                  alt={image.caption || "Gallery image"}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              </button>
              <div className={viewMode === "tiles" ? "p-3 sm:p-6" : "p-5 sm:p-6"}>
                <div className="flex items-start justify-between gap-3">
                  <h2 className={`line-clamp-2 font-black leading-snug text-slate-950 ${viewMode === "tiles" ? "text-xs sm:text-base" : ""}`}>
                    {image.caption || "Community moment"}
                  </h2>
                  <Images size={17} className={`shrink-0 text-violet-600 ${viewMode === "tiles" ? "hidden sm:block" : ""}`} />
                </div>
                <div className={`${viewMode === "tiles" ? "mt-2 sm:mt-4" : "mt-4"} space-y-2 text-xs font-semibold text-slate-500`}>
                  <p className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                    <CalendarDays size={14} />{" "}
                    <span className="truncate">{image.events?.title || "Community upload"}</span>
                  </p>
                  <p className={`items-center gap-2 ${viewMode === "tiles" ? "hidden sm:flex" : "flex"}`}>
                    <MapPin size={14} />{" "}
                    <span className="truncate">{image.local_churches?.name || "NELPAC community"}</span>
                  </p>
                  <p className={`items-center gap-2 ${viewMode === "tiles" ? "hidden sm:flex" : "flex"}`}>
                    <UserRound size={14} />{" "}
                    <span className="truncate">{getProfileDisplayName(image.profiles, "") ||
                      uploaderById.get(image.submitted_by) ||
                      "Community member"}</span>
                  </p>
                </div>
                {viewMode === "content" && (
                  <p className="mt-5 text-sm leading-6 text-slate-600">
                    Click the photo to open the full-size image.
                  </p>
                )}
              </div>
            </article>
          ))}
          ))}
        </div>}
        </>
      )}
      <ImageLightbox image={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}

export { ImageGallery };
