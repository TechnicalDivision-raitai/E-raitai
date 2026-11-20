import React, { useState } from 'react';
import {
  X,
  Wrench,
  FileText,
  MapPin,
  Phone,
  User,
  Calendar,
  ExternalLink,
  CheckCircle2,
  Circle,
  Clock,
  Printer,
  Edit3,
  Camera,
  Image as ImageIcon,
  FolderKanban
} from 'lucide-react';
import {
  RepairAttachment,
  RepairRequest,
  RepairRequestStatus,
  UserProfile
} from '../types/project';
import { formatCurrency, formatThaiDate } from '../utils/thaiDate';
import {
  REPAIR_ATTACHMENT_STAGE_LABELS,
  REPAIR_CHANNEL_LABELS,
  REPAIR_ROAD_TYPE_LABELS,
  REPAIR_STATUS_META,
  REPAIR_URGENCY_META,
  getRepairImageDisplayUrl
} from '../utils/repairHelpers';

interface RepairRequestDetailModalProps {
  isOpen: boolean;
  request: RepairRequest | null;
  currentUser: UserProfile;
  onClose: () => void;
  onEdit: (request: RepairRequest, tab?: 1 | 2) => void;
  onQuickStatusChange: (id: string, status: RepairRequestStatus) => void;
}

const PROGRESS_STEPS: {
  step: number;
  title: string;
  subtitle: string;
  matchStatuses: RepairRequestStatus[];
}[] = [
  {
    step: 1,
    title: 'รับคำร้องทุกข์',
    subtitle: 'ลงรับเรื่องเข้าระบบกองช่าง',
    matchStatuses: ['received']
  },
  {
    step: 2,
    title: 'สำรวจหน้างาน',
    subtitle: 'ช่างลงพื้นที่ตรวจสอบสภาพชำรุด',
    matchStatuses: ['inspecting']
  },
  {
    step: 3,
    title: 'กำลังซ่อมแซม',
    subtitle: 'ดำเนินการเกรด/ปะซ่อม/ปรับปรุง',
    matchStatuses: ['in_progress']
  },
  {
    step: 4,
    title: 'ปิดงาน / เสนอตั้งงบ',
    subtitle: 'ซ่อมแล้วเสร็จ หรือส่งเข้าแผนโครงการ',
    matchStatuses: ['completed', 'budget_planned']
  }
];

const QUICK_STATUS_OPTIONS: RepairRequestStatus[] = [
  'received',
  'inspecting',
  'in_progress',
  'completed',
  'budget_planned'
];

const ATTACHMENT_STAGES: RepairAttachment['stage'][] = [
  'petition',
  'before',
  'during',
  'after'
];

export const RepairRequestDetailModal: React.FC<RepairRequestDetailModalProps> = ({
  isOpen,
  request,
  currentUser,
  onClose,
  onEdit,
  onQuickStatusChange
}) => {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [previewImage, setPreviewImage] = useState<{
    src: string;
    title: string;
    stageLabel: string;
    url?: string;
  } | null>(null);

  if (!isOpen || !request) return null;

  const statusMeta = REPAIR_STATUS_META[request.status] || REPAIR_STATUS_META.received;
  const urgencyMeta = REPAIR_URGENCY_META[request.urgency] || REPAIR_URGENCY_META.normal;
  const currentStepIndex = statusMeta.stepIndex;
  const hasCoords = Boolean(request.locationLat?.trim() && request.locationLng?.trim());
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps?q=${encodeURIComponent(
        `${request.locationLat!.trim()},${request.locationLng!.trim()}`
      )}`
    : null;
  const canModify = currentUser.role === 'admin';

  const attachmentsByStage = ATTACHMENT_STAGES.map(stage => ({
    stage,
    label: REPAIR_ATTACHMENT_STAGE_LABELS[stage],
    items: (request.attachments || []).filter(att => att.stage === stage)
  })).filter(group => group.items.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-[1px] p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Top Modal Header */}
        <div className="px-5 sm:px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-300 font-mono tabular-nums">
              <span className="text-emerald-300 font-bold text-sm">{request.requestCode}</span>
              <span>·</span>
              <span>ปีงบประมาณ {request.fiscalYear}</span>
              {request.obtReceiveNo && (
                <>
                  <span>·</span>
                  <span>เลขรับ อบต. {request.obtReceiveNo}</span>
                </>
              )}
              {request.engReceiveNo && (
                <>
                  <span>·</span>
                  <span>เลขรับกองช่าง {request.engReceiveNo}</span>
                </>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white mt-1 leading-snug">
              {request.subject}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0 no-print">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>พิมพ์สรุป</span>
            </button>
            {canModify && (
              <>
                <button
                  type="button"
                  onClick={() => onEdit(request, 2)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition whitespace-nowrap shrink-0"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>อัปเดตผลซ่อม</span>
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(request, 1)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium transition whitespace-nowrap shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>แก้ไขคำร้อง</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดหน้าต่างรายละเอียด"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-slate-50">
          {/* Progress Stepper + Quick Status Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-sm">
                  <span className={`w-2.5 h-2.5 rounded-full ${statusMeta.dotClass}`} />
                  <span className={statusMeta.textClass}>{statusMeta.label}</span>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">
                  ความเร่งด่วน:{' '}
                  <span className={urgencyMeta.textClass}>{urgencyMeta.label}</span>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">
                  ช่องทาง: <span className="text-slate-700 font-medium">{REPAIR_CHANNEL_LABELS[request.channel]}</span>
                </span>
              </div>
              <div className="text-xs text-slate-500 tabular-nums">
                ยื่นคำร้องเมื่อ {formatThaiDate(request.petitionDate, 'full')}
              </div>
            </div>

            {/* 4-Step Visual Progress */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {PROGRESS_STEPS.map(stepItem => {
                const isDone = currentStepIndex > stepItem.step || (currentStepIndex === 4 && stepItem.step === 4);
                const isActive = currentStepIndex === stepItem.step && stepItem.step < 4;
                const isBudgetPlanned = stepItem.step === 4 && request.status === 'budget_planned';

                return (
                  <div
                    key={stepItem.step}
                    className={`rounded-lg border p-3 transition ${
                      isDone
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : isActive
                        ? 'bg-sky-50/70 border-sky-300'
                        : 'bg-slate-50/70 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isDone ? (
                        isBudgetPlanned ? (
                          <FolderKanban className="w-4 h-4 text-slate-700 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        )
                      ) : isActive ? (
                        <Clock className="w-4 h-4 text-sky-600 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-300 shrink-0" />
                      )}
                      <span
                        className={`text-xs font-bold ${
                          isDone
                            ? isBudgetPlanned
                              ? 'text-slate-800'
                              : 'text-emerald-800'
                            : isActive
                            ? 'text-sky-800'
                            : 'text-slate-500'
                        }`}
                      >
                        {stepItem.step}. {isBudgetPlanned ? 'เสนอตั้งงบประมาณ' : stepItem.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 pl-6 leading-relaxed">
                      {stepItem.subtitle}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Quick Status Switcher */}
            {canModify && (
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 no-print">
                <span className="text-xs font-medium text-slate-500 mr-1">ปรับสถานะด่วน:</span>
                {QUICK_STATUS_OPTIONS.map(st => {
                  const meta = REPAIR_STATUS_META[st];
                  const active = request.status === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => onQuickStatusChange(request.id, st)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          active ? 'bg-emerald-400' : meta.dotClass
                        }`}
                      />
                      <span>{meta.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2-Column Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left 2 Columns: Petition + Resolution */}
            <div className="lg:col-span-2 space-y-5">
              {/* Petition Details */}
              <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>รายละเอียดใบคำร้องทุกข์ / ร้องเรียน</span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {REPAIR_ROAD_TYPE_LABELS[request.roadType]}
                  </span>
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
                  <div>
                    <dt className="text-slate-500">สายถนน / จุดเกิดเหตุ</dt>
                    <dd className="text-slate-900 font-semibold mt-0.5">
                      {request.roadName || '-'}
                      {request.villageNo ? ` · หมู่ที่ ${request.villageNo}` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">เลขรับหนังสือและวันที่รับ</dt>
                    <dd className="text-slate-800 mt-0.5 tabular-nums space-y-0.5">
                      <div>
                        อบต.: {request.obtReceiveNo || '-'}{' '}
                        {request.obtReceiveDate ? `(${formatThaiDate(request.obtReceiveDate)})` : ''}
                      </div>
                      <div>
                        กองช่าง: {request.engReceiveNo || '-'}{' '}
                        {request.engReceiveDate ? `(${formatThaiDate(request.engReceiveDate)})` : ''}
                      </div>
                    </dd>
                  </div>
                </dl>

                <div className="pt-2 border-t border-slate-100">
                  <div className="text-xs text-slate-500 mb-1">รายละเอียดความเดือดร้อน / สภาพการชำรุด</div>
                  <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line bg-slate-50 border border-slate-200/80 rounded-lg p-3.5">
                    {request.problemDetails || '-'}
                  </p>
                </div>

                {request.submittedEvidenceNote && (
                  <div className="pt-2 border-t border-slate-100 text-xs">
                    <div className="text-slate-500 mb-1">เอกสารหลักฐานแนบคำร้อง</div>
                    <div className="text-slate-800 font-medium">
                      {request.submittedEvidenceNote}
                    </div>
                  </div>
                )}
              </section>

              {/* Inspection & Repair Section */}
              <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                    <Wrench className="w-4 h-4 text-emerald-600" />
                    <span>การลงพื้นที่ตรวจสอบและการแก้ไขปัญหา</span>
                  </div>
                  {canModify && (
                    <button
                      type="button"
                      onClick={() => onEdit(request, 2)}
                      className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold whitespace-nowrap shrink-0 no-print"
                    >
                      บันทึก / อัปเดตข้อมูล →
                    </button>
                  )}
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
                  <div>
                    <dt className="text-slate-500">ผู้รับผิดชอบ / ชุดช่างผู้ดำเนินการ</dt>
                    <dd className="text-slate-900 font-semibold mt-0.5">
                      {request.assignedStaff || 'ยังไม่ได้มอบหมาย'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">วันที่ลงพื้นที่สำรวจ</dt>
                    <dd className="text-slate-800 font-medium mt-0.5 tabular-nums">
                      {request.inspectionDate ? formatThaiDate(request.inspectionDate, 'full') : 'ยังไม่ได้ลงพื้นที่'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">วิธีการซ่อมแซม / แนวทางแก้ไข</dt>
                    <dd className="text-slate-900 font-medium mt-0.5">
                      {request.repairMethod || '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">ระยะเวลาดำเนินการซ่อมแซม</dt>
                    <dd className="text-slate-800 font-medium mt-0.5 tabular-nums">
                      {request.repairStartDate ? formatThaiDate(request.repairStartDate) : '-'}
                      {' — '}
                      {request.repairCompletedDate ? formatThaiDate(request.repairCompletedDate) : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">ค่าใช้จ่ายซ่อมบำรุง (ถ้ามี)</dt>
                    <dd className="text-slate-900 font-semibold mt-0.5 tabular-nums">
                      {request.repairCost && request.repairCost > 0
                        ? `${formatCurrency(request.repairCost)} บาท`
                        : 'ใช้งบดำเนินการ / เครื่องจักรของ อบต.'}
                    </dd>
                  </div>
                </dl>

                {request.inspectionSummary && (
                  <div className="pt-2 border-t border-slate-100">
                    <div className="text-xs text-slate-500 mb-1">ผลการตรวจสอบหน้างาน</div>
                    <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                      {request.inspectionSummary}
                    </p>
                  </div>
                )}

                {request.repairDetails && (
                  <div className="pt-2 border-t border-slate-100">
                    <div className="text-xs text-slate-500 mb-1">รายละเอียดการแก้ไข / วัสดุ / เครื่องจักรที่ใช้</div>
                    <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                      {request.repairDetails}
                    </p>
                  </div>
                )}

                {request.resolutionNote && (
                  <div className="pt-2 border-t border-slate-100">
                    <div className="text-xs text-slate-500 mb-1">สรุปผลการแก้ไข / หมายเหตุปิดงาน</div>
                    <p className="text-xs sm:text-sm text-emerald-900 bg-emerald-50/70 border border-emerald-200 rounded-lg p-3 leading-relaxed whitespace-pre-line">
                      {request.resolutionNote}
                    </p>
                  </div>
                )}
              </section>
            </div>

            {/* Right Column: Requester + Location */}
            <div className="space-y-5">
              {/* Requester Card */}
              <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm border-b border-slate-100 pb-3">
                  <User className="w-4 h-4 text-emerald-600" />
                  <span>ข้อมูลผู้ร้องทุกข์ / ผู้แจ้ง</span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <div className="text-slate-500">ชื่อผู้ร้อง</div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">
                      {request.requesterName}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-500 mb-0.5">เบอร์ติดต่อ</div>
                    {request.requesterPhone ? (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <a
                          href={`tel:${request.requesterPhone.replace(/\s+/g, '')}`}
                          className="text-emerald-700 hover:underline font-semibold tabular-nums"
                        >
                          {request.requesterPhone}
                        </a>
                      </div>
                    ) : (
                      <div className="text-slate-400">-</div>
                    )}
                  </div>
                </div>
              </section>

              {/* Location / Coordinates Card */}
              <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm border-b border-slate-100 pb-3">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <span>พิกัดจุดชำรุด</span>
                </div>

                {hasCoords && mapsUrl ? (
                  <div className="space-y-3 text-xs">
                    <div className="font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 tabular-nums">
                      {request.locationLat}, {request.locationLng}
                    </div>
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold transition whitespace-nowrap"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>เปิดตำแหน่งบน Google Maps</span>
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    ยังไม่ได้ระบุพิกัด GPS สามารถกดแก้ไขคำร้องเพื่อวางพิกัดจาก Google Maps ได้
                  </p>
                )}
              </section>

              {/* Metadata Footer Info */}
              <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5 text-[11px] text-slate-500 tabular-nums">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>บันทึกเข้าระบบ: {formatThaiDate(request.createdAt)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>อัปเดตล่าสุด: {formatThaiDate(request.updatedAt)}</span>
                </div>
              </section>
            </div>
          </div>

          {/* Attachments & Before/During/After Photos */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                <Camera className="w-4 h-4 text-emerald-600" />
                <span>
                  เอกสารใบคำร้องและภาพถ่าย ก่อน – ระหว่าง – หลังซ่อม (
                  {(request.attachments || []).length} รายการ)
                </span>
              </div>
              {canModify && (
                <button
                  type="button"
                  onClick={() => onEdit(request, 2)}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold whitespace-nowrap shrink-0 no-print"
                >
                  + เพิ่มภาพ / แนบลิงก์
                </button>
              )}
            </div>

            {attachmentsByStage.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                ยังไม่มีไฟล์สแกนใบคำร้องหรือภาพถ่ายประกอบ สามารถแนบไฟล์หรือวางลิงก์ Google Drive ได้ในหน้าอัปเดตผลซ่อม
              </div>
            ) : (
              <div className="space-y-5">
                {attachmentsByStage.map(group => (
                  <div key={group.stage} className="space-y-2.5">
                    <h4 className="text-xs font-bold text-slate-700">
                      {group.label} ({group.items.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {group.items.map(att => {
                        const imgUrl = getRepairImageDisplayUrl(att);
                        const isImage =
                          Boolean(att.previewDataUrl) ||
                          att.type.startsWith('image/') ||
                          /\.(jpg|jpeg|png|webp|gif)$/i.test(att.name);
                        const showThumb = Boolean(imgUrl && isImage && !failedImages[att.id]);

                        return (
                          <div
                            key={att.id}
                            className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 flex flex-col"
                          >
                            {showThumb ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewImage({
                                    src: imgUrl,
                                    title: att.name,
                                    stageLabel: group.label,
                                    url: att.url
                                  })
                                }
                                className="relative h-40 w-full bg-slate-100 overflow-hidden group text-left"
                              >
                                <img
                                  src={imgUrl}
                                  alt={`${group.label} - ${att.name}`}
                                  referrerPolicy="no-referrer"
                                  onError={() =>
                                    setFailedImages(prev => ({ ...prev, [att.id]: true }))
                                  }
                                  className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                                />
                              </button>
                            ) : (
                              <div className="h-24 w-full bg-slate-100 flex items-center justify-center text-slate-400">
                                <ImageIcon className="w-6 h-6" />
                              </div>
                            )}

                            <div className="p-2.5 bg-white border-t border-slate-200 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div
                                  className="text-xs font-semibold text-slate-800 truncate"
                                  title={att.name}
                                >
                                  {att.name}
                                </div>
                                <div className="text-[11px] text-slate-400 tabular-nums">
                                  {formatThaiDate(att.uploadDate)}
                                </div>
                              </div>
                              {att.url && (
                                <a
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-100 text-[11px] font-medium text-slate-700 whitespace-nowrap shrink-0"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>เปิดไฟล์</span>
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Lightbox Image Preview */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/85 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="max-w-4xl w-full bg-white rounded-xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-emerald-300 font-medium">{previewImage.stageLabel}</div>
                <div className="text-sm font-semibold truncate">{previewImage.title}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {previewImage.url && (
                  <a
                    href={previewImage.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>ต้นฉบับ</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="bg-slate-950 flex items-center justify-center max-h-[75vh] overflow-auto">
              <img
                src={previewImage.src}
                alt={previewImage.title}
                referrerPolicy="no-referrer"
                className="max-h-[75vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
