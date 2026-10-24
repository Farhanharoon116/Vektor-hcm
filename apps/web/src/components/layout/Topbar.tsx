import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Sparkles, LogOut, CheckCheck } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { api } from '../../lib/api';

interface TopbarProps {
  onOpenAI: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onOpenAI }) => {
  const { user, company, logout } = useAuthStore();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      const data = await api.get('/notifications');
      setNotifications(data.notifications || []);
    } catch (err) {
      // ignore
    }
  };

  const handleToggleNotifications = () => {
    const next = !showNotifications;
    setShowNotifications(next);
    if (next) {
      loadNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      // ignore
    }
  };

  const handleNotificationClick = async (n: any) => {
    try {
      if (!n.is_read) {
        await api.patch(`/notifications/${n.id}/read`).catch(() => {});
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
        );
      }
      if (n.link) {
        setShowNotifications(false);
        navigate(n.link);
      }
    } catch (err) {
      // ignore
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 fixed top-0 right-0 left-64 z-10 px-8 flex items-center justify-between">
      {/* Title / Company */}
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold text-gray-800">
          {company?.name || 'Vektor Human Capital'}
        </h2>
      </div>

      {/* Action items */}
      <div className="flex items-center gap-4">
        {/* Ask AI Assistant Button */}
        <button
          onClick={onOpenAI}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-brand-600 to-indigo-600 text-white text-xs font-semibold shadow-sm hover:opacity-95 transition-all cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          <span>Ask Vektor AI</span>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={handleToggleNotifications}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 relative transition-colors cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white"></span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
              <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-gray-900">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-brand-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck className="w-3 h-3" /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                {notifications.length === 0 ? (
                  <p className="text-xs text-gray-400 py-6 text-center">No notifications yet</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-3 text-xs transition-colors cursor-pointer hover:bg-gray-50 ${
                        n.is_read ? 'opacity-70 bg-white' : 'bg-brand-50/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-semibold text-gray-900 leading-tight">{n.title}</p>
                        {!n.is_read && (
                          <span className="w-2 h-2 rounded-full bg-brand-600 shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-gray-600 mt-1 leading-snug">{n.message}</p>
                      <span className="text-[10px] text-gray-400 mt-1.5 block">
                        {new Date(n.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile & Sign Out */}
        <div className="flex items-center gap-3 pl-3 border-l border-gray-200">
          <div className="text-right">
            <p className="text-xs font-semibold text-gray-900 truncate max-w-[150px]">
              {user?.email}
            </p>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">{user?.role}</span>
          </div>

          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
