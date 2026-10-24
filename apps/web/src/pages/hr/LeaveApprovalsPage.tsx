import React, { useState, useEffect } from 'react';
import { Calendar, Check, X, Filter } from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Skeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';

export const LeaveApprovalsPage: React.FC = () => {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');

  // Review modal
  const [selectedLeave, setSelectedLeave] = useState<any | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);

  useEffect(() => {
    loadLeaves();
  }, [statusFilter]);

  const loadLeaves = async () => {
    try {
      setIsLoading(true);
      let endpoint = '/leaves';
      if (statusFilter) endpoint += `?status=${statusFilter}`;
      const res = await api.get(endpoint);
      setLeaves(res.leave_requests || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReviewLeave = async (status: 'approved' | 'rejected') => {
    if (!selectedLeave) return;
    setIsReviewing(true);
    try {
      await api.post(`/leaves/${selectedLeave.id}/review`, {
        status,
        comment: reviewComment,
      });
      setSelectedLeave(null);
      setReviewComment('');
      loadLeaves();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Leave Approvals Inbox</h1>
          <p className="text-xs text-gray-500">
            Review, approve or reject employee leave requests with audit comments
          </p>
        </div>

        {/* Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700"
        >
          <option value="pending">Pending Review Only</option>
          <option value="approved">Approved Requests</option>
          <option value="rejected">Rejected Requests</option>
          <option value="">All Leave Requests</option>
        </select>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-2.5 px-3 border-b border-gray-100 last:border-0">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-7 w-20 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/75 border-b border-gray-200/80 text-gray-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Employee</th>
                  <th className="py-2.5 px-3">Leave Type</th>
                  <th className="py-2.5 px-3">Duration (Working Days)</th>
                  <th className="py-2.5 px-3">Date Range</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {leaves.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">
                      No leave requests in this status.
                    </td>
                  </tr>
                ) : (
                  leaves.map((l) => (
                    <tr key={l.id} className="hover:bg-gray-50/50">
                      <td className="py-2.5 px-3 font-semibold text-gray-900">
                        {l.employee?.first_name} {l.employee?.last_name}
                        <span className="block text-[10px] text-gray-400 font-normal">
                          {l.employee?.department?.name || 'General'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-brand-700">
                        {l.leave_type?.name}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-gray-900">
                        {l.days_count} working day(s)
                      </td>
                      <td className="py-2.5 px-3 text-gray-600">
                        {l.start_date} → {l.end_date}
                      </td>
                      <td className="py-2.5 px-3 max-w-xs truncate text-gray-600">{l.reason}</td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={
                            l.status === 'approved'
                              ? 'success'
                              : l.status === 'rejected'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {l.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {l.status === 'pending' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedLeave(l)}
                          >
                            Review
                          </Button>
                        ) : (
                          <span className="text-gray-400 text-[11px]">Decided</span>
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

      {/* Modal: Review Leave */}
      <Modal
        isOpen={selectedLeave !== null}
        onClose={() => setSelectedLeave(null)}
        title="Review Employee Leave Request"
      >
        {selectedLeave && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-gray-50 rounded-lg space-y-1">
              <p>
                <strong>Employee:</strong> {selectedLeave.employee?.first_name}{' '}
                {selectedLeave.employee?.last_name}
              </p>
              <p>
                <strong>Type:</strong> {selectedLeave.leave_type?.name}
              </p>
              <p>
                <strong>Requested Period:</strong> {selectedLeave.start_date} to{' '}
                {selectedLeave.end_date} (
                <strong>{selectedLeave.days_count} working day(s)</strong>)
              </p>
              <p>
                <strong>Reason:</strong> "{selectedLeave.reason}"
              </p>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                HR Review Comment (Optional)
              </label>
              <textarea
                rows={2}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="e.g. Approved. Please hand over pending tasks."
                className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs text-gray-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleReviewLeave('rejected')}
                isLoading={isReviewing}
              >
                Reject Leave
              </Button>
              <Button
                size="sm"
                onClick={() => handleReviewLeave('approved')}
                isLoading={isReviewing}
              >
                Approve Leave
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
