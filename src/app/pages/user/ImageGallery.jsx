import { useMemo, useState } from "react";
import { CalendarDays, Images, MapPin, UserRound } from "lucide-react";
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
  const approved = images.filter((image) => image.status === "Approved");
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
        <div
          className={
            viewMode === "tiles"
              ? "grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
              : "space-y-4"
          }
        >
          {approved.map((image) => (
            <article
              key={image.id}
              className={`overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-lg ${viewMode === "content" ? "md:grid md:grid-cols-[20rem_1fr]" : ""}`}
            >
              <button
                type="button"
                onClick={() =>
                  setViewer({
                    src: image.image_url,
                    alt: image.caption || "Gallery image",
                  })
                }
                className={`group block w-full overflow-hidden bg-slate-100 ${viewMode === "content" ? "h-full min-h-60" : "h-64"}`}
              >
                <img
                  src={image.image_url}
                  alt={image.caption || "Gallery image"}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              </button>
              <div className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-black leading-snug text-slate-950">
                    {image.caption || "Community moment"}
                  </h2>
                  <Images size={17} className="shrink-0 text-violet-600" />
                </div>
                <div className="mt-4 space-y-2 text-xs font-semibold text-slate-500">
                  <p className="flex items-center gap-2">
                    <CalendarDays size={14} />{" "}
                    {image.events?.title || "Community upload"}
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin size={14} />{" "}
                    {image.local_churches?.name || "NELPAC community"}
                  </p>
                  <p className="flex items-center gap-2">
                    <UserRound size={14} />{" "}
                    {getProfileDisplayName(image.profiles, "") ||
                      uploaderById.get(image.submitted_by) ||
                      "Community member"}
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
        </div>
      )}
      <ImageLightbox image={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}

export { ImageGallery };
