import React, { useState } from 'react';
import {
  Menu,
  PlusCircle,
  Bell,
  Search,
  Calendar,
  RotateCcw,
  Printer,
  AlertTriangle,
  Clock,
  HardHat
} from 'lucide-react';
import { Project, UserProfile } from '../types/project';
import { getDaysRemaining, isProjectCompletedOrDisbursed } from '../utils/thaiDate';

interface HeaderProps {
  onOpenMobileMenu: () => void;
  pageTitle: string;
  selectedYear: string | number;
  onSelectYear: (year: string | number) => void;
  availableYears: number[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenNewProjectModal: () => void;
  onResetData: () => void;
  projects: Project[];
  currentUser: UserProfile;
  onSelectProject: (p: Project) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileMenu,
  pageTitle,
  selectedYear,
  onSelectYear,
  availableYears,
  searchQuery,
  onSearchChange,
  onOpenNewProjectModal,
  onResetData,
  projects,
  currentUser,
  onSelectProject
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const isAdmin = currentUser.role === 'admin';

  // Generate notifications for overdue projects and projects expiring within 30 days (หยุดเตือนเมื่อโครงการเสร็จหรือเบิกจ่ายแล้ว)
  const alerts = projects
    .filter(p => !isProjectCompletedOrDisbursed(p))
    .map(p => {
      const remaining = getDaysRemaining(p.endDate);
      const isUrgent =
        (remaining.isOverdue || (remaining.days <= 30 && remaining.days >= 0)) &&
        Boolean(p.endDate);

      return {
        project: p,
        remaining,
        isUrgent
      };
    })
    .filter(a => a.isUrgent);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 md:px-8 shadow-xs no-print">
      {/* Left: Mobile trigger & Page Title */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden text-gray-600 hover:text-gray-900 focus:outline-hidden text-xl p-1"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-base sm:text-lg md:text-xl font-bold text-gray-800 font-heading truncate">
          {pageTitle}
        </h1>
      </div>

      {/* Center / Year Filter */}
      <div className="hidden lg:flex items-center space-x-2 bg-emerald-50/70 border border-emerald-200/80 rounded-xl px-3 py-1.5 shadow-2xs">
        <Calendar className="w-4 h-4 text-emerald-700" />
        <span className="text-xs font-semibold text-emerald-900">ปีงบประมาณ:</span>
        <select
          value={selectedYear}
          onChange={e => onSelectYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="bg-transparent text-xs font-bold text-emerald-950 focus:outline-hidden cursor-pointer"
        >
          <option value="all">ทุกปี (All Years)</option>
          {availableYears.map(yr => (
            <option key={yr} value={yr}>
              ปี พ.ศ. {yr}
            </option>
          ))}
        </select>
      </div>

      {/* Right: Actions & Role Badge */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-xl text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 border border-gray-200 transition"
            title="การแจ้งเตือนงานเกินกำหนดและใกล้ครบสัญญา"
          >
            <Bell className="w-5 h-5" />
            {alerts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse shadow-xs">
                {alerts.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-bold text-gray-800">แจ้งเตือนโครงการ</span>
                </div>
                <span className="text-xs text-gray-500">{alerts.length} รายการ</span>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                {alerts.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-xs">
                    ไม่มีโครงการที่เกินกำหนดหรือใกล้สิ้นสุดสัญญาในขณะนี้
                  </div>
                ) : (
                  alerts.map(({ project, remaining }) => (
                    <button
                      key={project.id}
                      onClick={() => {
                        onSelectProject(project);
                        setShowNotifications(false);
                      }}
                      className="w-full text-left p-3 hover:bg-gray-50 transition flex items-start gap-3"
                    >
                      <div
                        className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                          remaining.isOverdue
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {remaining.isOverdue ? (
                          <AlertTriangle className="w-4 h-4" />
                        ) : (
                          <Clock className="w-4 h-4" />
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-xs font-semibold text-gray-800 line-clamp-1">
                          {project.name}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          สัญญา: {project.contractNo || 'ยังไม่มีสัญญา'}
                        </div>
                        <div className="mt-1">
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              remaining.isOverdue
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {remaining.label}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Add Project Button (Shown for Admin, exactly matching Saraban addDocBtn) */}
        {isAdmin && (
          <button
            onClick={onOpenNewProjectModal}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-medium px-3.5 py-2 rounded-xl shadow-md transition flex items-center space-x-1.5 active:scale-95"
            title="ลงทะเบียนโครงการใหม่"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">ลงทะเบียนโครงการใหม่</span>
            <span className="sm:hidden">เพิ่ม</span>
          </button>
        )}

        {/* Role Badge Container matching Saraban header */}
        <div className="bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-xl flex items-center space-x-2 text-xs font-semibold">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isAdmin ? 'bg-green-500' : 'bg-amber-500'
            }`}
          />
          <span className="text-gray-700 hidden sm:inline">
            {isAdmin ? 'ผู้ดูแลระบบ (Admin)' : 'เจ้าหน้าที่ (Staff)'}
          </span>
        </div>
      </div>
    </header>
  );
};
