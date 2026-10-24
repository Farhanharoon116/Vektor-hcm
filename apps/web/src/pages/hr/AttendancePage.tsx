import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Check, X, Filter } from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Skeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';

export const AttendancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'board' | 'report' | 'corrections'>('board');
  const [boardData, setBoardData] = useState<any | null>(null);
  const [reportRecords, setReportRecords] = useState<any[]>([]);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Report filters
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Review correction modal
  const [selectedCorrection, setSelectedCorrection] = useState<any | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);

  useEffect(() => {
    if (activeTab === 'board') loadBoard();
    else if (activeTab === 'report') loadReport();
    else if (activeTab === 'corrections') loadCorrections();
  }, [activeTab]);

  const loadBoard = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/attendance/today');
      setBoardData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/attendance/report?start_date=${startDate}&end_date=${endDate}`);
      setReportRecords(res.records || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCorrections = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/attendance/corrections');
      setCorrections(res.corrections || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReviewCorrection = async (status: 'approved' | 'rejected') => {
    if (!selectedCorrection) return;
    setIsReviewing(true);
    try {
      await api.post(`/attendance/corrections/${selectedCorrection.id}/review`, {
        status,
        comment: reviewComment,
      });
      setSelectedCorrection(null);
      setReviewComment('');
      loadCorrections();
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
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Attendance Operations</h1>
          <p className="text-xs text-gray-500">
            Monitor daily clock-ins, generate date-range reports, and process correction requests
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('board')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'board' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Daily Attendance Board
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'report' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Attendance Report
          </button>
          <button
            onClick={() => setActiveTab('corrections')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'corrections' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Corrections Inbox
          </button>
        </div>
      </div>

      {/* Tab 1: Daily Board */}
      {activeTab === 'board' && (
        <div className="space-y-4">
          {boardData && (
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="bg-white p-3 rounded-xl border border-gray-200">
                <span className="text-[11px] text-gray-500 font-medium">Present Today</span>
                <p className="text-xl font-bold text-emerald-600">{boardData.kpis.present}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-gray-200">
                <span className="text-[11px] text-gray-500 font-medium">Late (after 09:15)</span>
                <p className="text-xl font-bold text-amber-600">{boardData.kpis.late}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-gray-200">
                <span className="text-[11px] text-gray-500 font-medium">On Approved Leave</span>
                <p className="text-xl font-bold text-blue-600">{boardData.kpis.on_leave}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-gray-200">
                <span className="text-[11px] text-gray-500 font-medium">Absent / Unmarked</span>
                <p className="text-xl font-bold text-rose-600">{boardData.kpis.absent}</p>
              </div>
            </div>
          )}

          <Card>
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 px-3 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-36" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/75 border-b border-gray-200/80 text-gray-500 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Employee</th>
                      <th className="py-2.5 px-3">Code</th>
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Clock-In</th>
                      <th className="py-2.5 px-3">Clock-Out</th>
                      <th className="py-2.5 px-3">Hours Worked</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {(boardData?.board || []).map((row: any) => (
                      <tr key={row.employee.id} className="hover:bg-gray-50/50">
                        <td className="py-2.5 px-3 font-semibold text-gray-900">
                          {row.employee.first_name} {row.employee.last_name}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-gray-500">
                          {row.employee.employee_code}
                        </td>
                        <td className="py-2.5 px-3">{row.employee.department?.name || '—'}</td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant={
                              row.status === 'present'
                                ? 'success'
                                : row.status === 'late'
                                ? 'warning'
                                : row.status === 'leave'
                                ? 'info'
                                : 'danger'
                            }
                          >
                            {row.status} {row.leave_name ? `(${row.leave_name})` : ''}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3">
                          {row.attendance?.clock_in
                            ? new Date(row.attendance.clock_in).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          {row.attendance?.clock_out
                            ? new Date(row.attendance.clock_out).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-medium">
                          {row.attendance?.hours_worked ? `${row.attendance.hours_worked} hrs` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 2: Report */}
      {activeTab === 'report' && (
        <div className="space-y-4">
          <Card className="p-4 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-700">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs text-gray-900"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-700">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs text-gray-900"
              />
            </div>
            <Button size="sm" onClick={loadReport}>
              <Filter className="w-3.5 h-3.5 mr-1" /> Filter Records
            </Button>
          </Card>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/75 border-b border-gray-200/80 text-gray-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Clock-In</th>
                    <th className="py-2.5 px-3">Clock-Out</th>
                    <th className="py-2.5 px-3">Hours</th>
                    <th className="py-2.5 px-3">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {reportRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/50">
                      <td className="py-2.5 px-3 font-semibold text-gray-900">{r.date}</td>
                      <td className="py-2.5 px-3">
                        {r.employee?.first_name} {r.employee?.last_name}
                      </td>
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
                        {r.clock_in ? new Date(r.clock_in).toLocaleTimeString() : '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        {r.clock_out ? new Date(r.clock_out).toLocaleTimeString() : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-medium">{r.hours_worked || 0}h</td>
                      <td className="py-2.5 px-3 capitalize text-gray-500">{r.check_in_source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 3: Corrections */}
      {activeTab === 'corrections' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/75 border-b border-gray-200/80 text-gray-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Employee</th>
                  <th className="py-2.5 px-3">Requested Status</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {corrections.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">
                      No correction requests in inbox.
                    </td>
                  </tr>
                ) : (
                  corrections.map((corr) => (
                    <tr key={corr.id} className="hover:bg-gray-50/50">
                      <td className="py-2.5 px-3 font-semibold text-gray-900">{corr.date}</td>
                      <td className="py-2.5 px-3 font-medium">
                        {corr.employee?.first_name} {corr.employee?.last_name}
                      </td>
                      <td className="py-2.5 px-3 capitalize font-bold text-brand-600">
                        {corr.requested_status}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 max-w-xs">{corr.reason}</td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={
                            corr.status === 'approved'
                              ? 'success'
                              : corr.status === 'rejected'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {corr.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {corr.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedCorrection(corr)}
                          >
                            Review
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal: Review Correction */}
      <Modal
        isOpen={selectedCorrection !== null}
        onClose={() => setSelectedCorrection(null)}
        title="Review Attendance Correction Request"
      >
        {selectedCorrection && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-gray-50 rounded-lg space-y-1">
              <p>
                <strong>Employee:</strong> {selectedCorrection.employee?.first_name}{' '}
                {selectedCorrection.employee?.last_name}
              </p>
              <p>
                <strong>Date:</strong> {selectedCorrection.date}
              </p>
              <p>
                <strong>Requested Status:</strong>{' '}
                <span className="font-bold capitalize text-brand-600">
                  {selectedCorrection.requested_status}
                </span>
              </p>
              <p>
                <strong>Reason given:</strong> "{selectedCorrection.reason}"
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
                placeholder="e.g. Approved per manager confirmation"
                className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs text-gray-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleReviewCorrection('rejected')}
                isLoading={isReviewing}
              >
                Reject Request
              </Button>
              <Button
                size="sm"
                onClick={() => handleReviewCorrection('approved')}
                isLoading={isReviewing}
              >
                Approve & Update Attendance
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
