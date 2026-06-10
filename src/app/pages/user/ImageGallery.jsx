import { useState } from "react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/DataState";
import { ImageLightbox } from "../../components/ImageLightbox";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { listImageSubmissions } from "../../lib/supabaseServices";

function ImageGallery() {
  const {
    data: images,
    loading,
    error,
  } = useSupabaseData(() => listImageSubmissions(), []);
  const [viewer, setViewer] = useState(null);
  const approved = images.filter((image) => image.status === "Approved");
  if (loading) return <LoadingState label="Loading gallery..." />;
  return (
    <div className="space-y-5">
      <div>
        <h1
          className="text-slate-900"
          style={{ fontSize: "22px", fontWeight: 700 }}
        >
          Image Gallery
        </h1>
        <p className="text-slate-500 text-sm">
          Approved community image submissions
        </p>
      </div>
      <ErrorState message={error} />
      {approved.length === 0 ? (
        <EmptyState label="No approved images yet." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {approved.map((image) => (
            <div
              key={image.id}
              className="bg-white rounded-2xl overflow-hidden border border-slate-100"
            >
              <button
                type="button"
                onClick={() =>
                  setViewer({
                    src: image.image_url,
                    alt: image.caption || "Gallery image",
                  })
                }
                className="block w-full bg-slate-100"
              >
                <img
                  src={image.image_url}
                  alt={image.caption || "Gallery image"}
                  className="w-full max-h-80 object-contain"
                />
              </button>
              <div className="p-4">
                <p className="text-sm" style={{ fontWeight: 700 }}>
                  {image.caption || "No caption"}
                </p>
                <p className="text-xs text-slate-500">
                  {image.events?.title || "No event"} -{" "}
                  {image.local_churches?.name || "No church"}
                </p>
                <p className="text-xs text-slate-500">
                  Uploaded by {image.submitted_by_profile?.full_name || "Unknown user"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      <ImageLightbox image={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}

export { ImageGallery };
