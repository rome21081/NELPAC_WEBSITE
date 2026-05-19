function LoadingState({ label = "Loading data..." }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">{label}</div>;
}

function ErrorState({ message }) {
  if (!message) return null;
  return <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message}</div>;
}

function EmptyState({ label = "No records found." }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">{label}</div>;
}

export {
  EmptyState,
  ErrorState,
  LoadingState,
};
