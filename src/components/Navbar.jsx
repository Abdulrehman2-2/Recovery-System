import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Sun,
  Moon,
  LayoutDashboard,
  Users,
  AlertTriangle,
  Receipt,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  WalletCards,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import { formatDate } from '../utils/formatters';

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { notifications, unreadCount, refreshNotifications } = useNotifications();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (customerId) => {
    setDropdownOpen(false);
    if (customerId) {
      navigate(`/customers/${customerId}`);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await refreshNotifications();
    setTimeout(() => setRefreshing(false), 500);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700 shadow-sm transition-colors duration-150">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Brand Logo & Title */}
          <div className="flex items-center gap-8">
            <Link
              to="/"
              className="flex items-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-teal rounded-lg p-1"
            >
              <div className="w-9 h-9 rounded-lg bg-teal flex items-center justify-center text-white shadow-sm font-black">
                <WalletCards className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  PayMate
                  <span className="text-[10px] font-semibold tracking-normal uppercase px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-mint border border-teal-200 dark:border-teal-800/60">
                    Recovery
                  </span>
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Receivables Dashboard
                </span>
              </div>
            </Link>

            {/* Main Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-teal-50 text-teal-700 dark:bg-navy-800 dark:text-mint border-b-2 border-teal dark:border-mint'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-navy-800'
                  }`
                }
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </NavLink>

              <NavLink
                to="/customers"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-teal-50 text-teal-700 dark:bg-navy-800 dark:text-mint border-b-2 border-teal dark:border-mint'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-navy-800'
                  }`
                }
              >
                <Users className="w-4 h-4" />
                Customers
              </NavLink>
            </nav>
          </div>

          {/* Right Controls: Theme Toggle & Notifications Bell */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-navy-800 border border-transparent hover:border-slate-200 dark:hover:border-navy-700 transition"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-slate-600" />
              )}
            </button>

            {/* Notification Bell Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className={`relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-navy-800 border ${
                  dropdownOpen
                    ? 'border-teal bg-teal-50/50 dark:bg-navy-800 dark:border-teal'
                    : 'border-transparent hover:border-slate-200 dark:hover:border-navy-700'
                } transition`}
                aria-label="Notifications"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-navy-900">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg shadow-xl overflow-hidden z-50 animate-in fade-in-50 duration-100">
                  {/* Dropdown Header */}
                  <div className="px-4 py-3 bg-slate-50 dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-teal dark:text-mint" />
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Notifications
                      </h4>
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-300">
                        {unreadCount}
                      </span>
                    </div>

                    <button
                      onClick={handleManualRefresh}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-700 transition"
                      title="Refresh Notifications"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-teal' : ''}`}
                      />
                    </button>
                  </div>

                  {/* Notification List */}
                  <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-navy-700">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          All caught up!
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          No open flags or pending payment proofs.
                        </p>
                      </div>
                    ) : (
                      notifications.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleNotificationClick(item.customerId)}
                          className={`p-3.5 flex items-start gap-3 cursor-pointer transition hover:bg-slate-50 dark:hover:bg-navy-700/60 ${
                            item.type === 'flag'
                              ? 'border-l-4 border-l-rose-500 bg-rose-50/20 dark:bg-rose-950/10'
                              : 'border-l-4 border-l-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10'
                          }`}
                        >
                          <div
                            className={`p-2 rounded-md shrink-0 mt-0.5 ${
                              item.type === 'flag'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}
                          >
                            {item.type === 'flag' ? (
                              <AlertTriangle className="w-4 h-4" />
                            ) : (
                              <Receipt className="w-4 h-4" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-xs font-bold leading-tight ${
                                item.type === 'flag'
                                  ? 'text-rose-900 dark:text-rose-200'
                                  : 'text-emerald-900 dark:text-emerald-200'
                              }`}
                            >
                              {item.title}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 font-medium truncate">
                              {item.subtitle}
                            </p>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              {formatDate(item.timestamp, true)}
                            </span>
                          </div>

                          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 self-center" />
                        </div>
                      ))
                    )}
                  </div>

                  {/* Dropdown Footer */}
                  {notifications.length > 0 && (
                    <div className="p-2 bg-slate-50 dark:bg-navy-900 border-t border-slate-200 dark:border-navy-700 text-center">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Auto-updates every 30 seconds
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile navigation row */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-200 dark:border-navy-700 py-2 bg-slate-50 dark:bg-navy-900">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold ${
              isActive
                ? 'bg-teal-100 text-teal-800 dark:bg-navy-800 dark:text-mint'
                : 'text-slate-600 dark:text-slate-300'
            }`
          }
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          Dashboard
        </NavLink>
        <NavLink
          to="/customers"
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold ${
              isActive
                ? 'bg-teal-100 text-teal-800 dark:bg-navy-800 dark:text-mint'
                : 'text-slate-600 dark:text-slate-300'
            }`
          }
        >
          <Users className="w-3.5 h-3.5" />
          Customers
        </NavLink>
      </div>
    </header>
  );
}
