import React, { useState, useEffect } from 'react';
import { Clock, Calendar, AlertCircle, FileSpreadsheet, Check, Sparkles, Camera } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { DashboardSkeleton } from '../../components/ui/Skeleton';

export const EmployeeDashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/dashboard/employee');
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWebCheckIn = async () => {
    setIsCheckingIn(true);
    setStatusMessage(null);
    try {
      const res = await api.post('/attendance/check-in', { source: 'web' });
      setStatusMessage(
        `Checked in successfully! Status: ${res.status.toUpperCase()} ${
          res.is_late ? '(Late after 09:15)' : ''
        }`
      );
      loadDashboard();
    } catch (err: any) {
      alert(err.message || 'Check-in failed');
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleWebCheckOut = async () => {
    setIsCheckingOut(true);
    setStatusMessage(null);
    try {
      const res = await api.post('/attendance/check-out', {});
      setStatusMessage(
        `Checked out successfully! Total: ${res.hours_worked} hours worked. Status: ${res.status.toUpperCase()}`
      );
      loadDashboard();
    } catch (err: any) {
      alert(err.message || 'Check-out failed');
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const todayAtt = data?.today_attendance;
  const isCheckedIn = !!todayAtt?.clock_in;
  const isCheckedOut = !!todayAtt?.clock_out;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Employee Self-Service</h1>
        <p className="text-xs text-gray-500">
          Mark daily attendance, manage leaves, view payslips, and check company announcements
        </p>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 rounded-lg flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" /> {statusMessage}
        </div>
      )}

      {/* Main Attendance Check-In Widget */}
      <Card className="bg-gradient-to-r from-white to-brand-50/30 border-brand-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600">
              Daily Attendance Widget
            </span>
            <h2 className="text-xl font-extrabold text-gray-900">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </h2>
            <div className="flex items-center gap-3 text-xs text-gray-600">
              <span>
                Clock In:{' '}
                <strong>
                  {todayAtt?.clock_in
                    ? new Date(todayAtt.clock_in).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Not yet'}
                </strong>
              </span>
              <span>·</span>
              <span>
                Clock Out:{' '}
                <strong>
                  {todayAtt?.clock_out
                    ? new Date(todayAtt.clock_out).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Not yet'}
                </strong>
              </span>
              {todayAtt && (
                <>
                  <span>·</span>
                  <Badge
                    variant={
                      todayAtt.status === 'present'
                        ? 'success'
                        : todayAtt.status === 'late'
                        ? 'warning'
                        : 'neutral'
                    }
                  >
                    {todayAtt.status}
                  </Badge>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!isCheckedIn ? (
              <>
                <Button onClick={handleWebCheckIn} isLoading={isCheckingIn} size="lg">
                  <Clock className="w-4 h-4 mr-2" /> Web Check-In
                </Button>
                <Link to="/employee/camera-attendance">
                  <Button variant="outline" size="lg">
                    <Camera className="w-4 h-4 mr-2 text-brand-600" /> Camera Check-In
                  </Button>
                </Link>
              </>
            ) : !isCheckedOut ? (
              <Button
                onClick={handleWebCheckOut}
                isLoading={isCheckingOut}
                size="lg"
                variant="danger"
              >
                <Clock className="w-4 h-4 mr-2" /> Clock-Out
              </Button>
            ) : (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-200">
                ✓ Attendance Completed for Today
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Hours Worked This Week
            </p>
            <h3 className="text-2xl font-bold text-gray-900">{data?.weekly_hours || 0} hrs</h3>
            <p className="text-xs text-gray-400">Target: 40 hrs / week</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Late Count This Month
            </p>
            <h3 className="text-2xl font-bold text-gray-900">
              {data?.late_count_this_month || 0} times
            </h3>
            <p className="text-xs text-gray-400">Grace threshold: 09:15</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Last Net Take-Home Pay
            </p>
            <h3 className="text-2xl font-bold text-gray-900">
              {data?.last_payslip
                ? `PKR ${Number(data.last_payslip.net_salary).toLocaleString()}`
                : 'Pending run'}
            </h3>
            <p className="text-xs text-gray-400">
              {data?.last_payslip
                ? `${data.last_payslip.payroll_run?.month}/${data.last_payslip.payroll_run?.year}`
                : 'No finalized payslips'}
            </p>
          </div>
        </Card>
      </div>

      {/* Leave Balances Grid */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">My Leave Quotas & Balances</h3>
            <p className="text-xs text-gray-500">Days remaining for the current calendar year</p>
          </div>
          <Link to="/employee/leaves">
            <Button size="sm" variant="outline">
              Apply for Leave →
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(data?.leave_balances || []).map((lb: any, idx: number) => (
            <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-center">
              <span className="text-xs font-semibold text-gray-700">{lb.name}</span>
              <p className="text-xl font-bold text-gray-900 mt-1">{lb.balance}</p>
              <p className="text-[10px] text-gray-400">
                {lb.quota > 0 ? `Quota: ${lb.quota} (Used ${lb.used})` : 'Unlimited'}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Announcements */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-900">Company Announcements</h3>
        </div>

        <div className="divide-y divide-gray-100">
          {(data?.announcements || []).length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No announcements posted.</p>
          ) : (
            data.announcements.map((a: any) => (
              <div key={a.id} className="py-2.5 text-xs">
                <p className="font-bold text-gray-900">{a.title}</p>
                <p className="text-gray-600 mt-0.5">{a.content}</p>
                <span className="text-[10px] text-gray-400 mt-1 block">
                  {new Date(a.created_at).toLocaleDateString()}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};
