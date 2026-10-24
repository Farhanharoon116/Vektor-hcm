import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/auth.store';
import { AppLayout } from './components/layout/AppLayout';
import { Spinner } from './components/ui/Spinner';

// Pages
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { FirstRunSetupPage } from './pages/setup/FirstRunSetupPage';
import { ChangePasswordPage } from './pages/auth/ChangePasswordPage';

import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { CompanySettingsPage } from './pages/admin/CompanySettingsPage';
import { UserManagementPage } from './pages/admin/UserManagementPage';
import { AuditLogPage } from './pages/admin/AuditLogPage';

import { HRDashboardPage } from './pages/hr/HRDashboardPage';
import { EmployeesPage } from './pages/hr/EmployeesPage';
import { AttendancePage } from './pages/hr/AttendancePage';
import { LeaveApprovalsPage } from './pages/hr/LeaveApprovalsPage';
import { PayrollPage } from './pages/hr/PayrollPage';

import { EmployeeDashboardPage } from './pages/employee/EmployeeDashboardPage';
import { MyAttendancePage } from './pages/employee/MyAttendancePage';
import { CameraAttendancePage } from './pages/employee/CameraAttendancePage';
import { MyLeavesPage } from './pages/employee/MyLeavesPage';
import { MyPayslipsPage } from './pages/employee/MyPayslipsPage';
import { MyProfilePage } from './pages/employee/MyProfilePage';

// Protected Route Guards
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({
  children,
  allowedRoles,
}) => {
  const { user, token, isLoading, isInitialized } = useAuthStore();

  if (isLoading && !isInitialized) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to their own dashboard
    if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'hr') return <Navigate to="/hr/dashboard" replace />;
    return <Navigate to="/employee/dashboard" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  const { fetchMe, user } = useAuthStore();

  useEffect(() => {
    fetchMe();
  }, []);

  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/setup" element={<FirstRunSetupPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />

        {/* Protected Application Routes */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          {/* Admin Routes */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <CompanySettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <UserManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/audit"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AuditLogPage />
              </ProtectedRoute>
            }
          />

          {/* HR & Admin Routes */}
          <Route
            path="/hr/dashboard"
            element={
              <ProtectedRoute allowedRoles={['admin', 'hr']}>
                <HRDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/employees"
            element={
              <ProtectedRoute allowedRoles={['admin', 'hr']}>
                <EmployeesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/attendance"
            element={
              <ProtectedRoute allowedRoles={['admin', 'hr']}>
                <AttendancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/leaves"
            element={
              <ProtectedRoute allowedRoles={['admin', 'hr']}>
                <LeaveApprovalsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr/payroll"
            element={
              <ProtectedRoute allowedRoles={['admin', 'hr']}>
                <PayrollPage />
              </ProtectedRoute>
            }
          />

          {/* Employee Routes */}
          <Route
            path="/employee/dashboard"
            element={
              <ProtectedRoute allowedRoles={['employee']}>
                <EmployeeDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/attendance"
            element={
              <ProtectedRoute allowedRoles={['employee']}>
                <MyAttendancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/camera-attendance"
            element={
              <ProtectedRoute allowedRoles={['employee']}>
                <CameraAttendancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/leaves"
            element={
              <ProtectedRoute allowedRoles={['employee']}>
                <MyLeavesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/payslips"
            element={
              <ProtectedRoute allowedRoles={['employee']}>
                <MyPayslipsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/profile"
            element={
              <ProtectedRoute allowedRoles={['employee']}>
                <MyProfilePage />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Root Redirect */}
        <Route
          path="*"
          element={
            <Navigate
              to={
                user?.role === 'admin'
                  ? '/admin/dashboard'
                  : user?.role === 'hr'
                  ? '/hr/dashboard'
                  : user?.role === 'employee'
                  ? '/employee/dashboard'
                  : '/login'
              }
              replace
            />
          }
        />
      </Routes>
    </>
  );
};
