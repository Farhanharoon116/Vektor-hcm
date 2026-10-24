import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarCheck,
  CreditCard,
  Settings,
  ShieldCheck,
  FileSpreadsheet,
  Camera,
  UserCheck,
  Megaphone,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';

export const Sidebar: React.FC = () => {
  const { user, company } = useAuthStore();
  const role = user?.role || 'employee';

  const adminLinks = [
    { to: '/admin/dashboard', label: 'Company Overview', icon: LayoutDashboard },
    { to: '/admin/settings', label: 'Organization & Rules', icon: Settings },
    { to: '/admin/users', label: 'User & HR Logins', icon: UserCheck },
    { to: '/hr/employees', label: 'Employee Directory', icon: Users },
    { to: '/hr/attendance', label: 'Attendance Board', icon: Clock },
    { to: '/hr/leaves', label: 'Leave Approvals', icon: CalendarCheck },
    { to: '/hr/payroll', label: 'Monthly Payroll', icon: CreditCard },
    { to: '/admin/audit', label: 'Security Audit Log', icon: ShieldCheck },
  ];

  const hrLinks = [
    { to: '/hr/dashboard', label: 'HR Dashboard', icon: LayoutDashboard },
    { to: '/hr/employees', label: 'Employees & 360', icon: Users },
    { to: '/hr/attendance', label: 'Attendance & Clock-ins', icon: Clock },
    { to: '/hr/leaves', label: 'Leave Requests', icon: CalendarCheck },
    { to: '/hr/payroll', label: 'Payroll Runs', icon: CreditCard },
  ];

  const employeeLinks = [
    { to: '/employee/dashboard', label: 'My Dashboard', icon: LayoutDashboard },
    { to: '/employee/attendance', label: 'My Attendance', icon: Clock },
    { to: '/employee/camera-attendance', label: 'Camera Check-in', icon: Camera },
    { to: '/employee/leaves', label: 'My Leaves', icon: CalendarCheck },
    { to: '/employee/payslips', label: 'My Payslips', icon: FileSpreadsheet },
    { to: '/employee/profile', label: 'My Profile', icon: Users },
  ];

  let links = employeeLinks;
  if (role === 'admin') links = adminLinks;
  else if (role === 'hr') links = hrLinks;

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen fixed left-0 top-0 z-20">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center border-b border-gray-100 gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
          V
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-gray-900 tracking-tight text-lg">Vektor</span>
            <span className="font-semibold text-brand-600 text-sm">HCM</span>
          </div>
          <p className="text-[10px] text-gray-400 font-medium truncate max-w-[130px]">
            {company?.name || 'Human Capital'}
          </p>
        </div>
      </div>

      {/* Role Indicator Banner */}
      <div className="px-6 py-2.5 bg-gray-50/70 border-b border-gray-100 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Role
        </span>
        <span
          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
            role === 'admin'
              ? 'bg-purple-100 text-purple-700'
              : role === 'hr'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {role}
        </span>
      </div>

      {/* Nav Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0 text-current opacity-80" />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-gray-100 text-center">
        <p className="text-[11px] text-gray-400">Saylani Hackathon 2026</p>
      </div>
    </aside>
  );
};
