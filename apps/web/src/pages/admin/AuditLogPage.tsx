import React, { useState, useEffect } from 'react';
import { ShieldCheck, Filter } from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { Skeleton } from '../../components/ui/Skeleton';

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  useEffect(() => {
    loadAudit();
  }, [actionFilter, entityFilter]);

  const loadAudit = async () => {
    try {
      setIsLoading(true);
      let endpoint = '/audit-logs?limit=100';
      if (actionFilter) endpoint += `&action=${actionFilter}`;
      if (entityFilter) endpoint += `&entity=${entityFilter}`;
      const res = await api.get(endpoint);
      setLogs(res.audit_logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Security Audit Logs</h1>
          <p className="text-xs text-gray-500">
            Immutable tracking of all create, update, approve, and finalize operations
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700"
          >
            <option value="">All Actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="approve">Approve</option>
            <option value="reject">Reject</option>
            <option value="finalize">Finalize</option>
            <option value="login">Login</option>
          </select>

          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700"
          >
            <option value="">All Entities</option>
            <option value="employee">Employee</option>
            <option value="attendance_checkin">Attendance</option>
            <option value="leave_request">Leave</option>
            <option value="payroll_run">Payroll</option>
            <option value="user">User</option>
          </select>
        </div>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center justify-between py-2.5 px-3 border-b border-gray-100 last:border-0">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/75 border-b border-gray-200/80 text-gray-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Entity</th>
                  <th className="py-2.5 px-3">Details</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">
                      No audit records found matching criteria.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50">
                      <td className="py-2.5 px-3 font-semibold text-gray-900">{log.actor_email}</td>
                      <td className="py-2.5 px-3 uppercase text-[10px] font-bold text-gray-500">
                        {log.actor_role}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded text-[11px]">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-gray-900">{log.entity}</td>
                      <td className="py-2.5 px-3 text-gray-500 max-w-xs truncate font-mono text-[11px]">
                        {log.details ? JSON.stringify(log.details) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-gray-400 text-[11px]">
                        {new Date(log.created_at).toLocaleString()}
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
