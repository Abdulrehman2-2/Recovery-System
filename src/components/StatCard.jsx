import React from 'react';
import { Badge } from './Badge';

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  badgeVariant = 'default',
  color = 'teal',
  onClick,
  className = '',
}) {
  const colorMap = {
    teal: 'border-teal-500/30 text-teal-600 dark:text-mint bg-teal-50/50 dark:bg-teal-950/20',
    rose: 'border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20',
    blue: 'border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20',
    emerald: 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20',
    navy: 'border-navy-200 dark:border-navy-700 text-navy-800 dark:text-navy-100 bg-navy-50/50 dark:bg-navy-800/40',
  };

  const selectedTheme = colorMap[color] || colorMap.teal;

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg p-5 shadow-sm transition-all duration-150 ${
        onClick ? 'cursor-pointer hover:border-teal-500/50 hover:shadow-md' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {value}
            </h3>
            {badge && (
              <Badge variant={badgeVariant} className="text-[11px]">
                {badge}
              </Badge>
            )}
          </div>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>

        {Icon && (
          <div
            className={`p-3 rounded-lg border ${selectedTheme} flex items-center justify-center shrink-0 ml-3`}
          >
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}
