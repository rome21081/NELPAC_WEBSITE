import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, LoaderCircle, RefreshCw } from "lucide-react";

const accents = {
  admin: {
    badge: "bg-amber-500",
    dot: "bg-amber-500",
    unread: "bg-amber-50/70",
    icon: "text-amber-700",
  },
  user: {
    badge: "bg-emerald-500",
    dot: "bg-emerald-500",
    unread: "bg-emerald-50/70",
    icon: "text-emerald-700",
  },
};

function formatNotificationTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const elapsed = Date.now() - date.getTime();
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

function NotificationCenter({
  notifications = [],
  loading = false,
  error = "",
  mode = "user",
  onMarkRead,
  onMarkAllRead,
  onRefresh,
  onOpen,
}) {
  const [open, setOpen] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const rootRef = useRef(null);
  const palette = accents[mode] || accents.user;
  const unread = useMemo(
    () => notifications.filter((item) => !item.is_read),
    [notifications],
  );

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeWithEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [open]);

  const toggle = () => {
    setOpen((current) => {
      const next = !current;
      if (next) onOpen?.();
      return next;
    });
  };

  const markOne = async (notification) => {
    if (notification.is_read || workingId) return;
    setWorkingId(notification.id);
    try {
      await onMarkRead?.(notification.id);
    } finally {
      setWorkingId("");
    }
  };

  const markAll = async () => {
    if (!unread.length || markingAll) return;
    setMarkingAll(true);
    try {
      await onMarkAllRead?.(unread.map((item) => item.id));
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={
          unread.length
            ? `Notifications, ${unread.length} unread`
            : "Notifications"
        }
        aria-expanded={open}
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition ${open ? "border-slate-300 bg-slate-100 text-slate-900" : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-800"}`}
      >
        <Bell size={20} />
        {unread.length > 0 && (
          <span
            className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black text-white ring-2 ring-white ${palette.badge}`}
          >
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>

      {open && (
        <section
          className="fixed right-2 top-16 z-[70] flex max-h-[min(34rem,calc(100vh-5rem))] w-[calc(100vw-1rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 sm:absolute sm:right-0 sm:top-full sm:mt-3 sm:w-96"
          aria-label="Notification panel"
        >
          <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-slate-950">Notifications</h2>
                {unread.length > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black ${palette.unread} ${palette.icon}`}
                  >
                    {unread.length} new
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                Updates from your NELPAC account
              </p>
            </div>
            {unread.length > 0 && (
              <button
                type="button"
                disabled={markingAll || loading}
                onClick={markAll}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold hover:bg-slate-50 disabled:opacity-50 ${palette.icon}`}
              >
                {markingAll ? (
                  <LoaderCircle className="animate-spin" size={14} />
                ) : (
                  <CheckCheck size={14} />
                )}{" "}
                Mark all read
              </button>
            )}
          </header>

          {error && (
            <div className="mx-3 mt-3 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-xs leading-5 text-red-700">{error}</p>
              <button
                type="button"
                onClick={onRefresh}
                className="shrink-0 text-xs font-bold text-red-700"
              >
                Retry
              </button>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {loading && unread.length === 0 ? (
              <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-slate-500">
                <LoaderCircle className="animate-spin" size={18} /> Loading
                notifications...
              </div>
            ) : unread.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <Bell size={21} />
                </span>
                <h3 className="mt-3 text-sm font-black text-slate-800">
                  You’re all caught up
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Viewed notifications are removed from this panel.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {unread.slice(0, 30).map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    disabled={
                      notification.is_read || workingId === notification.id
                    }
                    onClick={() => markOne(notification)}
                    className={`relative block w-full px-4 py-3.5 text-left transition hover:bg-slate-50 disabled:cursor-default ${notification.is_read ? "bg-white" : palette.unread}`}
                  >
                    <div className="flex gap-3">
                      {!notification.is_read && (
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${palette.dot}`}
                        />
                      )}
                      <div
                        className={`min-w-0 flex-1 ${notification.is_read ? "pl-5" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3
                            className={`text-sm leading-5 text-slate-900 ${notification.is_read ? "font-semibold" : "font-black"}`}
                          >
                            {notification.title || "Notification"}
                          </h3>
                          <time className="shrink-0 pt-0.5 text-[10px] font-semibold text-slate-400">
                            {formatNotificationTime(notification.created_at)}
                          </time>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {notification.message || "No additional details."}
                        </p>
                        {workingId === notification.id && (
                          <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                            <LoaderCircle className="animate-spin" size={11} />{" "}
                            Marking as viewed...
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <footer className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-4 py-2.5">
            <p className="text-[11px] text-slate-400">
              {unread.length} unread notification
              {unread.length === 1 ? "" : "s"}
            </p>
            <button
              type="button"
              disabled={loading}
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-600 hover:bg-white disabled:opacity-50"
            >
              <RefreshCw className={loading ? "animate-spin" : ""} size={13} />{" "}
              Refresh
            </button>
          </footer>
        </section>
      )}
    </div>
  );
}

export { NotificationCenter };
