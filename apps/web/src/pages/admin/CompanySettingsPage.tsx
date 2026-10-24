import React, { useState, useEffect } from 'react';
import { Settings, Building, Award, Calendar, Plus, Trash2, Check } from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { CardGridSkeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';

export const CompanySettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals state
  const [modalType, setModalType] = useState<'dept' | 'desig' | 'leave' | 'holiday' | null>(null);
  const [inputName, setInputName] = useState('');
  const [inputDate, setInputDate] = useState('');
  const [inputQuota, setInputQuota] = useState(10);
  const [inputIsPaid, setInputIsPaid] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setIsLoading(true);
      const [sRes, dRes, desRes, ltRes, hRes] = await Promise.all([
        api.get('/company/settings'),
        api.get('/company/departments'),
        api.get('/company/designations'),
        api.get('/company/leave-types'),
        api.get('/company/holidays'),
      ]);
      setSettings(sRes.settings);
      setDepartments(dRes.departments || []);
      setDesignations(desRes.designations || []);
      setLeaveTypes(ltRes.leave_types || []);
      setHolidays(hRes.holidays || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg(null);
    try {
      const res = await api.patch('/company/settings', {
        office_start: settings.office_start,
        grace_minutes: Number(settings.grace_minutes),
        half_day_hours: Number(settings.half_day_hours),
        office_latitude: settings.office_latitude ? Number(settings.office_latitude) : null,
        office_longitude: settings.office_longitude ? Number(settings.office_longitude) : null,
        office_radius_meters: Number(settings.office_radius_meters),
      });
      setSettings(res.settings);
      setSuccessMsg('Company rules and settings updated successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddDept = async () => {
    if (!inputName.trim()) return;
    try {
      const res = await api.post('/company/departments', { name: inputName });
      setDepartments((prev) => [...prev, res.department]);
      setModalType(null);
      setInputName('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteDept = async (id: string) => {
    if (!confirm('Are you sure you want to delete this department?')) return;
    try {
      await api.delete(`/company/departments/${id}`);
      setDepartments((prev) => prev.filter((d) => d.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddDesig = async () => {
    if (!inputName.trim()) return;
    try {
      const res = await api.post('/company/designations', { title: inputName });
      setDesignations((prev) => [...prev, res.designation]);
      setModalType(null);
      setInputName('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteDesig = async (id: string) => {
    if (!confirm('Delete this designation?')) return;
    try {
      await api.delete(`/company/designations/${id}`);
      setDesignations((prev) => prev.filter((d) => d.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddLeaveType = async () => {
    if (!inputName.trim()) return;
    try {
      const res = await api.post('/company/leave-types', {
        name: inputName,
        is_paid: inputIsPaid,
        days_per_year: Number(inputQuota),
      });
      setLeaveTypes((prev) => [...prev, res.leave_type]);
      setModalType(null);
      setInputName('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddHoliday = async () => {
    if (!inputName.trim() || !inputDate) return;
    try {
      const res = await api.post('/company/holidays', {
        name: inputName,
        date: inputDate,
      });
      setHolidays((prev) => [...prev, res.holiday]);
      setModalType(null);
      setInputName('');
      setInputDate('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      await api.delete(`/company/holidays/${id}`);
      setHolidays((prev) => prev.filter((h) => h.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddDefaultLeaveTypes = async () => {
    try {
      const res = await api.post('/company/leave-types/defaults');
      setLeaveTypes(res.leave_types);
      setSuccessMsg('Default leave quotas populated: Annual (14), Sick (8), Casual (10), Unpaid (unlimited)');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to populate default leave types');
    }
  };

  if (isLoading) {
    return <CardGridSkeleton count={4} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Organization Rules & Setup</h1>
        <p className="text-xs text-gray-500">
          Configure office hours, geofence radius, departments, leave quotas, and holidays
        </p>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 rounded-lg flex items-center gap-1.5">
          <Check className="w-4 h-4" /> {successMsg}
        </div>
      )}

      {/* Workplace Rules Form */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4 text-brand-600" />
          <h3 className="text-sm font-bold text-gray-900">Workplace & Attendance Rules</h3>
        </div>

        <form onSubmit={handleUpdateSettings} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Office Start Time</label>
              <input
                type="time"
                value={settings?.office_start || '09:00'}
                onChange={(e) => setSettings({ ...settings, office_start: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Grace Minutes (Late Threshold)
              </label>
              <input
                type="number"
                value={settings?.grace_minutes ?? 15}
                onChange={(e) => setSettings({ ...settings, grace_minutes: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Half-Day Limit (Hours Worked)
              </label>
              <input
                type="number"
                step="0.5"
                value={settings?.half_day_hours ?? 5.0}
                onChange={(e) => setSettings({ ...settings, half_day_hours: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-semibold text-gray-800">Office Location & Geofence</span>
            <button
              type="button"
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setSettings({
                        ...settings,
                        office_latitude: pos.coords.latitude,
                        office_longitude: pos.coords.longitude,
                      });
                    },
                    () => alert('Could not access current location')
                  );
                }
              }}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
            >
              📍 Set Office To Current Location
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Office Latitude</label>
              <input
                type="number"
                step="0.0001"
                value={settings?.office_latitude ?? ''}
                onChange={(e) => setSettings({ ...settings, office_latitude: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Office Longitude</label>
              <input
                type="number"
                step="0.0001"
                value={settings?.office_longitude ?? ''}
                onChange={(e) => setSettings({ ...settings, office_longitude: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Geofence Radius (Meters)
              </label>
              <input
                type="number"
                value={settings?.office_radius_meters ?? 150}
                onChange={(e) => setSettings({ ...settings, office_radius_meters: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
          </div>

          <Button type="submit" isLoading={isSaving} size="sm">
            Save Workplace Rules
          </Button>
        </form>
      </Card>

      {/* Departments & Designations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Departments */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-brand-600" />
              <h3 className="text-sm font-bold text-gray-900">Departments</h3>
            </div>
            <Button size="sm" variant="outline" onClick={() => setModalType('dept')}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Dept
            </Button>
          </div>

          <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
            {departments.map((d) => (
              <div key={d.id} className="py-2 flex items-center justify-between text-xs">
                <span className="font-medium text-gray-800">{d.name}</span>
                <button
                  onClick={() => handleDeleteDept(d.id)}
                  className="text-gray-400 hover:text-red-600 p-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* Designations */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-brand-600" />
              <h3 className="text-sm font-bold text-gray-900">Designations</h3>
            </div>
            <Button size="sm" variant="outline" onClick={() => setModalType('desig')}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Title
            </Button>
          </div>

          <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
            {designations.map((d) => (
              <div key={d.id} className="py-2 flex items-center justify-between text-xs">
                <span className="font-medium text-gray-800">{d.title}</span>
                <button
                  onClick={() => handleDeleteDesig(d.id)}
                  className="text-gray-400 hover:text-red-600 p-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Leave Types & Quotas & Holidays */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Leave Types */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900">Leave Types & Annual Quotas</h3>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={handleAddDefaultLeaveTypes}>
                + Default Quotas
              </Button>
              <Button size="sm" variant="outline" onClick={() => setModalType('leave')}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Type
              </Button>
            </div>
          </div>

          <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
            {leaveTypes.map((lt) => (
              <div key={lt.id} className="py-2 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-gray-900">{lt.name}</span>
                  <span className="text-gray-500 ml-2">({lt.is_paid ? 'Paid' : 'Unpaid'})</span>
                </div>
                <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[11px] font-medium">
                  {lt.days_per_year > 0 ? `${lt.days_per_year} days/yr` : 'Unlimited'}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Public Holidays */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-600" />
              <h3 className="text-sm font-bold text-gray-900">Public Holidays</h3>
            </div>
            <Button size="sm" variant="outline" onClick={() => setModalType('holiday')}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Holiday
            </Button>
          </div>

          <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
            {holidays.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No holidays added yet.</p>
            ) : (
              holidays.map((h) => (
                <div key={h.id} className="py-2 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-gray-900">{h.name}</span>
                    <span className="text-gray-500 ml-2">{h.date}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteHoliday(h.id)}
                    className="text-gray-400 hover:text-red-600 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Modal for adding Dept / Desig / Leave / Holiday */}
      <Modal
        isOpen={modalType !== null}
        onClose={() => setModalType(null)}
        title={
          modalType === 'dept'
            ? 'Add Department'
            : modalType === 'desig'
            ? 'Add Designation'
            : modalType === 'leave'
            ? 'Add Leave Type'
            : 'Add Public Holiday'
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">Name / Title</label>
            <input
              type="text"
              required
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder="e.g. Finance, Eid Holiday, etc."
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
            />
          </div>

          {modalType === 'holiday' && (
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Holiday Date</label>
              <input
                type="date"
                required
                value={inputDate}
                onChange={(e) => setInputDate(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
          )}

          {modalType === 'leave' && (
            <>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Days Per Year Quota (0 for unlimited)
                </label>
                <input
                  type="number"
                  value={inputQuota}
                  onChange={(e) => setInputQuota(Number(e.target.value))}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_paid"
                  checked={inputIsPaid}
                  onChange={(e) => setInputIsPaid(e.target.checked)}
                />
                <label htmlFor="is_paid" className="font-semibold text-gray-700">
                  Paid Leave Type
                </label>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setModalType(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (modalType === 'dept') handleAddDept();
                else if (modalType === 'desig') handleAddDesig();
                else if (modalType === 'leave') handleAddLeaveType();
                else if (modalType === 'holiday') handleAddHoliday();
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
