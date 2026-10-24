import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Download } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { Skeleton } from '../../components/ui/Skeleton';

export const MyPayslipsPage: React.FC = () => {
  const { user, employee } = useAuthStore();
  const [payslips, setPayslips] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const empId = user?.employee_id || employee?.id;

  useEffect(() => {
    loadPayslips();
  }, [empId]);

  const loadPayslips = async () => {
    if (!empId) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const res = await api.get(`/payroll/payslips/${empId}`);
      setPayslips(res.payslips || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (itemId: string, month: number, year: number) => {
    try {
      const res = await api.get(`/payroll/payslips/item/${itemId}/pdf`, { skipCache: true });
      const blob = res instanceof Blob ? res : new Blob([res], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip_${month}_${year}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      alert('Failed to download PDF payslip: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">My Salary Payslips</h1>
        <p className="text-xs text-gray-500">
          Official monthly salary slips with earnings, attendance deductions, and income tax breakdown
        </p>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between py-2.5 px-3 border-b border-gray-100 last:border-0">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-7 w-28 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/75 border-b border-gray-200/80 text-gray-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Pay Period</th>
                  <th className="py-2.5 px-3">Gross Salary</th>
                  <th className="py-2.5 px-3">Deduction Days</th>
                  <th className="py-2.5 px-3">Attendance Deduction</th>
                  <th className="py-2.5 px-3">Income Tax</th>
                  <th className="py-2.5 px-3">Net Take-Home</th>
                  <th className="py-2.5 px-3 text-right">PDF Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {payslips.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">
                      No payslips generated for your profile yet.
                    </td>
                  </tr>
                ) : (
                  payslips.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50">
                      <td className="py-2.5 px-3 font-bold text-gray-900">
                        {new Date(p.payroll_run?.year, p.payroll_run?.month - 1).toLocaleString(
                          'default',
                          { month: 'long', year: 'numeric' }
                        )}
                      </td>
                      <td className="py-2.5 px-3">PKR {Number(p.gross_salary).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-gray-600 font-medium">
                        {p.deduction_days} days
                      </td>
                      <td className="py-2.5 px-3 text-rose-600 font-medium">
                        PKR {Number(p.salary_deduction).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600">
                        PKR {Number(p.monthly_tax).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-extrabold text-emerald-700">
                        PKR {Number(p.net_salary).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() =>
                            handleDownload(p.id, p.payroll_run?.month, p.payroll_run?.year)
                          }
                          className="px-2.5 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-md font-semibold text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" /> Download PDF
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
