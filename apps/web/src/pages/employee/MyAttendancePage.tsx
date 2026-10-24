import React, { useState, useEffect } from 'react';
import { Clock, Plus, Check } from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Skeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';

export const MyAttendancePage: React.FC = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Correction modal
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [corrDate, setCorrDate] = useState(new Date().toISOString().split('T')[0]);
  const [requestedStatus, setRequestedStatus] = useState<'present' | 'late' | 'half_day'>('present');
  const [corrReason, setCorrReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadMyAttendance();
  }, []);

  const loadMyAttendance = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/attendance/my');
      setRecords(res.attendance || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/attendance/corrections', {
        date: corrDate,
        requested_status: requestedStatus,
        reason: corrReason,
      });
      setIsCorrectionOpen(false);
      setCorrReason('');
      setSuccessMsg('Correction request submitted to HR for approval.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to submit correction');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">My Attendance Calendar</h1>
          <p className="text-xs text-gray-500">
            View daily clock-in/out stamps and request attendance adjustments with reason
          </p>
        </div>

        <Button onClick={() => setIsCorrectionOpen(true)} className="self-start">
          <Plus className="w-4 h-4 mr-1.5" /> Request Attendance Correction
        </Button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 rounded-lg flex items-center gap-1.5">
          <Check className="w-4 h-4 text-emerald-600" /> {successMsg}
        </div>
      )}

      <Card>
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center justify-between py-2.5 px-3 border-b border-gray-100 last:border-0">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/75 border-b border-gray-200/80 text-gray-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Clock-In Time</th>
                  <th className="py-2.5 px-3">Clock-Out Time</th>
                  <th className="py-2.5 px-3">Hours Worked</th>
                  <th className="py-2.5 px-3">Source</th>
                  <th className="py-2.5 px-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">
                      No attendance records found yet. Check in from your dashboard.
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/50">
                      <td className="py-2.5 px-3 font-semibold text-gray-900">{r.date}</td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={
                            r.status === 'present'
                              ? 'success'
                              : r.status === 'late'
                              ? 'warning'
                              : 'danger'
                          }
                        >
                          {r.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3">
                        {r.clock_in
                          ? new Date(r.clock_in).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        {r.clock_out
                          ? new Date(r.clock_out).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-gray-900">
                        {r.hours_worked ? `${r.hours_worked} hrs` : '—'}
                      </td>
                      <td className="py-2.5 px-3 capitalize text-gray-500">
                        {r.check_in_source || 'web'}
                      </td>
                      <td className="py-2.5 px-3 text-gray-500 truncate max-w-xs">
                        {r.notes || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal: Request Correction */}
      <Modal
        isOpen={isCorrectionOpen}
        onClose={() => setIsCorrectionOpen(false)}
        title="Submit Attendance Correction"
      >
        <form onSubmit={handleRequestCorrection} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">Date *</label>
            <input
              type="date"
              required
              value={corrDate}
              onChange={(e) => setCorrDate(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Requested Status *</label>
            <select
              value={requestedStatus}
              onChange={(e: any) => setRequestedStatus(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
            >
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="half_day">Half Day</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              Reason / Explanation (min 5 characters) *
            </label>
            <textarea
              required
              rows={3}
              value={corrReason}
              onChange={(e) => setCorrReason(e.target.value)}
              placeholder="e.g. System checkout glitch or client on-site visit"
              className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-900"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCorrectionOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting}>
              Submit to HR
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
