import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Sparkles, AlertCircle, X, Check } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Modal } from '../../components/ui/Modal';
import { CardGridSkeleton } from '../../components/ui/Skeleton';

export const MyLeavesPage: React.FC = () => {
  const { user, employee } = useAuthStore();
  const [balances, setBalances] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Apply modal
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [smartPrompt, setSmartPrompt] = useState('');
  const [isSmartParsing, setIsSmartParsing] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const empId = user?.employee_id || employee?.id;

  useEffect(() => {
    loadLeaveData();
  }, [empId]);

  const loadLeaveData = async () => {
    if (!empId) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const [balRes, reqRes] = await Promise.all([
        api.get(`/leaves/balances/${empId}`),
        api.get('/leaves'),
      ]);
      setBalances(balRes.balances || []);
      setRequests(reqRes.leave_requests || []);
      if (balRes.balances?.length > 0 && !leaveTypeId) {
        setLeaveTypeId(balRes.balances[0].leave_type_id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSmartFill = async () => {
    if (!smartPrompt.trim()) return;
    setIsSmartParsing(true);
    setError(null);
    try {
      const res = await api.post('/ai/smart-leave', { message: smartPrompt });
      const parsed = res.parsed_leave;
      if (parsed) {
        if (parsed.leave_type_id) setLeaveTypeId(parsed.leave_type_id);
        if (parsed.start_date) setStartDate(parsed.start_date);
        if (parsed.end_date) setEndDate(parsed.end_date);
        if (parsed.reason) setReason(parsed.reason);
      }
    } catch (err: any) {
      setError('AI Smart Fill was unable to parse. Please fill form manually.');
    } finally {
      setIsSmartParsing(false);
    }
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await api.post('/leaves', {
        leave_type_id: leaveTypeId,
        start_date: startDate,
        end_date: endDate,
        reason,
      });

      setIsApplyOpen(false);
      setSmartPrompt('');
      setReason('');
      setSuccessMsg('Leave request submitted successfully for HR review!');
      setTimeout(() => setSuccessMsg(null), 4000);
      loadLeaveData();
    } catch (err: any) {
      setError(err.message || 'Failed to apply for leave');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelLeave = async (leaveId: string) => {
    if (!confirm('Are you sure you want to cancel this pending leave?')) return;
    try {
      await api.patch(`/leaves/${leaveId}/cancel`);
      loadLeaveData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (isLoading) {
    return <CardGridSkeleton count={4} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">My Leave Management</h1>
          <p className="text-xs text-gray-500">
            View annual quotas, apply with AI Smart Leave assistant, and track approval status
          </p>
        </div>

        <Button onClick={() => setIsApplyOpen(true)} className="self-start">
          <Plus className="w-4 h-4 mr-1.5" /> Apply for Leave
        </Button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 rounded-lg flex items-center gap-1.5">
          <Check className="w-4 h-4 text-emerald-600" /> {successMsg}
        </div>
      )}

      {/* Leave Balances Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {balances.map((b) => (
          <Card key={b.leave_type_id} className="text-center p-4">
            <span className="text-xs font-bold text-gray-700">{b.leave_type_name}</span>
            <p className="text-2xl font-extrabold text-brand-600 mt-1">{b.balance}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {b.quota > 0 ? `${b.used} used of ${b.quota} days` : 'Unlimited quota'}
            </p>
          </Card>
        ))}
      </div>

      {/* Leave Requests History */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">Leave Application History</h3>
        </div>

        {isLoading ? (
          <div className="py-16">
            <Spinner />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/75 border-b border-gray-200/80 text-gray-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Leave Type</th>
                  <th className="py-2.5 px-3">Period</th>
                  <th className="py-2.5 px-3">Working Days Count</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">HR Review Comment</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">
                      No leave requests submitted yet.
                    </td>
                  </tr>
                ) : (
                  requests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50/50">
                      <td className="py-2.5 px-3 font-semibold text-gray-900">
                        {req.leave_type?.name}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600">
                        {req.start_date} → {req.end_date}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-brand-700">
                        {req.days_count} day(s)
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 max-w-xs truncate">{req.reason}</td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={
                            req.status === 'approved'
                              ? 'success'
                              : req.status === 'rejected'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {req.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-gray-500">{req.review_comment || '—'}</td>
                      <td className="py-2.5 px-3 text-right">
                        {req.status === 'pending' && (
                          <button
                            onClick={() => handleCancelLeave(req.id)}
                            className="text-xs text-rose-600 hover:underline font-semibold cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal: Apply with AI Smart Leave Assistant */}
      <Modal isOpen={isApplyOpen} onClose={() => setIsApplyOpen(false)} title="Apply for Leave">
        <form onSubmit={handleApplyLeave} className="space-y-4 text-xs">
          {/* AI Smart Leave Assistant Box */}
          <div className="p-3.5 rounded-xl bg-brand-50/70 border border-brand-200">
            <div className="flex items-center gap-1.5 text-xs font-bold text-brand-800 mb-1.5">
              <Sparkles className="w-4 h-4 text-brand-600" />
              <span>AI Smart Leave (Plain English or Roman Urdu)</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={smartPrompt}
                onChange={(e) => setSmartPrompt(e.target.value)}
                placeholder='e.g. "Need next Monday and Tuesday off for my sister&apos;s wedding"'
                className="flex-1 bg-white border border-brand-200 rounded-lg px-3 py-1.5 text-xs text-gray-900"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleSmartFill}
                isLoading={isSmartParsing}
                className="bg-brand-600 text-white shrink-0"
              >
                Smart Fill
              </Button>
            </div>
            <span className="text-[10px] text-brand-600/80 mt-1 block">
              Type naturally in English or Roman Urdu — the AI will extract the dates, leave type, and reason!
            </span>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Leave Type *</label>
            <select
              value={leaveTypeId}
              onChange={(e) => setLeaveTypeId(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
            >
              {balances.map((b) => (
                <option key={b.leave_type_id} value={b.leave_type_id}>
                  {b.leave_type_name} ({b.balance} days left)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Start Date *</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">End Date *</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Reason for Leave *</label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide the reason for your absence"
              className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-xs text-gray-900"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsApplyOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting}>
              Submit Application
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
