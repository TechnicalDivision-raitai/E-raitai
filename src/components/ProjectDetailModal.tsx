import React, { useState } from 'react';
import {
  X,
  Printer,
  Edit,
  Download,
  Calendar,
  Building,
  CheckCircle2,
  Clock,
  AlertTriangle,
  HardHat,
  FileText,
  Paperclip,
  Eye,
  Coins,
  ShieldCheck,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { Project, UserProfile } from '../types/project';
import { formatCurrency, formatThaiDate, getDaysRemaining, bahtText } from '../utils/thaiDate';
import { STATUS_LABELS } from '../utils/excelExport';

import { AttachmentFile } from '../types/project';

interface ProjectDetailModalProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (p: Project) => void;
  currentUser: UserProfile;
  initialTab?: number;
}

const SectionAttachments: React.FC<{
  attachments?: AttachmentFile[];
  categories: AttachmentFile['category'][];
  title?: string;
}> = ({ attachments, categories, title }) => {
  const filtered = (attachments || []).filter(a => categories.includes(a.category));
  if (!filtered.length) return null;

  return (
    <div className="mt-3 p-3 bg-emerald-50/70 border border-emerald-200/90 rounded-xl space-y-2 no-print">
      <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
        <span className="flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5 text-emerald-700" />
          <span>{title || 'เอกสารแนบใน Google Drive'} ({filtered.length} ไฟล์)</span>
        </span>
        <span className="text-[11px] text-emerald-700 font-semibold">สิทธิ์ Staff เปิดดูไฟล์ได้</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {filtered.map(att => (
          <div
            key={att.id}
            className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-emerald-200 text-xs shadow-2xs"
          >
            <span className="truncate text-slate-800 font-medium" title={att.name}>
              {att.name}
            </span>
            {att.url ? (
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-bold shrink-0 inline-flex items-center gap-1 transition shadow-xs"
                title="คลิกเพื่อเปิดดูไฟล์ใน Google Drive"
              >
                <ExternalLink className="w-3 h-3" />
                <span>เปิดดู Drive</span>
              </a>
            ) : (
              <span className="text-[10px] text-slate-400">ไม่มีลิงก์</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  project,
  isOpen,
  onClose,
  onEdit,
  currentUser,
  initialTab = 1
}) => {
  const [activeTab, setActiveTab] = useState<number>(initialTab);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || 1);
    }
  }, [isOpen, initialTab]);

  if (!isOpen || !project) return null;

  const remaining = getDaysRemaining(project.endDate);

  const tabs = [
    { id: 1, title: '1. ข้อมูลทั่วไป' },
    { id: 2, title: '2. TOR และราคากลาง' },
    { id: 3, title: '3. คำสั่งแต่งตั้งกรรมการ' },
    { id: 4, title: '4. ข้อมูลสัญญาจ้าง' },
    { id: 5, title: '5. การดำเนินงาน' },
    { id: 6, title: '6. การตรวจรับงาน' },
    { id: 7, title: '7. การจัดทำฎีกาและเบิกจ่าย' },
    { id: 8, title: `8. เอกสารแนบ (${project.attachments?.length || 0})` }
  ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 printable-area">
        {/* Modal Top Actions Header (hidden in print) */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-800 to-teal-800 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-700/60 rounded-xl">
              <HardHat className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs px-2 py-0.5 rounded-sm bg-emerald-900/80 text-emerald-300">
                  {project.projectCode}
                </span>
                <span className="text-xs text-emerald-200">
                  ปีงบประมาณ พ.ศ. {project.fiscalYear}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold font-heading line-clamp-1">
                {project.name}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {project.attachments && project.attachments.length > 0 && (
              <button
                onClick={() => setActiveTab(8)}
                className="p-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 text-xs font-semibold shadow-xs"
                title="คลิกเพื่อดูรายการไฟล์แนบใน Google Drive"
              >
                <Paperclip className="w-4 h-4 text-emerald-200" />
                <span className="hidden sm:inline">ไฟล์แนบ Drive ({project.attachments.length})</span>
              </button>
            )}

            <button
              onClick={handlePrint}
              className="p-2 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 text-white transition flex items-center gap-1.5 text-xs font-semibold"
              title="พิมพ์เอกสารรายละเอียดโครงการ"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">พิมพ์เอกสาร</span>
            </button>

            {currentUser.role === 'admin' && (
              <button
                onClick={() => onEdit(project)}
                className="p-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white transition flex items-center gap-1.5 text-xs font-semibold"
                title="แก้ไขข้อมูลโครงการ"
              >
                <Edit className="w-4 h-4" />
                <span className="hidden sm:inline">แก้ไข</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-emerald-200 hover:text-white hover:bg-emerald-700/50 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 8-Tab Navigation Bar (hidden in print) */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 flex gap-1 overflow-x-auto scrollbar-none py-1.5 no-print">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {tab.title}
            </button>
          ))}
        </div>

        {/* Printable Official Government Header (visible when printed or in preview) */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Official Document Banner */}
          <div className="text-center border-b-2 border-slate-800 pb-4 mb-4">
            <div className="inline-block p-1 text-slate-800 font-bold mb-1 tracking-wider uppercase text-xs">
              แบบแสดงรายละเอียดและติดตามโครงการ กองช่าง
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">
              {project.name}
            </h2>
            <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center justify-center gap-3">
              <span>รหัสโครงการ: <strong>{project.projectCode}</strong></span>
              <span>•</span>
              <span>ปีงบประมาณ: <strong>พ.ศ. {project.fiscalYear}</strong></span>
              <span>•</span>
              <span>หมวด: <strong>{project.budgetCategory}</strong></span>
              <span>•</span>
              <span>สถานะ: <strong>{STATUS_LABELS[project.status] || project.status}</strong></span>
            </div>
          </div>

          {/* =========================================================================
              แท็บ 1: ข้อมูลทั่วไป (หัวข้อด้านซ้าย - รายละเอียดด้านขวา)
              ========================================================================= */}
          {(activeTab === 1 || window.matchMedia?.('print')?.matches) && (
            <section className="space-y-3">
              <h4 className="text-sm font-bold text-emerald-900 font-heading bg-emerald-50 px-3 py-1.5 rounded-lg border-l-4 border-emerald-700">
                1. ข้อมูลทั่วไปของโครงการ
              </h4>
              <div className="border border-slate-300 rounded-xl overflow-hidden divide-y divide-slate-200 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-3">
                  <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">ชื่อโครงการ</div>
                  <div className="p-2.5 text-slate-900 md:col-span-2 font-medium">{project.name}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3">
                  <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">ปีงบประมาณ</div>
                  <div className="p-2.5 text-slate-900 md:col-span-2">พ.ศ. {project.fiscalYear}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3">
                  <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">หมวดงบประมาณ</div>
                  <div className="p-2.5 text-slate-900 md:col-span-2">{project.budgetCategory}</div>
                </div>

                {project.meetingSession && (
                  <div className="grid grid-cols-1 md:grid-cols-3">
                    <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">สมัยประชุม/ครั้งที่ (กรณีเงินสะสม)</div>
                    <div className="p-2.5 text-slate-900 md:col-span-2">{project.meetingSession}</div>
                  </div>
                )}

                {project.approvalYear && (
                  <div className="grid grid-cols-1 md:grid-cols-3">
                    <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">ปี พ.ศ. มติอนุมัติ</div>
                    <div className="p-2.5 text-slate-900 md:col-span-2">พ.ศ. {project.approvalYear}</div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3">
                  <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">งบประมาณที่ได้รับอนุมัติ</div>
                  <div className="p-2.5 text-emerald-800 font-bold md:col-span-2 text-sm">
                    {formatCurrency(project.approvedBudget)} บาท ({bahtText(project.approvedBudget)})
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3">
                  <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">สถานที่ดำเนินโครงการ</div>
                  <div className="p-2.5 text-slate-900 md:col-span-2">{project.location || '-'}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3">
                  <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">รายละเอียดแบบรูปรายการ</div>
                  <div className="p-2.5 text-slate-800 md:col-span-2 whitespace-pre-wrap leading-relaxed">
                    {project.description || '-'}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3">
                  <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">ผู้รับผิดชอบโครงการ</div>
                  <div className="p-2.5 text-slate-900 md:col-span-2">{project.responsiblePerson || '-'}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3">
                  <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">หมายเหตุ</div>
                  <div className="p-2.5 text-slate-600 md:col-span-2">{project.notes || '-'}</div>
                </div>
              </div>
            </section>
          )}

          {/* =========================================================================
              แท็บ 2: TOR และราคากลาง
              ========================================================================= */}
          {(activeTab === 2 || window.matchMedia?.('print')?.matches) && (
            <section className="space-y-3">
              <h4 className="text-sm font-bold text-emerald-900 font-heading bg-emerald-50 px-3 py-1.5 rounded-lg border-l-4 border-emerald-700">
                2. ข้อมูลการจัดทำ TOR และราคากลาง
              </h4>
              <div className="border border-slate-300 rounded-xl overflow-hidden divide-y divide-slate-200 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-3">
                  <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">เลขที่คำสั่งแต่งตั้ง กก. TOR</div>
                  <div className="p-2.5 text-slate-900 md:col-span-2">{project.torOrderNo || '-'}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3">
                  <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">วันที่ออกคำสั่ง</div>
                  <div className="p-2.5 text-slate-900 md:col-span-2">{formatThaiDate(project.torOrderDate, 'official')}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3">
                  <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">ผู้จัดทำ TOR / วันที่</div>
                  <div className="p-2.5 text-slate-900 md:col-span-2">
                    {project.torAuthor || '-'} {project.torDate ? `(เมื่อ ${formatThaiDate(project.torDate)})` : ''}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3">
                  <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">ราคากลางที่กำหนด</div>
                  <div className="p-2.5 text-slate-900 md:col-span-2 font-bold text-sm">
                    {project.refPrice ? `${formatCurrency(project.refPrice)} บาท (${bahtText(project.refPrice)})` : '-'}
                    {project.refPriceDate && (
                      <span className="text-xs font-normal text-slate-500 ml-2">
                        กำหนดเมื่อ {formatThaiDate(project.refPriceDate)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3">
                  <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">
                    รายชื่อคณะกรรมการกำหนดราคากลาง
                  </div>
                  <div className="p-2.5 text-slate-900 md:col-span-2">
                    {project.torCommittees && project.torCommittees.length > 0 ? (
                      <ol className="list-decimal list-inside space-y-1">
                        {project.torCommittees.map(c => (
                          <li key={c.id}>
                            <span className="font-semibold">{c.name}</span> - {c.position} ({c.role})
                          </li>
                        ))}
                      </ol>
                    ) : (
                      '- ไม่ระบุ -'
                    )}
                  </div>
                </div>
              </div>
              <SectionAttachments
                attachments={project.attachments}
                categories={['tor']}
                title="เอกสารแนบ TOR และราคากลาง"
              />
            </section>
          )}

          {/* =========================================================================
              แท็บ 3: คำสั่งแต่งตั้งกรรมการ
              ========================================================================= */}
          {(activeTab === 3 || window.matchMedia?.('print')?.matches) && (
            <section className="space-y-3">
              <h4 className="text-sm font-bold text-emerald-900 font-heading bg-emerald-50 px-3 py-1.5 rounded-lg border-l-4 border-emerald-700">
                3. คำสั่งควบคุมงานและตรวจรับงานจ้าง
              </h4>
              <div className="border border-slate-300 rounded-xl overflow-hidden divide-y divide-slate-200 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-3">
                  <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">เลขที่คำสั่งแต่งตั้ง</div>
                  <div className="p-2.5 text-slate-900 md:col-span-2">{project.inspectOrderNo || '-'}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3">
                  <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">วันที่ออกคำสั่ง</div>
                  <div className="p-2.5 text-slate-900 md:col-span-2">{formatThaiDate(project.inspectOrderDate, 'official')}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3">
                  <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">ผู้ควบคุมงาน</div>
                  <div className="p-2.5 text-slate-900 md:col-span-2 font-medium">{project.supervisorName || '-'}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3">
                  <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">
                    รายชื่อคณะกรรมการตรวจรับงานจ้าง
                  </div>
                  <div className="p-2.5 text-slate-900 md:col-span-2">
                    {project.inspectCommittees && project.inspectCommittees.length > 0 ? (
                      <ol className="list-decimal list-inside space-y-1">
                        {project.inspectCommittees.map(c => (
                          <li key={c.id}>
                            <span className="font-semibold">{c.name}</span> - {c.position} ({c.role})
                          </li>
                        ))}
                      </ol>
                    ) : (
                      '- ไม่ระบุ -'
                    )}
                  </div>
                </div>
              </div>
              <SectionAttachments
                attachments={project.attachments}
                categories={['order']}
                title="เอกสารแนบคำสั่งแต่งตั้ง"
              />
            </section>
          )}

          {/* =========================================================================
              แท็บ 4: ข้อมูลสัญญาจ้าง
              ========================================================================= */}
          {(activeTab === 4 || window.matchMedia?.('print')?.matches) && (
            <section className="space-y-3">
              <h4 className="text-sm font-bold text-emerald-900 font-heading bg-emerald-50 px-3 py-1.5 rounded-lg border-l-4 border-emerald-700">
                4. ข้อมูลสัญญาจ้าง
              </h4>
              <div className="border border-slate-300 rounded-xl overflow-hidden divide-y divide-slate-200 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-3">
                  <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">เลขที่สัญญาจ้าง</div>
                  <div className="p-2.5 text-slate-900 md:col-span-2 font-mono font-bold text-sm">
                    {project.contractNo || '-'}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3">
                  <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">วันที่ลงนามในสัญญา</div>
                  <div className="p-2.5 text-slate-900 md:col-span-2">{formatThaiDate(project.contractDate, 'official')}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3">
                  <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">วงเงินตามสัญญา</div>
                  <div className="p-2.5 text-emerald-800 font-bold text-sm md:col-span-2">
                    {project.contractAmount ? `${formatCurrency(project.contractAmount)} บาท (${bahtText(project.contractAmount)})` : '-'}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3">
                  <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">ระยะเวลาตามสัญญา</div>
                  <div className="p-2.5 text-slate-900 md:col-span-2">
                    เริ่มสัญญา {formatThaiDate(project.startDate)} ถึง {formatThaiDate(project.endDate)}
                    {project.endDate && (
                      <span
                        className={`inline-block ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          remaining.isOverdue
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {remaining.label}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3">
                  <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">ชื่อผู้รับจ้าง</div>
                  <div className="p-2.5 text-slate-900 md:col-span-2 font-semibold">
                    {project.contractorName || '-'}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3">
                  <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">เลขประจำตัวผู้เสียภาษี</div>
                  <div className="p-2.5 text-slate-900 md:col-span-2 font-mono">
                    {project.contractorTaxId || '-'}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3">
                  <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">ข้อมูลติดต่อผู้รับจ้าง</div>
                  <div className="p-2.5 text-slate-800 md:col-span-2">
                    {project.contractorContact || '-'}
                  </div>
                </div>
              </div>
              <SectionAttachments
                attachments={project.attachments}
                categories={['contract']}
                title="เอกสารแนบสัญญาจ้าง"
              />
            </section>
          )}

          {/* =========================================================================
              แท็บ 5: การดำเนินงาน (แจ้งเข้าทำงาน & ส่งมอบงาน)
              ========================================================================= */}
          {(activeTab === 5 || window.matchMedia?.('print')?.matches) && (
            <section className="space-y-4">
              <h4 className="text-sm font-bold text-emerald-900 font-heading bg-emerald-50 px-3 py-1.5 rounded-lg border-l-4 border-emerald-700">
                5. การดำเนินงานและส่งมอบงาน
              </h4>

              {/* แจ้งเข้าทำงาน */}
              <div>
                <h5 className="text-xs font-bold text-slate-700 mb-2">หนังสือแจ้งเข้าทำงาน:</h5>
                {project.workNotices && project.workNotices.length > 0 ? (
                  <table className="w-full text-xs border border-slate-300">
                    <thead className="bg-slate-100 font-semibold text-slate-700">
                      <tr>
                        <th className="p-2 border border-slate-300 text-left">เลขที่หนังสือ</th>
                        <th className="p-2 border border-slate-300 text-left">ลงวันที่</th>
                        <th className="p-2 border border-slate-300 text-left">เข้าทำงานจริง</th>
                        <th className="p-2 border border-slate-300 text-left">หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.workNotices.map(w => (
                        <tr key={w.id}>
                          <td className="p-2 border border-slate-300 font-medium">{w.bookNo || '-'}</td>
                          <td className="p-2 border border-slate-300">{formatThaiDate(w.bookDate)}</td>
                          <td className="p-2 border border-slate-300">{formatThaiDate(w.actualWorkDate)}</td>
                          <td className="p-2 border border-slate-300">{w.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg">
                    - ยังไม่มีการบันทึกหนังสือแจ้งเข้าทำงาน -
                  </div>
                )}
              </div>

              {/* ส่งมอบงาน */}
              <div>
                <h5 className="text-xs font-bold text-slate-700 mb-2">การส่งมอบงานแต่ละงวด:</h5>
                {project.deliveries && project.deliveries.length > 0 ? (
                  <table className="w-full text-xs border border-slate-300">
                    <thead className="bg-slate-100 font-semibold text-slate-700">
                      <tr>
                        <th className="p-2 border border-slate-300 text-center w-16">งวดที่</th>
                        <th className="p-2 border border-slate-300 text-left">เลขที่หนังสือ</th>
                        <th className="p-2 border border-slate-300 text-left">วันที่ส่งมอบจริง</th>
                        <th className="p-2 border border-slate-300 text-left">รายละเอียดผลงานที่ส่งมอบ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.deliveries.map(d => (
                        <tr key={d.id}>
                          <td className="p-2 border border-slate-300 text-center font-bold">{d.installment}</td>
                          <td className="p-2 border border-slate-300">{d.bookNo || '-'}</td>
                          <td className="p-2 border border-slate-300">{formatThaiDate(d.actualDeliveryDate)}</td>
                          <td className="p-2 border border-slate-300">{d.details || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg">
                    - ยังไม่มีรายการส่งมอบงาน -
                  </div>
                )}
              </div>
              <SectionAttachments
                attachments={project.attachments}
                categories={['notice', 'delivery']}
                title="เอกสารแนบการดำเนินงานและส่งมอบงาน"
              />
            </section>
          )}

          {/* =========================================================================
              แท็บ 6: การตรวจรับงาน
              ========================================================================= */}
          {(activeTab === 6 || window.matchMedia?.('print')?.matches) && (
            <section className="space-y-3">
              <h4 className="text-sm font-bold text-emerald-900 font-heading bg-emerald-50 px-3 py-1.5 rounded-lg border-l-4 border-emerald-700">
                6. การตรวจรับงานจ้าง
              </h4>
              {project.inspections && project.inspections.length > 0 ? (
                <table className="w-full text-xs border border-slate-300">
                  <thead className="bg-slate-100 font-semibold text-slate-700">
                    <tr>
                      <th className="p-2 border border-slate-300 text-center w-16">งวดที่</th>
                      <th className="p-2 border border-slate-300 text-left">วันที่ตรวจรับ</th>
                      <th className="p-2 border border-slate-300 text-center w-36">ผลการตรวจรับ</th>
                      <th className="p-2 border border-slate-300 text-left">รายละเอียดผลการตรวจรับ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.inspections.map(i => (
                      <tr key={i.id}>
                        <td className="p-2 border border-slate-300 text-center font-bold">{i.installment}</td>
                        <td className="p-2 border border-slate-300">{formatThaiDate(i.inspectionDate)}</td>
                        <td className="p-2 border border-slate-300 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              i.result === 'pass'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {i.result === 'pass' ? 'ตรวจรับถูกต้อง' : 'ไม่ผ่าน/แก้ไข'}
                          </span>
                        </td>
                        <td className="p-2 border border-slate-300">{i.details || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg">
                  - ยังไม่มีการบันทึกผลการตรวจรับงาน -
                </div>
              )}
              <SectionAttachments
                attachments={project.attachments}
                categories={['inspection']}
                title="เอกสารแนบการตรวจรับงานจ้าง"
              />
            </section>
          )}

          {/* =========================================================================
              แท็บ 7: การจัดทำฎีกาและเบิกจ่าย + ค่าตอบแทน
              ========================================================================= */}
          {(activeTab === 7 || window.matchMedia?.('print')?.matches) && (
            <section className="space-y-4">
              <h4 className="text-sm font-bold text-emerald-900 font-heading bg-emerald-50 px-3 py-1.5 rounded-lg border-l-4 border-emerald-700">
                7. การจัดทำฎีกาและการเบิกจ่ายเงินงบประมาณ
              </h4>

              {/* ฎีกาค่าจ้าง */}
              <div>
                <h5 className="text-xs font-bold text-slate-700 mb-2">รายการฎีกาเบิกจ่ายเงินค่าจ้าง:</h5>
                {project.disbursements && project.disbursements.length > 0 ? (
                  <table className="w-full text-xs border border-slate-300">
                    <thead className="bg-slate-100 font-semibold text-slate-700">
                      <tr>
                        <th className="p-2 border border-slate-300 text-center w-16">งวดที่</th>
                        <th className="p-2 border border-slate-300 text-left">เลขที่ฎีกา</th>
                        <th className="p-2 border border-slate-300 text-left">วันที่จัดทำ</th>
                        <th className="p-2 border border-slate-300 text-right">จำนวนเงิน (บาท)</th>
                        <th className="p-2 border border-slate-300 text-center">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.disbursements.map(d => (
                        <tr key={d.id}>
                          <td className="p-2 border border-slate-300 text-center font-bold">{d.installment}</td>
                          <td className="p-2 border border-slate-300 font-medium">{d.petitionNo}</td>
                          <td className="p-2 border border-slate-300">{formatThaiDate(d.disbursementDate)}</td>
                          <td className="p-2 border border-slate-300 text-right font-bold text-slate-800">
                            {formatCurrency(d.amount)}
                          </td>
                          <td className="p-2 border border-slate-300 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                d.status === 'paid'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {d.status === 'paid' ? 'เบิกจ่ายแล้ว' : 'รอเบิกจ่าย'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg">
                    - ยังไม่มีรายการฎีกาเบิกจ่ายเงินค่าจ้าง -
                  </div>
                )}
              </div>

              {/* ค่าตอบแทนกรรมการ */}
              <div>
                <h5 className="text-xs font-bold text-slate-700 mb-2">การเบิกค่าตอบแทนคณะกรรมการ:</h5>
                {project.remunerations && project.remunerations.length > 0 ? (
                  <table className="w-full text-xs border border-slate-300">
                    <thead className="bg-slate-100 font-semibold text-slate-700">
                      <tr>
                        <th className="p-2 border border-slate-300 text-left">รายการค่าตอบแทน</th>
                        <th className="p-2 border border-slate-300 text-left">ผู้รับเงิน</th>
                        <th className="p-2 border border-slate-300 text-right">จำนวนเงิน (บาท)</th>
                        <th className="p-2 border border-slate-300 text-left">เลขที่ฎีกา</th>
                        <th className="p-2 border border-slate-300 text-center">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.remunerations.map(r => (
                        <tr key={r.id}>
                          <td className="p-2 border border-slate-300 font-medium">{r.title}</td>
                          <td className="p-2 border border-slate-300">{r.payeeName || '-'}</td>
                          <td className="p-2 border border-slate-300 text-right font-bold text-slate-800">
                            {formatCurrency(r.amount)}
                          </td>
                          <td className="p-2 border border-slate-300">{r.petitionNo || '-'}</td>
                          <td className="p-2 border border-slate-300 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                r.status === 'paid'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {r.status === 'paid' ? 'เบิกแล้ว' : 'ยังไม่เบิก'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold">
                      <tr>
                        <td colSpan={2} className="p-2 border border-slate-300 text-right">
                          รวมค่าตอบแทนทั้งหมด:
                        </td>
                        <td className="p-2 border border-slate-300 text-right text-emerald-800">
                          {formatCurrency(project.remunerations.reduce((s, r) => s + (r.amount || 0), 0))} บ.
                        </td>
                        <td colSpan={2} className="p-2 border border-slate-300" />
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <div className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg">
                    - ยังไม่มีรายการเบิกค่าตอบแทนกรรมการ -
                  </div>
                )}
              </div>

              <SectionAttachments
                attachments={project.attachments}
                categories={['disbursement', 'remuneration']}
                title="เอกสารแนบฎีกาและการเบิกจ่าย"
              />
            </section>
          )}

          {/* =========================================================================
              แท็บ 8: เอกสารแนบ
              ========================================================================= */}
          {(activeTab === 8 || window.matchMedia?.('print')?.matches) && (
            <section className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-50 px-3 py-2 rounded-lg border-l-4 border-emerald-700">
                <h4 className="text-sm font-bold text-emerald-950 font-heading">
                  8. รายการเอกสารแนบในระบบ (Google Drive)
                </h4>
                <span className="text-[11px] text-emerald-800 font-semibold bg-white/90 px-2.5 py-0.5 rounded-full border border-emerald-300 w-fit shadow-2xs">
                  ✓ สิทธิ์ Staff และผู้ใช้งานทุกคน สามารถเปิดดูไฟล์แนบได้โดยตรง
                </span>
              </div>
              {project.attachments && project.attachments.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {project.attachments.map(att => (
                    <div
                      key={att.id}
                      className="p-3 bg-slate-50 hover:bg-emerald-50/40 rounded-xl border border-slate-200 hover:border-emerald-300 flex items-center justify-between gap-3 text-xs transition shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
                          <Paperclip className="w-4 h-4" />
                        </div>
                        <div className="overflow-hidden">
                          <div className="font-semibold text-slate-800 truncate" title={att.name}>
                            {att.name}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            หมวด: {att.category} • {(att.size / 1024).toFixed(1)} KB • อัปโหลด {formatThaiDate(att.uploadDate)}
                          </div>
                        </div>
                      </div>

                      {att.url ? (
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shrink-0 transition inline-flex items-center gap-1.5 shadow-xs text-xs"
                          title="เปิดไฟล์ใน Google Drive (แท็บใหม่)"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>เปิดดู Drive</span>
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400">ไม่มีลิงก์</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic p-4 bg-slate-50 rounded-xl text-center border border-slate-200">
                  - ยังไม่มีเอกสารแนบสำหรับโครงการนี้ใน Google Drive -
                </div>
              )}
            </section>
          )}

        </div>
      </div>
    </div>
  );
};
