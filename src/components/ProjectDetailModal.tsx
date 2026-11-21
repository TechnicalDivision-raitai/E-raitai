import React, { useState } from 'react';
import Swal from 'sweetalert2';
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
  ExternalLink,
  RefreshCw,
  MapPin,
  Navigation,
  Signpost,
  Image as ImageIcon,
  Compass
} from 'lucide-react';
import {
  hasValidCoord,
  getGoogleMapsPointUrl,
  getGoogleMapsRouteUrl,
  getArchiveImageDisplayUrl
} from './ProjectRecordsView';
import { Project, ProjectStatus, UserProfile, AttachmentFile } from '../types/project';
import {
  formatCurrency,
  formatThaiDate,
  formatThaiDateTime,
  getDaysRemaining,
  bahtText,
  getWorkNoticeAlert,
  isProjectCompletedOrDisbursed,
  DEFAULT_DELIVERY_DETAILS,
  getDeliveryContractStatus,
  getFirstAttachmentTab
} from '../utils/thaiDate';
import { STATUS_LABELS } from '../utils/excelExport';

interface ProjectDetailModalProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (p: Project) => void;
  onUpdateProject?: (p: Project) => void;
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
  onUpdateProject,
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
  const isInspectedOrCompleted =
    project.status === 'inspected' ||
    project.status === 'completed' ||
    isProjectCompletedOrDisbursed(project) ||
    Boolean(project.inspections?.some(i => i.result === 'pass'));

  const tabs = [
    { id: 1, title: '1. ข้อมูลทั่วไป' },
    { id: 2, title: '2. TOR และราคากลาง' },
    { id: 3, title: '3. คำสั่งแต่งตั้งกรรมการ' },
    { id: 4, title: '4. ข้อมูลสัญญาจ้าง' },
    { id: 5, title: '5. การดำเนินงาน' },
    { id: 6, title: '6. การตรวจรับงาน' },
    { id: 7, title: '7. การจัดทำฎีกาและเบิกจ่าย' },
    { id: 8, title: '8. ข้อมูลโครงการ' }
  ];

  const handlePrint = () => {
    window.print();
  };

  const handleChangeStatus = () => {
    if (currentUser.role !== 'admin' || !onUpdateProject) return;

    Swal.fire({
      title: 'เปลี่ยนสถานะการดำเนินงานโครงการ',
      input: 'select',
      inputOptions: {
        not_started: STATUS_LABELS.not_started,
        procurement_tor: STATUS_LABELS.procurement_tor,
        contracted: STATUS_LABELS.contracted,
        in_progress: STATUS_LABELS.in_progress,
        delivered: STATUS_LABELS.delivered,
        inspected: STATUS_LABELS.inspected,
        completed: STATUS_LABELS.completed,
        overdue: STATUS_LABELS.overdue,
        cancelled: STATUS_LABELS.cancelled
      },
      inputValue: project.status,
      showCancelButton: true,
      confirmButtonText: 'บันทึกสถานะ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#059669'
    }).then(result => {
      if (result.isConfirmed && result.value) {
        const nowStr = formatThaiDateTime();
        const updated: Project = {
          ...project,
          status: result.value as ProjectStatus,
          statusUpdatedAt: nowStr,
          updatedAt: new Date().toISOString()
        };
        onUpdateProject(updated);

        Swal.fire({
          icon: 'success',
          title: 'อัปเดตสถานะสำเร็จ',
          text: `เปลี่ยนสถานะเป็น "${STATUS_LABELS[result.value]}" เรียบร้อยแล้ว (${nowStr})`,
          timer: 1500,
          showConfirmButton: false
        });
      }
    });
  };

  const latestStatusDate =
    project.statusUpdatedAt ||
    project.ackTime ||
    (project.updatedAt ? formatThaiDateTime(project.updatedAt) : '');

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
                onClick={() => setActiveTab(getFirstAttachmentTab(project))}
                className="p-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 text-xs font-semibold shadow-xs"
                title="คลิกเพื่อไปยังแท็บที่มีไฟล์แนบใน Google Drive"
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

            {currentUser.role === 'admin' && onUpdateProject && (
              <button
                onClick={handleChangeStatus}
                className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white transition flex items-center gap-1.5 text-xs font-semibold shadow-xs"
                title="เปลี่ยนสถานะโครงการ"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">เปลี่ยนสถานะ</span>
              </button>
            )}

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
              <span>
                สถานะ: <strong>{STATUS_LABELS[project.status] || project.status}</strong>
                {latestStatusDate && (
                  <span className="text-slate-500 ml-1.5">
                    (อัปเดตล่าสุด {latestStatusDate})
                  </span>
                )}
              </span>
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

                <div className="grid grid-cols-1 md:grid-cols-3 bg-emerald-50/30">
                  <div className="bg-emerald-50/70 font-bold text-emerald-900 p-2.5 md:col-span-1">
                    หนังสือขออนุมัติโครงการ (ขั้นตอนที่ 1)
                  </div>
                  <div className="p-2.5 text-slate-900 md:col-span-2">
                    {project.approvalRequestNo || project.approvalRequestDate ? (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>
                          เลขที่หนังสือ:{' '}
                          <strong className="font-mono text-emerald-900">
                            {project.approvalRequestNo || '-'}
                          </strong>
                        </span>
                        {project.approvalRequestDate && (
                          <span className="text-slate-600">
                            ลงวันที่ {formatThaiDate(project.approvalRequestDate, 'official')}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">- ยังไม่บันทึกการขออนุมัติโครงการ -</span>
                    )}
                  </div>
                </div>
              </div>
              <SectionAttachments
                attachments={project.attachments}
                categories={['approval_request', 'other', 'project_record']}
                title="เอกสารแนบข้อมูลทั่วไปและหนังสือขออนุมัติโครงการ"
              />
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
                      <span className="block text-xs font-normal text-slate-500 mt-1">
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
                    {(() => {
                      const list = (project.torCommittees || []).filter(c => c?.name?.trim());
                      return list.length > 0 ? (
                        <ol className="list-decimal list-inside space-y-1">
                          {list.map(c => (
                            <li key={c.id}>
                              <span className="font-semibold">{c.name}</span>
                              {c.position ? ` - ${c.position}` : ''} ({c.role})
                            </li>
                          ))}
                        </ol>
                      ) : (
                        '- ไม่ระบุ -'
                      );
                    })()}
                  </div>
                </div>

                {project.torNotes && (
                  <div className="grid grid-cols-1 md:grid-cols-3">
                    <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">
                      หมายเหตุ TOR / ราคากลาง
                    </div>
                    <div className="p-2.5 text-slate-900 md:col-span-2 whitespace-pre-wrap">
                      {project.torNotes}
                    </div>
                  </div>
                )}
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
                  <div className="p-2.5 text-slate-900 md:col-span-2">
                    {(() => {
                      const list =
                        project.supervisors && project.supervisors.some(s => s.name?.trim())
                          ? project.supervisors.filter(s => s.name?.trim())
                          : (project.supervisorName || '')
                              .split(/[\n,]+/)
                              .map(part => part.trim())
                              .filter(Boolean)
                              .map((part, idx) => ({
                                id: `sup-view-${idx}`,
                                name: part,
                                position: ''
                              }));

                      if (list.length === 0) return '-';
                      if (list.length === 1) {
                        const s = list[0];
                        return (
                          <span className="font-medium">
                            {s.name}
                            {s.position ? ` - ${s.position}` : ''}
                          </span>
                        );
                      }
                      return (
                        <ol className="list-decimal list-inside space-y-1">
                          {list.map(s => (
                            <li key={s.id}>
                              <span className="font-semibold">{s.name}</span>
                              {s.position ? ` - ${s.position}` : ''}
                            </li>
                          ))}
                        </ol>
                      );
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3">
                  <div className="bg-slate-50 font-bold text-slate-700 p-2.5 md:col-span-1">
                    รายชื่อคณะกรรมการตรวจรับงานจ้าง
                  </div>
                  <div className="p-2.5 text-slate-900 md:col-span-2">
                    {(() => {
                      const list = (project.inspectCommittees || []).filter(c => c?.name?.trim());
                      return list.length > 0 ? (
                        <ol className="list-decimal list-inside space-y-1">
                          {list.map(c => (
                            <li key={c.id}>
                              <span className="font-semibold">{c.name}</span>
                              {c.position ? ` - ${c.position}` : ''} ({c.role})
                            </li>
                          ))}
                        </ol>
                      ) : (
                        '- ไม่ระบุ -'
                      );
                    })()}
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
                    {project.endDate && !isInspectedOrCompleted && (
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
                {currentUser.role === 'admin' && getWorkNoticeAlert(project).hasAlert && (
                  <div
                    className={`mb-2.5 p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                      getWorkNoticeAlert(project).isOver15Days
                        ? 'bg-rose-50 border-rose-300 text-rose-900'
                        : 'bg-amber-50 border-amber-300 text-amber-950'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <div className="font-semibold">
                      {getWorkNoticeAlert(project).fullMessage}
                    </div>
                  </div>
                )}
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
                          <td className="p-2 border border-slate-300">
                            {w.actualWorkDate ? (
                              formatThaiDate(w.actualWorkDate)
                            ) : currentUser.role === 'admin' && getWorkNoticeAlert(project).hasAlert ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                <AlertTriangle className="w-3 h-3 shrink-0 text-amber-700" />
                                <span>{getWorkNoticeAlert(project).badgeLabel}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">รอระบุวันเข้าทำงานจริง</span>
                            )}
                          </td>
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
                  <div className="space-y-2.5">
                    {/* แจ้งเตือนเฉพาะกรณีส่งมอบเกินกำหนดสัญญาเท่านั้น */}
                    {project.deliveries.map(d => {
                      const delStatus = getDeliveryContractStatus(
                        d.actualDeliveryDate || d.bookDate,
                        project.endDate
                      );
                      if (!delStatus.hasComparison || delStatus.isWithinContract) return null;
                      return (
                        <div
                          key={`status-${d.id}`}
                          className="p-3 rounded-xl border flex items-start gap-2.5 text-xs bg-rose-50/90 border-rose-300 text-rose-950"
                        >
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                          <div>
                            <span className="font-bold">
                              งวดที่ {d.installment}: พ้นกำหนดระยะเวลาตามสัญญา (เกินกำหนด {delStatus.overdueDays} วัน จนถึงวันส่งมอบ)
                            </span>
                            <div className="text-[11px] mt-0.5 opacity-90">
                              {delStatus.detailMessage}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <table className="w-full text-xs border border-slate-300">
                      <thead className="bg-slate-100 font-semibold text-slate-700">
                        <tr>
                          <th className="p-2 border border-slate-300 text-center w-16">งวดที่</th>
                          <th className="p-2 border border-slate-300 text-left">เลขที่หนังสือ</th>
                          <th className="p-2 border border-slate-300 text-left">วันที่ส่งมอบจริง</th>
                          <th className="p-2 border border-slate-300 text-left">รายละเอียดงานที่ส่งมอบ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {project.deliveries.map(d => {
                          const delStatus = getDeliveryContractStatus(
                            d.actualDeliveryDate || d.bookDate,
                            project.endDate
                          );
                          return (
                            <tr key={d.id}>
                              <td className="p-2 border border-slate-300 text-center font-bold">
                                {d.installment}
                              </td>
                              <td className="p-2 border border-slate-300">{d.bookNo || '-'}</td>
                              <td className="p-2 border border-slate-300">
                                <div>{formatThaiDate(d.actualDeliveryDate || d.bookDate)}</div>
                                {delStatus.hasComparison && (
                                  <span
                                    className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                      delStatus.isWithinContract
                                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                        : 'bg-rose-100 text-rose-800 border-rose-300'
                                    }`}
                                  >
                                    {delStatus.isWithinContract ? (
                                      <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-700" />
                                    ) : (
                                      <AlertTriangle className="w-3 h-3 shrink-0 text-rose-700" />
                                    )}
                                    <span>{delStatus.label}</span>
                                  </span>
                                )}
                              </td>
                              <td className="p-2 border border-slate-300">
                                {d.details || DEFAULT_DELIVERY_DETAILS}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
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
                        <th className="p-2 border border-slate-300 text-left">เลขที่ฎีกา / หมายเหตุ</th>
                        <th className="p-2 border border-slate-300 text-center">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.remunerations.map(r => (
                        <tr key={r.id}>
                          <td className="p-2 border border-slate-300 font-medium">{r.title}</td>
                          <td className="p-2 border border-slate-300">{r.payeeName || '-'}</td>
                          <td className="p-2 border border-slate-300 text-right font-bold text-slate-800">
                            {r.status === 'not_eligible' ? '-' : formatCurrency(r.amount)}
                          </td>
                          <td className="p-2 border border-slate-300">
                            {r.status === 'not_eligible'
                              ? r.remarks
                                ? `หมายเหตุ: ${r.remarks}`
                                : '-'
                              : r.petitionNo || '-'}
                          </td>
                          <td className="p-2 border border-slate-300 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                r.status === 'paid'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : r.status === 'not_eligible'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {r.status === 'paid'
                                ? 'เบิกแล้ว'
                                : r.status === 'not_eligible'
                                ? 'ไม่สามารถเบิกได้'
                                : 'ยังไม่เบิก'}
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
                          {formatCurrency(
                            project.remunerations
                              .filter(r => r.status !== 'not_eligible')
                              .reduce((s, r) => s + (r.amount || 0), 0)
                          )}{' '}
                          บ.
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
              แท็บ 8: ข้อมูลโครงการ (พิกัดโครงการ, พิกัดป้ายโครงการ, รูปภาพแนบ)
              ========================================================================= */}
          {(activeTab === 8 || window.matchMedia?.('print')?.matches) && (
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-50 px-3.5 py-2.5 rounded-xl border-l-4 border-emerald-700">
                <div>
                  <h4 className="text-sm font-bold text-emerald-950 font-heading flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-700" />
                    <span>8. ข้อมูลโครงการ (พิกัดโครงการ • พิกัดป้ายแสดงโครงการ • รูปภาพโครงการ)</span>
                  </h4>
                  <p className="text-[11px] text-emerald-800">
                    ข้อมูลส่วนนี้จัดเก็บไว้เพื่อเปิดดูย้อนหลังและเปิดแผนที่ผ่าน Google Maps
                  </p>
                </div>
              </div>

              {getGoogleMapsRouteUrl(
                project.projectRecord?.startPoint,
                project.projectRecord?.endPoint
              ) && (
                <div className="flex justify-start no-print">
                  <a
                    href={getGoogleMapsRouteUrl(
                      project.projectRecord?.startPoint,
                      project.projectRecord?.endPoint
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition"
                  >
                    <Compass className="w-4 h-4" />
                    <span>ดูเส้นทาง จุดเริ่มต้น → จุดสิ้นสุดโครงการ บน Google Maps</span>
                  </a>
                </div>
              )}

              {/* 1 & 2: พิกัดโครงการ และ พิกัดป้ายแสดงโครงการ */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1.1 จุดเริ่มต้นโครงการ */}
                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <Navigation className="w-4 h-4 text-emerald-600" />
                      <span>1.1 จุดเริ่มต้นโครงการ</span>
                    </span>
                  </div>
                  {hasValidCoord(project.projectRecord?.startPoint) ? (
                    <div className="bg-white p-3 rounded-xl border border-emerald-200 text-xs space-y-1">
                      <div className="font-mono font-semibold text-emerald-900">
                        ละติจูด: {project.projectRecord!.startPoint!.lat}
                      </div>
                      <div className="font-mono font-semibold text-emerald-900">
                        ลองจิจูด: {project.projectRecord!.startPoint!.lng}
                      </div>
                      {project.projectRecord?.startPoint?.note && (
                        <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                          จุดสังเกต: {project.projectRecord.startPoint.note}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic p-3 bg-white rounded-xl border border-slate-200">
                      ยังไม่ได้บันทึกพิกัดจุดเริ่มต้นโครงการ
                    </div>
                  )}
                </div>

                {/* 1.2 จุดสิ้นสุดโครงการ */}
                <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                      <Navigation className="w-4 h-4 text-rose-600" />
                      <span>1.2 จุดสิ้นสุดโครงการ</span>
                    </span>
                  </div>
                  {hasValidCoord(project.projectRecord?.endPoint) ? (
                    <div className="bg-white p-3 rounded-xl border border-rose-200 text-xs space-y-1">
                      <div className="font-mono font-semibold text-rose-900">
                        ละติจูด: {project.projectRecord!.endPoint!.lat}
                      </div>
                      <div className="font-mono font-semibold text-rose-900">
                        ลองจิจูด: {project.projectRecord!.endPoint!.lng}
                      </div>
                      {project.projectRecord?.endPoint?.note && (
                        <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                          จุดสังเกต: {project.projectRecord.endPoint.note}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic p-3 bg-white rounded-xl border border-slate-200">
                      ยังไม่ได้บันทึกพิกัดจุดสิ้นสุดโครงการ
                    </div>
                  )}
                </div>

                {/* 2. พิกัดป้ายแสดงโครงการ */}
                <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                      <Signpost className="w-4 h-4 text-purple-600" />
                      <span>2. พิกัดป้ายแสดงโครงการ</span>
                    </span>
                    {getGoogleMapsPointUrl(project.projectRecord?.signboardPoint) && (
                      <a
                        href={getGoogleMapsPointUrl(project.projectRecord?.signboardPoint)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold inline-flex items-center gap-1 shadow-2xs transition no-print"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>เปิดดู Google Maps</span>
                      </a>
                    )}
                  </div>
                  {hasValidCoord(project.projectRecord?.signboardPoint) ? (
                    <div className="bg-white p-3 rounded-xl border border-purple-200 text-xs space-y-1">
                      <div className="font-mono font-semibold text-purple-900">
                        ละติจูด: {project.projectRecord!.signboardPoint!.lat}
                      </div>
                      <div className="font-mono font-semibold text-purple-900">
                        ลองจิจูด: {project.projectRecord!.signboardPoint!.lng}
                      </div>
                      {project.projectRecord?.signboardPoint?.note && (
                        <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                          จุดติดตั้ง: {project.projectRecord.signboardPoint.note}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic p-3 bg-white rounded-xl border border-slate-200">
                      ยังไม่ได้บันทึกพิกัดป้ายแสดงโครงการ
                    </div>
                  )}
                </div>
              </div>

              {/* 3. รูปภาพและไฟล์แนบโครงการ */}
              <div className="p-4 rounded-2xl bg-sky-50/40 border border-sky-200 space-y-3">
                <h5 className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-sky-600" />
                  <span>3. แนบไฟล์ / รูปภาพโครงการ ({project.projectRecord?.files?.length || 0} รายการ)</span>
                </h5>
                {project.projectRecord?.files && project.projectRecord.files.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {project.projectRecord.files.map(file => {
                      const imgSrc = getArchiveImageDisplayUrl(file);
                      const isImage =
                        file.type?.startsWith('image/') ||
                        Boolean(file.previewDataUrl) ||
                        /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);
                      return (
                        <div
                          key={file.id}
                          className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs flex flex-col justify-between"
                        >
                          {isImage && imgSrc ? (
                            <img src={imgSrc} alt={file.name} className="h-36 w-full object-cover" />
                          ) : (
                            <div className="h-36 bg-slate-50 flex flex-col items-center justify-center p-3 text-center">
                              <FileText className="w-7 h-7 text-slate-400 mb-1" />
                              <span className="text-xs font-semibold text-slate-700">{file.name}</span>
                            </div>
                          )}
                          <div className="p-2.5 flex items-center justify-between gap-2 text-xs">
                            <span className="font-medium text-slate-700 truncate">
                              {file.caption || file.name}
                            </span>
                            {file.url && (
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold inline-flex items-center gap-1 shrink-0 no-print"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>เปิดดู</span>
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic p-4 bg-white rounded-xl border border-slate-200 text-center">
                    ยังไม่มีรูปภาพหรือไฟล์แนบในแท็บบันทึกข้อมูลโครงการ
                  </div>
                )}
              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  );
};
