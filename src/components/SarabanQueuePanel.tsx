import React, { useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  Paperclip,
  Code2,
  Copy,
  Check,
  X,
  ArrowRight,
  AlertCircle,
  FileCheck2,
  Clock,
  Trash2
} from 'lucide-react';
import {
  Project,
  SarabanQueueItem,
  SarabanQueueStatus,
  UserProfile
} from '../types/project';
import {
  DEFAULT_INSPECTION_DETAILS_BY_RESULT,
  DEFAULT_REMUNERATION_TITLES,
  SARABAN_DOC_CATEGORY_META,
  SARABAN_GAS_ADDON_SNIPPET,
  SarabanReviewOverrides,
  applySarabanQueueToProject,
  buildDefaultReviewOverrides
} from '../utils/sarabanSync';
import { formatCurrency, formatThaiDate, formatThaiDateTime } from '../utils/thaiDate';
import { STATUS_LABELS } from '../utils/excelExport';

interface SarabanQueuePanelProps {
  projects: Project[];
  queueItems: SarabanQueueItem[];
  isLoading: boolean;
  needsScriptUpdate: boolean;
  errorMessage?: string | null;
  currentUser: UserProfile;
  onRefreshQueue: () => void;
  onApproveItem: (
    item: SarabanQueueItem,
    mergedProject: Project
  ) => Promise<{ success: boolean; error?: string }>;
  onRejectItem: (
    item: SarabanQueueItem,
    reason: string
  ) => Promise<{ success: boolean; error?: string }>;
  onDeleteItem: (
    item: SarabanQueueItem,
    rollbackProject?: Project
  ) => Promise<{ success: boolean; error?: string }>;
  onSelectProject: (p: Project, tab?: number) => void;
}

export const SarabanQueuePanel: React.FC<SarabanQueuePanelProps> = ({
  projects,
  queueItems,
  isLoading,
  needsScriptUpdate,
  errorMessage,
  currentUser,
  onRefreshQueue,
  onApproveItem,
  onRejectItem,
  onDeleteItem,
  onSelectProject
}) => {
  const [statusFilter, setStatusFilter] = useState<SarabanQueueStatus | 'all'>('pending');
  const [reviewingItem, setReviewingItem] = useState<SarabanQueueItem | null>(null);
  const [overrides, setOverrides] = useState<SarabanReviewOverrides | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showGasModal, setShowGasModal] = useState(false);
  const [copiedGas, setCopiedGas] = useState(false);

  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    queueItems.forEach(item => {
      if (item.queueStatus === 'pending') pending++;
      else if (item.queueStatus === 'approved') approved++;
      else if (item.queueStatus === 'rejected') rejected++;
    });
    return { pending, approved, rejected, all: queueItems.length };
  }, [queueItems]);

  const filteredItems = useMemo(() => {
    if (statusFilter === 'all') return queueItems;
    return queueItems.filter(i => i.queueStatus === statusFilter);
  }, [queueItems, statusFilter]);

  const findMatchedProject = (item: SarabanQueueItem): Project | undefined => {
    if (item.projectId) {
      const byId = projects.find(p => String(p.id) === String(item.projectId));
      if (byId) return byId;
    }
    if (item.projectCode) {
      const normalized = item.projectCode.trim().toLowerCase();
      return projects.find(p => p.projectCode && p.projectCode.trim().toLowerCase() === normalized);
    }
    return undefined;
  };

  const openReviewModal = (item: SarabanQueueItem) => {
    const matched = findMatchedProject(item);
    setReviewingItem(item);
    setOverrides(buildDefaultReviewOverrides(item, matched?.id || ''));
  };

  const closeReviewModal = () => {
    if (isSubmitting) return;
    setReviewingItem(null);
    setOverrides(null);
  };

  const previewTargetProject = useMemo(() => {
    if (!overrides?.targetProjectId) return undefined;
    return projects.find(p => String(p.id) === String(overrides.targetProjectId));
  }, [projects, overrides?.targetProjectId]);

  const previewMergedProject = useMemo(() => {
    if (!reviewingItem || !previewTargetProject || !overrides) return null;
    return applySarabanQueueToProject(previewTargetProject, reviewingItem, overrides);
  }, [reviewingItem, previewTargetProject, overrides]);

  const handleConfirmApprove = async () => {
    if (!reviewingItem || !previewMergedProject) {
      Swal.fire('กรุณาเลือกโครงการ', 'ไม่พบโครงการเป้าหมาย กรุณาเลือกโครงการก่อนยืนยันรับเข้า', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onApproveItem(reviewingItem, previewMergedProject);
      if (res.success) {
        setReviewingItem(null);
        setOverrides(null);
        Swal.fire({
          icon: 'success',
          title: 'รับข้อมูลเข้าโครงการสำเร็จ',
          text: `อัปเดตโครงการ "${previewMergedProject.name}" เรียบร้อยแล้ว`,
          timer: 1800,
          showConfirmButton: false
        });
      } else {
        Swal.fire('ไม่สามารถยืนยันคิวได้', res.error || 'เกิดข้อผิดพลาดในการเชื่อมต่อ Google Sheet', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (item: SarabanQueueItem) => {
    const result = await Swal.fire({
      title: 'ปฏิเสธรายการจากสารบรรณ',
      text: `รายการ ${item.queueId} (${item.bookNo || item.subject})`,
      input: 'text',
      inputLabel: 'ระบุเหตุผลการปฏิเสธ / ส่งกลับแก้ไข',
      inputPlaceholder: 'เช่น เลือกโครงการหรือหมวดเอกสารไม่ถูกต้อง...',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันปฏิเสธ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#e11d48',
      inputValidator: value => {
        if (!value || !value.trim()) {
          return 'กรุณาระบุเหตุผลเพื่อให้ระบบสารบรรณทราบ';
        }
        return null;
      }
    });

    if (result.isConfirmed && result.value) {
      const res = await onRejectItem(item, String(result.value).trim());
      if (res.success) {
        Swal.fire({
          icon: 'info',
          title: 'ปฏิเสธรายการแล้ว',
          text: `บันทึกสถานะปฏิเสธสำหรับ ${item.queueId} เรียบร้อยแล้ว`,
          timer: 1600,
          showConfirmButton: false
        });
      } else {
        Swal.fire('เกิดข้อผิดพลาด', res.error || 'ไม่สามารถปฏิเสธรายการได้', 'error');
      }
    }
  };

  const handleDelete = async (item: SarabanQueueItem, matchedProject?: Project) => {
    const isApproved = item.queueStatus === 'approved';
    const result = await Swal.fire({
      title: isApproved ? 'ลบคิวและถอนข้อมูลที่รับเข้าแล้ว?' : 'ลบรายการคิวนี้?',
      text: isApproved
        ? `รายการ ${item.queueId} ถูกกดรับเข้าโครงการแล้ว ระบบจะลบแถวคิวนี้ออกจากชีตและถอนข้อมูล/ไฟล์แนบจากคิวนี้ในโครงการ${
            matchedProject ? ` "${matchedProject.projectCode}"` : ''
          } ออกให้ด้วย`
        : `ต้องการลบรายการ ${item.queueId} (${item.bookNo || item.subject}) ออกจากคิวสารบรรณใช่หรือไม่`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันลบคิว',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#e11d48'
    });

    if (!result.isConfirmed) return;

    const res = await onDeleteItem(item, isApproved ? matchedProject : undefined);
    if (res.success) {
      Swal.fire({
        icon: 'success',
        title: 'ลบคิวเรียบร้อยแล้ว',
        text: isApproved
          ? `ลบคิว ${item.queueId} และปรับปรุงข้อมูลโครงการเรียบร้อยแล้ว`
          : `ลบรายการคิว ${item.queueId} เรียบร้อยแล้ว`,
        timer: 1600,
        showConfirmButton: false
      });
    } else {
      Swal.fire('ลบคิวไม่สำเร็จ', res.error || 'เกิดข้อผิดพลาดในการเชื่อมต่อ Google Sheet', 'error');
    }
  };

  const handleCopyGasSnippet = async () => {
    try {
      await navigator.clipboard.writeText(SARABAN_GAS_ADDON_SNIPPET);
      setCopiedGas(true);
      setTimeout(() => setCopiedGas(false), 2000);
    } catch {
      Swal.fire('คัดลอกไม่สำเร็จ', 'กรุณาเลือกคัดลอกโค้ดด้วยตนเองจากช่องข้อความ', 'info');
    }
  };

  const sortedProjects = useMemo(
    () =>
      [...projects].sort((a, b) => {
        if (b.fiscalYear !== a.fiscalYear) return b.fiscalYear - a.fiscalYear;
        return (a.projectCode || '').localeCompare(b.projectCode || '', 'th');
      }),
    [projects]
  );

  return (
    <div className="space-y-4">
      {/* Toolbar: Status Filters & Utility Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          {(
            [
              { key: 'pending', label: `รอตรวจสอบ (${counts.pending})` },
              { key: 'approved', label: `รับเข้าแล้ว (${counts.approved})` },
              { key: 'rejected', label: `ปฏิเสธ (${counts.rejected})` },
              { key: 'all', label: `ทั้งหมด (${counts.all})` }
            ] as const
          ).map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                statusFilter === tab.key
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGasModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition whitespace-nowrap shrink-0"
          >
            <Code2 className="w-3.5 h-3.5 text-slate-500" />
            <span>โค้ด Apps Script เชื่อมต่อ</span>
          </button>

          <button
            type="button"
            onClick={onRefreshQueue}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold transition whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'กำลังดึงคิว...' : 'รีเฟรชคิว'}</span>
          </button>
        </div>
      </div>

      {/* Warning when GAS hasn't been updated yet */}
      {needsScriptUpdate && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Google Apps Script ยังไม่ได้ติดตั้งฟังก์ชันรับคิวจากสารบรรณ</div>
              <p className="text-amber-800 mt-0.5 leading-relaxed">
                ปลายทางตอบกลับว่ายังไม่รู้จัก <span className="font-mono">getSarabanQueue</span> — กรุณานำโค้ดส่วนเสริมไปวางใน{' '}
                <span className="font-mono">Code.gs</span> แล้วกด Deploy เวอร์ชันใหม่
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowGasModal(true)}
            className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition whitespace-nowrap shrink-0"
          >
            ดูโค้ด Apps Script
          </button>
        </div>
      )}

      {!needsScriptUpdate && errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Queue Items List */}
      {isLoading && queueItems.length === 0 ? (
        <div className="space-y-3 py-2">
          {[1, 2, 3].map(n => (
            <div key={n} className="h-24 rounded-xl bg-slate-100 animate-pulse border border-slate-200/70" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-12 px-4 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
          <FileCheck2 className="w-9 h-9 text-emerald-500 mx-auto mb-2.5" />
          <p className="text-sm font-semibold text-slate-800">
            {statusFilter === 'pending'
              ? 'ไม่มีรายการรอรับเข้าจากระบบสารบรรณในขณะนี้'
              : 'ไม่พบรายการในหมวดสถานะที่เลือก'}
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            เมื่อมีการออกหนังสือหรือบันทึกข้อความจากระบบสารบรรณและกดส่งซิงค์เข้ามา รายการจะปรากฏที่นี่เพื่อรอตรวจสอบและรับเข้าโครงการ
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white overflow-hidden">
          {filteredItems.map(item => {
            const meta = SARABAN_DOC_CATEGORY_META[item.docCategory] || SARABAN_DOC_CATEGORY_META.other;
            const matchedProject = findMatchedProject(item);

            return (
              <div
                key={item.queueId}
                className="p-4 hover:bg-slate-50/70 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                {/* Left Content */}
                <div className="space-y-1.5 min-w-0 flex-1">
                  {/* Quiet Metadata Line */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 tabular-nums">
                    <span className="font-mono font-semibold text-slate-700">{item.queueId}</span>
                    <span aria-hidden="true">·</span>
                    <span>{meta.label}</span>
                    {meta.stepNo && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>ขั้นตอนที่ {meta.stepNo}/12</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>ส่งโดย {item.submittedBy || '-'}</span>
                    {item.createdAt && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{formatThaiDateTime(item.createdAt)}</span>
                      </>
                    )}
                  </div>

                  {/* Subject / Primary Headline */}
                  <div className="text-sm font-semibold text-slate-900 leading-snug">
                    {item.subject || meta.label}
                  </div>

                  {/* Book No, Date & Target Project */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                    <span>
                      เลขที่หนังสือ:{' '}
                      <strong className="font-mono text-slate-800">{item.bookNo || '-'}</strong>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="tabular-nums">
                      ลงวันที่: <strong className="text-slate-800">{formatThaiDate(item.bookDate)}</strong>
                    </span>
                    <span className="text-slate-300">|</span>
                    {matchedProject ? (
                      <button
                        type="button"
                        onClick={() => onSelectProject(matchedProject, meta.detailTab)}
                        className="text-emerald-700 hover:text-emerald-800 hover:underline font-medium text-left truncate max-w-md"
                      >
                        {matchedProject.projectCode} · {matchedProject.name}
                      </button>
                    ) : (
                      <span className="text-amber-700 font-medium">
                        รหัส {item.projectCode || item.projectId || '-'} (รอเลือกจับคู่โครงการ)
                      </span>
                    )}
                  </div>

                  {/* Status Note for Approved / Rejected */}
                  {item.queueStatus === 'approved' && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 pt-0.5 tabular-nums">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        รับเข้าโครงการแล้วโดย {item.reviewedBy || '-'}
                        {item.reviewedAt ? ` · ${formatThaiDateTime(item.reviewedAt)}` : ''}
                      </span>
                    </div>
                  )}

                  {item.queueStatus === 'rejected' && (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-rose-700 pt-0.5 tabular-nums">
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        ปฏิเสธโดย {item.reviewedBy || '-'}
                        {item.rejectReason ? ` · เหตุผล: ${item.rejectReason}` : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* Right Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {item.fileUrl ? (
                    <a
                      href={item.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition whitespace-nowrap shrink-0"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                      <span className="max-w-[140px] truncate">{item.fileName || 'เปิดดูไฟล์แนบ'}</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400 px-2">ไม่มีไฟล์แนบ</span>
                  )}

                  {item.queueStatus === 'pending' && currentUser.role === 'admin' && (
                    <>
                      <button
                        type="button"
                        onClick={() => openReviewModal(item)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition whitespace-nowrap shrink-0"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>ตรวจสอบ & รับเข้า</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleReject(item)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-600 text-xs font-medium transition whitespace-nowrap shrink-0"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>ปฏิเสธ</span>
                      </button>
                    </>
                  )}

                  {currentUser.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => handleDelete(item, matchedProject)}
                      title="ลบรายการคิวนี้"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-500 text-xs font-medium transition whitespace-nowrap shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ลบคิว</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review & Confirm Modal */}
      {reviewingItem && overrides && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  ตรวจสอบข้อมูลก่อนรับเข้าโครงการ
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  รหัสคิว {reviewingItem.queueId} ·{' '}
                  {SARABAN_DOC_CATEGORY_META[reviewingItem.docCategory]?.label || reviewingItem.docCategory}
                </p>
              </div>
              <button
                type="button"
                onClick={closeReviewModal}
                disabled={isSubmitting}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Target Project Selector */}
              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-700">
                  โครงการเป้าหมายในระบบงานโครงการ
                </label>
                <select
                  value={overrides.targetProjectId}
                  onChange={e =>
                    setOverrides(prev => (prev ? { ...prev, targetProjectId: e.target.value } : prev))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- กรุณาเลือกโครงการ --</option>
                  {sortedProjects.map(p => (
                    <option key={p.id} value={p.id}>
                      [{p.projectCode}] {p.name} (ปี {p.fiscalYear})
                    </option>
                  ))}
                </select>
              </div>

              {/* Common Book No & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">
                    {reviewingItem.docCategory === 'disbursement' || reviewingItem.docCategory === 'remuneration'
                      ? 'เลขที่ฎีกา / เอกสาร'
                      : reviewingItem.docCategory === 'contract'
                      ? 'เลขที่สัญญาจ้าง'
                      : 'เลขที่หนังสือ / คำสั่ง'}
                  </label>
                  <input
                    type="text"
                    value={overrides.bookNo}
                    onChange={e =>
                      setOverrides(prev => (prev ? { ...prev, bookNo: e.target.value } : prev))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">
                    วันที่เอกสาร ({formatThaiDate(overrides.bookDate)})
                  </label>
                  <input
                    type="date"
                    value={overrides.bookDate}
                    onChange={e => {
                      const nextBookDate = e.target.value;
                      setOverrides(prev => {
                        if (!prev) return prev;
                        const shouldSyncDelivery =
                          reviewingItem.docCategory === 'delivery' &&
                          (!prev.actualDeliveryDate || prev.actualDeliveryDate === prev.bookDate);
                        return {
                          ...prev,
                          bookDate: nextBookDate,
                          ...(shouldSyncDelivery ? { actualDeliveryDate: nextBookDate } : {})
                        };
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Category-Specific Editable Fields */}
              {reviewingItem.docCategory === 'tor_approval' && (
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">ผู้จัดทำ TOR</label>
                  <input
                    type="text"
                    value={overrides.torAuthor}
                    onChange={e =>
                      setOverrides(prev => (prev ? { ...prev, torAuthor: e.target.value } : prev))
                    }
                    placeholder="ระบุชื่อผู้จัดทำ TOR"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-xs"
                  />
                </div>
              )}

              {reviewingItem.docCategory === 'ref_price' && (
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">วงเงินราคากลาง (บาท)</label>
                  <input
                    type="number"
                    value={overrides.refPrice}
                    onChange={e =>
                      setOverrides(prev => (prev ? { ...prev, refPrice: e.target.value } : prev))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-xs tabular-nums"
                  />
                </div>
              )}

              {reviewingItem.docCategory === 'inspect_order' && (
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">ผู้ควบคุมงาน</label>
                  <input
                    type="text"
                    value={overrides.supervisorName}
                    onChange={e =>
                      setOverrides(prev => (prev ? { ...prev, supervisorName: e.target.value } : prev))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-xs"
                  />
                </div>
              )}

              {reviewingItem.docCategory === 'contract' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block font-semibold text-slate-700">วงเงินตามสัญญา (บาท)</label>
                    <input
                      type="number"
                      value={overrides.contractAmount}
                      onChange={e =>
                        setOverrides(prev => (prev ? { ...prev, contractAmount: e.target.value } : prev))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-xs tabular-nums"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-semibold text-slate-700">ชื่อผู้รับจ้าง / คู่สัญญา</label>
                    <input
                      type="text"
                      value={overrides.contractorName}
                      onChange={e =>
                        setOverrides(prev => (prev ? { ...prev, contractorName: e.target.value } : prev))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-semibold text-slate-700">
                      วันเริ่มต้นสัญญา ({formatThaiDate(overrides.startDate)})
                    </label>
                    <input
                      type="date"
                      value={overrides.startDate}
                      onChange={e =>
                        setOverrides(prev => (prev ? { ...prev, startDate: e.target.value } : prev))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-xs tabular-nums"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-semibold text-slate-700">
                      วันสิ้นสุดสัญญา ({formatThaiDate(overrides.endDate)})
                    </label>
                    <input
                      type="date"
                      value={overrides.endDate}
                      onChange={e =>
                        setOverrides(prev => (prev ? { ...prev, endDate: e.target.value } : prev))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-xs tabular-nums"
                    />
                  </div>
                </div>
              )}

              {reviewingItem.docCategory === 'work_notice' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block font-semibold text-slate-700">
                      วันเข้าทำงานจริง (เว้นว่างได้หากยังไม่เข้า)
                    </label>
                    <input
                      type="date"
                      value={overrides.actualWorkDate}
                      onChange={e =>
                        setOverrides(prev => (prev ? { ...prev, actualWorkDate: e.target.value } : prev))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-xs tabular-nums"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-semibold text-slate-700">หมายเหตุ</label>
                    <input
                      type="text"
                      value={overrides.details}
                      placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)..."
                      onChange={e =>
                        setOverrides(prev => (prev ? { ...prev, details: e.target.value } : prev))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-xs"
                    />
                  </div>
                </div>
              )}

              {reviewingItem.docCategory === 'delivery' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block font-semibold text-slate-700">งวดที่ส่งมอบ</label>
                    <input
                      type="number"
                      min={1}
                      value={overrides.installment}
                      onChange={e =>
                        setOverrides(prev =>
                          prev ? { ...prev, installment: Math.max(1, Number(e.target.value) || 1) } : prev
                        )
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-xs tabular-nums"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-semibold text-slate-700">
                      วันส่งมอบจริง ({formatThaiDate(overrides.actualDeliveryDate)})
                    </label>
                    <input
                      type="date"
                      value={overrides.actualDeliveryDate}
                      onChange={e =>
                        setOverrides(prev =>
                          prev ? { ...prev, actualDeliveryDate: e.target.value } : prev
                        )
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-xs tabular-nums"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="block font-semibold text-slate-700">รายละเอียดการส่งมอบ</label>
                    <input
                      type="text"
                      value={overrides.details}
                      onChange={e =>
                        setOverrides(prev => (prev ? { ...prev, details: e.target.value } : prev))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-xs"
                    />
                  </div>
                </div>
              )}

              {reviewingItem.docCategory === 'inspection' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block font-semibold text-slate-700">งวดที่ตรวจรับ</label>
                    <input
                      type="number"
                      min={1}
                      value={overrides.installment}
                      onChange={e =>
                        setOverrides(prev =>
                          prev ? { ...prev, installment: Math.max(1, Number(e.target.value) || 1) } : prev
                        )
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-xs tabular-nums"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-semibold text-slate-700">ผลการตรวจรับ</label>
                    <select
                      value={overrides.inspectionResult}
                      onChange={e => {
                        const nextResult = e.target.value as 'pass' | 'fail' | 'need_revision';
                        const knownDefaults = Object.values(DEFAULT_INSPECTION_DETAILS_BY_RESULT);
                        setOverrides(prev => {
                          if (!prev) return prev;
                          const shouldUpdateDetails =
                            !prev.details.trim() || knownDefaults.includes(prev.details.trim());
                          return {
                            ...prev,
                            inspectionResult: nextResult,
                            details: shouldUpdateDetails
                              ? DEFAULT_INSPECTION_DETAILS_BY_RESULT[nextResult]
                              : prev.details
                          };
                        });
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs"
                    >
                      <option value="pass">ตรวจรับผ่านถูกต้อง (pass)</option>
                      <option value="need_revision">ให้แก้ไขเพิ่มเติม (need_revision)</option>
                      <option value="fail">ไม่ผ่านการตรวจรับ (fail)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="block font-semibold text-slate-700">รายละเอียดผลการตรวจรับ</label>
                    <input
                      type="text"
                      value={overrides.details}
                      onChange={e =>
                        setOverrides(prev => (prev ? { ...prev, details: e.target.value } : prev))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-xs"
                    />
                  </div>
                </div>
              )}

              {reviewingItem.docCategory === 'disbursement' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block font-semibold text-slate-700">งวดที่เบิกจ่าย</label>
                    <input
                      type="number"
                      min={1}
                      value={overrides.installment}
                      onChange={e =>
                        setOverrides(prev =>
                          prev ? { ...prev, installment: Math.max(1, Number(e.target.value) || 1) } : prev
                        )
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-xs tabular-nums"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-semibold text-slate-700">จำนวนเงิน (บาท)</label>
                    <input
                      type="number"
                      value={overrides.amount}
                      onChange={e =>
                        setOverrides(prev => (prev ? { ...prev, amount: e.target.value } : prev))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-xs tabular-nums"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-semibold text-slate-700">สถานะฎีกา</label>
                    <select
                      value={overrides.paymentStatus}
                      onChange={e =>
                        setOverrides(prev =>
                          prev ? { ...prev, paymentStatus: e.target.value as 'pending' | 'paid' } : prev
                        )
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs"
                    >
                      <option value="pending">รอดำเนินการเบิกจ่าย</option>
                      <option value="paid">เบิกจ่ายเงินเรียบร้อยแล้ว</option>
                    </select>
                  </div>
                </div>
              )}

              {reviewingItem.docCategory === 'remuneration' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block font-semibold text-slate-700">ประเภทค่าตอบแทน</label>
                    <select
                      value={overrides.remunerationType}
                      onChange={e => {
                        const nextType = e.target.value as
                          | 'tor_author'
                          | 'tor'
                          | 'supervisor'
                          | 'inspection';
                        const knownTitles = Object.values(DEFAULT_REMUNERATION_TITLES);
                        setOverrides(prev => {
                          if (!prev) return prev;
                          const shouldUpdateTitle =
                            !prev.remunerationTitle.trim() ||
                            knownTitles.includes(prev.remunerationTitle.trim());
                          return {
                            ...prev,
                            remunerationType: nextType,
                            remunerationTitle: shouldUpdateTitle
                              ? DEFAULT_REMUNERATION_TITLES[nextType]
                              : prev.remunerationTitle
                          };
                        });
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs"
                    >
                      <option value="tor_author">ค่าตอบแทนผู้จัดทำ TOR</option>
                      <option value="tor">ค่าตอบแทน กก. ราคากลาง/TOR</option>
                      <option value="supervisor">ค่าตอบแทนผู้ควบคุมงาน</option>
                      <option value="inspection">ค่าตอบแทน กก. ตรวจรับงาน</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block font-semibold text-slate-700">ผู้รับเงิน</label>
                    <input
                      type="text"
                      value={overrides.payeeName}
                      onChange={e =>
                        setOverrides(prev => (prev ? { ...prev, payeeName: e.target.value } : prev))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-semibold text-slate-700">จำนวนเงิน (บาท)</label>
                    <input
                      type="number"
                      value={overrides.amount}
                      onChange={e =>
                        setOverrides(prev => (prev ? { ...prev, amount: e.target.value } : prev))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-xs tabular-nums"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-semibold text-slate-700">สถานะการเบิก</label>
                    <select
                      value={overrides.paymentStatus}
                      onChange={e =>
                        setOverrides(prev =>
                          prev ? { ...prev, paymentStatus: e.target.value as 'pending' | 'paid' } : prev
                        )
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs"
                    >
                      <option value="pending">รอเบิกจ่าย</option>
                      <option value="paid">เบิกจ่ายแล้ว</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="block font-semibold text-slate-700">รายการค่าตอบแทน</label>
                    <input
                      type="text"
                      value={overrides.remunerationTitle}
                      onChange={e =>
                        setOverrides(prev =>
                          prev ? { ...prev, remunerationTitle: e.target.value } : prev
                        )
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Attachment Summary */}
              {reviewingItem.fileUrl && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 truncate">
                        {reviewingItem.fileName || 'ไฟล์แนบจากสารบรรณ'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        จะบันทึกแนบในหมวด{' '}
                        <span className="font-mono">
                          {SARABAN_DOC_CATEGORY_META[reviewingItem.docCategory]?.attachmentCategory || 'other'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <a
                    href={reviewingItem.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium whitespace-nowrap shrink-0"
                  >
                    <span>เปิดไฟล์</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Outcome Preview */}
              {previewTargetProject && previewMergedProject && (
                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
                  <div className="font-bold text-emerald-900">ผลลัพธ์หลังกดยืนยันรับเข้าโครงการ</div>
                  <div className="flex flex-wrap items-center gap-2 text-emerald-950 tabular-nums">
                    <span>สถานะ:</span>
                    <span className="font-medium text-slate-600">
                      {STATUS_LABELS[previewTargetProject.status] || previewTargetProject.status}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-bold text-emerald-800">
                      {STATUS_LABELS[previewMergedProject.status] || previewMergedProject.status}
                    </span>
                    <span className="text-slate-300">|</span>
                    <span>
                      ความคืบหน้า: <strong>{previewTargetProject.progressPercent}%</strong> →{' '}
                      <strong className="text-emerald-800">{previewMergedProject.progressPercent}%</strong>
                    </span>
                  </div>
                  {overrides.amount && Number(overrides.amount) > 0 && (
                    <div className="text-emerald-900 tabular-nums">
                      ยอดเงินบันทึก: <strong>{formatCurrency(Number(overrides.amount))}</strong> บาท
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={closeReviewModal}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmApprove}
                disabled={isSubmitting || !previewMergedProject}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition"
              >
                {isSubmitting ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>ยืนยันรับเข้าโครงการ</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apps Script Add-on Modal */}
      {showGasModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[88vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  โค้ดส่วนเสริม Google Apps Script (สำหรับเชื่อมต่อระบบสารบรรณ)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  นำไปวางต่อท้ายไฟล์ Code.gs เดิม แล้วเพิ่มเงื่อนไขใน doGet / doPost จากนั้น Deploy เป็นเวอร์ชันใหม่
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGasModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-700">
                  รองรับครบทั้ง 4 Endpoint: getProjectOptions, pushSarabanQueue, getSarabanQueue, resolveSarabanQueue
                </span>
                <button
                  type="button"
                  onClick={handleCopyGasSnippet}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition whitespace-nowrap shrink-0"
                >
                  {copiedGas ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedGas ? 'คัดลอกโค้ดแล้ว' : 'คัดลอกโค้ดทั้งหมด'}</span>
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[55vh] select-all">
                {SARABAN_GAS_ADDON_SNIPPET}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
