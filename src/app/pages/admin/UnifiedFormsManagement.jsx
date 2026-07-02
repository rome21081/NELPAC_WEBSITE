import { useState } from "react";
import { BarChart3, CalendarDays, ClipboardPenLine, Settings2, ShoppingBag } from "lucide-react";
import { MerchPreordersManagement } from "./MerchPreordersManagement";
import { PreRegistrationManagement } from "./PreRegistrationManagement";
import { RegistrationAnalytics } from "./RegistrationAnalytics";

function UnifiedFormsManagement() {
  const [type, setType] = useState("registration");
  const [view, setView] = useState("setup");
  return <div className="space-y-6">
    <header className="rounded-3xl bg-gradient-to-r from-slate-950 via-blue-950 to-violet-950 p-6 text-white shadow-lg sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-200">Admin Forms Center</p>
      <h1 className="mt-2 text-2xl font-black sm:text-3xl">Create, customize, and manage forms</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Use one workspace for event pre-registration and merch pre-orders. Switch form types without hunting through separate admin pages.</p>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <button onClick={() => setType("registration")} className={`flex items-center gap-4 rounded-2xl border p-4 text-left ${type === "registration" ? "border-blue-300 bg-white text-blue-950 shadow-lg" : "border-white/20 bg-white/10 hover:bg-white/15"}`}><span className={`rounded-xl p-3 ${type === "registration" ? "bg-blue-100 text-blue-700" : "bg-white/10"}`}><ClipboardPenLine size={23} /></span><span><strong className="block">Pre-Registration Form</strong><small className={type === "registration" ? "text-blue-700" : "text-slate-300"}>Connect and customize event forms</small></span></button>
        <button onClick={() => setType("merch")} className={`flex items-center gap-4 rounded-2xl border p-4 text-left ${type === "merch" ? "border-violet-300 bg-white text-violet-950 shadow-lg" : "border-white/20 bg-white/10 hover:bg-white/15"}`}><span className={`rounded-xl p-3 ${type === "merch" ? "bg-violet-100 text-violet-700" : "bg-white/10"}`}><ShoppingBag size={23} /></span><span><strong className="block">Merch Pre-Order Form</strong><small className={type === "merch" ? "text-violet-700" : "text-slate-300"}>Create and update merch forms</small></span></button>
      </div>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-700">{type === "registration" ? <CalendarDays className="text-blue-700" size={18} /> : <ShoppingBag className="text-violet-700" size={18} />}{type === "registration" ? "Pre-Registration" : "Merch Pre-Order"}</div>
      <div className="inline-flex rounded-xl bg-slate-100 p-1"><button onClick={() => setView("setup")} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold ${view === "setup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}><Settings2 size={15} /> Create & Edit</button><button onClick={() => setView("analytics")} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold ${view === "analytics" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}><BarChart3 size={15} /> Submissions & Analytics</button></div>
    </div>
    {view === "setup" ? (type === "registration" ? <PreRegistrationManagement /> : <MerchPreordersManagement />) : <RegistrationAnalytics key={type} initialTab={type === "registration" ? "events" : "merch"} />}
  </div>;
}

export { UnifiedFormsManagement };
