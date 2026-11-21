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
import { RepairRequestsView } from './components/RepairRequestsView';
import { ProjectCodeRenumberModal } from './components/ProjectCodeRenumberModal';
import {
  Project,
  ProjectArchiveRecord,
  ProjectFilter,
  RepairRequest,
  RepairRequestStatus,
  SarabanQueueItem,
  UserProfile
} from './types/project';
import {
  getStoredProjects,
  saveStoredProjects,
  resetToDefaultProjects,
  clearAllProjects,
  getStoredUser,
  saveStoredUser,
  clearStoredUser,
  getStoredRepairRequests,
  saveStoredRepairRequests
} from './services/storage';
import {
  fetchProjectsFromGoogleSheet,
  syncProjectsToGoogleSheet,
  fetchSarabanQueue,
  resolveSarabanQueue,
  deleteSarabanQueue
} from './services/googleSync';
import { rollbackSarabanQueueFromProject } from './utils/sarabanSync';
import { CURRENT_USER, STAFF_USER } from './data/mockData';
import {
  getCurrentThaiFiscalYear,
  calculateProjectProgress,
  isProjectCompletedOrDisbursed,
  formatThaiDateTime
} from './utils/thaiDate';
import { enrichProjectsWithKnownDirectory } from './utils/projectEnrichment';
import {
  findAllCodeGapGroups,
  ProjectCodeGapGroup,
  ProjectCodeRenumberItem
} from './utils/projectCodeUtils';
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
  'repair_requests',
  'excel_import',
  'manual'
]);

export default function App() {
  const [projects, setProjects] = useState<Project[]>(() =>
    getStoredProjects().map(p => ({
      ...p,
      progressPercent: calculateProjectProgress(p)
    }))
  );
  const [repairRequests, setRepairRequests] = useState<RepairRequest[]>(() =>
    getStoredRepairRequests()
  );
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
  const [isRenumberModalOpen, setIsRenumberModalOpen] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('syncing');

  // Saraban Queue State (Approach B Integration)
  const [sarabanQueueItems, setSarabanQueueItems] = useState<SarabanQueueItem[]>([]);
  const [sarabanQueueLoading, setSarabanQueueLoading] = useState<boolean>(false);
  const [sarabanNeedsScriptUpdate, setSarabanNeedsScriptUpdate] = useState<boolean>(false);
  const [sarabanQueueError, setSarabanQueueError] = useState<string | null>(null);

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

  const loadSarabanQueue = async (silent = false) => {
    if (!silent) setSarabanQueueLoading(true);
    try {
      const res = await fetchSarabanQueue('all');
      if (res.success && Array.isArray(res.items)) {
        setSarabanQueueItems(res.items);
        setSarabanNeedsScriptUpdate(false);
        setSarabanQueueError(null);
      } else if (res.needsScriptUpdate) {
        setSarabanNeedsScriptUpdate(true);
        setSarabanQueueError(res.error || null);
      } else {
        setSarabanQueueError(res.error || 'ไม่สามารถโหลดคิวจากสารบรรณได้');
      }
    } catch {
      setSarabanQueueError('เกิดข้อผิดพลาดในการเชื่อมต่อคิวสารบรรณ');
    } finally {
      if (!silent) setSarabanQueueLoading(false);
    }
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
            const { projects: enrichedRaw, stats } = enrichProjectsWithKnownDirectory(res.projects);
            const enriched = enrichedRaw.map(p => ({
              ...p,
              progressPercent: calculateProjectProgress(p)
            }));
            setProjects(enriched);
            saveStoredProjects(enriched);
            setSelectedProjectForDetail(prev =>
              prev ? enriched.find(p => p.id === prev.id) || prev : null
            );

            const activeUser = getStoredUser();
            if (stats.updatedProjectsCount > 0 && activeUser?.role === 'admin') {
              const summaryParts: string[] = [];
              if (stats.filledPositionsCount > 0) {
                summaryParts.push(`ตำแหน่ง ${stats.filledPositionsCount} รายชื่อ`);
              }
              const contractorFields = stats.filledContractorTaxIdCount + stats.filledContractorContactCount;
              if (contractorFields > 0) {
                summaryParts.push(`ข้อมูลผู้รับจ้าง ${stats.filledContractorProjectsCount} โครงการ`);
              }
              showToast(
                `เติมข้อมูลที่เคยบันทึกไว้อัตโนมัติ (${summaryParts.join(' • ')}) ใน ${stats.updatedProjectsCount} โครงการแล้ว`,
                'success'
              );
              // Persist enriched fields back to Google Sheet
              syncProjectsToGoogleSheet(enriched).catch(() => {});
            } else {
              showToast(`ดึงข้อมูลจาก Google Sheet อัตโนมัติสำเร็จ (${enriched.length} รายการ)`, 'success');
            }
          }
          setSyncStatus('synced');
        } else {
          // Offline fallback: enrich locally stored projects if any known blanks exist
          const localProjects = getStoredProjects();
          const { projects: enrichedLocal, stats } = enrichProjectsWithKnownDirectory(localProjects);
          if (stats.updatedProjectsCount > 0 && getStoredUser()?.role === 'admin') {
            setProjects(enrichedLocal);
            saveStoredProjects(enrichedLocal);
          }
          setSyncStatus('error');
        }
      } catch {
        if (isMounted) setSyncStatus('error');
      }
    };

    loadFromCloudSheet();
    loadSarabanQueue(false);
    return () => {
      isMounted = false;
    };
  }, []);

  // Manual quick refresh from Google Sheet when clicking status badge
  const handleRefreshCloudSync = async () => {
    setSyncStatus('syncing');
    try {
      const [res] = await Promise.all([
        fetchProjectsFromGoogleSheet(),
        loadSarabanQueue(false)
      ]);
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

  // Approve & apply a Saraban Queue item onto a project
  const handleApproveSarabanItem = async (
    item: SarabanQueueItem,
    mergedProject: Project
  ): Promise<{ success: boolean; error?: string }> => {
    if (currentUser?.role !== 'admin') {
      return { success: false, error: 'สิทธิ์เจ้าหน้าที่ (Staff) ไม่สามารถอนุมัติรับเข้าคิวได้' };
    }

    const res = await resolveSarabanQueue({
      queueId: item.queueId,
      decision: 'approve',
      reviewedBy: currentUser.displayName,
      updatedProject: mergedProject
    });

    if (!res.success) {
      if (res.needsScriptUpdate) setSarabanNeedsScriptUpdate(true);
      return { success: false, error: res.error };
    }

    const newProjects = projects.map(p => (p.id === mergedProject.id ? mergedProject : p));
    updateProjects(newProjects);

    setSarabanQueueItems(prev =>
      prev.map(q =>
        q.queueId === item.queueId
          ? {
              ...q,
              queueStatus: 'approved',
              reviewedBy: currentUser.displayName,
              reviewedAt: res.reviewedAt || new Date().toISOString()
            }
          : q
      )
    );
    showToast(`รับข้อมูล ${item.queueId} เข้าโครงการ ${mergedProject.projectCode} แล้ว`, 'success');
    return { success: true };
  };

  // Reject a Saraban Queue item
  const handleRejectSarabanItem = async (
    item: SarabanQueueItem,
    reason: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (currentUser?.role !== 'admin') {
      return { success: false, error: 'สิทธิ์เจ้าหน้าที่ (Staff) ไม่สามารถปฏิเสธคิวได้' };
    }

    const res = await resolveSarabanQueue({
      queueId: item.queueId,
      decision: 'reject',
      reviewedBy: currentUser.displayName,
      rejectReason: reason
    });

    if (!res.success) {
      if (res.needsScriptUpdate) setSarabanNeedsScriptUpdate(true);
      return { success: false, error: res.error };
    }

    setSarabanQueueItems(prev =>
      prev.map(q =>
        q.queueId === item.queueId
          ? {
              ...q,
              queueStatus: 'rejected',
              reviewedBy: currentUser.displayName,
              reviewedAt: res.reviewedAt || new Date().toISOString(),
              rejectReason: reason
            }
          : q
      )
    );
    showToast(`ปฏิเสธรายการ ${item.queueId} เรียบร้อยแล้ว`, 'info');
    return { success: true };
  };

  // Delete a Saraban Queue item (and rollback approved project data if present)
  const handleDeleteSarabanItem = async (
    item: SarabanQueueItem,
    rollbackProject?: Project
  ): Promise<{ success: boolean; error?: string }> => {
    if (currentUser?.role !== 'admin') {
      return { success: false, error: 'สิทธิ์เจ้าหน้าที่ (Staff) ไม่สามารถลบคิวได้' };
    }

    const rolledBack =
      item.queueStatus === 'approved' && rollbackProject
        ? rollbackSarabanQueueFromProject(rollbackProject, item)
        : undefined;

    const res = await deleteSarabanQueue({
      queueId: item.queueId,
      idempotencyKey: item.idempotencyKey,
      docCategory: item.docCategory,
      projectId: rollbackProject?.id || item.projectId,
      updatedProject: rolledBack
    });

    if (!res.success) {
      if (res.needsScriptUpdate) setSarabanNeedsScriptUpdate(true);
      return { success: false, error: res.error };
    }

    if (rolledBack) {
      const nextProjects = projects.map(p => (p.id === rolledBack.id ? rolledBack : p));
      updateProjects(nextProjects);
    }

    setSarabanQueueItems(prev => prev.filter(q => q.queueId !== item.queueId));
    showToast(`ลบรายการคิว ${item.queueId} เรียบร้อยแล้ว`, 'info');
    return { success: true };
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

    const { projects: enrichedProjects, stats } = enrichProjectsWithKnownDirectory(updatedProjects);
    updateProjects(enrichedProjects);

    const extraNotes: string[] = [];
    if (stats.filledPositionsCount > 0) {
      extraNotes.push(`เติมตำแหน่งอัตโนมัติ ${stats.filledPositionsCount} รายชื่อ`);
    }
    if (stats.filledContractorProjectsCount > 0) {
      extraNotes.push(`เติมข้อมูลผู้รับจ้าง ${stats.filledContractorProjectsCount} โครงการ`);
    }

    Swal.fire({
      icon: 'success',
      title: 'นำเข้าข้อมูลสำเร็จ',
      text: `นำเข้า/อัปเดตโครงการจากไฟล์ Excel สำเร็จจำนวน ${imported.length} รายการ${
        extraNotes.length > 0 ? ` (${extraNotes.join(', ')})` : ''
      }`,
      timer: 2400,
      showConfirmButton: false
    });
    setCurrentTab('projects');
  };

  // Preview how many projects have blank positions / contractor details that match previously recorded records
  const enrichmentPreview = useMemo(() => enrichProjectsWithKnownDirectory(projects), [projects]);

  // Option 3: Detect vacant sequential code gaps across all (prefix, fiscalYear) groups
  const codeGapGroups = useMemo(() => findAllCodeGapGroups(projects), [projects]);
  const totalCodeGapCount = useMemo(
    () => codeGapGroups.reduce((sum, g) => sum + g.missingCodes.length, 0),
    [codeGapGroups]
  );

  const handleApplyCodeRenumber = (
    group: ProjectCodeGapGroup,
    changes: ProjectCodeRenumberItem[]
  ) => {
    if (currentUser?.role !== 'admin') {
      Swal.fire('ไม่อนุญาต', 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถจัดเรียงรหัสโครงการได้', 'warning');
      return;
    }
    if (changes.length === 0) return;

    const changeMap = new Map(changes.map(c => [c.projectId, c.newCode]));
    const nowIso = new Date().toISOString();
    const updated = projects.map(p => {
      const nextCode = changeMap.get(p.id);
      if (!nextCode) return p;
      return {
        ...p,
        projectCode: nextCode,
        updatedAt: nowIso
      };
    });

    updateProjects(updated);
    setSelectedProjectForDetail(prev => {
      if (!prev) return null;
      const nextCode = changeMap.get(prev.id);
      return nextCode ? { ...prev, projectCode: nextCode, updatedAt: nowIso } : prev;
    });
    setIsRenumberModalOpen(false);

    Swal.fire({
      icon: 'success',
      title: 'จัดเรียงรหัสโครงการใหม่สำเร็จ',
      text: `ปรับเรียงรหัส ${group.prefixLabel} ปีงบประมาณ ${group.fiscalYear} จำนวน ${changes.length} โครงการเรียบร้อยแล้ว`,
      timer: 2200,
      showConfirmButton: false
    });
  };

  // Manual 1-click trigger to propagate newly entered positions / contractor details to matching blank projects
  const handleEnrichKnownData = () => {
    if (currentUser?.role !== 'admin') {
      Swal.fire('ไม่อนุญาต', 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถอัปเดตข้อมูลโครงการได้', 'warning');
      return;
    }

    const { projects: enrichedProjects, stats } = enrichProjectsWithKnownDirectory(projects);
    if (stats.updatedProjectsCount === 0) {
      Swal.fire({
        icon: 'info',
        title: 'ข้อมูลครบถ้วนตามฐานข้อมูลแล้ว',
        text: 'ไม่มีช่องตำแหน่งหรือข้อมูลผู้รับจ้างว่างที่ตรงกับข้อมูลที่เคยบันทึกไว้ในระบบ',
        timer: 2000,
        showConfirmButton: false
      });
      return;
    }

    updateProjects(enrichedProjects);

    const details: string[] = [];
    if (stats.filledPositionsCount > 0) {
      details.push(`เติมตำแหน่งบุคลากร/กรรมการ/ผู้ควบคุมงาน ${stats.filledPositionsCount} รายการ`);
    }
    if (stats.filledContractorTaxIdCount > 0) {
      details.push(`เติมเลขผู้เสียภาษีผู้รับจ้าง ${stats.filledContractorTaxIdCount} โครงการ`);
    }
    if (stats.filledContractorContactCount > 0) {
      details.push(`เติมเบอร์โทร/ติดต่อผู้รับจ้าง ${stats.filledContractorContactCount} โครงการ`);
    }

    Swal.fire({
      icon: 'success',
      title: `เติมข้อมูลอัตโนมัติสำเร็จ (${stats.updatedProjectsCount} โครงการ)`,
      text: `${details.join(' • ')} (รายชื่อที่ยังไม่เคยมีข้อมูลบันทึกไว้ยังคงเว้นว่างตามเดิม)`,
      confirmButtonText: 'ตกลง',
      confirmButtonColor: '#047857'
    });
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

  // Repair Requests Handlers (Admin only; Staff is read-only)
  const handleSaveRepairRequest = (req: RepairRequest) => {
    if (currentUser?.role !== 'admin') {
      Swal.fire('ไม่อนุญาต', 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถบันทึกหรือแก้ไขคำร้องได้', 'warning');
      return;
    }
    setRepairRequests(prev => {
      const exists = prev.some(item => item.id === req.id);
      const next = exists
        ? prev.map(item => (item.id === req.id ? req : item))
        : [req, ...prev];
      saveStoredRepairRequests(next);
      return next;
    });
    showToast(`บันทึกคำร้อง ${req.requestCode} เรียบร้อยแล้ว`, 'success');
  };

  const handleDeleteRepairRequest = (id: string) => {
    if (currentUser?.role !== 'admin') {
      Swal.fire('ไม่อนุญาต', 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถลบข้อมูลคำร้องได้', 'warning');
      return;
    }
    setRepairRequests(prev => {
      const next = prev.filter(item => item.id !== id);
      saveStoredRepairRequests(next);
      return next;
    });
    showToast('ลบรายการคำร้องเรียบร้อยแล้ว', 'info');
  };

  const handleQuickRepairStatusChange = (id: string, status: RepairRequestStatus) => {
    if (currentUser?.role !== 'admin') {
      Swal.fire('ไม่อนุญาต', 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถเปลี่ยนสถานะคำร้องได้', 'warning');
      return;
    }
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.slice(0, 10);
    setRepairRequests(prev => {
      const next = prev.map(item => {
        if (item.id !== id) return item;
        return {
          ...item,
          status,
          repairCompletedDate:
            status === 'completed' && !item.repairCompletedDate
              ? todayStr
              : item.repairCompletedDate,
          updatedAt: nowIso
        };
      });
      saveStoredRepairRequests(next);
      return next;
    });
    showToast('อัปเดตสถานะคำร้องเรียบร้อยแล้ว', 'success');
  };

  const openRepairCount = useMemo(
    () =>
      repairRequests.filter(
        r =>
          r.status === 'received' ||
          r.status === 'inspecting' ||
          r.status === 'in_progress'
      ).length,
    [repairRequests]
  );

  const currentCategoryTitle = filter.category && filter.category !== 'all' ? filter.category : 'ทะเบียนโครงการทั้งหมด';

  const pageTitles: Record<string, string> = {
    dashboard: 'สรุปผลงานโครงการ',
    vouchersSummary: 'รายงานฎีกา & เบิกจ่าย',
    myInbox: 'กล่องงานของฉัน',
    projects: currentCategoryTitle,
    overdue: 'งานเกินกำหนดสัญญา',
    timeline: 'ติดตามสถานะโครงการ',
    reports: 'รายงาน & สถิติโครงการ',
    project_records: 'ข้อมูลโครงการ',
    repair_requests: 'คำร้อง/งานซ่อมแซม',
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
        pendingSarabanCount={sarabanQueueItems.filter(i => i.queueStatus === 'pending').length}
        openRepairCount={openRepairCount}
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
              sarabanQueueItems={sarabanQueueItems}
              sarabanQueueLoading={sarabanQueueLoading}
              sarabanNeedsScriptUpdate={sarabanNeedsScriptUpdate}
              sarabanQueueError={sarabanQueueError}
              onRefreshSarabanQueue={() => loadSarabanQueue(false)}
              onApproveSarabanItem={handleApproveSarabanItem}
              onRejectSarabanItem={handleRejectSarabanItem}
              onDeleteSarabanItem={handleDeleteSarabanItem}
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
              onEnrichKnownData={handleEnrichKnownData}
              fillableCount={enrichmentPreview.stats.updatedProjectsCount}
              onOpenRenumberModal={() => setIsRenumberModalOpen(true)}
              codeGapCount={totalCodeGapCount}
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
              availableYears={availableYears}
              selectedYear={filter.fiscalYear}
              onSelectYear={yr => setFilter(prev => ({ ...prev, fiscalYear: yr }))}
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

          {/* 7.6 Road Petitions & Repair Work Tracker */}
          {currentTab === 'repair_requests' && (
            <RepairRequestsView
              requests={repairRequests}
              availableYears={availableYears}
              currentUser={currentUser}
              onSaveRequest={handleSaveRepairRequest}
              onDeleteRequest={handleDeleteRepairRequest}
              onQuickStatusChange={handleQuickRepairStatusChange}
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

      {/* Project Code Re-number Preview Modal (Option 3) */}
      <ProjectCodeRenumberModal
        isOpen={isRenumberModalOpen}
        onClose={() => setIsRenumberModalOpen(false)}
        gapGroups={codeGapGroups}
        onApplyRenumber={handleApplyCodeRenumber}
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
