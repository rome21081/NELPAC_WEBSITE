import { useState } from "react";
import { Calendar } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { ImageLightbox } from "../../components/ImageLightbox";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { listEvents } from "../../lib/supabaseServices";

function ImagePlaceholder({ label }) {
  return <div className="mb-3 flex h-40 w-full items-center justify-center rounded-xl bg-slate-100 text-slate-400">
    <div className="text-center"><Calendar className="mx-auto mb-2" style={{ width: 24, height: 24 }} /><p className="text-xs">{label}</p></div>
  </div>;
}

function UserEvents() {
  const { data: events, loading, error } = useSupabaseData(() => listEvents(), []);
  const [viewer, setViewer] = useState(null);
  const visible = events.filter((event) => ["Published", "Completed"].includes(event.status));
  if (loading) return <LoadingState label="Loading events..." />;
  return <div className="space-y-5">
    <div><h1 className="text-slate-900" style={{ fontSize: "22px", fontWeight: 700 }}>Events</h1><p className="text-slate-500 text-sm">Published NELPAC events</p></div>
    <ErrorState message={error} />
    {visible.length === 0 ? <EmptyState label="No published events." /> : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {visible.map((event) => <div key={event.id} className="bg-white rounded-2xl p-5 border border-slate-100">
        {event.image_url ? <button type="button" onClick={() => setViewer({ src: event.image_url, alt: event.title })} className="mb-3 block w-full rounded-xl bg-slate-100"><img src={event.image_url} alt={event.title} className="max-h-72 w-full rounded-xl object-contain" /></button> : <ImagePlaceholder label="No event image" />}
        <h2 style={{ fontWeight: 700 }}>{event.title}</h2>
        <p className="text-slate-500 text-sm">{event.event_date} - {event.venue || "No venue"}</p>
        <p className="text-slate-600 text-sm mt-3">{event.description || "No description."}</p>
        <span className="inline-block mt-3 text-xs rounded-full bg-slate-100 px-2 py-1">{event.status}</span>
      </div>)}
    </div>}
    <ImageLightbox image={viewer} onClose={() => setViewer(null)} />
  </div>;
}

export { UserEvents };
