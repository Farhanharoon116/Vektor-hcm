import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, FileText, Lock, Send, CheckCircle2, Download } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Modal } from '../../components/ui/Modal';
import { TableSkeleton } from '../../components/ui/Skeleton';

export const PayrollPage: React.FC = () => {
  const { user } = useAuthStore();
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRun, setSelectedRun] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Draft Modal
  const [isDraftOpen, setIsDraftOpen] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadPayrollRuns();
  }, []);

  const loadPayrollRuns = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/payroll/runs');
      setRuns(res.runs || []);
      if (res.runs && res.runs.length > 0) {
        loadRunDetails(res.runs[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRunDetails = async (runId: string) => {
    try {
      const res = await api.get(`/payroll/runs/${runId}`);
      setSelectedRun(res.run);
      setItems(res.items || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const res = await api.post('/payroll/draft', {
        month: Number(month),
        year: Number(year),
      });
      setIsDraftOpen(false);
      await loadPayrollRuns();
      await loadRunDetails(res.payroll_run.id);
    } catch (err: any) {
      alert(err.message || 'Failed to create draft');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmitDraft = async (runId: string) => {
    if (!confirm('Submit this payroll draft to Admin for finalization?')) return;
    try {
      await api.post(`/payroll/runs/${runId}/submit`);
      loadPayrollRuns();
      loadRunDetails(runId);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleFinalizePayroll = async (runId: string) => {
    if (!confirm('Finalize and LOCK this payroll? Once finalized, no changes can be made.')) return;
    try {
      await api.post(`/payroll/runs/${runId}/finalize`);
      loadPayrollRuns();
      loadRunDetails(runId);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDownloadPayslip = async (itemId: string, empCode: string) => {
    try {
      const res = await api.get(`/payroll/payslips/item/${itemId}/pdf`, { skipCache: true });
      const blob = res instanceof Blob ? res : new Blob([res], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip_${empCode}_${selectedRun?.month}_${selectedRun?.year}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      alert('Failed to download PDF payslip: ' + err.message);
    }
  };

  if (isLoading) {
    return <TableSkeleton columns={6} rows={6} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Monthly Payroll Engine</h1>
          <p className="text-xs text-gray-500">
            Generate monthly payroll drafts, compute salary deductions & taxes, and issue locked payslips
          </p>
        </div>

        <Button onClick={() => setIsDraftOpen(true)} className="self-start">
          <Plus className="w-4 h-4 mr-1.5" /> Generate Payroll Run
        </Button>
      </div>

      {/* Payroll Runs Carousel / Selector */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {runs.map((r) => {
          const isSelected = selectedRun?.id === r.id;
          return (
            <button
              key={r.id}
              onClick={() => loadRunDetails(r.id)}
              className={`p-4 rounded-xl border text-left min-w-[220px] transition-all cursor-pointer ${
                isSelected
                  ? 'bg-white border-brand-500 shadow-sm ring-1 ring-brand-500'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm text-gray-900">
                  {new Date(r.year, r.month - 1).toLocaleString('default', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
                <Badge
                  variant={
                    r.status === 'finalized'
                      ? 'success'
                      : r.status === 'submitted'
                      ? 'info'
                      : 'neutral'
                  }
                >
                  {r.status}
                </Badge>
              </div>
              <p className="text-xs font-semibold text-brand-600 mt-1">
                PKR {Number(r.total_net).toLocaleString()}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {r.employee_count} employees · {r.working_days} working days
              </p>
            </button>
          );
        })}
      </div>

      {/* Selected Run Details Header */}
      {selectedRun && (
        <Card className="p-4 bg-gradient-to-r from-gray-50 to-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900">
                Payroll Period:{' '}
                {new Date(selectedRun.year, selectedRun.month - 1).toLocaleString('default', {
                  month: 'long',
                  year: 'numeric',
                })}
              </h2>
              <Badge
                variant={
                  selectedRun.status === 'finalized'
                    ? 'success'
                    : selectedRun.status === 'submitted'
                    ? 'info'
                    : 'neutral'
                }
              >
                {selectedRun.status}
              </Badge>
            </div>
            <p className="text-xs text-gray-500">
              Total Gross: <strong>PKR {Number(selectedRun.total_gross).toLocaleString()}</strong> · Total Deductions:{' '}
              <strong>PKR {Number(selectedRun.total_deductions).toLocaleString()}</strong> · Income Tax:{' '}
              <strong>PKR {Number(selectedRun.total_tax).toLocaleString()}</strong> · Net Disbursed:{' '}
              <strong className="text-emerald-700">
                PKR {Number(selectedRun.total_net).toLocaleString()}
              </strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {selectedRun.status === 'draft' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSubmitDraft(selectedRun.id)}
              >
                <Send className="w-3.5 h-3.5 mr-1" /> Submit to Admin
              </Button>
            )}

            {user?.role === 'admin' && selectedRun.status !== 'finalized' && (
              <Button
                size="sm"
                onClick={() => handleFinalizePayroll(selectedRun.id)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Lock className="w-3.5 h-3.5 mr-1" /> Finalize & Lock Month
              </Button>
            )}

            {selectedRun.status === 'finalized' && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-4 h-4" /> Finalized & Immutable
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Line Items Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/75 border-b border-gray-200/80 text-gray-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-2.5 px-3">Employee</th>
                <th className="py-2.5 px-3">Basic (100%)</th>
                <th className="py-2.5 px-3">HRA (40%)</th>
                <th className="py-2.5 px-3">Medical (10%)</th>
                <th className="py-2.5 px-3">Gross Salary</th>
                <th className="py-2.5 px-3">Deduction Days</th>
                <th className="py-2.5 px-3">Attendance Deduction</th>
                <th className="py-2.5 px-3">Income Tax</th>
                <th className="py-2.5 px-3">Net Take-Home</th>
                <th className="py-2.5 px-3 text-right">Payslip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-gray-400">
                    No items in this payroll run. Click "Generate Payroll Run" to compute.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="py-2.5 px-3 font-semibold text-gray-900">
                      {item.employee?.first_name} {item.employee?.last_name}
                      <span className="block text-[10px] text-gray-400 font-normal">
                        {item.employee?.employee_code} · {item.employee?.department?.name || 'General'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">PKR {Number(item.basic_salary).toLocaleString()}</td>
                    <td className="py-2.5 px-3">PKR {Number(item.hra).toLocaleString()}</td>
                    <td className="py-2.5 px-3">PKR {Number(item.medical).toLocaleString()}</td>
                    <td className="py-2.5 px-3 font-medium text-gray-900">
                      PKR {Number(item.gross_salary).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`font-semibold ${
                          item.deduction_days > 0 ? 'text-rose-600' : 'text-gray-600'
                        }`}
                      >
                        {item.deduction_days} days
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-rose-600 font-medium">
                      PKR {Number(item.salary_deduction).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-gray-600">
                      PKR {Number(item.monthly_tax).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-emerald-700">
                      PKR {Number(item.net_salary).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() =>
                          handleDownloadPayslip(item.id, item.employee?.employee_code)
                        }
                        className="px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded border border-gray-200 text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" /> PDF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Generate Draft */}
      <Modal isOpen={isDraftOpen} onClose={() => setIsDraftOpen(false)} title="Generate Monthly Payroll Run">
        <form onSubmit={handleCreateDraft} className="space-y-4 text-xs">
          <p className="text-gray-500">
            This will calculate working days, pull attendance clock-ins, compute absent & unpaid leave deductions, apply tax brackets, and generate payroll line items for all active employees.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Month (1 - 12)</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2026, i).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDraftOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isGenerating}>
              Run Calculations & Create Draft
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
