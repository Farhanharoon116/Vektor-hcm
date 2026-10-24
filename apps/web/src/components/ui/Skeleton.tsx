import React from 'react';
import { Card } from './Card';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', ...props }) => {
  return (
    <div
      className={`animate-pulse bg-gray-200/80 rounded-md ${className}`}
      {...props}
    />
  );
};

/**
 * Customized Theme Skeleton for Admin / HR / Employee Dashboards
 */
export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>

      {/* AI Summary Banner Skeleton */}
      <Card className="p-4 border-brand-100 bg-brand-50/20">
        <div className="flex items-start gap-3">
          <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      </Card>

      {/* 4 Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="w-9 h-9 rounded-xl" />
            </div>
            <Skeleton className="h-7 w-32 rounded-md" />
            <Skeleton className="h-3 w-28" />
          </Card>
        ))}
      </div>

      {/* 2 Big Dashboard Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3.5 w-12" />
                </div>
                <Skeleton className="h-2.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

/**
 * Customized Theme Skeleton for Data Tables (Employees, Attendance, Payroll, Leave Approvals, Users, Audit)
 */
export const TableSkeleton: React.FC<{
  title?: string;
  subtitle?: string;
  columns?: number;
  rows?: number;
  hasFilter?: boolean;
}> = ({
  columns = 5,
  rows = 6,
  hasFilter = true,
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48 rounded-lg" />
          <Skeleton className="h-4 w-80 rounded-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>

      {/* Filter and Search Bar */}
      {hasFilter && (
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <Skeleton className="h-9 w-full sm:w-72 rounded-lg" />
            <div className="flex gap-2 w-full sm:w-auto">
              <Skeleton className="h-9 w-32 rounded-lg" />
              <Skeleton className="h-9 w-32 rounded-lg" />
            </div>
          </div>
        </Card>
      )}

      {/* Table Card */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-24" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {Array.from({ length: columns }).map((_, idx) => (
                  <th key={idx} className="p-3 text-left">
                    <Skeleton className="h-3.5 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Array.from({ length: rows }).map((_, rIdx) => (
                <tr key={rIdx} className="hover:bg-gray-50/50">
                  {/* First column with avatar and name */}
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                      <div className="space-y-1">
                        <Skeleton className="h-3.5 w-32" />
                        <Skeleton className="h-2.5 w-20" />
                      </div>
                    </div>
                  </td>
                  {/* Other columns */}
                  {Array.from({ length: columns - 1 }).map((_, cIdx) => (
                    <td key={cIdx} className="p-3">
                      {cIdx === columns - 2 ? (
                        <Skeleton className="h-5 w-20 rounded-full" />
                      ) : (
                        <Skeleton className="h-3.5 w-24" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer pagination */}
        <div className="p-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-1.5">
            <Skeleton className="h-7 w-16 rounded" />
            <Skeleton className="h-7 w-16 rounded" />
          </div>
        </div>
      </Card>
    </div>
  );
};

/**
 * Customized Theme Skeleton for Employee Profile Page
 */
export const ProfileSkeleton: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Title */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-40 rounded-lg" />
        <Skeleton className="h-4 w-96 rounded-md" />
      </div>

      <Card className="p-6 space-y-6">
        {/* Profile Header */}
        <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
          <Skeleton className="w-16 h-16 rounded-2xl shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-48 rounded" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-64" />
            <Skeleton className="h-3.5 w-52" />
          </div>
        </div>

        {/* Biometric Enrollment Card Skeleton */}
        <div className="py-2 border-b border-gray-100 space-y-3">
          <Skeleton className="h-5 w-60" />
          <Skeleton className="h-3.5 w-96" />
          <div className="bg-gray-50/80 rounded-xl p-4 border border-gray-200/80 flex items-center gap-6">
            <Skeleton className="w-24 h-24 rounded-xl shrink-0" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-32 rounded-lg" />
                <Skeleton className="h-8 w-36 rounded-lg" />
              </div>
            </div>
          </div>
        </div>

        {/* 4 Detail Columns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-b border-gray-100">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-28" />
            </div>
          ))}
        </div>

        {/* Form Skeleton */}
        <div className="space-y-4 pt-2">
          <Skeleton className="h-5 w-48" />
          <div className="space-y-3">
            <div className="space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
            <Skeleton className="h-8 w-40 rounded-lg" />
          </div>
        </div>
      </Card>
    </div>
  );
};

/**
 * Customized Theme Skeleton for Card Grids (My Leaves, My Payslips, Company Settings)
 */
export const CardGridSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48 rounded-lg" />
        <Skeleton className="h-4 w-72 rounded-md" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <Card key={i} className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="w-8 h-8 rounded-lg" />
            </div>
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-3 w-32" />
          </Card>
        ))}
      </div>

      <Card className="p-6 space-y-4">
        <Skeleton className="h-5 w-40" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-between items-center py-3 border-b border-gray-50">
              <div className="space-y-1">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

/**
 * Skeleton for Employee 360 View Drawer
 * Matches the 4 cards: Compensation Structure, Current Month Attendance, Leave Balances, Biometric Profile
 */
export const Employee360Skeleton: React.FC = () => {
  return (
    <div className="space-y-5 text-xs animate-in fade-in duration-150">
      {/* 1. Compensation Structure */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-3 w-40" />
        </div>
        <div className="grid grid-cols-2 gap-3 bg-gray-50/80 p-3.5 rounded-xl border border-gray-100">
          <div className="space-y-1.5">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-2.5 w-28" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-2.5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-2.5 w-28" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>

      {/* 2. Current Month Attendance */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-3 w-44" />
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100/70 flex flex-col items-center gap-1.5">
            <Skeleton className="h-2.5 w-10 bg-emerald-200/60" />
            <Skeleton className="h-6 w-8 bg-emerald-200/80 rounded" />
          </div>
          <div className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-100/70 flex flex-col items-center gap-1.5">
            <Skeleton className="h-2.5 w-8 bg-amber-200/60" />
            <Skeleton className="h-6 w-8 bg-amber-200/80 rounded" />
          </div>
          <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/70 flex flex-col items-center gap-1.5">
            <Skeleton className="h-2.5 w-12 bg-blue-200/60" />
            <Skeleton className="h-6 w-8 bg-blue-200/80 rounded" />
          </div>
          <div className="bg-rose-50/50 p-2.5 rounded-lg border border-rose-100/70 flex flex-col items-center gap-1.5">
            <Skeleton className="h-2.5 w-10 bg-rose-200/60" />
            <Skeleton className="h-6 w-8 bg-rose-200/80 rounded" />
          </div>
        </div>
      </div>

      {/* 3. Leave Balances */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="space-y-1.5">
          {['Annual', 'Casual', 'Sick', 'Unpaid'].map((name) => (
            <div
              key={name}
              className="p-2.5 bg-gray-50/80 rounded-lg flex items-center justify-between border border-gray-100"
            >
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 w-28" />
            </div>
          ))}
        </div>
      </div>

      {/* 4. Biometric Face Attendance Profile */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-3 w-56" />
        </div>
        <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-4 w-14 rounded-full" />
              </div>
              <Skeleton className="h-2.5 w-56" />
            </div>
          </div>
          <Skeleton className="h-8 w-24 rounded-lg shrink-0" />
        </div>
      </div>
    </div>
  );
};

