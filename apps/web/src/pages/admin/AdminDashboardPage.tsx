import React, { useState, useEffect } from 'react';
import { Users, DollarSign, TrendingUp, ShieldCheck, Sparkles, Building } from 'lucide-react';
import { api } from '../../lib/api';
import { StatCard } from '../../components/ui/StatCard';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { DashboardSkeleton } from '../../components/ui/Skeleton';

export const AdminDashboardPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/dashboard/admin');
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
        department_breakdown: data.department_breakdown,
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
      {/* Page Header with AI Summarize */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Executive Dashboard</h1>
          <p className="text-xs text-gray-500">Real-time company-wide workforce intelligence & metrics</p>
        </div>

        <Button
          onClick={handleGenerateSummary}
          isLoading={isSummarizing}
          className="bg-gradient-to-r from-brand-600 to-indigo-600 text-white self-start"
        >
          <Sparkles className="w-4 h-4 mr-1.5" /> AI Summarize KPIs
        </Button>
      </div>

      {/* AI Summary Box if generated */}
      {aiSummary && (
        <div className="p-4 rounded-xl bg-brand-50/60 border border-brand-200/80 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs font-bold text-brand-700 mb-1.5">
            <Sparkles className="w-4 h-4" /> AI Workforce Insights
          </div>
          <p className="text-xs text-gray-800 whitespace-pre-line leading-relaxed">{aiSummary}</p>
        </div>
      )}

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Headcount"
          value={kpis.headcount || 0}
          subtitle="Registered staff"
          icon={<Users className="w-6 h-6" />}
        />
        <StatCard
          title="Monthly Payroll Cost"
          value={`PKR ${Number(kpis.total_monthly_payroll || 0).toLocaleString()}`}
          subtitle="Gross commitment"
          icon={<DollarSign className="w-6 h-6" />}
        />
        <StatCard
          title="Average Monthly Salary"
          value={`PKR ${Number(kpis.average_salary || 0).toLocaleString()}`}
          subtitle="Across all departments"
          icon={<TrendingUp className="w-6 h-6" />}
        />
        <StatCard
          title="Attrition YTD"
          value={`${kpis.attrition_ytd || 0}%`}
          subtitle="Retention stable"
          icon={<ShieldCheck className="w-6 h-6" />}
        />
      </div>

      {/* Department Breakdown Table */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Workforce & Cost by Department</h3>
            <p className="text-xs text-gray-500">Headcount distribution and monthly payroll weight</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/75 border-b border-gray-200/80 text-gray-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3">Headcount</th>
                <th className="py-2.5 px-3">Total Monthly Gross</th>
                <th className="py-2.5 px-3">Average Salary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {(data?.department_breakdown || []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-400">
                    No department data yet.
                  </td>
                </tr>
              ) : (
                data.department_breakdown.map((dept: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="py-2.5 px-3 font-semibold text-gray-900 flex items-center gap-2">
                      <Building className="w-3.5 h-3.5 text-gray-400" />
                      {dept.name}
                    </td>
                    <td className="py-2.5 px-3">{dept.headcount} employees</td>
                    <td className="py-2.5 px-3 font-medium text-gray-900">
                      PKR {Number(dept.total_payroll).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-gray-600">
                      PKR {Number(dept.avg_salary).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Security Audit Log Feed */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Recent Security & Activity Feed</h3>
            <p className="text-xs text-gray-500">Immutable audit records of administrative actions</p>
          </div>
        </div>

        <div className="divide-y divide-gray-100 text-xs">
          {(data?.recent_audit_logs || []).length === 0 ? (
            <p className="py-6 text-center text-gray-400">No activity logged yet.</p>
          ) : (
            data.recent_audit_logs.map((log: any) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-gray-900">{log.actor_email}</span>
                  <span className="text-gray-500 ml-1.5">
                    performed <strong className="text-gray-800">{log.action}</strong> on{' '}
                    <span className="text-brand-600 font-medium">{log.entity}</span>
                  </span>
                </div>
                <span className="text-[11px] text-gray-400">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};
