import React from 'react';
import {
  LayoutDashboard,
  PieChart,
  Inbox,
  FolderTree,
  Coins,
  FileSpreadsheet,
  FileText,
  Database,
  HelpCircle,
  HardHat,
  AlertTriangle,
  ArrowRightLeft,
  Power,
  ChevronRight,
  X,
  CalendarClock,
  Layers,
  MapPin,
  Wrench
} from 'lucide-react';
import { UserProfile, Project } from '../types/project';
import { isProjectCompletedOrDisbursed, isProjectInMyInbox } from '../utils/thaiDate';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  currentUser: UserProfile;
  onOpenLoginModal: () => void;
  onLogout: () => void;
  projects: Project[];
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  isDesktopCollapsed?: boolean;
  onSelectCategoryFilter?: (category: string) => void;
  selectedCategory?: string;
  pendingSarabanCount?: number;
  openRepairCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  currentUser,
  onOpenLoginModal,
  onLogout,
  projects,
  isMobileOpen,
  setIsMobileOpen,
  isDesktopCollapsed = false,
  onSelectCategoryFilter,
  selectedCategory = 'all',
  pendingSarabanCount = 0,
  openRepairCount = 0
}) => {
  const isAdmin = currentUser.role === 'admin';
  const overdueCount = projects.filter(p => p.status === 'overdue' && !isProjectCompletedOrDisbursed(p)).length;

  // นับเฉพาะโครงการที่มีข้อมูลตั้งแต่แท็บ 2 (TOR/ราคากลาง) ขึ้นไป และยังไม่ปิดสถานะเสร็จสิ้น/เบิกจ่ายแล้ว หรือยกเลิก
  const myInboxCount = projects.filter(p => isProjectInMyInbox(p, currentUser)).length;

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Main Sidebar Desktop / Drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-gradient-to-b from-emerald-800 via-emerald-900 to-teal-950 text-white border-r border-emerald-700/40 flex flex-col transition-transform duration-300 ease-in-out shadow-xl shadow-emerald-950/25 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
          isDesktopCollapsed ? 'lg:-translate-x-full' : 'lg:translate-x-0'
        } no-print shrink-0`}
      >
        {/* Header Branding */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-950/30 ring-1 ring-white/25 shrink-0">
              <HardHat className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight font-heading text-white">งานโครงการกองช่าง</h2>
              <span className="text-xs text-emerald-200/80">อบต.ไร่ใต้ จ.อุบลราชธานี</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden text-emerald-200 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info Badge */}
        <div className="p-3 mx-3 my-2.5 bg-white/10 backdrop-blur-xs rounded-xl border border-white/15 flex items-center space-x-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center font-bold text-sm text-white ring-2 ring-white/20 shrink-0">
            {currentUser.displayName.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <div className="text-sm font-medium text-white truncate">
              {currentUser.displayName}
            </div>
            <div className="text-xs text-emerald-200 truncate">
              สถานะ: {currentUser.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'เจ้าหน้าที่ (Staff)'}
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto py-1 text-sm custom-sidebar-scroll scroll-smooth">
          {/* 1. สรุปผลงานโครงการ (Dashboard) */}
          <button
            onClick={() => {
              setCurrentTab('dashboard');
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium transition ${
              currentTab === 'dashboard'
                ? 'bg-gradient-to-r from-emerald-500/95 to-teal-500/90 text-white shadow-md shadow-emerald-950/30 ring-1 ring-white/20'
                : 'text-emerald-100/85 hover:bg-white/10 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-center shrink-0" />
            <span>สรุปผลงานโครงการ</span>
          </button>

          {/* 2. กล่องงานของฉัน (My Inbox - เฉพาะ Admin) */}
          {isAdmin && (
            <button
              onClick={() => {
                setCurrentTab('myInbox');
                setIsMobileOpen(false);
              }}
              title={
                pendingSarabanCount > 0
                  ? `มีเอกสารจากสารบรรณรอรับเข้า ${pendingSarabanCount} รายการ`
                  : undefined
              }
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium transition ${
                currentTab === 'myInbox'
                  ? 'bg-gradient-to-r from-emerald-500/95 to-teal-500/90 text-white shadow-md shadow-emerald-950/30 border border-emerald-300/60'
                  : 'text-emerald-100/85 hover:bg-white/10 hover:text-white border border-transparent'
              }`}
            >
              <Inbox className="w-4 h-4 text-emerald-200 shrink-0" />
              <span className="flex-1 text-left truncate">กล่องงานของฉัน</span>
              {pendingSarabanCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold tabular-nums bg-amber-400 text-slate-950 shrink-0">
                  +{pendingSarabanCount}
                </span>
              )}
              <span
                className={`text-xs px-2.5 py-0.5 rounded-lg font-bold tabular-nums transition-all shrink-0 ${
                  currentTab === 'myInbox'
                    ? 'bg-sky-500 text-white border-2 border-white shadow-[0_0_14px_rgba(56,189,248,0.95)] ring-2 ring-sky-300/70'
                    : 'bg-sky-500 text-white border border-sky-200 shadow-[0_0_12px_rgba(56,189,248,0.8)] ring-2 ring-sky-400/50'
                }`}
              >
                {myInboxCount}
              </span>
            </button>
          )}

          {/* 4. ติดตามสถานะโครงการ (Timeline 12 ขั้นตอน) */}
          <button
            onClick={() => {
              setCurrentTab('timeline');
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium transition ${
              currentTab === 'timeline'
                ? 'bg-gradient-to-r from-emerald-500/95 to-teal-500/90 text-white shadow-md shadow-emerald-950/30 ring-1 ring-white/20'
                : 'text-emerald-100/85 hover:bg-white/10 hover:text-white'
            }`}
          >
            <CalendarClock className="w-4 h-4 text-teal-200 shrink-0" />
            <span>ติดตามสถานะโครงการ</span>
          </button>

          {/* Section: ทะเบียนแยกตามหมวดงบประมาณ (แสดงเฉพาะหมวดที่มีโครงการบันทึกอยู่) */}
          <div className="pt-3 pb-1 px-3 text-[11px] font-semibold text-emerald-300/70 uppercase tracking-wider">
            ทะเบียนแยกตามหมวดงบ
          </div>

          {/* รวมทะเบียนโครงการทั้งหมด */}
          <button
            onClick={() => {
              onSelectCategoryFilter?.('all');
              setCurrentTab('projects');
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl transition ${
              currentTab === 'projects' && (selectedCategory === 'all' || !selectedCategory)
                ? 'bg-gradient-to-r from-emerald-500/95 to-teal-500/90 text-white font-bold border border-emerald-200/70 shadow-md ring-2 ring-emerald-300/25'
                : 'text-emerald-100/85 hover:bg-white/10 hover:text-white border border-transparent font-medium text-xs'
            }`}
          >
            <FolderTree className="w-4 h-4 text-emerald-200 shrink-0" />
            <span className="flex-1 text-left">รวมทะเบียนทั้งหมด</span>
          </button>

          {/* Dynamic Categories: Only show categories that have recorded projects */}
          {Array.from(new Set(projects.map(p => p.budgetCategory).filter(Boolean)))
            .sort((a, b) => a.localeCompare(b, 'th'))
            .map(cat => {
              const isSelected = currentTab === 'projects' && selectedCategory === cat;

              return (
                <button
                  key={cat}
                  onClick={() => {
                    onSelectCategoryFilter?.(cat);
                    setCurrentTab('projects');
                    setIsMobileOpen(false);
                  }}
                  className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs transition ${
                    isSelected
                      ? 'bg-white/15 text-white font-bold border border-emerald-300/75 shadow-sm ring-2 ring-emerald-300/25'
                      : 'text-emerald-100/80 hover:bg-white/10 hover:text-white border border-transparent font-medium'
                  }`}
                >
                  <Layers className={`w-4 h-4 shrink-0 ${isSelected ? 'text-emerald-200' : 'text-emerald-300/70'}`} />
                  <span className="flex-1 text-left truncate" title={cat}>
                    {cat}
                  </span>
                </button>
              );
            })}

          {/* Section: รายงานและติดตาม */}
          <div className="pt-3 pb-1 px-3 text-[11px] font-semibold text-emerald-300/70 uppercase tracking-wider">
            รายงานและติดตาม
          </div>

          {/* ข้อมูลโครงการย้อนหลัง (พิกัด & รูปภาพ) */}
          <button
            onClick={() => {
              setCurrentTab('project_records');
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium transition ${
              currentTab === 'project_records'
                ? 'bg-gradient-to-r from-emerald-500/95 to-teal-500/90 text-white shadow-md shadow-emerald-950/30 ring-1 ring-white/20'
                : 'text-emerald-100/85 hover:bg-white/10 hover:text-white'
            }`}
          >
            <MapPin className="w-4 h-4 text-teal-200 shrink-0" />
            <span className="flex-1 text-left">ข้อมูลโครงการ</span>
          </button>

          {/* คำร้อง/งานซ่อมแซม (รับเรื่องร้องทุกข์ถนนและติดตามการแก้ไข) */}
          <button
            onClick={() => {
              setCurrentTab('repair_requests');
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium transition ${
              currentTab === 'repair_requests'
                ? 'bg-gradient-to-r from-emerald-500/95 to-teal-500/90 text-white shadow-md shadow-emerald-950/30 ring-1 ring-white/20'
                : 'text-emerald-100/85 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Wrench className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="flex-1 text-left truncate">คำร้อง/งานซ่อมแซม</span>
            {openRepairCount > 0 && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold tabular-nums shrink-0 ${
                  currentTab === 'repair_requests'
                    ? 'bg-white/25 text-white'
                    : 'bg-amber-400/20 text-amber-200'
                }`}
              >
                {openRepairCount}
              </span>
            )}
          </button>

          {/* รายงานฎีกา & เบิกจ่าย */}
          <button
            onClick={() => {
              setCurrentTab('vouchersSummary');
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium transition ${
              currentTab === 'vouchersSummary'
                ? 'bg-gradient-to-r from-emerald-500/95 to-teal-500/90 text-white shadow-md shadow-emerald-950/30 ring-1 ring-white/20'
                : 'text-emerald-100/85 hover:bg-white/10 hover:text-white'
            }`}
          >
            <PieChart className="w-4 h-4 text-emerald-300 shrink-0" />
            <span className="flex-1 text-left">รายงานฎีกา & เบิกจ่าย</span>
          </button>

          {/* งานเกินกำหนด */}
          <button
            onClick={() => {
              setCurrentTab('overdue');
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium transition ${
              currentTab === 'overdue'
                ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-md shadow-rose-950/30 ring-1 ring-white/20'
                : 'text-emerald-100/85 hover:bg-white/10 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
            <span className="flex-1 text-left">งานเกินกำหนดสัญญา</span>
            {overdueCount > 0 && (
              <span className="bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full font-bold tabular-nums">
                {overdueCount}
              </span>
            )}
          </button>

          {/* รายงานและส่งออก */}
          <button
            onClick={() => {
              setCurrentTab('reports');
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium transition ${
              currentTab === 'reports'
                ? 'bg-gradient-to-r from-emerald-500/95 to-teal-500/90 text-white shadow-md shadow-emerald-950/30 ring-1 ring-white/20'
                : 'text-emerald-100/85 hover:bg-white/10 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>รายงาน & สถิติโครงการ</span>
          </button>

          {/* นำเข้าข้อมูล Excel (เฉพาะ Admin ตามข้อ 7) */}
          {isAdmin && (
            <button
              onClick={() => {
                setCurrentTab('excel_import');
                setIsMobileOpen(false);
              }}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium transition ${
                currentTab === 'excel_import'
                  ? 'bg-gradient-to-r from-emerald-500/95 to-teal-500/90 text-white shadow-md shadow-emerald-950/30 ring-1 ring-white/20'
                  : 'text-emerald-100/85 hover:bg-white/10 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-teal-200 shrink-0" />
              <span>นำเข้าข้อมูล Excel</span>
            </button>
          )}

          {/* คู่มือ & สรุปผลงาน */}
          <button
            onClick={() => {
              setCurrentTab('manual');
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium transition ${
              currentTab === 'manual'
                ? 'bg-gradient-to-r from-emerald-500/95 to-teal-500/90 text-white shadow-md shadow-emerald-950/30 ring-1 ring-white/20'
                : 'text-emerald-100/85 hover:bg-white/10 hover:text-white'
            }`}
          >
            <HelpCircle className="w-4 h-4 text-amber-300 shrink-0" />
            <span>คู่มือ & สรุปผลงาน</span>
          </button>
        </nav>

        {/* Sidebar Footer Controls */}
        <div className="p-3 border-t border-white/10 space-y-2">
          {currentUser.role === 'admin' && (
            <button
              onClick={onOpenLoginModal}
              className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-50 border border-white/10 text-xs font-medium transition"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>สลับสิทธิ์การใช้งาน</span>
            </button>
          )}
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-400/20 text-xs font-medium transition"
          >
            <Power className="w-3.5 h-3.5" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>
    </>
  );
};

