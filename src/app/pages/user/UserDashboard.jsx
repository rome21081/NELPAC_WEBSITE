import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Calendar,
  ChevronRight,
  CreditCard,
  FileText,
  Gift,
  Image,
  MapPin,
  Upload,
  Users,
} from "lucide-react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/DataState";
import { useAuth } from "../../lib/authContext";
import { getProfileDisplayName } from "../../lib/profileNames";
import { useSupabaseData } from "../../lib/useSupabaseData";
import {
  getMyMembers,
  listEvents,
  listPointBalances,
  listPosts,
  listRewardClaims,
} from "../../lib/supabaseServices";

const actions = [
  { icon: Users, label: "Members", path: "/user/local-church-members" },
  { icon: CreditCard, label: "One Card", path: "/user/one-card" },
  { icon: Calendar, label: "Events", path: "/user/events" },
  { icon: Upload, label: "Submit Image", path: "/user/gallery?section=submit" },
  { icon: Gift, label: "Rewards", path: "/user/one-card?section=rewards" },
  { icon: Image, label: "Gallery", path: "/user/gallery" },
];

const localEventDate = (value, endOfDay = false) => {
  if (!value) return null;
  const dateOnly = String(value).match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  const date = dateOnly
    ? new Date(`${dateOnly}T${endOfDay ? "23:59:59.999" : "00:00:00"}`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatEventDate = (value) => {
  const date = localEventDate(value);
  return date
    ? date.toLocaleDateString("en-PH", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Date to be announced";
};

const countdownParts = (target, now) => {
  const remaining = Math.max((target?.getTime() || now) - now, 0);
  return {
    days: Math.floor(remaining / 86400000),
    hours: Math.floor((remaining % 86400000) / 3600000),
    minutes: Math.floor((remaining % 3600000) / 60000),
    seconds: Math.floor((remaining % 60000) / 1000),
  };
};

function UserDashboard() {
  const { user, profile } = useAuth();
  const [now, setNow] = useState(Date.now());
  const { data, loading, error } = useSupabaseData(async () => {
    const [members, balances, events, posts, claims] = await Promise.all([
      getMyMembers(user.id),
      listPointBalances(),
      listEvents(),
      listPosts({ publishedOnly: true }),
      listRewardClaims(),
    ]);
    return [{ members, balances, events, posts, claims }];
  }, [user?.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const dashboard = data[0] || {
    members: [],
    balances: [],
    events: [],
    posts: [],
    claims: [],
  };
  const upcomingEvents = useMemo(
    () =>
      dashboard.events
        .filter((event) => {
          const eventEnd = localEventDate(event.event_date, true);
          return (
            event.status === "Published" &&
            eventEnd &&
            eventEnd.getTime() >= now
          );
        })
        .sort(
          (first, second) =>
            localEventDate(first.event_date).getTime() -
            localEventDate(second.event_date).getTime(),
        ),
    [dashboard.events, now],
  );

  if (loading) return <LoadingState label="Loading user dashboard..." />;

  const member = dashboard.members[0];
  const points =
    dashboard.balances.find((balance) => balance.user_id === user.id)
      ?.points_balance || 0;
  const nextEvent = upcomingEvents[0];
  const nextEventDate = localEventDate(nextEvent?.event_date);
  const countdown = countdownParts(nextEventDate, now);
  const myClaims = dashboard.claims.filter(
    (claim) => claim.user_id === user.id,
  );

  return (
    <div className="space-y-5 pb-44 sm:space-y-6 sm:pb-36">
      <ErrorState message={error} />

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-5 text-white shadow-xl shadow-blue-950/15 sm:p-7">
        <div className="absolute -right-16 -top-24 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200">
              NELPAC Youth Portal
            </p>
            <h1 className="mt-2 break-words text-2xl font-black tracking-tight sm:text-3xl">
              Welcome,{" "}
              {getProfileDisplayName(profile, profile.email || "Member")}
            </h1>
            <p className="mt-1 text-sm text-blue-100">
              {member
                ? `${member.local_church_name} - ${member.district}`
                : "Complete your member application"}
            </p>
          </div>
          <div className="flex w-fit items-end gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
            <strong className="text-3xl font-black tracking-tight">
              {points.toLocaleString()}
            </strong>
            <span className="pb-1 text-xs font-bold text-blue-100">points</span>
          </div>
        </div>
      </section>

      <section>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.path}
                to={action.path}
                title={action.label}
                className="group flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-1.5 py-2.5 text-center text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-700 hover:shadow-md sm:flex-row sm:gap-2 sm:px-2"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 group-hover:bg-blue-50">
                  <Icon size={15} />
                </span>
                <span className="max-w-full truncate text-[10px] font-bold leading-tight sm:text-[11px]">
                  {action.label}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">
                Calendar
              </p>
              <h2 className="mt-1 text-xl font-black text-slate-950">
                Upcoming Events
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Only published events whose dates have not passed.
              </p>
            </div>
            <Link
              to="/user/events"
              className="shrink-0 text-xs font-bold text-blue-700"
            >
              View all
            </Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <EmptyState label="No upcoming events." />
          ) : (
            <div className="space-y-3">
              {upcomingEvents.slice(0, 5).map((event) => (
                <Link
                  key={event.id}
                  to="/user/events"
                  className="group flex min-w-0 gap-4 rounded-2xl border border-slate-100 p-3 transition hover:border-blue-200 hover:bg-blue-50/40"
                >
                  {event.image_url ? (
                    <img
                      src={event.image_url}
                      alt={event.title}
                      className="h-16 w-20 shrink-0 rounded-xl bg-slate-100 object-cover sm:h-20 sm:w-24"
                    />
                  ) : (
                    <div className="flex h-16 w-20 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 sm:h-20 sm:w-24">
                      <Calendar size={22} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 py-0.5 sm:py-1">
                    <p className="text-[10px] font-bold text-blue-700 sm:text-xs">
                      {formatEventDate(event.event_date)}
                    </p>
                    <h3 className="mt-1 line-clamp-2 text-sm font-black leading-5 text-slate-900 group-hover:text-blue-800 sm:text-base">
                      {event.title}
                    </h3>
                    <p className="mt-1 flex items-center gap-1.5 truncate text-[10px] text-slate-500 sm:text-xs">
                      <MapPin size={12} /> {event.venue || "Venue TBA"}
                    </p>
                  </div>
                  <ChevronRight
                    className="mt-5 hidden shrink-0 text-slate-300 group-hover:text-blue-600 sm:block"
                    size={18}
                  />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-violet-700">
                Community
              </p>

              <h2 className="mt-1 text-lg font-black text-slate-950">
                Latest Posts
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                News and announcements from NELPAC.
              </p>
            </div>

            <Link
              to="/user/events?section=posts"
              className="shrink-0 text-xs font-bold text-violet-700 hover:underline"
            >
              View all
            </Link>
          </div>

          {dashboard.posts.length === 0 ? (
            <EmptyState label="No posts yet." />
          ) : (
            <div className="space-y-3">
              {dashboard.posts.slice(0, 1).map((post) => (
                <div
                  key={post.id}
                  className="flex min-w-0 gap-3 rounded-2xl border border-slate-100 p-3 transition hover:border-violet-200 hover:bg-violet-50/40"
                >
                  {post.image_url ? (
                    <img
                      src={post.image_url}
                      alt={post.title}
                      className="h-16 w-16 shrink-0 rounded-xl bg-slate-100 object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-500">
                      <FileText size={18} />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 py-0.5">
                    <h3 className="line-clamp-1 text-sm font-black leading-5 text-slate-900">
                      {post.title}
                    </h3>

                    <p className="mt-1 text-[10px] font-semibold text-violet-700 sm:text-xs">
                      {post.category}
                    </p>

                    <p
                      className="mt-1 text-xs leading-5 text-slate-500"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {post.body}
                    </p>

                    <Link
                      to={`/user/events?post=${post.id}`}
                      className="mt-2 inline-flex w-fit rounded-full bg-violet-50 px-3 py-1 text-[11px] font-bold text-violet-700 transition hover:bg-violet-100"
                    >
                      See whole post
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4">
          <h2 className="font-black text-slate-950">Reward Claims</h2>
          <p className="mt-1 text-xs text-slate-500">
            Your most recent reward requests.
          </p>
        </div>
        {myClaims.length === 0 ? (
          <EmptyState label="No reward claims yet." />
        ) : (
          myClaims.slice(0, 5).map((claim) => (
            <div
              key={claim.id}
              className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 text-sm last:border-0"
            >
              <span className="min-w-0 truncate font-semibold text-slate-800">
                {claim.reward_name}
              </span>
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                {claim.claim_status}
              </span>
            </div>
          ))
        )}
      </section>

      {nextEvent && (
        <aside className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 right-3 z-30 mx-auto max-w-4xl overflow-hidden rounded-2xl border border-blue-300/60 bg-slate-950/95 text-white shadow-2xl shadow-slate-950/30 backdrop-blur-xl lg:left-[19rem]">
          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-300">
                Next event countdown
              </p>
              <h2 className="mt-1 truncate text-sm font-black sm:text-base">
                {nextEvent.title}
              </h2>
              <p className="mt-0.5 truncate text-[11px] text-slate-300">
                {formatEventDate(nextEvent.event_date)} ·{" "}
                {nextEvent.venue || "Venue TBA"}
              </p>
            </div>
            <div className="grid grid-cols-4 gap-1.5 sm:w-[22rem]">
              {[
                ["Days", countdown.days],
                ["Hours", countdown.hours],
                ["Minutes", countdown.minutes],
                ["Seconds", countdown.seconds],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/10 bg-white/10 px-2 py-2 text-center"
                >
                  <strong className="block text-lg font-black tabular-nums sm:text-xl">
                    {String(value).padStart(2, "0")}
                  </strong>
                  <span className="text-[8px] font-bold uppercase tracking-wider text-blue-200 sm:text-[9px]">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

export { UserDashboard };
