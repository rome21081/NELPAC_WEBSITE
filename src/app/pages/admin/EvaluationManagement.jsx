import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { useSupabaseData } from "../../lib/useSupabaseData";
import { listEvaluationAnalytics, listEvaluationDetails } from "../../lib/supabaseServices";

function EvaluationManagement() {
  const { data, loading, error } = useSupabaseData(async () => {
    const [analytics, details] = await Promise.all([listEvaluationAnalytics(), listEvaluationDetails()]);
    return [{ analytics, details }];
  }, []);
  if (loading) return <LoadingState label="Loading evaluation analytics..." />;
  const { analytics = [], details = [] } = data[0] || {};

  return <div className="space-y-5">
    <div><h1 className="text-slate-900" style={{ fontSize: "22px", fontWeight: 700 }}>Evaluation Management</h1><p className="text-slate-500 text-sm">Live feedback and event averages</p></div>
    <ErrorState message={error} />
    {analytics.length === 0 ? <EmptyState label="No evaluation analytics yet." /> : <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {analytics.map((item) => <div key={item.event_id} className="bg-white rounded-2xl p-5 border border-slate-100">
        <div className="flex justify-between"><h2 className="text-slate-900" style={{ fontWeight: 700 }}>{item.event_title}</h2><span className="text-sm text-slate-500">{item.total_evaluations} responses</span></div>
        <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
          <p>Overall: <b>{item.average_overall_rating || "0.00"}</b></p><p>Speaker: <b>{item.average_speaker_rating || "0.00"}</b></p>
          <p>Venue: <b>{item.average_venue_rating || "0.00"}</b></p><p>Program: <b>{item.average_program_rating || "0.00"}</b></p>
        </div>
      </div>)}
    </div>}
    <section className="bg-white rounded-2xl p-5 border border-slate-100">
      <h2 className="text-slate-900 mb-3" style={{ fontSize: "16px", fontWeight: 700 }}>Recent Comments</h2>
      {details.filter((detail) => detail.comment).length === 0 ? <EmptyState label="No comments submitted." /> : <div className="space-y-2">
        {details.filter((detail) => detail.comment).slice(0, 20).map((detail) => <div key={detail.id} className="rounded-xl bg-slate-50 p-3 text-sm"><b>{detail.event_title}</b><p className="text-slate-600">{detail.comment}</p></div>)}
      </div>}
    </section>
  </div>;
}

export { EvaluationManagement };
