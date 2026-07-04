import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";

function LoadingState({ label = "Loading data..." }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
        <LoaderCircle className="animate-spin text-blue-600" size={20} />
        {label}
      </div>
    </div>
  );
}

function ErrorState({ message }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
      <AlertCircle className="mt-0.5 shrink-0" size={18} />
      <span>{message}</span>
    </div>
  );
}

function EmptyState({ label = "No records found." }) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
        <Inbox size={20} />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-500">{label}</p>
    </div>
  );
}

export { EmptyState, ErrorState, LoadingState };
