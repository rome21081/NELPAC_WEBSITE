import { CalendarDays, LayoutGrid, List, Newspaper } from "lucide-react";
import { useSearchParams } from "react-router";
import { UserEvents } from "./UserEvents";
import { UserPosts } from "./UserPosts";

function UserCommunity() {
  const [searchParams, setSearchParams] = useSearchParams();
  const section = searchParams.get("section") === "posts" ? "posts" : "events";
  const view = searchParams.get("view") === "content" ? "content" : "tiles";

  const update = (key, value) => {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-900 px-6 py-8 text-white sm:px-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">
            NELPAC Community
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Stay connected and informed
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Discover upcoming events, official announcements, news, and
            community activities in one organized place.
          </p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          <button
            type="button"
            onClick={() => update("section", "events")}
            className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${section === "events" ? "border-blue-300 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 hover:border-blue-200 hover:bg-slate-50"}`}
          >
            <span
              className={`rounded-xl p-3 ${section === "events" ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              <CalendarDays size={22} />
            </span>
            <span>
              <strong className="block text-slate-950">Events</strong>
              <small className="text-slate-500">
                Schedules, venues, and registration
              </small>
            </span>
          </button>
          <button
            type="button"
            onClick={() => update("section", "posts")}
            className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${section === "posts" ? "border-cyan-300 bg-cyan-50 ring-2 ring-cyan-100" : "border-slate-200 hover:border-cyan-200 hover:bg-slate-50"}`}
          >
            <span
              className={`rounded-xl p-3 ${section === "posts" ? "bg-cyan-700 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              <Newspaper size={22} />
            </span>
            <span>
              <strong className="block text-slate-950">
                Posts & Activities
              </strong>
              <small className="text-slate-500">
                Announcements, stories, and updates
              </small>
            </span>
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2 px-2 text-sm font-extrabold text-slate-800">
          {section === "events" ? (
            <CalendarDays size={17} className="text-blue-700" />
          ) : (
            <Newspaper size={17} className="text-cyan-700" />
          )}
          {section === "events"
            ? "Published Events"
            : "Community Posts & Activities"}
        </div>
        <div
          className="inline-flex rounded-xl bg-slate-100 p-1"
          aria-label="Display style"
        >
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

      {section === "events" ? (
        <UserEvents embedded viewMode={view} />
      ) : (
        <UserPosts embedded viewMode={view} />
      )}
    </div>
  );
}

export { UserCommunity };
