import { Images, LayoutGrid, List, Upload } from "lucide-react";
import { useSearchParams } from "react-router";
import { ImageGallery } from "./ImageGallery";
import { SubmitImage } from "./SubmitImage";

function UserGallery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const section =
    searchParams.get("section") === "submit" ? "submit" : "gallery";
  const view = searchParams.get("view") === "content" ? "content" : "tiles";

  const update = (key, value) => {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-700">
            Community Gallery
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            Moments from across NELPAC
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Browse approved community photos or share a meaningful moment for
            review.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            update("section", section === "submit" ? "gallery" : "submit")
          }
          className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold shadow-sm transition ${section === "submit" ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" : "bg-slate-950 text-white hover:bg-violet-800"}`}
        >
          {section === "submit" ? <Images size={18} /> : <Upload size={18} />}
          {section === "submit" ? "Back to Gallery" : "Submit Image"}
        </button>
      </header>

      {section === "gallery" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2 px-2 text-sm font-extrabold text-slate-800">
            <Images size={17} className="text-violet-700" /> Approved Images
          </div>
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => update("view", "tiles")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${view === "tiles" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              <LayoutGrid size={15} /> Tiles
            </button>
            <button
              type="button"
              onClick={() => update("view", "content")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${view === "content" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              <List size={15} /> Content
            </button>
          </div>
        </div>
      )}

      {section === "gallery" ? (
        <ImageGallery embedded viewMode={view} />
      ) : (
        <SubmitImage embedded />
      )}
    </div>
  );
}

export { UserGallery };
