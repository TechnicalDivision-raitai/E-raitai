import React, { useMemo, useState } from 'react';
import {
  Clock,
  AlertTriangle,
  Megaphone,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Wrench,
  CheckCircle2,
  HardHat
} from 'lucide-react';
import {
  Project,
  ProjectFilter,
  RepairRequest,
  RepairRequestStatus,
  UserProfile
} from '../types/project';
import {
  calculateProjectProgress,
  formatCurrency,
  formatThaiDate,
  getDaysRemaining,
  getWorkNoticeAlert,
  isProjectCompletedOrDisbursed
} from '../utils/thaiDate';
import { STATUS_LABELS } from '../utils/excelExport';
import civicSeamlessBanner from '../assets/images/civic_engineering_seamless_banner_1795349964067.jpg';

interface DashboardProps {
  projects: Project[];
  repairRequests?: RepairRequest[];
  filter: ProjectFilter;
  setFilter: React.Dispatch<React.SetStateAction<ProjectFilter>>;
  availableYears: number[];
  onSelectProject: (p: Project, tab?: number) => void;
  onOpenNewProjectModal: () => void;
  onNavigateToRepairRequests?: () => void;
  currentUser?: UserProfile;
}

type SummaryBucketKey = 'in_progress' | 'completed' | 'pending' | 'overdue' | 'cancelled';

const REPAIR_STATUS_META: Record<
  RepairRequestStatus,
  { label: string; textClass: string }
> = {
  received: { label: 'รับคำร้อง / รอตรวจ', textClass: 'text-rose-600' },
  inspecting: { label: 'ลงพื้นที่สำรวจ', textClass: 'text-amber-700' },
  in_progress: { label: 'กำลังซ่อมแซม', textClass: 'text-sky-700' },
  budget_planned: { label: 'เสนอตั้งงบฯ', textClass: 'text-indigo-700' },
  completed: { label: 'แก้ไขแล้วเสร็จ', textClass: 'text-emerald-700' }
};

function classifyProjectBucket(p: Project): SummaryBucketKey {
  if (p.status === 'cancelled') return 'cancelled';
  if (p.status === 'completed' || isProjectCompletedOrDisbursed(p)) return 'completed';
  const rem = p.endDate ? getDaysRemaining(p.endDate) : null;
  if (p.status === 'overdue' || (rem && rem.isOverdue)) return 'overdue';
  if (p.status === 'not_started' || p.status === 'procurement_tor') return 'pending';
  return 'in_progress';
}

export const Dashboard: React.FC<DashboardProps> = ({
  projects,
  repairRequests = [],
  filter,
  setFilter,
  availableYears,
  onSelectProject,
  onOpenNewProjectModal,
  onNavigateToRepairRequests,
  currentUser
}) => {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [activeBucketFilter, setActiveBucketFilter] = useState<SummaryBucketKey | 'all'>('all');
  const [hoveredBucket, setHoveredBucket] = useState<SummaryBucketKey | null>(null);
  const [bannerImgFailed, setBannerImgFailed] = useState<boolean>(false);
  const [showAllNearDue, setShowAllNearDue] = useState<boolean>(false);
  const [showAllOverdue, setShowAllOverdue] = useState<boolean>(false);
  const [showAllFollowUp, setShowAllFollowUp] = useState<boolean>(false);
  const [followUpMode, setFollowUpMode] = useState<'repairs' | 'notices'>('repairs');

  // Available budget categories for filter dropdown
  const availableCategories = useMemo(
    () =>
      Array.from(new Set(projects.map(p => p.budgetCategory).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'th')
      ),
    [projects]
  );

  // Base filtered projects (year, category, status, keyword)
  const baseFilteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (filter.fiscalYear !== 'all' && p.fiscalYear !== Number(filter.fiscalYear)) {
        return false;
      }
      if (filter.category !== 'all' && p.budgetCategory !== filter.category) {
        return false;
      }
      if (filter.status !== 'all' && p.status !== filter.status) {
        return false;
      }
      if (filter.searchQuery.trim()) {
        const query = filter.searchQuery.toLowerCase().trim();
        const matchName = p.name.toLowerCase().includes(query);
        const matchCode = p.projectCode.toLowerCase().includes(query);
        const matchContract = p.contractNo?.toLowerCase().includes(query) ?? false;
        const matchContractor = p.contractorName?.toLowerCase().includes(query) ?? false;
        const matchLocation = p.location?.toLowerCase().includes(query) ?? false;
        if (!matchName && !matchCode && !matchContract && !matchContractor && !matchLocation) {
          return false;
        }
      }
      return true;
    });
  }, [projects, filter]);

  // Projects filtered further if user clicked a status row/slice in the summary card
  const displayProjects = useMemo(() => {
    if (activeBucketFilter === 'all') return baseFilteredProjects;
    return baseFilteredProjects.filter(p => classifyProjectBucket(p) === activeBucketFilter);
  }, [baseFilteredProjects, activeBucketFilter]);

  // 5-Bucket Summary Counts (always computed from baseFilteredProjects so donut stays full context)
  const bucketCounts = useMemo(() => {
    const counts: Record<SummaryBucketKey, number> = {
      in_progress: 0,
      completed: 0,
      pending: 0,
      overdue: 0,
      cancelled: 0
    };
    baseFilteredProjects.forEach(p => {
      counts[classifyProjectBucket(p)] += 1;
    });
    return counts;
  }, [baseFilteredProjects]);

  const totalCount = baseFilteredProjects.length;

  const summaryItems: Array<{
    key: SummaryBucketKey;
    label: string;
    count: number;
    swatchClass: string;
    strokeColor: string;
  }> = useMemo(
    () => [
      {
        key: 'pending',
        label: 'เตรียมดำเนินการ',
        count: bucketCounts.pending,
        swatchClass: 'bg-amber-500',
        strokeColor: '#f59e0b'
      },
      {
        key: 'in_progress',
        label: 'อยู่ระหว่างดำเนินการ',
        count: bucketCounts.in_progress,
        swatchClass: 'bg-emerald-600',
        strokeColor: '#059669'
      },
      {
        key: 'completed',
        label: 'แล้วเสร็จ',
        count: bucketCounts.completed,
        swatchClass: 'bg-blue-500',
        strokeColor: '#3b82f6'
      },
      {
        key: 'overdue',
        label: 'ล่าช้า',
        count: bucketCounts.overdue,
        swatchClass: 'bg-rose-600',
        strokeColor: '#e11d48'
      },
      {
        key: 'cancelled',
        label: 'ยกเลิก / ระงับ',
        count: bucketCounts.cancelled,
        swatchClass: 'bg-slate-400',
        strokeColor: '#94a3b8'
      }
    ],
    [bucketCounts]
  );

  // Budget Totals
  const totalApprovedBudget = useMemo(
    () => displayProjects.reduce((sum, p) => sum + (p.approvedBudget || 0), 0),
    [displayProjects]
  );
  const totalContractAmount = useMemo(
    () => displayProjects.reduce((sum, p) => sum + (p.contractAmount || 0), 0),
    [displayProjects]
  );
  const totalDisbursedAmount = useMemo(
    () =>
      displayProjects.reduce((sum, p) => {
        const paidInProject = (p.disbursements || [])
          .filter(d => d.status === 'paid')
          .reduce((sub, d) => sub + (d.amount || 0), 0);
        return sum + paidInProject;
      }, 0),
    [displayProjects]
  );

  const budgetScaleMax = Math.max(totalApprovedBudget, totalContractAmount, totalDisbursedAmount, 1);
  const approvedBarPct =
    totalApprovedBudget > 0 ? Math.max(6, Math.round((totalApprovedBudget / budgetScaleMax) * 100)) : 0;
  const contractBarPct =
    totalContractAmount > 0 ? Math.max(4, Math.round((totalContractAmount / budgetScaleMax) * 100)) : 0;
  const disbursedBarPct =
    totalDisbursedAmount > 0 ? Math.max(4, Math.round((totalDisbursedAmount / budgetScaleMax) * 100)) : 0;

  const contractRatePct =
    totalApprovedBudget > 0 ? Math.round((totalContractAmount / totalApprovedBudget) * 100) : 0;
  const disbursedRatePct =
    totalContractAmount > 0
      ? Math.min(100, Math.round((totalDisbursedAmount / totalContractAmount) * 100))
      : totalApprovedBudget > 0
      ? Math.min(100, Math.round((totalDisbursedAmount / totalApprovedBudget) * 100))
      : 0;

  // Breakdown by Budget Source (หมวดงบประมาณ) + Infrastructure Type (ถ./อ.) + Average Progress
  const categoryBreakdown = useMemo(() => {
    const palette = [
      'bg-emerald-700',
      'bg-teal-600',
      'bg-amber-500',
      'bg-sky-600',
      'bg-rose-500'
    ];
    const map = new Map<string, { name: string; count: number; budget: number }>();
    displayProjects.forEach(p => {
      const cat = (p.budgetCategory || 'ไม่ระบุหมวดงบ').trim();
      const prev = map.get(cat) || { name: cat, count: 0, budget: 0 };
      prev.count += 1;
      prev.budget += p.approvedBudget || 0;
      map.set(cat, prev);
    });
    const sorted = Array.from(map.values()).sort(
      (a, b) => b.budget - a.budget || b.count - a.count
    );
    const totalBudgetSum = sorted.reduce((s, item) => s + item.budget, 0);
    return sorted.slice(0, 4).map((item, idx) => ({
      ...item,
      barColor: palette[idx % palette.length],
      sharePct:
        totalBudgetSum > 0
          ? Math.round((item.budget / totalBudgetSum) * 100)
          : displayProjects.length > 0
          ? Math.round((item.count / displayProjects.length) * 100)
          : 0
    }));
  }, [displayProjects]);

  const workTypeSummary = useMemo(() => {
    let road = 0;
    let building = 0;
    let other = 0;
    displayProjects.forEach(p => {
      const code = (p.projectCode || '').trim();
      if (code.startsWith('ถ.')) road += 1;
      else if (code.startsWith('อ.')) building += 1;
      else other += 1;
    });
    return { road, building, other };
  }, [displayProjects]);

  const avgProgressPct = useMemo(() => {
    const active = displayProjects.filter(p => p.status !== 'cancelled');
    if (active.length === 0) return 0;
    const sum = active.reduce((acc, p) => acc + calculateProjectProgress(p), 0);
    return Math.round(sum / active.length);
  }, [displayProjects]);

  const procurementSavings = useMemo(() => {
    return displayProjects.reduce((sum, p) => {
      if (p.status === 'cancelled') return sum;
      if (p.approvedBudget > 0 && p.contractAmount && p.contractAmount > 0 && p.approvedBudget > p.contractAmount) {
        return sum + (p.approvedBudget - p.contractAmount);
      }
      return sum;
    }, 0);
  }, [displayProjects]);

  // Alert List 1: Projects Near Deadline (<= 30 days remaining, not completed/cancelled)
  const nearDeadlineProjects = useMemo(() => {
    return baseFilteredProjects
      .filter(p => {
        if (!p.endDate || p.status === 'completed' || p.status === 'cancelled' || isProjectCompletedOrDisbursed(p)) {
          return false;
        }
        const rem = getDaysRemaining(p.endDate);
        return !rem.isOverdue && rem.days <= 30;
      })
      .map(p => ({ project: p, remaining: getDaysRemaining(p.endDate) }))
      .sort((a, b) => a.remaining.days - b.remaining.days);
  }, [baseFilteredProjects]);

  // Alert List 2: Overdue Projects (past endDate or status === 'overdue', not completed/cancelled)
  const overdueProjects = useMemo(() => {
    return baseFilteredProjects
      .filter(p => {
        if (p.status === 'completed' || p.status === 'cancelled' || isProjectCompletedOrDisbursed(p)) {
          return false;
        }
        const rem = p.endDate ? getDaysRemaining(p.endDate) : null;
        return p.status === 'overdue' || Boolean(rem && rem.isOverdue);
      })
      .map(p => ({
        project: p,
        overdueDays: p.endDate ? getDaysRemaining(p.endDate).days : 0
      }))
      .sort((a, b) => b.overdueDays - a.overdueDays);
  }, [baseFilteredProjects]);

  // Alert List 3: Open Repair Petitions (คำร้อง/ซ่อมแซมที่ยังไม่แล้วเสร็จ) + Contractor Acceleration Alerts
  const openRepairPetitions = useMemo(() => {
    const urgencyRank: Record<string, number> = { emergency: 0, urgent: 1, normal: 2 };
    const filteredRepairs = repairRequests.filter(r => {
      if (r.status === 'completed') return false;
      if (filter.fiscalYear !== 'all' && r.fiscalYear && r.fiscalYear !== Number(filter.fiscalYear)) {
        return false;
      }
      return true;
    });

    // If year filter hides all repairs while there are open repairs in other years, keep showing all open repairs so nothing urgent is missed
    const sourceList =
      filteredRepairs.length > 0
        ? filteredRepairs
        : repairRequests.filter(r => r.status !== 'completed');

    return [...sourceList].sort((a, b) => {
      const rankDiff = (urgencyRank[a.urgency] ?? 2) - (urgencyRank[b.urgency] ?? 2);
      if (rankDiff !== 0) return rankDiff;
      return (b.petitionDate || '').localeCompare(a.petitionDate || '');
    });
  }, [repairRequests, filter.fiscalYear]);

  const workNoticeAlerts = useMemo(() => {
    return baseFilteredProjects
      .map(p => ({ project: p, alert: getWorkNoticeAlert(p) }))
      .filter(item => item.alert.hasAlert)
      .sort((a, b) => b.alert.daysElapsed - a.alert.daysElapsed);
  }, [baseFilteredProjects]);

  // Latest projects sorted newest first (preserving original behavior)
  const latestProjects = useMemo(() => {
    return [...displayProjects]
      .sort((a, b) => {
        const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        return timeB - timeA;
      })
      .slice(0, 6);
  }, [displayProjects]);

  // Donut Chart Geometry (SVG stroke-dasharray)
  const donutRadius = 59;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const donutSegments = useMemo(() => {
    if (totalCount === 0) return [];
    let cumulativeFraction = 0;
    return summaryItems
      .filter(item => item.count > 0)
      .map(item => {
        const fraction = item.count / totalCount;
        const length = fraction * donutCircumference;
        const offset = -cumulativeFraction * donutCircumference;
        cumulativeFraction += fraction;
        return {
          ...item,
          length,
          offset,
          percent: Math.round(fraction * 100)
        };
      });
  }, [summaryItems, totalCount, donutCircumference]);

  const hasActiveFilters =
    filter.category !== 'all' ||
    filter.status !== 'all' ||
    activeBucketFilter !== 'all' ||
    Boolean(filter.searchQuery.trim());

  const handleResetFilters = () => {
    setFilter(prev => ({
      ...prev,
      category: 'all',
      status: 'all',
      searchQuery: ''
    }));
    setActiveBucketFilter('all');
  };

  const budgetYearLabel =
    filter.fiscalYear !== 'all' ? `พ.ศ. ${filter.fiscalYear}` : 'ทุกปีงบประมาณ';

  const visibleNearDue = showAllNearDue ? nearDeadlineProjects : nearDeadlineProjects.slice(0, 4);
  const visibleOverdue = showAllOverdue ? overdueProjects : overdueProjects.slice(0, 4);
  const visibleRepairs = showAllFollowUp ? openRepairPetitions : openRepairPetitions.slice(0, 4);
  const visibleNotices = showAllFollowUp ? workNoticeAlerts : workNoticeAlerts.slice(0, 4);

  return (
    <div className="space-y-3.5">
      {/* =====================================================================
          1. HERO EXECUTIVE BANNER (@container Layered Seamless Banner)
         ===================================================================== */}
      <section className="@container relative bg-white rounded-2xl border border-emerald-100/90 shadow-xs overflow-hidden">
        <div className="relative min-h-[104px] @xl:h-[112px] @3xl:h-[124px] @5xl:h-[136px] flex items-center">
          {/* Background Layer: Right-Anchored Continuous Illustration (scales fluidly with card width & never pushes text) */}
          <div
            className="absolute inset-0 overflow-hidden pointer-events-none select-none"
            aria-hidden="true"
          >
            {!bannerImgFailed ? (
              <>
                <img
                  src={civicSeamlessBanner}
                  alt="ภาพประกอบงานก่อสร้างและวิศวกรกองช่าง"
                  referrerPolicy="no-referrer"
                  onError={() => setBannerImgFailed(true)}
                  className="absolute right-0 @2xl:right-2 @4xl:right-3 top-[-54%] @3xl:top-[-64%] h-[196%] @3xl:h-[214%] w-auto max-w-none mix-blend-multiply opacity-30 @lg:opacity-55 @2xl:opacity-85 @3xl:opacity-100 transition-opacity duration-200"
                />
                {/* Adaptive Left White Scrim: protects text readability when overlapping image on narrower widths */}
                <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 via-[48%] @3xl:via-[38%] @5xl:via-[30%] to-transparent" />
              </>
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-white via-emerald-50/60 to-emerald-100/50 flex items-center justify-end gap-2 text-emerald-900/60 px-6">
                <HardHat className="w-6 h-6 shrink-0" />
                <span className="text-xs font-semibold">งานก่อสร้างและบำรุงรักษา กองช่าง</span>
              </div>
            )}
          </div>

          {/* Foreground Layer: Unobstructed Typography (never squeezed or clipped when resizing or opening sidebar) */}
          <div className="relative z-10 w-full px-5 py-3 @2xl:px-7 @2xl:py-0 flex flex-col justify-center">
            <h2 className="text-lg @md:text-xl @2xl:text-[24px] @4xl:text-[27px] font-extrabold text-emerald-900 font-heading tracking-tight leading-snug">
              ภาพรวมโครงการกองช่าง
            </h2>
            <p className="text-xs @2xl:text-[13px] @4xl:text-sm font-medium text-slate-600 mt-0.5 @2xl:mt-1 max-w-[92%] @3xl:max-w-[56%]">
              สถานะ ความคืบหน้า งบประมาณ และกำหนดการดำเนินงาน
            </p>
            <p className="text-xs @2xl:text-[13px] @4xl:text-sm font-bold text-emerald-700 mt-0.5">
              {filter.fiscalYear !== 'all'
                ? `ปีงบประมาณ พ.ศ. ${filter.fiscalYear}`
                : 'ทุกปีงบประมาณ'}
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================================
          2. COMPACT 3-DROPDOWN FILTER BAR
         ===================================================================== */}
      <section className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
          {/* Filter 1: Budget Category */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl px-3 py-1 hover:border-emerald-300 transition-colors">
            <label className="block text-[10px] font-semibold text-emerald-800/70 leading-tight">
              หมวดงบประมาณ
            </label>
            <select
              value={filter.category}
              onChange={e => setFilter(prev => ({ ...prev, category: e.target.value }))}
              className="w-full bg-transparent text-xs font-bold text-emerald-950 focus:outline-hidden cursor-pointer pt-0.5 truncate"
            >
              <option value="all">ทั้งหมด</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 2: Project Status */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl px-3 py-1 hover:border-emerald-300 transition-colors">
            <label className="block text-[10px] font-semibold text-emerald-800/70 leading-tight">
              สถานะโครงการ
            </label>
            <select
              value={filter.status}
              onChange={e => {
                setActiveBucketFilter('all');
                setFilter(prev => ({ ...prev, status: e.target.value }));
              }}
              className="w-full bg-transparent text-xs font-bold text-emerald-950 focus:outline-hidden cursor-pointer pt-0.5 truncate"
            >
              <option value="all">ทั้งหมด</option>
              <option value="not_started">ยังไม่เริ่มดำเนินการ</option>
              <option value="procurement_tor">จัดทำ TOR/ราคากลาง</option>
              <option value="contracted">ลงนามสัญญาแล้ว</option>
              <option value="in_progress">อยู่ระหว่างดำเนินการ</option>
              <option value="delivered">ส่งมอบงานแล้ว รอตรวจรับ</option>
              <option value="inspected">ตรวจรับแล้ว รอเบิกจ่าย</option>
              <option value="completed">แล้วเสร็จ/เบิกจ่ายแล้ว</option>
              <option value="overdue">เกินกำหนดสัญญา</option>
              <option value="cancelled">ยกเลิกโครงการ</option>
            </select>
          </div>

          {/* Filter 3: Fiscal Year */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl px-3 py-1 hover:border-emerald-300 transition-colors">
            <label className="block text-[10px] font-semibold text-emerald-800/70 leading-tight">
              ปีงบประมาณ
            </label>
            <select
              value={filter.fiscalYear}
              onChange={e =>
                setFilter(prev => ({
                  ...prev,
                  fiscalYear: e.target.value === 'all' ? 'all' : Number(e.target.value)
                }))
              }
              className="w-full bg-transparent text-xs font-bold text-emerald-950 focus:outline-hidden cursor-pointer pt-0.5 truncate"
            >
              <option value="all">ทุกปีงบประมาณ</option>
              {availableYears.map(yr => (
                <option key={yr} value={yr}>
                  ปีงบประมาณ {yr}
                </option>
              ))}
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>ล้างตัวกรอง</span>
          </button>
        )}
      </section>

      {/* =====================================================================
          3. ROW 1: STATUS DONUT | BUDGET SOURCE & PROGRESS | BUDGET OVERVIEW
         ===================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
        {/* Card 1: Status Proportion Donut + Bottom Total Count */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-emerald-800 to-teal-800 px-4 py-2 flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-white font-heading">
              สัดส่วนโครงการตามสถานะ
            </h3>
            {activeBucketFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setActiveBucketFilter('all')}
                className="text-[11px] font-medium text-emerald-100 hover:text-white underline whitespace-nowrap"
              >
                แสดงทั้งหมด
              </button>
            )}
          </div>

          <div className="p-3 flex-1 flex flex-col justify-between gap-2.5">
            <div className="flex-1 flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center justify-center gap-3">
              {/* SVG Donut */}
              <div className="relative w-36 h-36 shrink-0">
                <svg
                  viewBox="0 0 160 160"
                  className="w-full h-full -rotate-90"
                  role="img"
                  aria-label={`สัดส่วนโครงการทั้งหมด ${totalCount} โครงการ`}
                >
                  <circle
                    cx="80"
                    cy="80"
                    r={donutRadius}
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="30"
                  />
                  {donutSegments.map(seg => {
                    const isHighlighted =
                      hoveredBucket === seg.key || activeBucketFilter === seg.key;
                    const isDimmed =
                      (hoveredBucket && hoveredBucket !== seg.key) ||
                      (activeBucketFilter !== 'all' && activeBucketFilter !== seg.key);
                    return (
                      <circle
                        key={seg.key}
                        cx="80"
                        cy="80"
                        r={donutRadius}
                        fill="none"
                        stroke={seg.strokeColor}
                        strokeWidth={isHighlighted ? 34 : 30}
                        strokeDasharray={`${seg.length} ${donutCircumference - seg.length}`}
                        strokeDashoffset={seg.offset}
                        className="cursor-pointer transition-all duration-200"
                        style={{ opacity: isDimmed ? 0.35 : 1 }}
                        onClick={() =>
                          setActiveBucketFilter(prev => (prev === seg.key ? 'all' : seg.key))
                        }
                        onMouseEnter={() => setHoveredBucket(seg.key)}
                        onMouseLeave={() => setHoveredBucket(null)}
                      >
                        <title>{`${seg.label}: ${seg.count} โครงการ (${seg.percent}%)`}</title>
                      </circle>
                    );
                  })}
                </svg>

                {/* Center Metric */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4 text-center">
                  {(() => {
                    const focusItem = hoveredBucket
                      ? summaryItems.find(i => i.key === hoveredBucket)
                      : activeBucketFilter !== 'all'
                      ? summaryItems.find(i => i.key === activeBucketFilter)
                      : null;
                    const centerVal = focusItem ? focusItem.count : totalCount;
                    const focusPct =
                      focusItem && totalCount > 0
                        ? Math.round((focusItem.count / totalCount) * 100)
                        : 0;
                    return (
                      <>
                        <span
                          className="text-2xl font-extrabold tabular-nums leading-none transition-colors duration-150"
                          style={{ color: focusItem ? focusItem.strokeColor : '#064e3b' }}
                        >
                          {centerVal}
                        </span>
                        {focusItem ? (
                          <>
                            <span className="text-[11px] font-bold text-slate-700 tabular-nums leading-tight mt-0.5">
                              {focusPct}%
                            </span>
                            <span className="text-[9.5px] font-semibold text-slate-500 leading-tight max-w-[66px] truncate">
                              {focusItem.label}
                            </span>
                          </>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-500 mt-1">
                            โครงการ
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Compact Right Legend */}
              <div className="w-full sm:flex-1 space-y-1 text-xs">
                {summaryItems.map(item => {
                  const isActive = activeBucketFilter === item.key;
                  const pct = totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() =>
                        setActiveBucketFilter(prev => (prev === item.key ? 'all' : item.key))
                      }
                      onMouseEnter={() => setHoveredBucket(item.key)}
                      onMouseLeave={() => setHoveredBucket(null)}
                      className={`w-full flex items-center justify-between gap-2 px-1.5 py-0.5 rounded-lg transition-colors ${
                        isActive ? 'bg-emerald-50 text-emerald-900' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-2.5 h-3 rounded-xs shrink-0 ${item.swatchClass}`}
                          aria-hidden="true"
                        />
                        <span className="font-semibold truncate">{item.label}</span>
                      </span>
                      <span className="font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        {item.count}
                        <span className="text-[10px] font-normal text-slate-400 ml-1">({pct}%)</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Total Count Footer (moved from card header) */}
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-emerald-50/80 border border-emerald-100">
              <span className="text-xs font-bold text-slate-800">รวมทั้งหมด</span>
              <span className="text-xs font-bold text-emerald-900 tabular-nums">
                <strong className="text-base mr-1">{totalCount}</strong>โครงการ
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Budget Sources, Work Types & Average 12-Step Progress */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-emerald-800 to-teal-800 px-4 py-2 flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-white font-heading">
              จำแนกตามแหล่งงบและประเภทงาน
            </h3>
            {filter.category !== 'all' ? (
              <button
                type="button"
                onClick={() => setFilter(prev => ({ ...prev, category: 'all' }))}
                className="text-[11px] font-medium text-emerald-100 hover:text-white underline whitespace-nowrap"
              >
                ทุกหมวดงบ
              </button>
            ) : (
              <span className="text-[11px] text-emerald-100 tabular-nums">
                คืบหน้าเฉลี่ย {avgProgressPct}%
              </span>
            )}
          </div>

          <div className="p-3 flex-1 flex flex-col justify-between gap-2.5">
            {/* Funding Source Breakdown */}
            <div className="space-y-2 flex-1 flex flex-col justify-center">
              {categoryBreakdown.length === 0 ? (
                <div className="py-5 text-center text-xs text-slate-400">
                  ไม่มีข้อมูลหมวดงบประมาณในช่วงที่เลือก
                </div>
              ) : (
                categoryBreakdown.map(item => {
                  const isSelected = filter.category === item.name;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() =>
                        setFilter(prev => ({
                          ...prev,
                          category: prev.category === item.name ? 'all' : item.name
                        }))
                      }
                      className={`w-full text-left px-2 py-1 rounded-lg transition-colors ${
                        isSelected
                          ? 'bg-emerald-50 ring-1 ring-emerald-300'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs mb-1">
                        <span className="font-semibold text-slate-800 truncate min-w-0">
                          {item.name}
                        </span>
                        <span className="font-bold text-slate-900 tabular-nums whitespace-nowrap shrink-0">
                          {formatCurrency(item.budget)} บ.
                          <span className="text-[10px] font-medium text-slate-500 ml-1">
                            ({item.count})
                          </span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${item.barColor}`}
                          style={{ width: `${Math.max(4, item.sharePct)}%` }}
                        />
                      </div>
                    </button>
                  );
                })
              )}

              {/* Average 12-Step Progress & Procurement Savings */}
              <div className="pt-1.5 border-t border-slate-100 px-2 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-600">
                    ความคืบหน้าเฉลี่ย (12 ขั้นตอน)
                  </span>
                  <span className="font-bold text-emerald-800 tabular-nums">
                    {avgProgressPct}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${avgProgressPct}%` }}
                  />
                </div>
                {procurementSavings > 0 && (
                  <div className="flex items-center justify-between text-[11px] pt-0.5">
                    <span className="text-slate-500">ประหยัดงบจัดซื้อจัดจ้าง</span>
                    <span className="font-bold text-emerald-700 tabular-nums">
                      {formatCurrency(procurementSavings)} บ.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Work Type Summary Footer (aligned with Card 1) */}
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-emerald-50/80 border border-emerald-100 text-xs">
              <span className="font-bold text-slate-800 whitespace-nowrap">ประเภทงาน</span>
              <span className="font-semibold text-emerald-900 tabular-nums truncate">
                ถนน (ถ.) <strong>{workTypeSummary.road}</strong>
                <span className="text-slate-400 mx-1.5" aria-hidden="true">·</span>
                อาคาร (อ.) <strong>{workTypeSummary.building}</strong>
                {workTypeSummary.other > 0 && (
                  <>
                    <span className="text-slate-400 mx-1.5" aria-hidden="true">·</span>
                    อื่นๆ <strong>{workTypeSummary.other}</strong>
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Budget Overview */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-emerald-800 to-teal-800 px-4 py-2 flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-white font-heading">
              ภาพรวมงบประมาณ {budgetYearLabel}
            </h3>
            <span className="text-[11px] text-emerald-100 tabular-nums">
              {displayProjects.length} โครงการ
            </span>
          </div>

          <div className="p-3 flex-1 flex flex-col justify-between gap-2.5">
            <div className="space-y-3 flex-1 flex flex-col justify-center">
              {/* Approved Budget */}
              <div>
                <div className="flex items-center justify-between gap-2 text-xs mb-1">
                  <span className="flex items-center gap-2 font-semibold text-slate-700">
                    <span className="w-3 h-3 rounded-xs bg-amber-500 shrink-0" aria-hidden="true" />
                    <span>งบอนุมัติ</span>
                  </span>
                  <span className="font-bold text-slate-900 text-sm tabular-nums">
                    {formatCurrency(totalApprovedBudget)} บ.
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-300"
                    style={{ width: `${approvedBarPct}%` }}
                  />
                </div>
              </div>

              {/* Contracted Budget */}
              <div>
                <div className="flex items-center justify-between gap-2 text-xs mb-1">
                  <span className="flex items-center gap-2 font-semibold text-slate-700">
                    <span className="w-3 h-3 rounded-xs bg-emerald-600 shrink-0" aria-hidden="true" />
                    <span>วงเงินสัญญา</span>
                  </span>
                  <span className="font-bold text-slate-900 text-sm tabular-nums">
                    {formatCurrency(totalContractAmount)} บ.
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                    style={{ width: `${contractBarPct}%` }}
                  />
                </div>
              </div>

              {/* Disbursed Budget */}
              <div>
                <div className="flex items-center justify-between gap-2 text-xs mb-1">
                  <span className="flex items-center gap-2 font-semibold text-slate-700">
                    <span className="w-3 h-3 rounded-xs bg-blue-600 shrink-0" aria-hidden="true" />
                    <span>เบิกจ่ายแล้ว</span>
                  </span>
                  <span className="font-bold text-blue-700 text-sm tabular-nums">
                    {formatCurrency(totalDisbursedAmount)} บ.
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${disbursedBarPct}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-emerald-50/80 border border-emerald-100 text-xs tabular-nums">
              <span className="font-semibold text-slate-700">ทำสัญญาแล้ว {contractRatePct}%</span>
              <span className="font-bold text-emerald-900">
                เบิกจ่าย {disbursedRatePct}%
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          4. ROW 2: ACTION & ALERT TRACKING CARDS (3-Column Grid)
             1) ใกล้ครบกำหนด (<=30 วัน)
             2) โครงการล่าช้า (เกินกำหนด)
             3) ประเด็นที่ต้องเร่งติดตาม (ใบคำร้อง/ซ่อมแซม + เร่งรัดเข้างาน)
         ===================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 items-stretch">
        {/* Card 1: Projects Near Deadline */}
        <div className="bg-amber-50/75 rounded-2xl border border-amber-200/90 p-3.5 flex flex-col">
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-amber-200/70">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[13px] font-bold text-amber-900 font-heading truncate">
                  โครงการใกล้ครบกำหนด
                </h3>
                <p className="text-[11px] text-amber-800/80">อีก 30 วัน หรือน้อยกว่า</p>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-800 tabular-nums whitespace-nowrap pt-0.5">
              {nearDeadlineProjects.length} รายการ
            </span>
          </div>

          <div className="mt-2 flex-1 divide-y divide-amber-200/60">
            {visibleNearDue.length === 0 ? (
              <div className="py-5 text-center text-xs text-amber-900/60 flex flex-col items-center gap-1.5">
                <CheckCircle2 className="w-4.5 h-4.5 text-amber-600/60" />
                <span>ไม่มีโครงการใกล้ครบกำหนดภายใน 30 วัน</span>
              </div>
            ) : (
              visibleNearDue.map(({ project, remaining }) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => onSelectProject(project, 4)}
                  className="w-full py-2 px-1.5 flex items-center justify-between gap-3 text-left hover:bg-amber-100/60 rounded-lg transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {project.name}
                    </div>
                    <div className="text-[11px] text-slate-600 truncate mt-0.5">
                      {project.projectCode}
                      {project.location ? ` · ${project.location}` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-extrabold text-amber-700 tabular-nums whitespace-nowrap">
                      {remaining.days === 0 ? 'ครบวันนี้' : `${remaining.days} วัน`}
                    </span>
                    <div className="text-[10px] text-slate-500 tabular-nums">
                      {formatThaiDate(project.endDate)}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {nearDeadlineProjects.length > 4 && (
            <button
              type="button"
              onClick={() => setShowAllNearDue(prev => !prev)}
              className="mt-1.5 pt-2 border-t border-amber-200/70 w-full flex items-center justify-center gap-1 text-xs font-semibold text-amber-800 hover:text-amber-950 transition-colors"
            >
              <span>
                {showAllNearDue
                  ? 'ย่อรายการ'
                  : `ดูทั้งหมด (${nearDeadlineProjects.length} โครงการ)`}
              </span>
              {showAllNearDue ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* Card 2: Overdue Projects */}
        <div className="bg-rose-50/75 rounded-2xl border border-rose-200/90 p-3.5 flex flex-col">
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-rose-200/70">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[13px] font-bold text-rose-900 font-heading truncate">
                  โครงการล่าช้า
                </h3>
                <p className="text-[11px] text-rose-800/80">เกินกำหนดตามแผนสัญญา</p>
              </div>
            </div>
            <span className="text-xs font-bold text-rose-700 tabular-nums whitespace-nowrap pt-0.5">
              {overdueProjects.length} รายการ
            </span>
          </div>

          <div className="mt-2 flex-1 divide-y divide-rose-200/60">
            {visibleOverdue.length === 0 ? (
              <div className="py-5 text-center text-xs text-rose-900/60 flex flex-col items-center gap-1.5">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600/70" />
                <span>ไม่มีโครงการล่าช้าเกินกำหนดสัญญา</span>
              </div>
            ) : (
              visibleOverdue.map(({ project, overdueDays }) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => onSelectProject(project, 4)}
                  className="w-full py-2 px-1.5 flex items-center justify-between gap-3 text-left hover:bg-rose-100/60 rounded-lg transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {project.name}
                    </div>
                    <div className="text-[11px] text-slate-600 truncate mt-0.5">
                      {project.projectCode}
                      {project.location ? ` · ${project.location}` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-extrabold text-rose-600 tabular-nums whitespace-nowrap">
                      {overdueDays > 0 ? `${overdueDays} วัน` : 'เกินกำหนด'}
                    </span>
                    {project.endDate && (
                      <div className="text-[10px] text-slate-500 tabular-nums">
                        ครบ {formatThaiDate(project.endDate)}
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {overdueProjects.length > 4 && (
            <button
              type="button"
              onClick={() => setShowAllOverdue(prev => !prev)}
              className="mt-1.5 pt-2 border-t border-rose-200/70 w-full flex items-center justify-center gap-1 text-xs font-semibold text-rose-800 hover:text-rose-950 transition-colors"
            >
              <span>
                {showAllOverdue
                  ? 'ย่อรายการ'
                  : `ดูทั้งหมด (${overdueProjects.length} โครงการ)`}
              </span>
              {showAllOverdue ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* Card 3: Urgent Follow-Up (Repair Petitions & Work Notice Acceleration) */}
        <div className="bg-teal-50/75 rounded-2xl border border-teal-200/90 p-3.5 flex flex-col">
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-teal-200/70">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-teal-700 text-white flex items-center justify-center shrink-0">
                <Megaphone className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[13px] font-bold text-teal-950 font-heading truncate">
                  ประเด็นที่ต้องเร่งติดตาม
                </h3>
                <p className="text-[11px] text-teal-900/75">
                  ติดตามใบคำร้องซ่อมแซมและงานกระทบประชาชน
                </p>
              </div>
            </div>
            {onNavigateToRepairRequests && (
              <button
                type="button"
                onClick={onNavigateToRepairRequests}
                className="text-[11px] font-bold text-teal-800 hover:text-teal-950 inline-flex items-center gap-0.5 whitespace-nowrap shrink-0 pt-0.5"
              >
                <span>ทั้งหมด</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Optional Compact Switcher when Contractor Work Notice Alerts also exist */}
          {workNoticeAlerts.length > 0 && currentUser?.role === 'admin' && (
            <div className="mt-2 flex items-center gap-1 p-0.5 bg-teal-100/80 rounded-lg text-[11px]">
              <button
                type="button"
                onClick={() => setFollowUpMode('repairs')}
                className={`flex-1 px-2.5 py-1 rounded-md font-semibold transition-colors whitespace-nowrap ${
                  followUpMode === 'repairs'
                    ? 'bg-white text-teal-900 shadow-2xs'
                    : 'text-teal-800 hover:text-teal-950'
                }`}
              >
                คำร้องซ่อมแซม ({openRepairPetitions.length})
              </button>
              <button
                type="button"
                onClick={() => setFollowUpMode('notices')}
                className={`flex-1 px-2.5 py-1 rounded-md font-semibold transition-colors whitespace-nowrap ${
                  followUpMode === 'notices'
                    ? 'bg-white text-teal-900 shadow-2xs'
                    : 'text-teal-800 hover:text-teal-950'
                }`}
              >
                เร่งรัดเข้างาน ({workNoticeAlerts.length})
              </button>
            </div>
          )}

          <div className="mt-2 flex-1 divide-y divide-teal-200/60">
            {followUpMode === 'notices' && workNoticeAlerts.length > 0 && currentUser?.role === 'admin' ? (
              visibleNotices.map(({ project, alert }) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => onSelectProject(project, 5)}
                  className="w-full py-2 px-1.5 flex items-center justify-between gap-3 text-left hover:bg-teal-100/60 rounded-lg transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      เร่งรัดผู้รับจ้างเข้าทำงาน
                    </div>
                    <div className="text-[11px] text-slate-600 truncate mt-0.5">
                      {project.projectCode} · {project.name}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-xs font-extrabold tabular-nums whitespace-nowrap ${
                        alert.isOver15Days ? 'text-rose-600' : 'text-amber-700'
                      }`}
                    >
                      {alert.isOver15Days
                        ? `เกิน 15 วัน (${alert.daysElapsed} วัน)`
                        : `เหลือ ${alert.daysRemainingIn15} วัน`}
                    </span>
                  </div>
                </button>
              ))
            ) : visibleRepairs.length === 0 ? (
              <div className="py-5 text-center text-xs text-teal-900/65 flex flex-col items-center gap-1.5">
                <Wrench className="w-4.5 h-4.5 text-teal-600/60" />
                <span>ไม่มีใบคำร้องซ่อมแซมที่ค้างดำเนินการ</span>
              </div>
            ) : (
              visibleRepairs.map(req => {
                const statusMeta = REPAIR_STATUS_META[req.status] || REPAIR_STATUS_META.received;
                const urgencyPrefix =
                  req.urgency === 'emergency'
                    ? 'ฉุกเฉิน'
                    : req.urgency === 'urgent'
                    ? 'เร่งด่วน'
                    : null;
                return (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => onNavigateToRepairRequests?.()}
                    className="w-full py-2 px-1.5 flex items-center justify-between gap-3 text-left hover:bg-teal-100/60 rounded-lg transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {req.subject || req.roadName}
                      </div>
                      <div className="text-[11px] text-slate-600 truncate mt-0.5">
                        {req.requestCode}
                        {req.villageNo ? ` · หมู่ ${req.villageNo}` : ''}
                        {req.roadName && req.subject !== req.roadName ? ` · ${req.roadName}` : ''}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`text-xs font-extrabold whitespace-nowrap ${
                          req.urgency === 'emergency'
                            ? 'text-rose-600'
                            : req.urgency === 'urgent'
                            ? 'text-amber-700'
                            : statusMeta.textClass
                        }`}
                      >
                        {urgencyPrefix ? `${urgencyPrefix} · ` : ''}
                        {statusMeta.label}
                      </div>
                      <div className="text-[10px] text-slate-500 tabular-nums">
                        รับแจ้ง {formatThaiDate(req.petitionDate)}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {followUpMode === 'repairs' && openRepairPetitions.length > 4 && (
            <button
              type="button"
              onClick={() => setShowAllFollowUp(prev => !prev)}
              className="mt-2 pt-2 border-t border-teal-200/70 w-full flex items-center justify-center gap-1 text-xs font-semibold text-teal-800 hover:text-teal-950 transition-colors"
            >
              <span>
                {showAllFollowUp
                  ? 'ย่อรายการ'
                  : `ดูทั้งหมด (${openRepairPetitions.length} คำร้อง)`}
              </span>
              {showAllFollowUp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </section>

      {/* =====================================================================
          5. RECENT PROJECTS TABLE (Preserved at Bottom as Requested)
         ===================================================================== */}
      <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-800 font-heading">
              รายการโครงการล่าสุด
              {activeBucketFilter !== 'all' && (
                <span className="ml-2 text-xs font-semibold text-emerald-800">
                  ({summaryItems.find(i => i.key === activeBucketFilter)?.label})
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500">
              คลิกที่โครงการเพื่อเปิดดูรายละเอียดฉบับเต็มและเอกสารแนบ
            </p>
          </div>
          {currentUser?.role === 'admin' && (
            <button
              type="button"
              onClick={onOpenNewProjectModal}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              เพิ่มโครงการใหม่ <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">รหัส / ปี</th>
                <th className="py-3 px-4">ชื่อโครงการ</th>
                <th className="py-3 px-4">หมวดงบประมาณ</th>
                <th className="py-3 px-4 text-right">วงเงินสัญญา</th>
                <th className="py-3 px-4">ผู้รับจ้าง</th>
                <th className="py-3 px-4 text-center">สถานะ</th>
                <th className="py-3 px-4 text-center">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {latestProjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    ไม่พบโครงการตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                latestProjects.map(p => {
                  const isSelected = selectedRowId === p.id;
                  return (
                    <tr
                      key={p.id}
                      onClick={e => {
                        const clickedInteractive = Boolean(
                          (e.target as HTMLElement).closest('button, a')
                        );
                        setSelectedRowId(prev =>
                          clickedInteractive ? p.id : prev === p.id ? null : p.id
                        );
                      }}
                      className={`transition cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50/75 [&>td]:shadow-[inset_0_1px_0_0_rgba(5,150,105,0.45),inset_0_-1px_0_0_rgba(5,150,105,0.45)]'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-3 px-4 whitespace-nowrap tabular-nums">
                        <span className="font-semibold text-slate-900 font-mono">
                          {p.projectCode}
                        </span>
                        <span className="block text-[10px] text-slate-500">ปี {p.fiscalYear}</span>
                      </td>
                      <td className="py-3 px-4 max-w-xs sm:max-w-md">
                        <button
                          type="button"
                          onClick={() => onSelectProject(p)}
                          className="font-medium text-slate-800 hover:text-emerald-700 text-left line-clamp-1"
                        >
                          {p.name}
                        </button>
                        <span className="text-[11px] text-slate-400 block truncate">
                          {p.location}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-700 font-medium">
                        {p.budgetCategory}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap font-semibold text-slate-900 tabular-nums">
                        {p.contractAmount ? `${formatCurrency(p.contractAmount)} บ.` : '-'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                        {p.contractorName || '-'}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-0.5">
                          <span
                            className={`text-xs font-bold ${
                              p.status === 'completed'
                                ? 'text-blue-700'
                                : p.status === 'in_progress'
                                ? 'text-emerald-700'
                                : p.status === 'overdue'
                                ? 'text-rose-600'
                                : p.status === 'cancelled'
                                ? 'text-slate-400 line-through'
                                : p.status === 'inspected'
                                ? 'text-indigo-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {STATUS_LABELS[p.status] || p.status}
                          </span>
                          {currentUser?.role === 'admin' && getWorkNoticeAlert(p).hasAlert && (
                            <span className="text-[10px] font-semibold text-amber-700">
                              เร่งรัดผู้รับจ้างเข้าทำงาน
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onSelectProject(p)}
                          className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 px-2.5 py-1 rounded-lg hover:bg-emerald-50 transition"
                        >
                          ดูข้อมูล
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
