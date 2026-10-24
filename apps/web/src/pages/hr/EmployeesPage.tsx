import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Plus,
  Search,
  Download,
  Upload,
  Eye,
  Edit2,
  FileSpreadsheet,
  Check,
  X,
  FileText,
  CheckCircle2,
  Trash2,
  Paperclip,
  Camera,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Modal } from '../../components/ui/Modal';
import { Skeleton, Employee360Skeleton } from '../../components/ui/Skeleton';
import { FaceEnrollmentModal } from '../../components/biometrics/FaceEnrollmentModal';
import { calculateSalaryStructure } from '@vektor/shared';

export const EmployeesPage: React.FC = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [enrollEmpTarget, setEnrollEmpTarget] = useState<any | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  // Register Modal
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [empCode, setEmpCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedDesig, setSelectedDesig] = useState('');
  const [basicSalary, setBasicSalary] = useState(80000);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; tempPass: string } | null>(null);

  // Employee 360 Drawer
  const [is360Open, setIs360Open] = useState(false);
  const [selectedEmpHeader, setSelectedEmpHeader] = useState<{
    first_name: string;
    last_name: string;
    employee_code: string;
    department?: any;
  } | null>(null);
  const [selectedEmp360, setSelectedEmp360] = useState<any | null>(null);
  const [emp360Loading, setEmp360Loading] = useState(false);

  // CSV Import Modal state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvFileSize, setCsvFileSize] = useState<string | null>(null);
  const [csvTab, setCsvTab] = useState<'upload' | 'manual'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [dryRunReport, setDryRunReport] = useState<any | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, [search, deptFilter]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      let endpoint = '/employees?';
      if (search) endpoint += `search=${search}&`;
      if (deptFilter) endpoint += `department_id=${deptFilter}&`;

      const [empRes, dRes, desRes] = await Promise.all([
        api.get(endpoint),
        api.get('/company/departments'),
        api.get('/company/designations'),
      ]);

      setEmployees(empRes.employees || []);
      setDepartments(dRes.departments || []);
      setDesignations(desRes.designations || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await api.post('/employees', {
        employee_code: empCode,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        gender,
        joining_date: joiningDate,
        department_id: selectedDept || undefined,
        designation_id: selectedDesig || undefined,
        basic_salary: Number(basicSalary),
      });

      setEmployees((prev) => [res.employee, ...prev]);
      setIsRegisterOpen(false);
      setCreatedCredentials({
        email: res.employee.email,
        tempPass: res.temporary_password,
      });

      // Reset form
      setEmpCode('');
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
    } catch (err: any) {
      alert(err.message || 'Failed to register employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpen360 = async (empId: string, emp?: any) => {
    setIs360Open(true);
    setEmp360Loading(true);
    setSelectedEmp360(null);
    if (emp) {
      setSelectedEmpHeader({
        first_name: emp.first_name,
        last_name: emp.last_name,
        employee_code: emp.employee_code,
        department: emp.department,
      });
    } else {
      setSelectedEmpHeader(null);
    }

    try {
      const res = await api.get(`/employees/${empId}/360`, { skipCache: true });
      setSelectedEmp360(res);
      if (res?.employee) {
        setSelectedEmpHeader({
          first_name: res.employee.first_name,
          last_name: res.employee.last_name,
          employee_code: res.employee.employee_code,
          department: res.employee.department,
        });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to load employee 360 data');
      setIs360Open(false);
    } finally {
      setEmp360Loading(false);
    }
  };

  const handleClose360 = () => {
    setIs360Open(false);
    setSelectedEmp360(null);
    setSelectedEmpHeader(null);
    setEmp360Loading(false);
  };

  const handleExportCSV = async () => {
    try {
      const res = await api.get('/employees/export/csv', { skipCache: true });
      const blob = res instanceof Blob ? res : new Blob([String(res)], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `employees_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      alert('Failed to export CSV: ' + err.message);
    }
  };

  const handleDownloadTemplate = () => {
    const templateContent =
      'Employee Code,First Name,Last Name,Email,Phone,Gender,Joining Date,Department,Designation,Basic Salary\n' +
      'EMP-101,Bilal,Tariq,bilal@company.com,+923001234567,male,2026-01-15,Engineering,Software Engineer,85000\n' +
      'EMP-102,Sana,Sheikh,sana@company.com,+923009876543,female,2026-02-01,Human Resources,HR Officer,65000\n' +
      'EMP-103,Hamza,Khan,hamza@company.com,+923005556677,male,2026-02-10,Operations,Operations Associate,55000';

    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vektor_employees_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  };

  const processCsvFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      alert('Please select a valid .csv file');
      return;
    }

    const sizeFormatted = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${(file.size / 1024).toFixed(1)} KB`;

    setCsvFileName(file.name);
    setCsvFileSize(sizeFormatted);
    setDryRunReport(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      setCsvContent(text);
    };
    reader.readAsText(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processCsvFile(file);
    }
  };

  const parseCsvToRows = (rawText: string) => {
    const cleanText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!cleanText) return [];

    const lines = cleanText.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    // Header normalization (e.g. 'Employee Code' -> 'employee_code')
    const rawHeaders = lines[0].split(',').map((h) => h.replace(/^["']|["']$/g, '').trim());
    const normalizedHeaders = rawHeaders.map((h) =>
      h.toLowerCase().replace(/[\s_-]+/g, '_')
    );

    const rows = lines.slice(1).map((line) => {
      // Split with quotes handling
      const values = line.split(',').map((v) => v.replace(/^["']|["']$/g, '').trim());
      const row: any = {};
      normalizedHeaders.forEach((h, i) => {
        row[h] = values[i] || '';
      });
      return row;
    });

    return rows;
  };

  const handleRunDryRunImport = async () => {
    if (!csvContent.trim()) {
      alert('Please upload a CSV file or paste CSV content first.');
      return;
    }
    setIsImporting(true);

    try {
      const rows = parseCsvToRows(csvContent);
      if (rows.length === 0) {
        alert('No data rows found in CSV. Please verify your file.');
        setIsImporting(false);
        return;
      }

      const res = await api.post('/employees/import/csv?dry_run=true', { rows });
      setDryRunReport(res);
    } catch (err: any) {
      alert(err.message || 'Validation failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleCommitImport = async () => {
    if (!csvContent.trim()) return;
    setIsImporting(true);
    try {
      const rows = parseCsvToRows(csvContent);
      const res = await api.post('/employees/import/csv', { rows });
      alert(`Successfully imported ${res.imported_count} employee(s)!`);
      setIsImportOpen(false);
      setCsvContent('');
      setCsvFileName(null);
      setCsvFileSize(null);
      setDryRunReport(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  // Live salary preview
  const salaryBreakdown = calculateSalaryStructure(basicSalary);

  return (
    <div className="space-y-6">
      {/* Page Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Employee Directory</h1>
          <p className="text-xs text-gray-500">
            Register employees, view 360 profiles, manage compensation, and bulk import/export
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
          </Button>

          <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)}>
            <Upload className="w-3.5 h-3.5 mr-1" /> Import CSV
          </Button>

          <Button size="sm" onClick={() => setIsRegisterOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Register Employee
          </Button>
        </div>
      </div>

      {/* Search and Filters Card */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, employee code, or email..."
              className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-gray-900"
            />
          </div>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Employee List Table */}
      <Card>
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center justify-between py-2.5 px-3 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <div className="flex gap-1.5 justify-end">
                  <Skeleton className="h-7 w-12 rounded" />
                  <Skeleton className="h-7 w-12 rounded" />
                </div>
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
                  <th className="py-2.5 px-3">Designation</th>
                  <th className="py-2.5 px-3">Basic Salary</th>
                  <th className="py-2.5 px-3">Gross Salary</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400">
                      No employees found. Click "Register Employee" to add the first one.
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-gray-50/50">
                      <td className="py-2.5 px-3 font-semibold text-gray-900">
                        {emp.first_name} {emp.last_name}
                        <span className="block text-[10px] text-gray-400 font-normal">
                          {emp.email}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-gray-600">
                        {emp.employee_code}
                      </td>
                      <td className="py-2.5 px-3">{emp.department?.name || '—'}</td>
                      <td className="py-2.5 px-3">{emp.designation?.title || '—'}</td>
                      <td className="py-2.5 px-3">PKR {Number(emp.basic_salary).toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-semibold text-gray-900">
                        PKR {Number(emp.gross_salary).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant={emp.status === 'active' ? 'success' : 'neutral'}>
                          {emp.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleOpen360(emp.id, emp)}
                          className="px-2.5 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-md font-semibold text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" /> 360 View
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

      {/* Modal: Register Employee */}
      <Modal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        title="Register New Employee"
        maxWidth="xl"
      >
        <form onSubmit={handleRegisterEmployee} className="space-y-4 text-xs">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Employee Code *</label>
              <input
                type="text"
                required
                value={empCode}
                onChange={(e) => setEmpCode(e.target.value)}
                placeholder="EMP-001"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">First Name *</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ahmed"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Last Name *</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Khan"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Work Email *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ahmed.khan@company.com"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+92 300 1234567"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Department</label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Designation</label>
              <select
                value={selectedDesig}
                onChange={(e) => setSelectedDesig(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
              >
                <option value="">Select Designation</option>
                {designations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Joining Date</label>
              <input
                type="date"
                required
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
          </div>

          {/* Salary Structure Calculator Box */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <label className="block font-semibold text-gray-800 mb-1">
              Basic Salary (PKR) *
            </label>
            <input
              type="number"
              required
              value={basicSalary}
              onChange={(e) => setBasicSalary(Number(e.target.value))}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 font-bold"
            />

            <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <span className="text-gray-500">House Rent (HRA 40%):</span>
                <p className="font-semibold text-gray-900">
                  PKR {salaryBreakdown.hra.toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Medical (10%):</span>
                <p className="font-semibold text-gray-900">
                  PKR {salaryBreakdown.medical.toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-brand-600 font-bold">Gross Salary (150%):</span>
                <p className="font-extrabold text-brand-700 text-sm">
                  PKR {salaryBreakdown.gross.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsRegisterOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting}>
              Register Employee & Create Login
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Credentials Issued */}
      <Modal
        isOpen={createdCredentials !== null}
        onClose={() => setCreatedCredentials(null)}
        title="Employee Login Created Successfully"
      >
        <div className="space-y-4 text-xs">
          <p className="text-gray-600">
            A self-service user login has been created for the registered employee. Please share these temporary credentials:
          </p>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-1 font-mono text-[11px]">
            <p className="text-emerald-900">
              <strong>Email:</strong> {createdCredentials?.email}
            </p>
            <p className="text-emerald-900">
              <strong>Temporary Password:</strong> {createdCredentials?.tempPass}
            </p>
          </div>

          <p className="text-[10px] text-gray-400">
            The employee will be required to change this password on their first sign-in.
          </p>

          <div className="flex justify-end">
            <Button size="sm" onClick={() => setCreatedCredentials(null)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: CSV Import with File Upload & Dry-Run */}
      <Modal
        isOpen={isImportOpen}
        onClose={() => {
          setIsImportOpen(false);
          setDryRunReport(null);
          setCsvFileName(null);
          setCsvFileSize(null);
        }}
        title="Import Employees via CSV"
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs">
          {/* Header Bar with Mode Switcher & Download Sample Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-100">
            <div className="flex bg-gray-100 p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setCsvTab('upload')}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                  csvTab === 'upload' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Upload className="w-3.5 h-3.5" /> Upload File
              </button>
              <button
                type="button"
                onClick={() => setCsvTab('manual')}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                  csvTab === 'manual' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Paste Raw Text
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-md border border-brand-200 transition-colors self-start cursor-pointer"
            >
              <Download className="w-3 h-3" /> Download Sample CSV Template
            </button>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {csvTab === 'upload' ? (
            <div className="space-y-3">
              {!csvFileName ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) processCsvFile(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-brand-500 bg-brand-50/50'
                      : 'border-gray-300 hover:border-brand-400 hover:bg-gray-50/50'
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 mx-auto flex items-center justify-center mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-900">Click to choose a CSV file</h4>
                  <p className="text-xs text-gray-500 mt-1">or drag and drop your spreadsheet file here</p>
                  <p className="text-[10px] text-gray-400 mt-2 font-mono">
                    Supported columns: Employee Code, First Name, Last Name, Email, Basic Salary, Joining Date
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">{csvFileName}</p>
                      <p className="text-[11px] text-gray-500">
                        {csvFileSize} · {csvContent.split('\n').filter((l) => l.trim()).length - 1} row(s) loaded
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-brand-600 hover:underline font-semibold cursor-pointer"
                    >
                      Replace File
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCsvFileName(null);
                        setCsvFileSize(null);
                        setCsvContent('');
                        setDryRunReport(null);
                      }}
                      className="text-gray-400 hover:text-rose-600 p-1 cursor-pointer"
                      title="Remove file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Paste CSV Content (with headers)
              </label>
              <textarea
                rows={6}
                value={csvContent}
                onChange={(e) => {
                  setCsvContent(e.target.value);
                  setDryRunReport(null);
                }}
                placeholder={`Employee Code,First Name,Last Name,Email,Basic Salary,Joining Date\nEMP-101,Bilal,Tariq,bilal@company.com,75000,2026-01-15\nEMP-102,Sana,Sheikh,sana@company.com,90000,2026-02-01`}
                className="w-full bg-white border border-gray-200 rounded-lg p-3 text-xs font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          )}

          {dryRunReport && (
            <div
              className={`p-3 rounded-lg border text-xs ${
                dryRunReport.can_proceed
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {dryRunReport.can_proceed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <X className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <p className="font-bold">
                  Dry-run results: {dryRunReport.valid_count} valid row(s), {dryRunReport.error_count} error(s).
                </p>
              </div>

              {dryRunReport.errors?.length > 0 && (
                <div className="mt-2 space-y-1 max-h-36 overflow-y-auto pl-6">
                  {dryRunReport.errors.map((e: any, idx: number) => (
                    <p key={idx} className="text-[11px]">
                      Row {e.row}: <strong>{e.field}</strong> — {e.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsImportOpen(false);
                setDryRunReport(null);
                setCsvFileName(null);
                setCsvFileSize(null);
              }}
            >
              Cancel
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleRunDryRunImport}
              isLoading={isImporting}
              disabled={!csvContent.trim()}
            >
              Test Validation (Dry-Run)
            </Button>

            {dryRunReport?.can_proceed && (
              <Button size="sm" onClick={handleCommitImport} isLoading={isImporting}>
                Commit & Import ({dryRunReport.valid_count} employees)
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Employee 360 Drawer */}
      {is360Open && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          <div
            className="fixed inset-0 bg-gray-900/30 backdrop-blur-xs"
            onClick={handleClose360}
          />
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col z-10 border-l border-gray-200 p-6 overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {selectedEmpHeader ? (
                    `${selectedEmpHeader.first_name} ${selectedEmpHeader.last_name}`
                  ) : (
                    <Skeleton className="h-5 w-40" />
                  )}
                </h3>
                <p className="text-xs text-gray-500 font-mono">
                  {selectedEmpHeader ? (
                    `${selectedEmpHeader.employee_code} · ${selectedEmpHeader.department?.name || 'General'}`
                  ) : (
                    <Skeleton className="h-3.5 w-28 mt-1" />
                  )}
                </p>
              </div>
              <button
                onClick={handleClose360}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {emp360Loading || !selectedEmp360 ? (
              <Employee360Skeleton />
            ) : (
              <div className="space-y-4 text-xs">
                {/* Compensation Overview */}
                <div>
                  <h4 className="font-bold text-gray-900 mb-2 uppercase tracking-wider text-[11px]">
                    Compensation Structure
                  </h4>
                  <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div>
                      <span className="text-gray-500">Basic Salary:</span>
                      <p className="font-semibold text-gray-900">
                        PKR {Number(selectedEmp360.employee.basic_salary).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">House Rent (HRA 40%):</span>
                      <p className="font-semibold text-gray-900">
                        PKR {Number(selectedEmp360.employee.hra).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Medical Allowance (10%):</span>
                      <p className="font-semibold text-gray-900">
                        PKR {Number(selectedEmp360.employee.medical).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-brand-600 font-bold">Total Gross (150%):</span>
                      <p className="font-bold text-brand-700">
                        PKR {Number(selectedEmp360.employee.gross_salary).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Monthly Attendance Summary */}
                <div>
                  <h4 className="font-bold text-gray-900 mb-2 uppercase tracking-wider text-[11px]">
                    Current Month Attendance
                  </h4>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">
                      <span className="text-[10px] text-emerald-600 font-medium">Present</span>
                      <p className="text-lg font-bold text-emerald-800">
                        {selectedEmp360.attendanceStats.present}
                      </p>
                    </div>
                    <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-100">
                      <span className="text-[10px] text-amber-600 font-medium">Late</span>
                      <p className="text-lg font-bold text-amber-800">
                        {selectedEmp360.attendanceStats.late}
                      </p>
                    </div>
                    <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-100">
                      <span className="text-[10px] text-blue-600 font-medium">Half Days</span>
                      <p className="text-lg font-bold text-blue-800">
                        {selectedEmp360.attendanceStats.half_day}
                      </p>
                    </div>
                    <div className="bg-rose-50 p-2.5 rounded-lg border border-rose-100">
                      <span className="text-[10px] text-rose-600 font-medium">Absent</span>
                      <p className="text-lg font-bold text-rose-800">
                        {selectedEmp360.attendanceStats.absent}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Leave Balances */}
                <div>
                  <h4 className="font-bold text-gray-900 mb-2 uppercase tracking-wider text-[11px]">
                    Leave Balances
                  </h4>
                  <div className="space-y-1.5">
                    {selectedEmp360.leaveBalances.map((lb: any) => (
                      <div
                        key={lb.leave_type_id}
                        className="p-2.5 bg-gray-50 rounded-lg flex items-center justify-between border border-gray-100"
                      >
                        <span className="font-medium text-gray-800">{lb.leave_type_name}</span>
                        <span className="font-bold text-gray-900">
                          {lb.quota > 0 ? `${lb.balance} / ${lb.quota} days left` : 'Unlimited'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Biometric Face Profile & Re-Enrollment */}
                <div>
                  <h4 className="font-bold text-gray-900 mb-2 uppercase tracking-wider text-[11px]">
                    Biometric Face Attendance Profile
                  </h4>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {selectedEmp360.employee.face_descriptor?.photo_url ? (
                        <img
                          src={selectedEmp360.employee.face_descriptor.photo_url}
                          alt="Face Profile"
                          className="w-10 h-10 rounded-lg object-cover border border-emerald-500"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400">
                          <Camera className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-900">
                            {selectedEmp360.employee.face_enrolled
                              ? 'Biometric Face Enrolled'
                              : 'Face Not Enrolled'}
                          </span>
                          <Badge
                            variant={selectedEmp360.employee.face_enrolled ? 'success' : 'warning'}
                            className="text-[9px]"
                          >
                            {selectedEmp360.employee.face_enrolled ? 'Active (5 Frames)' : 'Pending'}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-gray-500">
                          {selectedEmp360.employee.face_enrolled
                            ? 'Employee can check in using webcam biometric matching'
                            : 'Must enroll live face before camera check-in is permitted'}
                        </p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-[11px]"
                      onClick={() => setEnrollEmpTarget(selectedEmp360.employee)}
                    >
                      <Camera className="w-3.5 h-3.5 mr-1" />
                      {selectedEmp360.employee.face_enrolled ? 'Re-Enroll Face' : 'Enroll Face'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Face Enrollment Modal for HR/Admin */}
      {enrollEmpTarget && (
        <FaceEnrollmentModal
          isOpen={!!enrollEmpTarget}
          onClose={() => setEnrollEmpTarget(null)}
          employeeId={enrollEmpTarget.id}
          employeeName={`${enrollEmpTarget.first_name} ${enrollEmpTarget.last_name}`}
          onSuccess={(updated) => {
            setEnrollEmpTarget(null);
            loadData();
            if (selectedEmp360 && selectedEmp360.employee.id === updated.id) {
              setSelectedEmp360({
                ...selectedEmp360,
                employee: updated,
              });
            }
          }}
        />
      )}
    </div>
  );
};

