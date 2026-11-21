import React, { useState, useMemo } from 'react';
import {
  CalendarClock,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Circle,
  ShieldAlert,
  Search,
  ExternalLink,
  PenLine,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  List
} from 'lucide-react';
import { Project, UserProfile } from '../types/project';
import {
  calculateProjectProgress,
  formatCurrency,
  formatThaiDate,
  getDaysRemaining,
  getWorkNoticeAlert
} from '../utils/thaiDate';
import { STATUS_LABELS } from '../utils/excelExport';

interface ProjectTimelineViewProps {
  projects: Project[];
  availableYears: number[];
  selectedYear: string | number;
  onSelectYear: (year: string | number) => void;
  onSelectProject: (p: Project, initialTab?: number) => void;
  onEditProject: (p: Project) => void;
  currentUser?: UserProfile;
}

export type TimelineStepStatus = 'completed' | 'in_progress' | 'pending' | 'overdue';

export interface TimelineStep {
  id: string;
  stepNo: number;
  phase: 1 | 2 | 3 | 4;
  detailTab: number;
  name: string;
  shortName: string;
  description: string;
  status: TimelineStepStatus;
  date?: string;
  referenceNo?: string;
}

const PHASE_META: Array<{
  phase: 1 | 2 | 3 | 4;
  title: string;
  subtitle: string;
}> = [
  { phase: 1, title: 'ระยะที่ 1 · เตรียมโครงการและราคากลาง', subtitle: 'ขั้นตอนที่ 1–4' },
  { phase: 2, title: 'ระยะที่ 2 · สัญญาจ้างและเข้าทำงาน', subtitle: 'ขั้นตอนที่ 5–7' },
  { phase: 3, title: 'ระยะที่ 3 · ส่งมอบและตรวจรับงาน', subtitle: 'ขั้นตอนที่ 8–9' },
  { phase: 4, title: 'ระยะที่ 4 · เบิกจ่ายและปิดโครงการ', subtitle: 'ขั้นตอนที่ 10–12' }
];

export const ProjectTimelineView: React.FC<ProjectTimelineViewProps> = ({
  projects,
  availableYears,
  selectedYear,
  onSelectYear,
  onSelectProject,
  onEditProject,
  currentUser
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    projects.length > 0 ? projects[0].id : ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [stepFilter, setStepFilter] = useState<'all' | 'actionable'>('all');
  const [focusedStepNo, setFocusedStepNo] = useState<number | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'timeline' | 'list'>('timeline');

  const yearFilteredProjects = useMemo(() => {
    if (!selectedYear || selectedYear === 'all') return projects;
    return projects.filter(p => Number(p.fiscalYear) === Number(selectedYear));
  }, [projects, selectedYear]);

  const computeSteps = (p: Project): TimelineStep[] => {
    const remaining = getDaysRemaining(p.endDate);
    const isOverdue = remaining.isOverdue && p.status !== 'completed';

    const hasProjectApproval = Boolean(
      (p.approvalRequestNo && p.approvalRequestNo.trim()) ||
        (p.approvalRequestDate && p.approvalRequestDate.trim()) ||
        (p.attachments && p.attachments.some(a => a.category === 'approval_request'))
    );
    const step1: TimelineStep = {
      id: 'step-1',
      stepNo: 1,
      phase: 1,
      detailTab: 1,
      name: 'ขออนุมัติโครงการ',
      shortName: 'ขออนุมัติโครงการ',
      description: p.approvalRequestNo
        ? `หนังสือขออนุมัติเลขที่ ${p.approvalRequestNo}`
        : 'บันทึกเลขที่หนังสือและวันที่ขออนุมัติโครงการ',
      status: hasProjectApproval || p.status === 'completed' ? 'completed' : 'pending',
      date: p.approvalRequestDate,
      referenceNo: p.approvalRequestNo
    };

    const hasNamedTorCommittee = Boolean(
      p.torCommittees && p.torCommittees.some(c => Boolean(c?.name && c.name.trim()))
    );
    const hasTorOrder = Boolean(
      (p.torOrderNo && p.torOrderNo.trim()) ||
        (p.torOrderDate && p.torOrderDate.trim()) ||
        hasNamedTorCommittee
    );
    const step2: TimelineStep = {
      id: 'step-2',
      stepNo: 2,
      phase: 1,
      detailTab: 2,
      name: 'คำสั่ง กก. TOR และราคากลาง',
      shortName: 'คำสั่ง TOR',
      description: p.torOrderNo
        ? `คำสั่งเลขที่ ${p.torOrderNo}`
        : 'แต่งตั้งคณะกรรมการจัดทำ TOR และราคากลาง',
      status: hasTorOrder ? 'completed' : p.status === 'procurement_tor' ? 'in_progress' : 'pending',
      date: p.torOrderDate,
      referenceNo: p.torOrderNo
    };

    const hasTorDoc = Boolean(
      (p.torDate && p.torDate.trim()) || (p.torAuthor && p.torAuthor.trim())
    );
    const step3: TimelineStep = {
      id: 'step-3',
      stepNo: 3,
      phase: 1,
      detailTab: 2,
      name: 'จัดทำ TOR',
      shortName: 'จัดทำ TOR',
      description: p.torAuthor ? `จัดทำโดย ${p.torAuthor}` : 'ร่างขอบเขตงานก่อสร้าง (TOR)',
      status: hasTorDoc ? 'completed' : p.status === 'procurement_tor' ? 'in_progress' : 'pending',
      date: p.torDate
    };

    const step4: TimelineStep = {
      id: 'step-4',
      stepNo: 4,
      phase: 1,
      detailTab: 2,
      name: 'จัดทำราคากลาง',
      shortName: 'ราคากลาง',
      description: p.refPrice
        ? `ราคากลาง ${formatCurrency(p.refPrice)} บ.`
        : 'กำหนดราคาอ้างอิงของทางราชการ',
      status:
        (p.refPriceDate && p.refPriceDate.trim()) || (p.refPrice && p.refPrice > 0)
          ? 'completed'
          : p.status === 'procurement_tor'
          ? 'in_progress'
          : 'pending',
      date: p.refPriceDate
    };

    const hasNamedInspectCommittee = Boolean(
      p.inspectCommittees && p.inspectCommittees.some(c => Boolean(c?.name && c.name.trim()))
    );
    const hasNamedSupervisor = Boolean(
      (p.supervisorName && p.supervisorName.trim()) ||
        (p.supervisors && p.supervisors.some(s => Boolean(s?.name && s.name.trim())))
    );
    const hasOrder = Boolean(
      (p.inspectOrderNo && p.inspectOrderNo.trim()) ||
        (p.inspectOrderDate && p.inspectOrderDate.trim()) ||
        hasNamedInspectCommittee ||
        hasNamedSupervisor
    );
    const step5: TimelineStep = {
      id: 'step-5',
      stepNo: 5,
      phase: 2,
      detailTab: 3,
      name: 'แต่งตั้งควบคุมงาน/ตรวจรับ',
      shortName: 'คำสั่งตรวจรับ',
      description: p.inspectOrderNo
        ? `คำสั่งเลขที่ ${p.inspectOrderNo}${p.supervisorName ? ` · ผู้ควบคุม: ${p.supervisorName}` : ''}`
        : 'แต่งตั้งผู้ควบคุมงานและกรรมการตรวจรับ',
      status: hasOrder ? 'completed' : 'pending',
      date: p.inspectOrderDate,
      referenceNo: p.inspectOrderNo
    };

    const hasContract = Boolean(
      (p.contractNo && p.contractNo.trim()) ||
        (p.contractDate && p.contractDate.trim()) ||
        (p.contractAmount && Number(p.contractAmount) > 0)
    );
    const step6: TimelineStep = {
      id: 'step-6',
      stepNo: 6,
      phase: 2,
      detailTab: 4,
      name: 'จัดทำสัญญาจ้าง',
      shortName: 'สัญญาจ้าง',
      description: p.contractorName ? `คู่สัญญา: ${p.contractorName}` : 'ลงนามสัญญาจ้างโครงการ',
      status: hasContract ? 'completed' : 'pending',
      date: p.contractDate,
      referenceNo: p.contractNo
    };

    const hasWorkNotice = Boolean(p.workNotices && p.workNotices.length > 0);
    const workNoticeAlert = getWorkNoticeAlert(p);
    const hasActualWorkStart = Boolean(
      p.workNotices && p.workNotices.some(w => Boolean(w.actualWorkDate && w.actualWorkDate.trim()))
    );
    const step7: TimelineStep = {
      id: 'step-7',
      stepNo: 7,
      phase: 2,
      detailTab: 5,
      name: 'แจ้งเข้าทำงาน',
      shortName: 'เข้าทำงาน',
      description: hasActualWorkStart
        ? `เข้าทำงานจริง ${formatThaiDate(p.workNotices[0].actualWorkDate)}`
        : workNoticeAlert.hasAlert
        ? workNoticeAlert.badgeLabel
        : 'หนังสือแจ้งเริ่มงานจากผู้รับจ้าง',
      status: hasActualWorkStart
        ? 'completed'
        : workNoticeAlert.hasAlert
        ? workNoticeAlert.isOver15Days
          ? 'overdue'
          : 'in_progress'
        : hasContract
        ? 'in_progress'
        : 'pending',
      date: hasWorkNotice ? p.workNotices[0].bookDate : undefined,
      referenceNo: hasWorkNotice ? p.workNotices[0].bookNo : undefined
    };

    const hasDelivery = Boolean(p.deliveries && p.deliveries.length > 0);
    const step8: TimelineStep = {
      id: 'step-8',
      stepNo: 8,
      phase: 3,
      detailTab: 5,
      name: 'ส่งมอบงาน',
      shortName: 'ส่งมอบงาน',
      description: hasDelivery
        ? `ส่งมอบแล้ว ${p.deliveries.length} งวด`
        : 'ผู้รับจ้างส่งมอบงานตามสัญญา',
      status: hasDelivery ? 'completed' : isOverdue ? 'overdue' : hasWorkNotice ? 'in_progress' : 'pending',
      date: hasDelivery
        ? p.deliveries[p.deliveries.length - 1].actualDeliveryDate ||
          p.deliveries[p.deliveries.length - 1].bookDate
        : undefined,
      referenceNo: hasDelivery ? p.deliveries[p.deliveries.length - 1].bookNo : undefined
    };

    const hasInspectionPass = Boolean(p.inspections && p.inspections.some(i => i.result === 'pass'));
    const step9: TimelineStep = {
      id: 'step-9',
      stepNo: 9,
      phase: 3,
      detailTab: 5,
      name: 'ตรวจรับงาน',
      shortName: 'ตรวจรับงาน',
      description: hasInspectionPass
        ? 'ตรวจรับงานถูกต้องครบถ้วน'
        : 'กรรมการตรวจรับงานจ้างก่อสร้าง',
      status: hasInspectionPass ? 'completed' : hasDelivery ? 'in_progress' : isOverdue ? 'overdue' : 'pending',
      date: hasInspectionPass ? p.inspections[p.inspections.length - 1].inspectionDate : undefined
    };

    const hasDisbursement = Boolean(p.disbursements && p.disbursements.length > 0);
    const step10: TimelineStep = {
      id: 'step-10',
      stepNo: 10,
      phase: 4,
      detailTab: 6,
      name: 'จัดทำฎีกาเบิกเงิน',
      shortName: 'ฎีกาเบิกเงิน',
      description: hasDisbursement
        ? `ฎีกาเลขที่ ${p.disbursements[0].petitionNo}`
        : 'จัดทำฎีกาเบิกจ่ายเงินค่าจ้าง',
      status: hasDisbursement ? 'completed' : hasInspectionPass ? 'in_progress' : 'pending',
      date: hasDisbursement ? p.disbursements[0].disbursementDate : undefined,
      referenceNo: hasDisbursement ? p.disbursements[0].petitionNo : undefined
    };

    const hasRemunerations = Boolean(p.remunerations && p.remunerations.length > 0);
    const hasRemunerationPaid = Boolean(p.remunerations && p.remunerations.some(r => r.status === 'paid'));
    const allRemunerationsNotEligible =
      hasRemunerations && p.remunerations.every(r => r.status === 'not_eligible');
    const step11: TimelineStep = {
      id: 'step-11',
      stepNo: 11,
      phase: 4,
      detailTab: 6,
      name: 'เบิกจ่ายค่าตอบแทน',
      shortName: 'ค่าตอบแทน',
      description: allRemunerationsNotEligible
        ? 'ไม่เข้าเกณฑ์เบิกค่าตอบแทน'
        : hasRemunerationPaid
        ? 'เบิกจ่ายค่าตอบแทนกรรมการเรียบร้อย'
        : 'ค่าตอบแทน TOR/ราคากลาง/ผู้ควบคุม/ตรวจรับ',
      status:
        hasRemunerationPaid || allRemunerationsNotEligible
          ? 'completed'
          : hasRemunerations
          ? 'in_progress'
          : 'pending'
    };

    const isCompleted = p.status === 'completed';
    const step12: TimelineStep = {
      id: 'step-12',
      stepNo: 12,
      phase: 4,
      detailTab: 1,
      name: 'ปิดโครงการตามระเบียบพัสดุ',
      shortName: 'ปิดโครงการ',
      description: isCompleted
        ? 'ส่งมอบและเบิกจ่ายเสร็จสิ้นสมบูรณ์'
        : 'ปิดโครงการเมื่อเบิกจ่ายครบถ้วน',
      status: isCompleted ? 'completed' : 'pending',
      date: isCompleted ? p.updatedAt?.split('T')[0] : undefined
    };

    return [step1, step2, step3, step4, step5, step6, step7, step8, step9, step10, step11, step12];
  };

  const filteredList = yearFilteredProjects.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.projectCode.toLowerCase().includes(q) ||
      (p.contractorName && p.contractorName.toLowerCase().includes(q))
    );
  });

  const currentProject =
    filteredList.find(p => p.id === selectedProjectId) ||
    yearFilteredProjects.find(p => p.id === selectedProjectId) ||
    filteredList[0] ||
    yearFilteredProjects[0];

  const steps = currentProject ? computeSteps(currentProject) : [];
  const completedCount = steps.filter(s => s.status === 'completed').length;
  const activeStep =
    steps.find(s => s.status === 'overdue') ||
    steps.find(s => s.status === 'in_progress') ||
    steps.find(s => s.status === 'pending') ||
    steps[steps.length - 1];
  const remainingDays = currentProject
    ? getDaysRemaining(currentProject.endDate)
    : { days: 0, isOverdue: false, label: '' };

  const currentIndex = currentProject
    ? filteredList.findIndex(p => p.id === currentProject.id)
    : -1;

  const handleStepProject = (direction: -1 | 1) => {
    if (filteredList.length <= 1 || currentIndex < 0) return;
    const nextIdx = (currentIndex + direction + filteredList.length) % filteredList.length;
    setSelectedProjectId(filteredList[nextIdx].id);
    setFocusedStepNo(null);
  };

  const getStepIcon = (status: TimelineStepStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-blue-600 shrink-0" />;
      case 'overdue':
        return <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />;
      default:
        return <Circle className="w-4 h-4 text-slate-300 shrink-0" />;
    }
  };

  const getStatusLabel = (status: TimelineStepStatus) => {
    switch (status) {
      case 'completed':
        return { text: 'ดำเนินการแล้ว', cls: 'text-emerald-700' };
      case 'in_progress':
        return { text: 'กำลังดำเนินการ', cls: 'text-blue-700' };
      case 'overdue':
        return { text: 'เกินกำหนด', cls: 'text-rose-700' };
      default:
        return { text: 'รอดำเนินการ', cls: 'text-slate-400' };
    }
  };

  return (
    <div className="space-y-4">
      {/* Compact Top Bar */}
      <div className="bg-white rounded-2xl px-5 py-4 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold font-heading text-slate-900 flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>ระบบติดตามสถานะโครงการ (12 ขั้นตอน)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            แสดงภาพรวมทั้ง 12 ขั้นตอนในหน้าเดียว แยกตาม 4 ระยะการดำเนินงาน · คลิกแต่ละขั้นตอนเพื่อดูรายละเอียดได้ทันที
          </p>
        </div>

        {yearFilteredProjects.some(p => p.status === 'overdue') && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold shrink-0">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>มีโครงการเกินกำหนดสัญญา</span>
          </div>
        )}
      </div>

      {/* Mobile Quick Switcher (hidden on lg+ desktop) */}
      <div className="lg:hidden bg-white rounded-2xl p-3 border border-slate-200 space-y-2.5">
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setMobilePanel('timeline')}
            className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              mobilePanel === 'timeline'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarClock className="w-4 h-4 shrink-0" />
            <span>ไทม์ไลน์ 12 ขั้นตอน</span>
          </button>
          <button
            type="button"
            onClick={() => setMobilePanel('list')}
            className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              mobilePanel === 'list'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="w-4 h-4 shrink-0" />
            <span>เลือกโครงการ ({filteredList.length})</span>
          </button>
        </div>

        {mobilePanel === 'timeline' && (
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-2 bg-emerald-50/70 border border-emerald-200/80 rounded-xl px-3 py-1.5 flex-1 min-w-0">
              <Calendar className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <select
                aria-label="กรองปีงบประมาณ (มือถือ)"
                value={selectedYear}
                onChange={e => onSelectYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="flex-1 min-w-0 w-full bg-transparent text-xs font-bold text-emerald-950 focus:outline-hidden cursor-pointer text-left truncate"
              >
                <option value="all">ทุกปีงบประมาณ</option>
                {availableYears.map(yr => (
                  <option key={yr} value={yr}>
                    ปี พ.ศ. {yr}
                  </option>
                ))}
              </select>
            </div>

            {filteredList.length > 1 && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleStepProject(-1)}
                  aria-label="โครงการก่อนหน้า"
                  className="min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-semibold text-slate-600 tabular-nums px-1">
                  {currentIndex >= 0 ? `${currentIndex + 1}/${filteredList.length}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => handleStepProject(1)}
                  aria-label="โครงการถัดไป"
                  className="min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Project Selector List (4 cols; toggled on mobile) */}
        <div className={`${mobilePanel === 'list' ? 'block' : 'hidden'} lg:block lg:col-span-4 min-w-0`}>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
            {/* Fiscal Year Filter (synced with Header) */}
            <div className="flex items-center gap-2 bg-emerald-50/70 border border-emerald-200/80 rounded-xl px-3 py-1.5 w-full min-w-0 overflow-hidden">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900 whitespace-nowrap shrink-0">
                <Calendar className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <label htmlFor="timeline-year-filter">ปีงบประมาณ:</label>
              </div>
              <select
                id="timeline-year-filter"
                value={selectedYear}
                onChange={e => onSelectYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="flex-1 min-w-0 w-full bg-transparent text-xs font-bold text-emerald-950 focus:outline-hidden cursor-pointer text-left truncate"
              >
                <option value="all" className="text-left">ทุกปีงบประมาณ</option>
                {availableYears.map(yr => (
                  <option key={yr} value={yr} className="text-left">
                    ปี พ.ศ. {yr}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="เลือกหรือค้นหาโครงการ..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="max-h-[580px] overflow-y-auto space-y-2 pr-1">
              {filteredList.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  ไม่พบโครงการตามปีงบประมาณหรือคำค้นหาที่เลือก
                </div>
              ) : (
                filteredList.map(p => {
                  const isSelected = p.id === currentProject?.id;
                  const rem = getDaysRemaining(p.endDate);
                  const projSteps = computeSteps(p);
                  const done = projSteps.filter(s => s.status === 'completed').length;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedProjectId(p.id);
                        setFocusedStepNo(null);
                        setMobilePanel('timeline');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition-colors ${
                        isSelected
                          ? 'bg-emerald-50/80 border-emerald-500'
                          : 'bg-white border-slate-200/80 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] mb-1.5">
                        <span className="font-mono font-semibold text-slate-600 tabular-nums whitespace-nowrap">
                          {p.projectCode} · พ.ศ. {p.fiscalYear}
                        </span>
                        <span
                          className={`font-semibold whitespace-nowrap ${
                            p.status === 'completed'
                              ? 'text-teal-700'
                              : p.status === 'overdue'
                              ? 'text-rose-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {STATUS_LABELS[p.status] || p.status}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-slate-800 leading-snug break-words">
                        {p.name}
                      </div>

                      {/* Mini 12-step progress bar on list item */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-[11px] text-slate-500">
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="flex items-center gap-0.5 shrink-0" aria-hidden="true">
                            {projSteps.map(s => (
                              <span
                                key={s.id}
                                className={`w-2 h-1.5 rounded-[2px] ${
                                  s.status === 'completed'
                                    ? 'bg-emerald-500'
                                    : s.status === 'overdue'
                                    ? 'bg-rose-500'
                                    : s.status === 'in_progress'
                                    ? 'bg-blue-500'
                                    : 'bg-slate-200'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="tabular-nums font-medium text-slate-600 shrink-0 whitespace-nowrap">
                            {done}/12
                          </span>
                        </div>
                        {p.endDate && p.status !== 'completed' && (
                          <span
                            className={`font-semibold tabular-nums whitespace-nowrap shrink-0 ${
                              rem.isOverdue ? 'text-rose-600' : 'text-slate-600'
                            }`}
                          >
                            {rem.label}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right: Scannable Single-Screen 12-Stage Pipeline (8 cols; default visible on mobile) */}
        <div className={`${mobilePanel === 'timeline' ? 'block' : 'hidden'} lg:block lg:col-span-8 min-w-0 space-y-4`}>
          {!currentProject ? (
            <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center text-slate-400 text-xs">
              ไม่มีข้อมูลโครงการสำหรับปีงบประมาณหรือเงื่อนไขที่เลือก
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {/* 1. Compact Project Header + Metrics */}
              <div className="p-5 border-b border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
                      <span className="font-mono font-semibold text-slate-700 tabular-nums">
                        {currentProject.projectCode}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>ปีงบประมาณ พ.ศ. {currentProject.fiscalYear}</span>
                      <span aria-hidden="true">·</span>
                      <span>{currentProject.budgetCategory}</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 font-heading leading-snug text-balance">
                      {currentProject.name}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {currentUser?.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => onEditProject(currentProject)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold whitespace-nowrap transition"
                      >
                        <PenLine className="w-3.5 h-3.5 text-emerald-700" />
                        <span>แก้ไข / บันทึกเพิ่ม</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectProject(currentProject, 1)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold whitespace-nowrap transition"
                    >
                      <span>ดูรายละเอียด</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Overdue Alert Bar (Admin only) */}
                {currentUser?.role === 'admin' &&
                  remainingDays.isOverdue &&
                  currentProject.status !== 'completed' && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-2.5 text-xs">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">เลยกำหนดสัญญาแล้ว {remainingDays.days} วัน</span>
                        <span className="text-rose-700 ml-1.5">
                          (สิ้นสุดสัญญา {formatThaiDate(currentProject.endDate)}) โปรดเร่งรัดการส่งมอบงาน
                        </span>
                      </div>
                    </div>
                  )}

                {/* 4-Column Key Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 border border-slate-200 rounded-xl bg-slate-50/70 text-xs tabular-nums">
                  <div className="p-3">
                    <div className="text-slate-500 text-[11px]">งบอนุมัติ</div>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {formatCurrency(currentProject.approvedBudget)} บ.
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="text-slate-500 text-[11px]">วงเงินสัญญา</div>
                    <div className="font-bold text-emerald-800 mt-0.5">
                      {currentProject.contractAmount ? `${formatCurrency(currentProject.contractAmount)} บ.` : '-'}
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="text-slate-500 text-[11px]">ระยะเวลาสัญญา</div>
                    <div className="font-semibold text-slate-800 mt-0.5">
                      {currentProject.startDate || currentProject.endDate
                        ? `${formatThaiDate(currentProject.startDate)} - ${formatThaiDate(currentProject.endDate)}`
                        : '-'}
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="text-slate-500 text-[11px]">ความคืบหน้า</div>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {completedCount} / 12 ขั้นตอน ({calculateProjectProgress(currentProject)}%)
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Horizontal 12-Step Visual Map (At-a-Glance Stepper) */}
              <div className="px-5 py-4 bg-slate-50/50 border-b border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-800 flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                    <span>แผนผังลำดับ 1–12 ขั้นตอน</span>
                    {activeStep && completedCount < 12 && (
                      <span className="font-normal text-slate-500 inline-flex items-center gap-1">
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span>
                          ขั้นตอนถัดไป:{' '}
                          <strong
                            className={
                              activeStep.status === 'overdue' ? 'text-rose-700' : 'text-blue-700'
                            }
                          >
                            {activeStep.stepNo}. {activeStep.shortName}
                          </strong>
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Segmented View Switch */}
                  <div className="inline-flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-lg self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setStepFilter('all');
                        setFocusedStepNo(null);
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition ${
                        stepFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ทั้งหมด (12)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStepFilter('actionable');
                        setFocusedStepNo(null);
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition ${
                        stepFilter === 'actionable'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      รอดำเนินการ ({12 - completedCount})
                    </button>
                  </div>
                </div>

                {/* 12 Connected Nodes: 4x3 on mobile (no horizontal scroll), 6x2 on tablet, 12x1 on desktop */}
                <div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-y-3 gap-x-1 items-start">
                    {steps.map((step, idx) => {
                      const isFocused = focusedStepNo === step.stepNo;
                      const nodeStyle =
                        step.status === 'completed'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : step.status === 'overdue'
                          ? 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-200'
                          : step.status === 'in_progress'
                          ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-200'
                          : 'bg-white text-slate-500 border-slate-300';

                      const connectorVisibility =
                        idx === steps.length - 1
                          ? 'hidden'
                          : idx === 3 || idx === 7
                          ? 'hidden sm:block'
                          : idx === 5
                          ? 'block sm:hidden lg:block'
                          : 'block';

                      return (
                        <button
                          key={step.id}
                          type="button"
                          onClick={() => {
                            setStepFilter('all');
                            setFocusedStepNo(prev => (prev === step.stepNo ? null : step.stepNo));
                          }}
                          title={`${step.stepNo}. ${step.name} — ${getStatusLabel(step.status).text}`}
                          className="group relative flex flex-col items-center text-center min-h-[44px] focus:outline-hidden"
                        >
                          {/* Connector line behind circles */}
                          {idx < steps.length - 1 && (
                            <span
                              aria-hidden="true"
                              className={`${connectorVisibility} absolute top-3.5 left-1/2 w-full h-0.5 ${
                                step.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-200'
                              }`}
                            />
                          )}
                          <span
                            className={`relative z-10 w-7 h-7 rounded-full border text-[11px] font-bold tabular-nums flex items-center justify-center transition-transform group-hover:scale-105 ${nodeStyle} ${
                              isFocused ? 'ring-2 ring-offset-1 ring-slate-800' : ''
                            }`}
                          >
                            {step.stepNo}
                          </span>
                          <span
                            className={`mt-1 text-[10px] leading-tight line-clamp-2 px-0.5 ${
                              isFocused
                                ? 'font-bold text-slate-900'
                                : step.status === 'completed'
                                ? 'font-semibold text-emerald-800'
                                : step.status === 'overdue'
                                ? 'font-semibold text-rose-700'
                                : step.status === 'in_progress'
                                ? 'font-semibold text-blue-700'
                                : 'text-slate-500'
                            }`}
                          >
                            {step.shortName}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 3. Compact 2x2 Phase Matrix — All 12 Steps Visible At Once */}
              <div className="p-5">
                {stepFilter === 'actionable' && completedCount === 12 ? (
                  <div className="p-8 text-center text-xs text-emerald-700 bg-emerald-50/60 border border-emerald-200 rounded-xl font-semibold">
                    โครงการนี้ดำเนินการครบทั้ง 12 ขั้นตอนเรียบร้อยแล้ว
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {PHASE_META.map(group => {
                      const groupSteps = steps.filter(
                        s =>
                          s.phase === group.phase &&
                          (stepFilter === 'all' || s.status !== 'completed')
                      );
                      if (groupSteps.length === 0) return null;

                      const phaseAllSteps = steps.filter(s => s.phase === group.phase);
                      const phaseDone = phaseAllSteps.filter(s => s.status === 'completed').length;

                      return (
                        <div
                          key={group.phase}
                          className="border border-slate-200 rounded-xl overflow-hidden bg-white"
                        >
                          {/* Phase Header */}
                          <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {group.title}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500 tabular-nums whitespace-nowrap shrink-0">
                              {phaseDone}/{phaseAllSteps.length} ขั้นตอน
                            </span>
                          </div>

                          {/* Compact Step Rows */}
                          <div className="divide-y divide-slate-100">
                            {groupSteps.map(step => {
                              const statusMeta = getStatusLabel(step.status);
                              const isFocused = focusedStepNo === step.stepNo;
                              return (
                                <button
                                  key={step.id}
                                  type="button"
                                  onClick={() => onSelectProject(currentProject, step.detailTab)}
                                  className={`w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 transition-colors hover:bg-slate-50 ${
                                    isFocused
                                      ? 'bg-emerald-50/70'
                                      : step.status === 'overdue'
                                      ? 'bg-rose-50/40'
                                      : step.status === 'in_progress'
                                      ? 'bg-blue-50/35'
                                      : ''
                                  }`}
                                  title="คลิกเพื่อเปิดดูรายละเอียดในหมวดนี้"
                                >
                                  <div className="mt-0.5">{getStepIcon(step.status)}</div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                                      <span className="text-xs font-bold text-slate-800 leading-snug">
                                        {step.stepNo}. {step.name}
                                      </span>
                                      <span className={`text-[11px] font-semibold whitespace-nowrap shrink-0 ${statusMeta.cls}`}>
                                        {statusMeta.text}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                      <span className="truncate max-w-full">{step.description}</span>
                                      {step.date && (
                                        <>
                                          <span aria-hidden="true">·</span>
                                          <span className="tabular-nums whitespace-nowrap text-slate-600">
                                            {formatThaiDate(step.date)}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
