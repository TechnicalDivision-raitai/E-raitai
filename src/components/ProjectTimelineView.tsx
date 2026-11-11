import React, { useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Circle,
  FileCheck,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  HardHat,
  Search,
  Filter
} from 'lucide-react';
import { Project, ProjectStatus, UserProfile } from '../types/project';
import { formatCurrency, formatThaiDate, getDaysRemaining } from '../utils/thaiDate';
import { STATUS_LABELS } from '../utils/excelExport';

interface ProjectTimelineViewProps {
  projects: Project[];
  onSelectProject: (p: Project) => void;
  onEditProject: (p: Project) => void;
  currentUser?: UserProfile;
}

export type TimelineStepStatus = 'completed' | 'in_progress' | 'pending' | 'overdue';

export interface TimelineStep {
  id: string;
  name: string;
  description: string;
  status: TimelineStepStatus;
  date?: string;
  referenceNo?: string;
}

export const ProjectTimelineView: React.FC<ProjectTimelineViewProps> = ({
  projects,
  onSelectProject,
  onEditProject,
  currentUser
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    projects.length > 0 ? projects[0].id : ''
  );
  const [searchQuery, setSearchQuery] = useState('');

  const currentProject = projects.find(p => p.id === selectedProjectId) || projects[0];

  // Helper to compute 12-stage pipeline for a project (Requirement 1)
  const computeSteps = (p: Project): TimelineStep[] => {
    const remaining = getDaysRemaining(p.endDate);
    const isOverdue = remaining.isOverdue && p.status !== 'completed';

    // 1. บันทึกข้อมูลโครงการ
    const step1: TimelineStep = {
      id: 'step-1',
      name: 'บันทึกข้อมูลโครงการ',
      description: 'บันทึกงบประมาณและรายละเอียดในแผนพัฒนา',
      status: 'completed',
      date: p.createdAt?.split('T')[0],
      referenceNo: p.projectCode
    };

    // 2. ออกคำสั่งแต่งตั้งกรรมการจัดทำ TOR และราคากลาง
    const hasTorOrder = Boolean(p.torOrderNo || p.torOrderDate || (p.torCommittees && p.torCommittees.length > 0));
    const step2: TimelineStep = {
      id: 'step-2',
      name: 'ออกคำสั่งแต่งตั้งกรรมการจัดทำ TOR และราคากลาง',
      description: p.torOrderNo
        ? `คำสั่งเลขที่ ${p.torOrderNo} แต่งตั้ง กก. จัดทำ TOR และราคากลาง`
        : 'คำสั่งแต่งตั้งคณะกรรมการจัดทำแบบรูปรายการ TOR และราคากลาง',
      status: hasTorOrder ? 'completed' : p.status === 'procurement_tor' ? 'in_progress' : 'pending',
      date: p.torOrderDate,
      referenceNo: p.torOrderNo
    };

    // 3. จัดทำ TOR
    const step3: TimelineStep = {
      id: 'step-3',
      name: 'จัดทำ TOR',
      description: p.torAuthor ? `จัดทำโดย ${p.torAuthor}` : 'ร่างขอบเขตงานก่อสร้าง (TOR)',
      status: p.torDate ? 'completed' : p.status === 'procurement_tor' ? 'in_progress' : 'pending',
      date: p.torDate
    };

    // 4. จัดทำราคากลาง
    const step4: TimelineStep = {
      id: 'step-4',
      name: 'จัดทำราคากลาง',
      description: p.refPrice
        ? `ราคากลาง ${formatCurrency(p.refPrice)} บ.`
        : 'กำหนดราคาอ้างอิงของทางราชการ',
      status: p.refPriceDate || (p.refPrice && p.refPrice > 0) ? 'completed' : p.status === 'procurement_tor' ? 'in_progress' : 'pending',
      date: p.refPriceDate
    };

    // 5. ออกคำสั่งแต่งตั้งกรรมการ
    const hasOrder = Boolean(p.inspectOrderNo || (p.inspectCommittees && p.inspectCommittees.length > 0) || p.supervisorName);
    const step5: TimelineStep = {
      id: 'step-5',
      name: 'ออกคำสั่งแต่งตั้งกรรมการ',
      description: p.inspectOrderNo
        ? `คำสั่งเลขที่ ${p.inspectOrderNo} (${p.supervisorName ? `ผู้ควบคุมงาน: ${p.supervisorName}` : 'แต่งตั้งผู้ควบคุมงาน/ตรวจรับ'})`
        : 'แต่งตั้งผู้ควบคุมงานและคณะกรรมการตรวจรับพัสดุ',
      status: hasOrder ? 'completed' : 'pending',
      date: p.inspectOrderDate,
      referenceNo: p.inspectOrderNo
    };

    // 6. จัดทำสัญญาจ้าง
    const hasContract = Boolean(p.contractNo && p.contractAmount);
    const step6: TimelineStep = {
      id: 'step-6',
      name: 'จัดทำสัญญาจ้าง',
      description: p.contractorName ? `คู่สัญญา: ${p.contractorName}` : 'ลงนามสัญญาจ้างโครงการ',
      status: hasContract ? 'completed' : 'pending',
      date: p.contractDate,
      referenceNo: p.contractNo
    };

    // 7. แจ้งเข้าทำงาน
    const hasWorkNotice = (p.workNotices && p.workNotices.length > 0);
    const step7: TimelineStep = {
      id: 'step-7',
      name: 'แจ้งเข้าทำงาน',
      description: hasWorkNotice
        ? `เข้าทำงานจริง ${formatThaiDate(p.workNotices[0].actualWorkDate)}`
        : 'หนังสือแจ้งเริ่มงานก่อสร้างจากผู้รับจ้าง',
      status: hasWorkNotice ? 'completed' : hasContract ? 'in_progress' : 'pending',
      date: hasWorkNotice ? p.workNotices[0].bookDate : undefined,
      referenceNo: hasWorkNotice ? p.workNotices[0].bookNo : undefined
    };

    // 8. ส่งมอบงาน
    const hasDelivery = (p.deliveries && p.deliveries.length > 0);
    const step8: TimelineStep = {
      id: 'step-8',
      name: 'ส่งมอบงาน',
      description: hasDelivery
        ? `ส่งมอบแล้ว ${p.deliveries.length} งวด`
        : 'ผู้รับจ้างส่งมอบงานตามสัญญา',
      status: hasDelivery ? 'completed' : isOverdue ? 'overdue' : hasWorkNotice ? 'in_progress' : 'pending',
      date: hasDelivery ? p.deliveries[p.deliveries.length - 1].actualDeliveryDate : undefined,
      referenceNo: hasDelivery ? p.deliveries[p.deliveries.length - 1].bookNo : undefined
    };

    // 9. ตรวจรับงาน
    const hasInspectionPass = p.inspections && p.inspections.some(i => i.result === 'pass');
    const step9: TimelineStep = {
      id: 'step-9',
      name: 'ตรวจรับงาน',
      description: hasInspectionPass
        ? 'คณะกรรมการตรวจรับงานถูกต้องครบถ้วน'
        : 'กรรมการตรวจรับพัสดุในงานจ้างก่อสร้าง',
      status: hasInspectionPass ? 'completed' : hasDelivery ? 'in_progress' : isOverdue ? 'overdue' : 'pending',
      date: hasInspectionPass ? p.inspections[p.inspections.length - 1].inspectionDate : undefined
    };

    // 10. จัดทำฎีกาเบิกเงิน
    const hasDisbursement = (p.disbursements && p.disbursements.length > 0);
    const step10: TimelineStep = {
      id: 'step-10',
      name: 'จัดทำฎีกาเบิกเงิน',
      description: hasDisbursement
        ? `ฎีกาเลขที่ ${p.disbursements[0].petitionNo}`
        : 'จัดทำฎีกาเบิกจ่ายเงินค่าจ้าง',
      status: hasDisbursement ? 'completed' : hasInspectionPass ? 'in_progress' : 'pending',
      date: hasDisbursement ? p.disbursements[0].disbursementDate : undefined,
      referenceNo: hasDisbursement ? p.disbursements[0].petitionNo : undefined
    };

    // 11. เบิกจ่ายค่าตอบแทน
    const hasRemunerationPaid = p.remunerations && p.remunerations.some(r => r.status === 'paid');
    const hasRemunerationPending = p.remunerations && p.remunerations.length > 0;
    const step11: TimelineStep = {
      id: 'step-11',
      name: 'เบิกจ่ายค่าตอบแทน',
      description: hasRemunerationPaid
        ? 'เบิกจ่ายค่าตอบแทนกรรมการเรียบร้อย'
        : 'ค่าตอบแทนจัดทำ TOR/ราคากลาง/ผู้ควบคุม/ตรวจรับ',
      status: hasRemunerationPaid ? 'completed' : hasRemunerationPending ? 'in_progress' : 'pending'
    };

    // 12. ดำเนินการแล้วเสร็จ — ปิดโครงการตามระเบียบพัสดุ
    const isCompleted = p.status === 'completed';
    const step12: TimelineStep = {
      id: 'step-12',
      name: 'ดำเนินการแล้วเสร็จ — ปิดโครงการตามระเบียบพัสดุ',
      description: isCompleted
        ? 'ส่งมอบและเบิกจ่ายเสร็จสิ้นสมบูรณ์ ปิดโครงการ'
        : 'ปิดโครงการตามระเบียบพัสดุเมื่อการดำเนินงานและเบิกจ่ายครบถ้วน',
      status: isCompleted ? 'completed' : 'pending',
      date: isCompleted ? p.updatedAt?.split('T')[0] : undefined
    };

    return [step1, step2, step3, step4, step5, step6, step7, step8, step9, step10, step11, step12];
  };

  const filteredList = projects.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.projectCode.toLowerCase().includes(q) ||
      (p.contractorName && p.contractorName.toLowerCase().includes(q))
    );
  });

  const steps = currentProject ? computeSteps(currentProject) : [];
  const remainingDays = currentProject ? getDaysRemaining(currentProject.endDate) : { days: 0, isOverdue: false, label: '' };

  const getStepIcon = (status: TimelineStepStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-600 animate-spin-slow shrink-0" />;
      case 'overdue':
        return <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />;
      default:
        return <Circle className="w-5 h-5 text-slate-300 shrink-0" />;
    }
  };

  const getStepBadge = (status: TimelineStepStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
            ดำเนินการแล้ว
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 animate-pulse">
            อยู่ระหว่างดำเนินการ
          </span>
        );
      case 'overdue':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
            เกินกำหนด
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
            ยังไม่ดำเนินการ
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-heading text-slate-900 flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-emerald-700" />
            <span>ระบบติดตามสถานะโครงการ (Project Pipeline Timeline 12 ขั้นตอน)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            ติดตาม 12 ลำดับขั้นตอนตั้งแต่จัดทำ TOR ถึงเบิกจ่ายค่าตอบแทนและปิดโครงการตามระเบียบพัสดุ
          </p>
        </div>

        {/* Overdue Warning Callout */}
        {projects.some(p => p.status === 'overdue') && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>มีโครงการที่เกินกำหนดสัญญาและยังไม่ตรวจรับ!</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Project Selector List (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
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

            <div className="max-h-[600px] overflow-y-auto space-y-2 pr-1">
              {filteredList.map(p => {
                const isSelected = p.id === currentProject?.id;
                const rem = getDaysRemaining(p.endDate);
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProjectId(p.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-emerald-50/80 border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                        : 'bg-white border-slate-200/70 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-700">
                        {p.projectCode}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          p.status === 'completed'
                            ? 'bg-teal-100 text-teal-800'
                            : p.status === 'overdue'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">
                      {p.name}
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                      <span>ปี พ.ศ. {p.fiscalYear}</span>
                      {p.endDate && p.status !== 'completed' && (
                        <span
                          className={`font-semibold ${
                            rem.isOverdue ? 'text-rose-600' : 'text-slate-600'
                          }`}
                        >
                          {rem.label}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Detailed 11-Stage Pipeline for Selected Project (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {currentProject && (
            <>
              {/* Project Card Header */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-sm bg-slate-100 text-slate-700">
                        {currentProject.projectCode}
                      </span>
                      <span className="text-xs text-slate-500">
                        ปีงบประมาณ พ.ศ. {currentProject.fiscalYear} • {currentProject.budgetCategory}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 font-heading">
                      {currentProject.name}
                    </h3>
                  </div>

                  <button
                    onClick={() => onSelectProject(currentProject)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shrink-0 transition"
                  >
                    ดูเอกสารฉบับเต็ม
                  </button>
                </div>

                {/* Overdue Alert Bar */}
                {remainingDays.isOverdue && currentProject.status !== 'completed' && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 flex items-start gap-2.5 text-xs">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">แจ้งเตือน: โครงการนี้เลยกำหนดสัญญาแล้ว!</div>
                      <div className="text-[11px] text-rose-700 mt-0.5">
                        สิ้นสุดสัญญาเมื่อ {formatThaiDate(currentProject.endDate)} (เลยกำหนดแล้ว {remainingDays.days} วัน)
                        โปรดเร่งรัดให้ผู้รับจ้างส่งมอบงาน หรือคิดค่าปรับตามระเบียบกระทรวงการคลัง
                      </div>
                    </div>
                  </div>
                )}

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-slate-400 text-[10px]">งบประมาณที่อนุมัติ</div>
                    <div className="font-bold text-slate-800 mt-0.5">
                      {formatCurrency(currentProject.approvedBudget)} บ.
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-slate-400 text-[10px]">วงเงินตามสัญญา</div>
                    <div className="font-bold text-emerald-800 mt-0.5">
                      {currentProject.contractAmount ? `${formatCurrency(currentProject.contractAmount)} บ.` : '-'}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-slate-400 text-[10px]">ระยะเวลาตามสัญญา</div>
                    <div className="font-semibold text-slate-800 mt-0.5">
                      {formatThaiDate(currentProject.startDate)} - {formatThaiDate(currentProject.endDate)}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-slate-400 text-[10px]">ความคืบหน้าภาพรวม</div>
                    <div className="font-bold text-slate-800 mt-0.5">
                      {currentProject.progressPercent}%
                    </div>
                  </div>
                </div>
              </div>

              {/* 12 Steps Timeline */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 font-heading">
                      ลำดับขั้นตอนความคืบหน้า (12 ขั้นตอนราชการ)
                    </h4>
                    <p className="text-xs text-slate-500">
                      ระบบประมวลผลอัตโนมัติจากข้อมูลที่บันทึกไว้ในแต่ละหมวด (ขั้นละ ~8.33%)
                    </p>
                  </div>
                  {currentUser?.role === 'admin' && (
                    <button
                      onClick={() => onEditProject(currentProject)}
                      className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold"
                    >
                      + บันทึกข้อมูลเพิ่ม
                    </button>
                  )}
                </div>

                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                  {steps.map((step, idx) => {
                    const isLast = idx === steps.length - 1;
                    return (
                      <div key={step.id} className="relative flex items-start gap-4 text-xs group">
                        {/* Step Marker */}
                        <div className="absolute -left-6 mt-0.5 bg-white rounded-full p-0.5">
                          {getStepIcon(step.status)}
                        </div>

                        {/* Step Content */}
                        <div className="flex-1 bg-slate-50/80 hover:bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 transition">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">
                                {idx + 1}. {step.name}
                              </span>
                              {step.referenceNo && (
                                <span className="font-mono text-[10px] bg-slate-200/70 text-slate-700 px-1.5 py-0.2 rounded-xs">
                                  {step.referenceNo}
                                </span>
                              )}
                            </div>
                            <div>{getStepBadge(step.status)}</div>
                          </div>

                          <p className="text-slate-600 text-xs mt-0.5">{step.description}</p>

                          {step.date && (
                            <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
                              <CalendarClock className="w-3.5 h-3.5 text-slate-400" />
                              <span>ดำเนินการเมื่อ: {formatThaiDate(step.date, 'official')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
