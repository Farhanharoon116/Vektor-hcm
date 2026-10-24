import React from 'react';
import { Card } from './Card';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, trend }) => {
  return (
    <Card className="flex items-center justify-between hover:border-brand-200 transition-colors">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{value}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        {trend && (
          <p
            className={`text-xs font-medium mt-1 flex items-center gap-1 ${
              trend.isPositive ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            <span>{trend.isPositive ? '↑' : '↓'}</span>
            <span>{trend.value}</span>
          </p>
        )}
      </div>
      {icon && (
        <div className="w-12 h-12 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600">
          {icon}
        </div>
      )}
    </Card>
  );
};
