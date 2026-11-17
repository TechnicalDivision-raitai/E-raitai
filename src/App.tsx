/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { ProjectTable } from './components/ProjectTable';
import { ProjectModal } from './components/ProjectModal';
import { ProjectDetailModal } from './components/ProjectDetailModal';
import { ProjectTimelineView } from './components/ProjectTimelineView';
import { ReportsView } from './components/ReportsView';
import { ExcelImportModal } from './components/ExcelImportModal';
import { UserManualModal } from './components/UserManualModal';
import { LoginModal } from './components/LoginModal';
import { MyInboxView } from './components/MyInboxView';
import { VouchersSummaryView } from './components/VouchersSummaryView';
import { ProjectRecordsView } from './components/ProjectRecordsView';
import { Project, ProjectArchiveRecord, ProjectFilter, UserProfile } from './types/project';
import {
  getStoredProjects,
  saveStoredProjects,
  resetToDefaultProjects,
  clearAllProjects,
  getStoredUser,
  saveStoredUser,
  clearStoredUser
} from './services/storage';
import {
  fetchProjectsFromGoogleSheet,
  syncProjectsToGoogleSheet
} from './services/googleSync';
import { CURRENT_USER, STAFF_USER } from './data/mockData';
import {
  getCurrentThaiFiscalYear,
  calculateProjectProgress,
  isProjectCompletedOrDisbursed,
  formatThaiDateTime
} from './utils/thaiDate';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const SESSION_TAB_KEY = 'raitai_engineering_active_tab';
const SESSION_FILTER_KEY = 'raitai_engineering_active_filter';
const SESSION_SIDEBAR_KEY = 'raitai_engineering_sidebar_collapsed';
const SESSION_DETAIL_KEY = 'raitai_engineering_detail_modal';

const ALLOWED_TABS = new Set([
  'dashboard',
  'vouchersSummary',
  'myInbox',
  'projects',
  'overdue',
  'timeline',
  'reports',
  'project_records',
  'excel_import',
  'manual'
]);

export default function App() {
  const [projects, setProjects] = useState<Project[]>(() => getStoredProjects());
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getStoredUser());
  const [currentTab, setCurrentTab] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_TAB_KEY);
      if (saved && ALLOWED_TABS.has(saved)) {
        const savedUser = getStoredUser();
        if (saved === 'myInbox' && savedUser?.role !== 'admin') {
          return 'dashboard';
        }
        return saved;
      }
    } catch {
      // ignore sessionStorage read errors
    }
    return 'dashboard';
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(SESSION_SIDEBAR_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // Filters State
  const [filter, setFilter] = useState<ProjectFilter>(() => {
    const defaultFilter: ProjectFilter = {
      fiscalYear: getCurrentThaiFiscalYear(),
      category: 'all',
      status: 'all',
      searchQuery: ''
    };
    try {
      const raw = sessionStorage.getItem(SESSION_FILTER_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return { ...defaultFilter, ...parsed };
        }
      }
    } catch {
      // ignore sessionStorage read errors
    }
    return defaultFilter;
  });

  // Modals State
  const [selectedDetailTab, setSelectedDetailTab] = useState<number>(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_DETAIL_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.tab === 'number') return parsed.tab;
      }
    } catch {
      // ignore
    }
    return 1;
  });
  const [selectedProjectForDetail, setSelectedProjectForDetail] = useState<Project | null>(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_DETAIL_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.projectId) {
          return getStoredProjects().find(p => p.id === parsed.projectId) || null;
        }
      }
    } catch {
      // ignore
    }
    return null;
  });
  const [isProjectModalOpen, setIsProjectModalOpen] = useState<boolean>(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('syncing');

  // Persist current view state across browser reloads
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_TAB_KEY, currentTab);
    } catch {
      // ignore
    }
  }, [currentTab]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_FILTER_KEY, JSON.stringify(filter));
    } catch {
      // ignore
    }
  }, [filter]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_SIDEBAR_KEY, String(isSidebarCollapsed));
    } catch {
      // ignore
    }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    try {
      if (selectedProjectForDetail) {
        sessionStorage.setItem(
          SESSION_DETAIL_KEY,
          JSON.stringify({ projectId: selectedProjectForDetail.id, tab: selectedDetailTab })
        );
      } else {
        sessionStorage.removeItem(SESSION_DETAIL_KEY);
      }
    } catch {
      // ignore
    }
  }, [selectedProjectForDetail, selectedDetailTab]);

  // Toast Notification State
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // 1. Auto-pull projects from Google Sheet on app initial load
  useEffect(() => {
    let isMounted = true;
    const loadFromCloudSheet = async () => {
      setSyncStatus('syncing');
      try {
        const res = await fetchProjectsFromGoogleSheet();
        if (!isMounted) return;
        if (res.success) {
          if (Array.isArray(res.projects) && res.projects.length > 0) {
            setProjects(res.projects);
            saveStoredProjects(res.projects);
            setSelectedProjectForDetail(prev =>
              prev ? res.projects!.find(p => p.id === prev.id) || prev : null
            );
            showToast(`ดึงข้อมูลจาก Google Sheet อัตโนมัติสำเร็จ (${res.projects.length} รายการ)`, 'success');
          }
          setSyncStatus('synced');
        } else {
          setSyncStatus('error');
        }
      } catch {
        if (isMounted) setSyncStatus('error');
      }
    };

    loadFromCloudSheet();
    return () => {
      isMounted = false;
    };
  }, []);

  // Manual quick refresh from Google Sheet when clicking status badge
  const handleRefreshCloudSync = async () => {
    setSyncStatus('syncing');
    try {
      const res = await fetchProjectsFromGoogleSheet();
      if (res.success) {
        if (Array.isArray(res.projects) && res.projects.length > 0) {
          setProjects(res.projects);
          saveStoredProjects(res.projects);
        }
        setSyncStatus('synced');
        showToast('ซิงค์ข้อมูล Google Sheet ล่าสุดเรียบร้อยแล้ว', 'success');
      } else {
        setSyncStatus('error');
        showToast(res.error || 'ไม่สามารถซิงค์ Google Sheet ได้', 'error');
      }
    } catch {
      setSyncStatus('error');
      showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ Google Sheet', 'error');
    }
  };

  // 2. Save projects locally & auto-backup to Google Sheet
  const updateProjects = (newProjects: Project[], skipCloudSync = false) => {
    setProjects(newProjects);
    saveStoredProjects(newProjects);

    if (!skipCloudSync) {
      setSyncStatus('syncing');
      syncProjectsToGoogleSheet(newProjects)
        .then(res => {
          if (res.success) {
            setSyncStatus('synced');
          } else {
            console.warn('Auto cloud sync notice:', res.error);
            setSyncStatus('error');
          }
        })
        .catch(err => {
          console.warn('Auto cloud sync error:', err);
          setSyncStatus('error');
        });
    }
  };

  // Update a single project (for Acknowledge / status change)
  const handleUpdateSingleProject = (updated: Project) => {
    if (currentUser?.role !== 'admin') {
      Swal.fire('ไม่อนุญาต', 'สิทธิ์เจ้าหน้าที่ (Staff) ไม่สามารถเปลี่ยนสถานะหรือแก้ไขข้อมูลได้', 'error');
      return;
    }
    const existing = projects.find(p => p.id === updated.id);
    const statusChanged = existing ? existing.status !== updated.status : updated.status !== 'not_started';
    const nextProject: Project = {
      ...updated,
      progressPercent: calculateProjectProgress(updated),
      statusUpdatedAt:
        updated.statusUpdatedAt ||
        (statusChanged ? formatThaiDateTime() : existing?.statusUpdatedAt)
    };
    const newProjects = projects.map(p => (p.id === nextProject.id ? nextProject : p));
    updateProjects(newProjects);
  };

  // Save only project archive record (coordinates, signboard coordinates, photos) without affecting status or 12-stage timeline
  const handleSaveProjectRecord = (projectId: string, record: ProjectArchiveRecord) => {
    if (currentUser?.role !== 'admin') {
      Swal.fire('ไม่อนุญาต', 'สิทธิ์เจ้าหน้าที่ (Staff) ไม่สามารถบันทึกหรือแก้ไขข้อมูลได้', 'error');
      return;
    }
    const newProjects = projects.map(p =>
      p.id === projectId
        ? {
            ...p,
            projectRecord: record
          }
        : p
    );
    updateProjects(newProjects);
  };

  // Handle Login
  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    saveStoredUser(user);
    if (user.role !== 'admin' && currentTab === 'myInbox') {
      setCurrentTab('dashboard');
    }
    setIsLoginModalOpen(false);
  };

  // Handle Logout
  const handleLogout = () => {
    clearStoredUser();
    try {
      sessionStorage.removeItem(SESSION_TAB_KEY);
      sessionStorage.removeItem(SESSION_DETAIL_KEY);
    } catch {
      // ignore
    }
    setCurrentUser(null);
    setSelectedProjectForDetail(null);
    setCurrentTab('dashboard');
    setIsLoginModalOpen(true);
    showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
  };

  // Calculate available fiscal years (Requirement 10: แสดงปีปัจจุบันก่อน โดยอ้างอิงตามปีงบประมาณและแสดงเฉพาะปีที่มีข้อมูล หากมีการเพิ่มภายหลังให้แสดงในตัวกรองอัตโนมัติในทุกหมวด)
  const availableYears = useMemo(() => {
    const projectYears = Array.from(
      new Set(
        projects
          .map(p => Number(p.fiscalYear))
          .filter(y => !isNaN(y) && y > 0)
      )
    );
    const currentFiscalYear = getCurrentThaiFiscalYear();

    const yearSet = new Set(projectYears);
    yearSet.add(currentFiscalYear);

    return Array.from(yearSet).sort((a, b) => {
      if (a === currentFiscalYear) return -1;
      if (b === currentFiscalYear) return 1;
      return b - a;
    });
  }, [projects]);

  // Handle Save Project (Create / Update) - Requirement 4 & 7: Protected from staff, auto 12-step progress
  const handleSaveProject = (projectData: Project) => {
    if (currentUser?.role !== 'admin') {
      Swal.fire('ไม่อนุญาต', 'สิทธิ์เจ้าหน้าที่ (Staff) ไม่สามารถบันทึกหรือแก้ไขข้อมูลในระบบได้', 'error');
      return;
    }

    try {
      const finalProgress = calculateProjectProgress(projectData);
      const existing = projects.find(p => p.id === projectData.id);
      const statusChanged = existing
        ? existing.status !== projectData.status
        : projectData.status !== 'not_started';
      const toSave: Project = {
        ...projectData,
        progressPercent: finalProgress,
        statusUpdatedAt: statusChanged
          ? projectData.statusUpdatedAt || formatThaiDateTime()
          : projectData.statusUpdatedAt ?? existing?.statusUpdatedAt
      };
      const exists = Boolean(existing);
      let updated: Project[];
      if (exists) {
        updated = projects.map(p => (p.id === toSave.id ? toSave : p));
        Swal.fire({
          icon: 'success',
          title: 'บันทึกสำเร็จ',
          text: `บันทึกการแก้ไขโครงการ "${toSave.name}" เรียบร้อยแล้ว`,
          timer: 1500,
          showConfirmButton: false
        });
      } else {
        updated = [toSave, ...projects];
        Swal.fire({
          icon: 'success',
          title: 'ลงทะเบียนสำเร็จ',
          text: `เพิ่มโครงการใหม่ "${toSave.name}" เรียบร้อยแล้ว`,
          timer: 1500,
          showConfirmButton: false
        });
      }
      updateProjects(updated);
      setIsProjectModalOpen(false);
      setProjectToEdit(null);
    } catch {
      Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลโครงการได้', 'error');
    }
  };

  // Handle Delete Project (Requirement 7: Admin only)
  const handleDeleteProject = (project: Project) => {
    if (currentUser?.role !== 'admin') {
      Swal.fire('ไม่อนุญาต', 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถลบข้อมูลโครงการได้', 'warning');
      return;
    }

    Swal.fire({
      title: 'ยืนยันการลบโครงการ?',
      text: `คุณต้องการลบโครงการ "${project.name}" ออกจากระบบใช่หรือไม่`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'ยืนยันลบ',
      cancelButtonText: 'ยกเลิก'
    }).then(result => {
      if (result.isConfirmed) {
        const updated = projects.filter(p => p.id !== project.id);
        updateProjects(updated);
        Swal.fire({
          icon: 'success',
          title: 'ลบสำเร็จ',
          text: `ลบโครงการ "${project.name}" เรียบร้อยแล้ว`,
          timer: 1500,
          showConfirmButton: false
        });
        if (selectedProjectForDetail?.id === project.id) {
          setSelectedProjectForDetail(null);
        }
      }
    });
  };

  // Handle Excel Import (Requirement 3: Upsert merge by projectCode/contractNo/name & preserve empty fields)
  const handleImportSuccess = (imported: Project[]) => {
    if (currentUser?.role !== 'admin') {
      Swal.fire('ไม่อนุญาต', 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถนำเข้าข้อมูลโครงการได้', 'warning');
      return;
    }

    let updatedProjects = [...projects];
    imported.forEach(imp => {
      const idx = updatedProjects.findIndex(
        p => p.id === imp.id || (p.projectCode && imp.projectCode && p.projectCode.trim().toLowerCase() === imp.projectCode.trim().toLowerCase())
      );
      if (idx >= 0) {
        updatedProjects[idx] = imp;
      } else {
        updatedProjects.unshift(imp);
      }
    });

    updateProjects(updatedProjects);
    Swal.fire({
      icon: 'success',
      title: 'นำเข้าข้อมูลสำเร็จ',
      text: `นำเข้า/อัปเดตโครงการจากไฟล์ Excel สำเร็จจำนวน ${imported.length} รายการ`,
      timer: 2000,
      showConfirmButton: false
    });
    setCurrentTab('projects');
  };

  // Reset to default sample dataset
  const handleResetData = () => {
    const def = resetToDefaultProjects();
    setProjects(def);
    Swal.fire({
      icon: 'info',
      title: 'โหลดข้อมูลตัวอย่างสำเร็จ',
      text: 'ข้อมูลโครงการตัวอย่างถูกเรียกคืนเรียบร้อยแล้ว',
      timer: 1500,
      showConfirmButton: false
    });
  };

  // Clear all projects to start fresh (Clean Slate Mode for real usage)
  const handleClearAllData = () => {
    if (currentUser?.role !== 'admin') {
      Swal.fire('ไม่อนุญาต', 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถล้างข้อมูลโครงการได้', 'warning');
      return;
    }

    Swal.fire({
      title: 'ล้างโครงการตัวอย่างทั้งหมด?',
      text: 'คุณต้องการลบข้อมูลโครงการตัวอย่างทั้งหมดเพื่อเริ่มต้นใช้งานจริงใช่หรือไม่ (ข้อมูลตัวอย่างจะหายไป และระบบจะว่างเปล่า 0 รายการ)',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'ยืนยันล้างข้อมูล',
      cancelButtonText: 'ยกเลิก'
    }).then(result => {
      if (result.isConfirmed) {
        const empty = clearAllProjects();
        setProjects(empty);
        Swal.fire({
          icon: 'success',
          title: 'ล้างข้อมูลสำเร็จ',
          text: 'ระบบเข้าสู่โหมดว่างเปล่า (0 โครงการ) พร้อมสำหรับการบันทึกโครงการจริงของ อบต.ไร่ใต้ แล้ว',
          timer: 1800,
          showConfirmButton: false
        });
      }
    });
  };

  const currentCategoryTitle = filter.category && filter.category !== 'all' ? filter.category : 'ทะเบียนโครงการทั้งหมด';

  const pageTitles: Record<string, string> = {
    dashboard: 'สรุปผลงานโครงการ',
    vouchersSummary: 'สรุปงานฎีกาและเบิกจ่าย',
    myInbox: 'กล่องงานของฉัน',
    projects: currentCategoryTitle,
    overdue: 'งานเกินกำหนดสัญญา',
    timeline: 'ไทม์ไลน์ 12 ขั้นตอน',
    reports: 'รายงาน & สถิติโครงการ',
    project_records: 'ข้อมูลโครงการ',
    excel_import: 'นำเข้าข้อมูล Excel',
    manual: 'คู่มือ & สรุปผลงาน'
  };

  // Mandatory Login Screen: If not logged in, force Login screen before accessing the system
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center font-['Kanit',sans-serif]">
        {/* Toast Notification Container */}
        {toast && (
          <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border bg-white animate-in slide-in-from-bottom-3 duration-200">
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-blue-600 shrink-0" />}
            <span className="text-xs font-semibold text-gray-800">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded-lg ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <LoginModal
          isOpen={true}
          onClose={() => {}}
          onLoginSuccess={handleLoginSuccess}
          canCancel={false}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-['Kanit',sans-serif] text-gray-800">
      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border bg-white animate-in slide-in-from-bottom-3 duration-200 no-print">
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
          {toast.type === 'info' && <Info className="w-5 h-5 text-blue-600 shrink-0" />}
          <span className="text-xs font-semibold text-gray-800">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sidebar Navigation (matching e-Saraban sidebar) */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        currentUser={currentUser}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        projects={projects}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
        isDesktopCollapsed={isSidebarCollapsed}
        selectedCategory={filter.category}
        onSelectCategoryFilter={cat => {
          setFilter(prev => ({ ...prev, category: cat }));
        }}
      />

      {/* Main Content Area */}
      <div
        className={`${
          isSidebarCollapsed ? 'lg:pl-0' : 'lg:pl-64'
        } flex-1 flex flex-col min-w-0 transition-all duration-300`}
      >
        {/* Top Header */}
        <Header
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebarCollapse={() => setIsSidebarCollapsed(prev => !prev)}
          pageTitle={pageTitles[currentTab] || 'ระบบบริหารจัดการงานโครงการกองช่าง'}
          selectedYear={filter.fiscalYear}
          onSelectYear={yr => setFilter(prev => ({ ...prev, fiscalYear: yr }))}
          availableYears={availableYears}
          searchQuery={filter.searchQuery}
          onSearchChange={q => setFilter(prev => ({ ...prev, searchQuery: q }))}
          onOpenNewProjectModal={() => {
            setProjectToEdit(null);
            setIsProjectModalOpen(true);
          }}
          onResetData={handleResetData}
          projects={projects}
          currentUser={currentUser}
          onSelectProject={(p: Project, tab?: number) => {
            setSelectedProjectForDetail(p);
            setSelectedDetailTab(tab || 1);
          }}
          syncStatus={syncStatus}
          onRefreshSync={handleRefreshCloudSync}
        />

        {/* Dynamic View Router */}
        <main className="p-4 sm:p-6 lg:p-8 flex-1 max-w-7xl w-full mx-auto">
          {/* 1. Dashboard View */}
          {currentTab === 'dashboard' && (
            <Dashboard
              projects={projects}
              filter={filter}
              setFilter={setFilter}
              availableYears={availableYears}
              currentUser={currentUser}
              onSelectProject={(p: Project, tab?: number) => {
                setSelectedProjectForDetail(p);
                setSelectedDetailTab(tab || 1);
              }}
              onOpenNewProjectModal={() => {
                setProjectToEdit(null);
                setIsProjectModalOpen(true);
              }}
            />
          )}

          {/* 2. Vouchers Summary Dashboard (Tab 9 from Saraban) */}
          {currentTab === 'vouchersSummary' && (
            <VouchersSummaryView
              projects={projects}
              availableYears={availableYears}
              selectedYear={filter.fiscalYear}
              onSelectYear={yr => setFilter(prev => ({ ...prev, fiscalYear: yr }))}
              onSelectProject={(p: Project, tab?: number) => {
                setSelectedProjectForDetail(p);
                setSelectedDetailTab(tab || 1);
              }}
            />
          )}

          {/* 3. My Inbox View (Admin only) */}
          {currentTab === 'myInbox' && currentUser.role === 'admin' && (
            <MyInboxView
              projects={projects}
              currentUser={currentUser}
              onSelectProject={(p: Project, tab?: number) => {
                setSelectedProjectForDetail(p);
                setSelectedDetailTab(tab || 1);
              }}
              onUpdateProject={handleUpdateSingleProject}
            />
          )}

          {/* 4. Projects Registry Table */}
          {currentTab === 'projects' && (
            <ProjectTable
              projects={projects}
              filter={filter}
              setFilter={setFilter}
              availableYears={availableYears}
              currentUser={currentUser}
              onSelectProject={(p: Project, tab?: number) => {
                setSelectedProjectForDetail(p);
                setSelectedDetailTab(tab || 1);
              }}
              onEditProject={p => {
                setProjectToEdit(p);
                setIsProjectModalOpen(true);
              }}
              onDeleteProject={handleDeleteProject}
              onOpenNewProjectModal={() => {
                setProjectToEdit(null);
                setIsProjectModalOpen(true);
              }}
            />
          )}

          {/* 5. Overdue Tracker (หยุดเตือนเมื่อโครงการเสร็จหรือเบิกจ่ายแล้ว) */}
          {currentTab === 'overdue' && (
            <ProjectTable
              projects={projects.filter(p => !isProjectCompletedOrDisbursed(p))}
              filter={{ ...filter, status: 'overdue' }}
              setFilter={setFilter}
              availableYears={availableYears}
              currentUser={currentUser}
              onSelectProject={(p: Project, tab?: number) => {
                setSelectedProjectForDetail(p);
                setSelectedDetailTab(tab || 1);
              }}
              onEditProject={p => {
                setProjectToEdit(p);
                setIsProjectModalOpen(true);
              }}
              onDeleteProject={handleDeleteProject}
              onOpenNewProjectModal={() => {
                setProjectToEdit(null);
                setIsProjectModalOpen(true);
              }}
            />
          )}

          {/* 6. Timeline 12 Stages */}
          {currentTab === 'timeline' && (
            <ProjectTimelineView
              projects={projects}
              currentUser={currentUser}
              onSelectProject={(p: Project, tab?: number) => {
                setSelectedProjectForDetail(p);
                setSelectedDetailTab(tab || 1);
              }}
              onEditProject={p => {
                setProjectToEdit(p);
                setIsProjectModalOpen(true);
              }}
            />
          )}

          {/* 7. Reports & Analytics */}
          {currentTab === 'reports' && (
            <ReportsView
              projects={projects}
              availableYears={availableYears}
              currentUser={currentUser}
              onSelectProject={(p: Project, tab?: number) => {
                setSelectedProjectForDetail(p);
                setSelectedDetailTab(tab || 1);
              }}
            />
          )}

          {/* 7.5 Project Records Archive (Coordinates & Photos - independent of workflow/timeline) */}
          {currentTab === 'project_records' && (
            <ProjectRecordsView
              projects={projects}
              availableYears={availableYears}
              selectedYear={filter.fiscalYear}
              onSelectYear={yr => setFilter(prev => ({ ...prev, fiscalYear: yr }))}
              currentUser={currentUser}
              onSaveProjectRecord={handleSaveProjectRecord}
            />
          )}

          {/* 8. Excel Import */}
          {currentTab === 'excel_import' && (
            <div className="space-y-4">
              <ExcelImportModal
                isOpen={true}
                onClose={() => setCurrentTab('projects')}
                existingProjects={projects}
                onImportSuccess={handleImportSuccess}
              />
            </div>
          )}


          {/* 10. Manual & Verification Checklist */}
          {currentTab === 'manual' && (
            <UserManualModal
              onClearAllData={handleClearAllData}
              onRestoreSampleData={handleResetData}
              projectCount={projects.length}
              currentUser={currentUser}
            />
          )}
        </main>
      </div>

      {/* Project Add / Edit Modal (Dynamic categories) */}
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => {
          setIsProjectModalOpen(false);
          setProjectToEdit(null);
        }}
        onSave={handleSaveProject}
        initialProject={projectToEdit}
        existingCategories={Array.from(new Set(projects.map(p => p.budgetCategory).filter(Boolean)))}
        existingProjects={projects}
      />

      {/* Project Official Details Modal (8 tabs, printable) */}
      <ProjectDetailModal
        project={selectedProjectForDetail}
        isOpen={Boolean(selectedProjectForDetail)}
        onClose={() => setSelectedProjectForDetail(null)}
        initialTab={selectedDetailTab}
        onEdit={p => {
          setSelectedProjectForDetail(null);
          setProjectToEdit(p);
          setIsProjectModalOpen(true);
        }}
        onUpdateProject={updated => {
          handleUpdateSingleProject(updated);
          setSelectedProjectForDetail(updated);
        }}
        currentUser={currentUser}
      />

      {/* Login Screen Modal: Mandatory before access if not logged in */}
      <LoginModal
        isOpen={!currentUser || isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        canCancel={Boolean(currentUser)}
      />
    </div>
  );
}
