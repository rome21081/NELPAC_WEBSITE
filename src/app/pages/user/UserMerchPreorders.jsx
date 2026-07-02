import { CalendarDays, Package, ShoppingBag } from "lucide-react";
import { Link } from "react-router";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { listMerchForms } from "../../lib/supabaseServices";

function UserMerchPreorders() {
  const { data: forms, loading, error } = useSupabaseData(() => listMerchForms({ publishedOnly: true }), []);
  if (loading) return <LoadingState label="Loading merch pre-orders..." />;
  return <div className="space-y-5">
    <div><h1 className="text-2xl font-extrabold text-slate-900">Merch Pre-Orders</h1><p className="text-sm text-slate-500">Place one organized order for your local church.</p></div>
    <ErrorState message={error} />
    {forms.length === 0 ? <EmptyState label="No merch pre-order forms are open." /> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{forms.map((form) => <article key={form.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {form.image_url ? <img src={form.image_url} alt={form.title} className="h-52 w-full object-cover" /> : <div className="flex h-52 items-center justify-center bg-gradient-to-br from-violet-100 to-blue-100 text-violet-600"><ShoppingBag size={48} /></div>}
      <div className="p-5"><div className="flex items-start justify-between gap-3"><div><span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">{form.merch_type === "Others" ? form.custom_merch_name : form.merch_type}</span><h2 className="mt-3 text-lg font-extrabold text-slate-900">{form.title}</h2></div><strong className="text-lg text-blue-700">₱{Number(form.item_fee).toLocaleString()}</strong></div><p className="mt-2 line-clamp-2 text-sm text-slate-500">{form.description || "NELPAC merch pre-order"}</p><div className="mt-4 flex items-center gap-2 text-xs text-slate-500"><CalendarDays size={15} /> {form.preorder_date}</div><Link to={`/user/merch-preorders/${form.id}`} className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800"><Package size={17} /> Open Pre-Order Form</Link></div>
    </article>)}</div>}
  </div>;
}

export { UserMerchPreorders };
