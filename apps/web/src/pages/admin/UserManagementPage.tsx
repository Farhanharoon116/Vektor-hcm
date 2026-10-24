import React, { useState, useEffect } from 'react';
import { UserCheck, Plus, RefreshCw, Power } from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';

export const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create user modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('Welcome' + Math.floor(1000 + Math.random() * 9000) + '!');
  const [newRole, setNewRole] = useState<'hr' | 'employee'>('hr');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Temp password display modal
  const [tempPassResult, setTempPassResult] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/users');
      setUsers(res.users || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await api.post('/users', {
        email: newEmail,
        password: newPassword,
        role: newRole,
      });
      setUsers((prev) => [res.user, ...prev]);
      setIsCreateOpen(false);
      setTempPassResult(`Created login for ${newEmail} with initial password: ${newPassword}`);
      setNewEmail('');
    } catch (err: any) {
      alert(err.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleDeactivate = async (userId: string) => {
    try {
      const res = await api.patch(`/users/${userId}/deactivate`);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_active: res.user.is_active } : u))
      );
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResetPassword = async (userId: string, email: string) => {
    if (!confirm(`Reset password for ${email}? A temporary password will be generated.`)) return;
    try {
      const res = await api.post(`/users/${userId}/reset-password`, {});
      setTempPassResult(
        `Temporary password for ${email}: ${res.temporary_password}\n(The user will be required to change it upon first login)`
      );
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (isLoading) {
    return <TableSkeleton columns={6} rows={5} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">System User & HR Logins</h1>
          <p className="text-xs text-gray-500">
            Create HR administrative accounts, toggle access, and issue temporary login credentials
          </p>
        </div>

        <Button onClick={() => setIsCreateOpen(true)} className="self-start">
          <Plus className="w-4 h-4 mr-1.5" /> Create New Login
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/75 border-b border-gray-200/80 text-gray-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-2.5 px-3">User Email</th>
                <th className="py-2.5 px-3">Assigned Role</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">First Login Status</th>
                <th className="py-2.5 px-3">Created</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/50">
                  <td className="py-2.5 px-3 font-semibold text-gray-900">{u.email}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        u.role === 'admin'
                          ? 'bg-purple-100 text-purple-700'
                          : u.role === 'hr'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <Badge variant={u.is_active ? 'success' : 'danger'}>
                      {u.is_active ? 'Active' : 'Deactivated'}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3">
                    {u.must_change_password ? (
                      <span className="text-amber-600 font-medium">Password Reset Required</span>
                    ) : (
                      <span className="text-gray-400">Normal</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-gray-500">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-2.5 px-3 text-right space-x-2">
                    <button
                      onClick={() => handleResetPassword(u.id, u.email)}
                      title="Reset Password"
                      className="p-1 text-gray-400 hover:text-brand-600 rounded transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleDeactivate(u.id)}
                      title={u.is_active ? 'Deactivate' : 'Activate'}
                      className={`p-1 rounded transition-colors cursor-pointer ${
                        u.is_active
                          ? 'text-gray-400 hover:text-rose-600'
                          : 'text-rose-500 hover:text-emerald-600'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Create User */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Login">
        <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">User Email</label>
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="hr@company.com"
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Role</label>
            <select
              value={newRole}
              onChange={(e: any) => setNewRole(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
            >
              <option value="hr">HR (People Operations)</option>
              <option value="employee">Employee (Self-Service)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              Temporary Initial Password
            </label>
            <input
              type="text"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
            />
            <span className="text-[10px] text-gray-400">
              The user will be required to change this password on their first login.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting}>
              Create Login
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Show Temporary Password Result */}
      <Modal
        isOpen={tempPassResult !== null}
        onClose={() => setTempPassResult(null)}
        title="Temporary Credentials Issued"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-brand-50 border border-brand-200 text-brand-900 rounded-lg whitespace-pre-wrap font-mono text-[11px]">
            {tempPassResult}
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setTempPassResult(null)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
