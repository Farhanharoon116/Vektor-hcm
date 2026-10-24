import React, { useState, useEffect } from 'react';
import { UserCheck, Clock, Calendar, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import { StatCard } from '../../components/ui/StatCard';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { DashboardSkeleton } from '../../components/ui/Skeleton';
import { Link } from 'react-router-dom';

export const HRDashboardPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  useEffect(() => {
    loadHRDashboard();
  }, []);

  const loadHRDashboard = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/dashboard/hr');
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!data) return;
    setIsSummarizing(true);
    try {
      const res = await api.post('/ai/summarize', {
        kpis: data.kpis,
        top_late_comers: data.top_late_comers,
      });
      setAiSummary(res.summary);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSummarizing(false);
    }
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const kpis = data?.kpis || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">HR Operations Dashboard</h1>
          <p className="text-xs text-gray-500">Today's workforce status, pending approvals, and operational insights</p>
        </div>

        <Button
          onClick={handleGenerateSummary}
          isLoading={isSummarizing}
          className="bg-gradient-to-r from-brand-600 to-indigo-600 text-white self-start"
        >
          <Sparkles className="w-4 h-4 mr-1.5" /> AI Daily Brief
        </Button>
      </div>

      {/* AI Brief Box */}
      {aiSummary && (
        <div className="p-4 rounded-xl bg-brand-50/60 border border-brand-200/80 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs font-bold text-brand-700 mb-1.5">
            <Sparkles className="w-4 h-4" /> AI Operations Briefing
          </div>
          <p className="text-xs text-gray-800 whitespace-pre-line leading-relaxed">{aiSummary}</p>
        </div>
      )}

      {/* Today's Attendance KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Present Today"
          value={kpis.present || 0}
          subtitle={`Out of ${kpis.headcount || 0} active`}
          icon={<UserCheck className="w-6 h-6 text-emerald-600" />}
        />
        <StatCard
          title="Late Arrivals"
          value={kpis.late || 0}
          subtitle="Clocked in after 09:15"
          icon={<Clock className="w-6 h-6 text-amber-600" />}
        />
        <StatCard
          title="On Approved Leave"
          value={kpis.on_leave || 0}
          subtitle="Annual, Casual, Sick"
          icon={<Calendar className="w-6 h-6 text-blue-600" />}
        />
        <StatCard
          title="Absent / Unmarked"
          value={kpis.absent || 0}
          subtitle="No record & no leave"
          icon={<AlertCircle className="w-6 h-6 text-rose-600" />}
        />
      </div>

      {/* Approvals Action Banner */}
      {((kpis.pending_leaves || 0) > 0 || (kpis.pending_corrections || 0) > 0) && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center font-bold text-xs">
              !
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900">Pending Actions Awaiting HR Review</p>
              <p className="text-xs text-amber-700">
                {kpis.pending_leaves || 0} leave request(s) and {kpis.pending_corrections || 0} attendance correction(s) require approval.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/hr/leaves" className="text-xs font-semibold px-3 py-1.5 bg-white border border-amber-300 text-amber-800 rounded-lg hover:bg-amber-100 transition-colors">
              Review Leaves →
            </Link>
            <Link to="/hr/attendance" className="text-xs font-semibold px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
              Review Corrections →
            </Link>
          </div>
        </div>
      )}

      {/* Late Comers Table */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Top Late-Comers (This Month)</h3>
            <p className="text-xs text-gray-500">Employees with highest recurring tardiness</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/75 border-b border-gray-200/80 text-gray-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-2.5 px-3">Employee</th>
                <th className="py-2.5 px-3">Code</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3 text-right">Late Count This Month</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {(data?.top_late_comers || []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-400">
                    No late arrivals recorded this month. Excellent punctuality!
                  </td>
                </tr>
              ) : (
                data.top_late_comers.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="py-2.5 px-3 font-semibold text-gray-900">
                      {item.employee?.first_name} {item.employee?.last_name}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500">{item.employee?.employee_code}</td>
                    <td className="py-2.5 px-3">{item.employee?.department?.name || 'General'}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                      {item.count} times
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
