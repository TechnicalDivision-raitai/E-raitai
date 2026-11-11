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
  Cloud
} from 'lucide-react';
import { UserProfile, Project } from '../types/project';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  currentUser: UserProfile;
  onOpenLoginModal: () => void;
  onLogout: () => void;
  projects: Project[];
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  onSelectCategoryFilter?: (category: string) => void;
  selectedCategory?: string;
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
  onSelectCategoryFilter,
  selectedCategory = 'all'
}) => {
  const isAdmin = currentUser.role === 'admin';
  const overdueCount = projects.filter(p => p.status === 'overdue').length;

  // Requirement 5: ตัวเลขกล่องงานของฉันนับเฉพาะโครงการที่เริ่มดำเนินงานแล้วและยังไม่เสร็จ โดยคำนึงถึงผู้รับผิดชอบหรือผู้ควบคุมงาน
  const myInboxCount = projects.filter(p => {
    const isStartedAndNotCompleted = p.status !== 'not_started' && p.status !== 'completed';
    if (!isStartedAndNotCompleted) return false;

    if (currentUser.role === 'admin') return true;
    return (
      (p.responsiblePerson && p.responsiblePerson.includes(currentUser.displayName)) ||
      (p.supervisorName && p.supervisorName.includes(currentUser.displayName))
    );
  }).length;

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
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-white border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out shadow-2xl lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        } no-print shrink-0`}
      >
        {/* Header Branding */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <HardHat className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight font-heading">งานโครงการกองช่าง</h2>
              <span className="text-xs text-slate-400">อบต.ไร่ใต้ จ.อุบลราชธานี</span>
            </div>
          </div>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info Badge (identical to saraban template) */}
        <div className="p-3 mx-3 my-2.5 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-center space-x-3">
          <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-sm text-white shrink-0">
            {currentUser.displayName.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <div className="text-sm font-medium text-slate-100 truncate">
              {currentUser.displayName}
            </div>
            <div className="text-xs text-emerald-400 truncate">
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
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg font-medium transition ${
              currentTab === 'dashboard'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-center shrink-0" />
            <span>สรุปผลงานโครงการ</span>
          </button>

          {/* 2. สรุปงานฎีกา / การเบิกจ่าย */}
          <button
            onClick={() => {
              setCurrentTab('vouchersSummary');
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg font-medium transition ${
              currentTab === 'vouchersSummary'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <PieChart className="w-4 h-4 text-pink-400 shrink-0" />
            <span>สรุปงานฎีกา & เบิกจ่าย</span>
          </button>

          {/* 3. กล่องงานของฉัน (My Inbox) */}
          <button
            onClick={() => {
              setCurrentTab('myInbox');
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg font-medium transition ${
              currentTab === 'myInbox'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Inbox className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="flex-1 text-left">กล่องงานของฉัน</span>
            <span className="bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
              {myInboxCount}
            </span>
          </button>

          {/* Section: ทะเบียนแยกตามหมวดงบประมาณ */}
          <div className="pt-3 pb-1 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            ทะเบียนแยกตามหมวดงบ
          </div>

          {/* 1. เงินสะสม */}
          <button
            onClick={() => {
              onSelectCategoryFilter?.('เงินสะสม');
              setCurrentTab('projects');
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs transition ${
              currentTab === 'projects' && selectedCategory === 'เงินสะสม'
                ? 'bg-slate-800 text-amber-300 font-bold border-2 border-amber-400 shadow-md ring-2 ring-amber-400/25'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white border border-transparent font-medium'
            }`}
          >
            <Coins className="w-4 h-4 text-amber-400 shrink-0" />
            <span>เงินสะสม (จ่ายขาด)</span>
          </button>

          {/* 2. งบประมาณรายจ่ายประจำปี */}
          <button
            onClick={() => {
              onSelectCategoryFilter?.('งบประมาณรายจ่าย');
              setCurrentTab('projects');
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs transition ${
              currentTab === 'projects' && selectedCategory === 'งบประมาณรายจ่าย'
                ? 'bg-slate-800 text-blue-300 font-bold border-2 border-blue-400 shadow-md ring-2 ring-blue-400/25'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white border border-transparent font-medium'
            }`}
          >
            <Layers className="w-4 h-4 text-blue-400 shrink-0" />
            <span>งบประมาณรายจ่ายประจำปี</span>
          </button>

          {/* 3. เงินอุดหนุนเฉพาะกิจ */}
          <button
            onClick={() => {
              onSelectCategoryFilter?.('เงินอุดหนุนเฉพาะกิจ');
              setCurrentTab('projects');
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs transition ${
              currentTab === 'projects' && selectedCategory === 'เงินอุดหนุนเฉพาะกิจ'
                ? 'bg-slate-800 text-purple-300 font-bold border-2 border-purple-400 shadow-md ring-2 ring-purple-400/25'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white border border-transparent font-medium'
            }`}
          >
            <Layers className="w-4 h-4 text-purple-400 shrink-0" />
            <span>เงินอุดหนุนเฉพาะกิจ</span>
          </button>

          {/* รวมทะเบียนโครงการทั้งหมด */}
          <button
            onClick={() => {
              onSelectCategoryFilter?.('all');
              setCurrentTab('projects');
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl transition ${
              currentTab === 'projects' && (selectedCategory === 'all' || !selectedCategory)
                ? 'bg-emerald-600 text-white font-bold border-2 border-emerald-300 shadow-md ring-2 ring-emerald-400/25'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white border border-transparent font-medium'
            }`}
          >
            <FolderTree className="w-4 h-4 text-teal-400 shrink-0" />
            <span>รวมทะเบียนโครงการทั้งหมด</span>
          </button>

          {/* Section: รายงานและติดตาม */}
          <div className="pt-3 pb-1 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            รายงานและติดตาม
          </div>

          {/* งานเกินกำหนด */}
          <button
            onClick={() => {
              setCurrentTab('overdue');
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg font-medium transition ${
              currentTab === 'overdue'
                ? 'bg-rose-700 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="flex-1 text-left">งานเกินกำหนดสัญญา</span>
            {overdueCount > 0 && (
              <span className="bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                {overdueCount}
              </span>
            )}
          </button>

          {/* ไทม์ไลน์ 12 ขั้นตอน */}
          <button
            onClick={() => {
              setCurrentTab('timeline');
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg font-medium transition ${
              currentTab === 'timeline'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <CalendarClock className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>ไทม์ไลน์ 12 ขั้นตอน</span>
          </button>

          {/* รายงานและส่งออก */}
          <button
            onClick={() => {
              setCurrentTab('reports');
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg font-medium transition ${
              currentTab === 'reports'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>รายงาน & สถิติโครงการ</span>
          </button>

          {/* นำเข้าข้อมูล Excel (เฉพาะ Admin ตามข้อ 7) */}
          {isAdmin && (
            <button
              onClick={() => {
                setCurrentTab('excel_import');
                setIsMobileOpen(false);
              }}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg font-medium transition ${
                currentTab === 'excel_import'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>นำเข้าข้อมูล Excel</span>
            </button>
          )}

          {/* ฐานข้อมูลหลัก Google Sheet & Drive */}
          <button
            onClick={() => {
              setCurrentTab('google_sheets');
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-medium transition ${
              currentTab === 'google_sheets'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Cloud className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>ฐานข้อมูล Google Sheet & Drive</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          </button>


          {/* คู่มือ & สรุปผลงาน */}
          <button
            onClick={() => {
              setCurrentTab('manual');
              setIsMobileOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg font-medium transition ${
              currentTab === 'manual'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>คู่มือ & สรุปผลงาน</span>
          </button>
        </nav>

        {/* Sidebar Footer Controls */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          {currentUser.role === 'admin' && (
            <button
              onClick={onOpenLoginModal}
              className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>สลับสิทธิ์การใช้งาน</span>
            </button>
          )}
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 text-xs font-medium transition"
          >
            <Power className="w-3.5 h-3.5" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>
    </>
  );
};

