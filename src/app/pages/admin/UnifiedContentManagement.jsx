import { CalendarDays, Newspaper } from "lucide-react";
import { useSearchParams } from "react-router";
import { EventsManagement } from "./EventsManagement";
import { PostsManagement } from "./PostsManagement";

function UnifiedContentManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const section = searchParams.get("section") === "posts" ? "posts" : "events";

  const chooseSection = (nextSection) => {
    const next = new URLSearchParams(searchParams);
    next.set("section", nextSection);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <header className="rounded-3xl bg-gradient-to-r from-slate-950 via-blue-950 to-cyan-950 p-6 text-white shadow-lg sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-200">
          Content Center
        </p>
        <h1 className="mt-2 text-2xl font-black sm:text-3xl">
          Events, posts, and activities
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          Create and manage public event information and community updates from
          one page. Choose a section below to show only the tools you need.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => chooseSection("events")}
            className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${section === "events" ? "border-blue-300 bg-white text-blue-950 shadow-lg" : "border-white/20 bg-white/10 hover:bg-white/15"}`}
          >
            <span
              className={`rounded-xl p-3 ${section === "events" ? "bg-blue-100 text-blue-700" : "bg-white/10"}`}
            >
              <CalendarDays size={23} />
            </span>
            <span>
              <strong className="block">Event Posts</strong>
              <small
                className={
                  section === "events" ? "text-blue-700" : "text-slate-300"
                }
              >
                Create events and control event availability
              </small>
            </span>
          </button>
          <button
            type="button"
            onClick={() => chooseSection("posts")}
            className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${section === "posts" ? "border-cyan-300 bg-white text-cyan-950 shadow-lg" : "border-white/20 bg-white/10 hover:bg-white/15"}`}
          >
            <span
              className={`rounded-xl p-3 ${section === "posts" ? "bg-cyan-100 text-cyan-700" : "bg-white/10"}`}
            >
              <Newspaper size={23} />
            </span>
            <span>
              <strong className="block">Posts & Activities</strong>
              <small
                className={
                  section === "posts" ? "text-cyan-700" : "text-slate-300"
                }
              >
                Publish announcements, news, and activities
              </small>
            </span>
          </button>
        </div>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="inline-flex w-full rounded-xl bg-slate-100 p-1 sm:w-auto">
          <button
            type="button"
            onClick={() => chooseSection("events")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold sm:flex-none ${section === "events" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
          >
            <CalendarDays size={16} /> Events
          </button>
          <button
            type="button"
            onClick={() => chooseSection("posts")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold sm:flex-none ${section === "posts" ? "bg-white text-cyan-700 shadow-sm" : "text-slate-500"}`}
          >
            <Newspaper size={16} /> Posts & Activities
          </button>
        </div>
      </div>

      {section === "events" ? <EventsManagement /> : <PostsManagement />}
    </div>
  );
}

export { UnifiedContentManagement };
