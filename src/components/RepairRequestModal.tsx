import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import {
  X,
  Save,
  FileText,
  Wrench,
  MapPin,
  ExternalLink,
  Upload,
  Link2,
  Trash2,
  AlertCircle,
  Camera
} from 'lucide-react';
import {
  FISCAL_YEARS,
  RAI_TAI_PERSONNEL,
  RepairAttachment,
  RepairChannel,
  RepairRequest,
  RepairRequestStatus,
  RepairRoadType,
  RepairUrgency
} from '../types/project';
import { AutoSuggestInput } from './AutoSuggestInput';
import { uploadFileToDrive } from '../services/storage';
import { createImagePreviewDataUrl } from './ProjectRecordsView';
import { getCurrentThaiFiscalYear } from '../utils/thaiDate';
import {
  REPAIR_ATTACHMENT_STAGE_LABELS,
  REPAIR_CHANNEL_LABELS,
  REPAIR_METHOD_PRESETS,
  REPAIR_ROAD_TYPE_LABELS,
  REPAIR_STATUS_META,
  REPAIR_URGENCY_META,
  extractRoadFromSubject,
  generateNextRepairCode,
  getRepairImageDisplayUrl
} from '../utils/repairHelpers';

interface RepairRequestModalProps {
  isOpen: boolean;
  initialRequest?: RepairRequest | null;
  initialTab?: 1 | 2;
  existingRequests: RepairRequest[];
  onClose: () => void;
  onSave: (request: RepairRequest) => void;
}

function tryParseCombinedCoords(raw: string): { lat: string; lng: string } | null {
  const cleaned = raw.trim();
  const match = cleaned.match(/(-?\d{1,2}\.\d+)\s*[,;\s]+\s*(-?\d{1,3}\.\d+)/);
  if (!match) return null;
  return { lat: match[1], lng: match[2] };
}

export const RepairRequestModal: React.FC<RepairRequestModalProps> = ({
  isOpen,
  initialRequest,
  initialTab = 1,
  existingRequests,
  onClose,
  onSave
}) => {
  const [activeTab, setActiveTab] = useState<1 | 2>(initialTab);
  const [hasManualCodeEdit, setHasManualCodeEdit] = useState(false);
  const [hasManualRoadEdit, setHasManualRoadEdit] = useState(false);

  // Inline Google Drive link state
  const [showDriveLinkForm, setShowDriveLinkForm] = useState(false);
  const [driveLinkName, setDriveLinkName] = useState('');
  const [driveLinkUrl, setDriveLinkUrl] = useState('');
  const [driveLinkStage, setDriveLinkStage] = useState<RepairAttachment['stage']>('petition');
  const [driveLinkError, setDriveLinkError] = useState<string | null>(null);
  const [uploadStage, setUploadStage] = useState<RepairAttachment['stage']>('before');

  const todayIso = new Date().toISOString().split('T')[0];

  const createEmptyRequest = (): RepairRequest => {
    const defaultYear = getCurrentThaiFiscalYear();
    return {
      id: `rep-${Date.now()}`,
      requestCode: generateNextRepairCode(defaultYear, existingRequests),
      fiscalYear: defaultYear,
      obtReceiveNo: '',
      obtReceiveDate: todayIso,
      engReceiveNo: '',
      engReceiveDate: todayIso,
      channel: 'walk_in',
      petitionDate: todayIso,
      subject: '',
      roadName: '',
      villageNo: '',
      roadType: 'gravel',
      requesterName: '',
      requesterPhone: '',
      problemDetails: '',
      submittedEvidenceNote: 'รูปถ่าย จำนวน 1 ชุด',
      urgency: 'normal',
      locationLat: '',
      locationLng: '',
      status: 'received',
      assignedStaff: 'กองช่าง อบต.ไร่ใต้',
      inspectionDate: '',
      inspectionSummary: '',
      repairMethod: '',
      repairDetails: '',
      repairStartDate: '',
      repairCompletedDate: '',
      repairCost: 0,
      resolutionNote: '',
      attachments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  };

  const [formData, setFormData] = useState<RepairRequest>(() =>
    initialRequest ? JSON.parse(JSON.stringify(initialRequest)) : createEmptyRequest()
  );

  useEffect(() => {
    if (!isOpen) return;
    if (initialRequest) {
      setFormData(JSON.parse(JSON.stringify(initialRequest)));
      setHasManualCodeEdit(true);
      setHasManualRoadEdit(Boolean(initialRequest.roadName));
    } else {
      setFormData(createEmptyRequest());
      setHasManualCodeEdit(false);
      setHasManualRoadEdit(false);
    }
    setActiveTab(initialTab);
    setShowDriveLinkForm(false);
    setDriveLinkName('');
    setDriveLinkUrl('');
    setDriveLinkError(null);
  }, [isOpen, initialRequest, initialTab]);

  const staffSuggestions = useMemo(() => {
    const set = new Set<string>(['กองช่าง อบต.ไร่ใต้']);
    RAI_TAI_PERSONNEL.forEach(p => set.add(p.name));
    existingRequests.forEach(r => {
      if (r.assignedStaff?.trim()) set.add(r.assignedStaff.trim());
    });
    return Array.from(set);
  }, [existingRequests]);

  const requesterSuggestions = useMemo(() => {
    const set = new Set<string>();
    existingRequests.forEach(r => {
      if (r.requesterName?.trim()) set.add(r.requesterName.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'));
  }, [existingRequests]);

  if (!isOpen) return null;

  const handleCoordInput = (field: 'locationLat' | 'locationLng', value: string) => {
    const parsed = tryParseCombinedCoords(value);
    if (parsed) {
      setFormData(prev => ({ ...prev, locationLat: parsed.lat, locationLng: parsed.lng }));
      return;
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Swal.fire({
      title: 'กำลังอัปโหลดไฟล์แนบ...',
      text: 'ระบบกำลังสร้างภาพตัวอย่างและอัปโหลดไปยัง Google Drive',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    const uploaded: RepairAttachment[] = [];
    for (const file of Array.from(files)) {
      try {
        const [previewDataUrl, driveRes] = await Promise.all([
          createImagePreviewDataUrl(file),
          uploadFileToDrive(file)
        ]);
        uploaded.push({
          id: `rep-att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          stage: uploadStage,
          caption: '',
          url: driveRes.fileUrl,
          previewDataUrl,
          uploadDate: new Date().toISOString().split('T')[0]
        });
      } catch (err) {
        console.error('Repair attachment upload error', err);
      }
    }

    setFormData(prev => ({
      ...prev,
      attachments: [...(prev.attachments || []), ...uploaded]
    }));

    e.target.value = '';
    Swal.fire({
      icon: 'success',
      title: 'อัปโหลดสำเร็จ',
      text: `เพิ่มไฟล์ประกอบจำนวน ${uploaded.length} รายการเรียบร้อยแล้ว`,
      timer: 1300,
      showConfirmButton: false
    });
  };

  const handleAddDriveLink = () => {
    const cleanName = driveLinkName.trim();
    const rawUrl = driveLinkUrl.trim();

    if (!cleanName) {
      setDriveLinkError('กรุณาระบุชื่อไฟล์ที่จะแสดงในระบบ');
      return;
    }
    if (!rawUrl) {
      setDriveLinkError('กรุณาวางลิงก์ URL ของไฟล์ใน Google Drive');
      return;
    }

    const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    try {
      const parsed = new URL(normalizedUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setDriveLinkError('รูปแบบ URL ไม่ถูกต้อง กรุณาใช้ลิงก์ที่ขึ้นต้นด้วย https://');
        return;
      }
    } catch {
      setDriveLinkError('รูปแบบ URL ไม่ถูกต้อง กรุณาตรวจสอบลิงก์อีกครั้ง');
      return;
    }

    const isImg = /\.(jpg|jpeg|png|webp|gif)$/i.test(cleanName);
    const newAtt: RepairAttachment = {
      id: `rep-link-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: cleanName,
      size: 0,
      type: isImg ? 'image/jpeg' : 'application/vnd.google-apps.file',
      stage: driveLinkStage,
      caption: '',
      url: normalizedUrl,
      uploadDate: new Date().toISOString().split('T')[0]
    };

    setFormData(prev => ({
      ...prev,
      attachments: [...(prev.attachments || []), newAtt]
    }));

    setDriveLinkName('');
    setDriveLinkUrl('');
    setDriveLinkError(null);
    setShowDriveLinkForm(false);
  };

  const handleRemoveAttachment = (attId: string) => {
    setFormData(prev => ({
      ...prev,
      attachments: (prev.attachments || []).filter(a => a.id !== attId)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject.trim()) {
      setActiveTab(1);
      Swal.fire({ icon: 'warning', title: 'กรุณากรอกเรื่องคำร้อง', timer: 1600, showConfirmButton: false });
      return;
    }
    if (!formData.requesterName.trim()) {
      setActiveTab(1);
      Swal.fire({ icon: 'warning', title: 'กรุณาระบุชื่อผู้ร้องทุกข์/ร้องเรียน', timer: 1600, showConfirmButton: false });
      return;
    }

    onSave({
      ...formData,
      requesterAge: undefined,
      requesterPosition: undefined,
      requesterAddress: undefined,
      officerNote: undefined,
      roadName: formData.roadName.trim() || extractRoadFromSubject(formData.subject) || formData.subject.trim(),
      updatedAt: new Date().toISOString()
    });
  };

  const hasCoords = Boolean(formData.locationLat?.trim() && formData.locationLng?.trim());
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${formData.locationLat!.trim()},${formData.locationLng!.trim()}`
      )}`
    : '';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-base font-bold font-heading truncate">
              {initialRequest ? 'แก้ไขคำร้องและบันทึกการซ่อมแซม' : 'บันทึกคำร้องทุกข์ / งานซ่อมแซมถนน'}
            </h3>
            <p className="text-xs text-slate-300 mt-0.5 tabular-nums">
              รหัสคำร้อง: <span className="font-mono text-emerald-300">{formData.requestCode}</span> · ปีงบประมาณ พ.ศ. {formData.fiscalYear}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Tab Navigation */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab(1)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap shrink-0 ${
              activeTab === 1
                ? 'bg-white text-emerald-800 border border-slate-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>1. ข้อมูลใบคำร้อง (รับเรื่อง)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab(2)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap shrink-0 ${
              activeTab === 2
                ? 'bg-white text-emerald-800 border border-slate-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>2. การตรวจสอบ ซ่อมแซม & ภาพถ่าย ({formData.attachments.length})</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 1 && (
            <div className="space-y-5">
              {/* Row 1: รหัสคำร้อง / ปีงบประมาณ / ความเร่งด่วน / ช่องทาง */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ปีงบประมาณ
                  </label>
                  <select
                    value={formData.fiscalYear}
                    onChange={e => {
                      const yr = Number(e.target.value);
                      const nextCode = !hasManualCodeEdit
                        ? generateNextRepairCode(yr, existingRequests, initialRequest?.id)
                        : formData.requestCode;
                      setFormData(prev => ({ ...prev, fiscalYear: yr, requestCode: nextCode }));
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    {FISCAL_YEARS.map(yr => (
                      <option key={yr} value={yr}>
                        พ.ศ. {yr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      รหัสคำร้อง
                    </label>
                    {hasManualCodeEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setHasManualCodeEdit(false);
                          setFormData(prev => ({
                            ...prev,
                            requestCode: generateNextRepairCode(
                              prev.fiscalYear,
                              existingRequests,
                              initialRequest?.id
                            )
                          }));
                        }}
                        className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
                      >
                        รันอัตโนมัติ
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={formData.requestCode}
                    onChange={e => {
                      setHasManualCodeEdit(true);
                      setFormData(prev => ({ ...prev, requestCode: e.target.value }));
                    }}
                    placeholder="เช่น ซ.69-001"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono tabular-nums focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ช่องทางการรับเรื่อง
                  </label>
                  <select
                    value={formData.channel}
                    onChange={e => setFormData(prev => ({ ...prev, channel: e.target.value as RepairChannel }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    {(Object.keys(REPAIR_CHANNEL_LABELS) as RepairChannel[]).map(key => (
                      <option key={key} value={key}>
                        {REPAIR_CHANNEL_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ระดับความเร่งด่วน
                  </label>
                  <select
                    value={formData.urgency}
                    onChange={e => setFormData(prev => ({ ...prev, urgency: e.target.value as RepairUrgency }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    {(Object.keys(REPAIR_URGENCY_META) as RepairUrgency[]).map(key => (
                      <option key={key} value={key}>
                        {REPAIR_URGENCY_META[key].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Section: เลขรับหนังสือ (ตรงตามตราประทับ อบต.ไร่ใต้ & กองช่าง) */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-800">
                  ข้อมูลการลงรับคำร้อง (อบต.ไร่ใต้ / กองช่าง)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      เลขรับ อบต.
                    </label>
                    <input
                      type="text"
                      value={formData.obtReceiveNo || ''}
                      onChange={e => setFormData(prev => ({ ...prev, obtReceiveNo: e.target.value }))}
                      placeholder="เช่น 2686"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono tabular-nums focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      วันที่รับ อบต.
                    </label>
                    <input
                      type="date"
                      value={formData.obtReceiveDate || ''}
                      onChange={e => setFormData(prev => ({ ...prev, obtReceiveDate: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm tabular-nums focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      เลขที่รับกองช่าง
                    </label>
                    <input
                      type="text"
                      value={formData.engReceiveNo || ''}
                      onChange={e => setFormData(prev => ({ ...prev, engReceiveNo: e.target.value }))}
                      placeholder="เช่น 288"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono tabular-nums focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      วันที่รับกองช่าง
                    </label>
                    <input
                      type="date"
                      value={formData.engReceiveDate || ''}
                      onChange={e => setFormData(prev => ({ ...prev, engReceiveDate: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm tabular-nums focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      วันที่ยื่นคำร้อง <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.petitionDate}
                      onChange={e => setFormData(prev => ({ ...prev, petitionDate: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm tabular-nums focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section: เรื่องที่ร้อง ผู้ยื่นคำร้อง และจุดถนนที่ชำรุด */}
              <div className="pt-4 border-t border-slate-200 space-y-4">
                <h4 className="text-xs font-bold text-slate-800">
                  เรื่องที่ร้องทุกข์ ผู้ยื่นคำร้อง และจุดถนนที่ชำรุด
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เรื่อง <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.subject}
                    onChange={e => {
                      const nextSubject = e.target.value;
                      const extracted = !hasManualRoadEdit ? extractRoadFromSubject(nextSubject) : null;
                      setFormData(prev => ({
                        ...prev,
                        subject: nextSubject,
                        ...(extracted ? { roadName: extracted } : {})
                      }));
                    }}
                    placeholder="เช่น ขอความอนุเคราะห์ ซ่อมแซม ถนนลูกรัง สายโคกสูง - เสี่ยวนา"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                {/* ผู้ยื่นคำร้อง (เฉพาะชื่อผู้ร้อง และเบอร์ติดต่อ) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ชื่อผู้ร้อง <span className="text-rose-500">*</span>
                    </label>
                    <AutoSuggestInput
                      value={formData.requesterName}
                      onChange={val => setFormData(prev => ({ ...prev, requesterName: val }))}
                      suggestions={requesterSuggestions}
                      placeholder="เช่น น.ส. ลัดดาวรรณ รสจันทร์"
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      เบอร์ติดต่อ
                    </label>
                    <input
                      type="text"
                      value={formData.requesterPhone || ''}
                      onChange={e => setFormData(prev => ({ ...prev, requesterPhone: e.target.value }))}
                      placeholder="เช่น 0900837931"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono tabular-nums focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      สายถนน / จุดที่ชำรุด
                    </label>
                    <input
                      type="text"
                      value={formData.roadName}
                      onChange={e => {
                        setHasManualRoadEdit(true);
                        setFormData(prev => ({ ...prev, roadName: e.target.value }));
                      }}
                      placeholder="เช่น สายโคกสูง - ท่าช้างเสี่ยวนา (แถวบ้านยายตึม)"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      หมู่ที่ / บ้าน
                    </label>
                    <input
                      type="text"
                      value={formData.villageNo || ''}
                      onChange={e => setFormData(prev => ({ ...prev, villageNo: e.target.value }))}
                      placeholder="เช่น หมู่ที่ 4 บ้านโคกสูง"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ประเภทถนน / งานซ่อม
                    </label>
                    <select
                      value={formData.roadType}
                      onChange={e => setFormData(prev => ({ ...prev, roadType: e.target.value as RepairRoadType }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      {(Object.keys(REPAIR_ROAD_TYPE_LABELS) as RepairRoadType[]).map(key => (
                        <option key={key} value={key}>
                          {REPAIR_ROAD_TYPE_LABELS[key]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    รายละเอียดความเดือดร้อน / สภาพความชำรุด
                  </label>
                  <textarea
                    rows={3}
                    value={formData.problemDetails}
                    onChange={e => setFormData(prev => ({ ...prev, problemDetails: e.target.value }))}
                    placeholder="ระบุลักษณะความชำรุด เช่น ถนนเป็นหลุมลึก มีโคลน รถติดหล่ม ชาวบ้านสัญจรไม่สะดวก..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Section: เอกสารหลักฐานและพิกัดจุดชำรุด */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-800">
                  เอกสารหลักฐานและพิกัดจุดชำรุด
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      เอกสารหลักฐานที่ผู้ร้องแนบมา
                    </label>
                    <input
                      type="text"
                      value={formData.submittedEvidenceNote || ''}
                      onChange={e => setFormData(prev => ({ ...prev, submittedEvidenceNote: e.target.value }))}
                      placeholder="เช่น รูปถ่าย จำนวน 1 ชุด"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      พิกัดจุดชำรุด (วาง ละติจูด, ลองจิจูด รวมได้)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={formData.locationLat || ''}
                        onChange={e => handleCoordInput('locationLat', e.target.value)}
                        placeholder="Lat เช่น 15.243500"
                        className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono tabular-nums focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                      <input
                        type="text"
                        value={formData.locationLng || ''}
                        onChange={e => handleCoordInput('locationLng', e.target.value)}
                        placeholder="Lng เช่น 105.221580"
                        className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono tabular-nums focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                      {hasCoords && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap shrink-0 transition"
                          title="เปิดดูจุดชำรุดบน Google Maps"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>แผนที่</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 2 && (
            <div className="space-y-5">
              {/* Status Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  สถานะการดำเนินงานและแก้ไขปัญหา
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(Object.keys(REPAIR_STATUS_META) as RepairRequestStatus[]).map(st => {
                    const meta = REPAIR_STATUS_META[st];
                    const isSelected = formData.status === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            status: st,
                            ...(st === 'completed' && !prev.repairCompletedDate
                              ? { repairCompletedDate: todayIso }
                              : {}),
                            ...(st === 'inspecting' && !prev.inspectionDate
                              ? { inspectionDate: todayIso }
                              : {}),
                            ...(st === 'in_progress' && !prev.repairStartDate
                              ? { repairStartDate: todayIso }
                              : {})
                          }));
                        }}
                        className={`px-3 py-2 rounded-xl border text-xs font-semibold text-left transition ${
                          isSelected
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="truncate">{meta.shortLabel}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Inspection & Assignment */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-800">
                  การลงพื้นที่ตรวจสอบและมอบหมายงาน
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ผู้รับผิดชอบ / ชุดช่างผู้ดำเนินการ
                    </label>
                    <AutoSuggestInput
                      value={formData.assignedStaff || ''}
                      onChange={val => setFormData(prev => ({ ...prev, assignedStaff: val }))}
                      suggestions={staffSuggestions}
                      placeholder="เช่น กองช่าง อบต.ไร่ใต้ หรือ นายศรายุทธ สงวนรัษฎ์"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      วันที่ลงพื้นที่ตรวจสอบ
                    </label>
                    <input
                      type="date"
                      value={formData.inspectionDate || ''}
                      onChange={e => setFormData(prev => ({ ...prev, inspectionDate: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm tabular-nums focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ผลการตรวจสอบหน้างาน / ข้อเสนอแนะช่าง
                  </label>
                  <textarea
                    rows={2}
                    value={formData.inspectionSummary || ''}
                    onChange={e => setFormData(prev => ({ ...prev, inspectionSummary: e.target.value }))}
                    placeholder="เช่น ตรวจสอบแล้วพบถนนลูกรังชำรุดเป็นหลุมลึกยาวประมาณ 150 เมตร เห็นควรนำรถเกรดและลงหินคลุกซ่อมแซม..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Repair Execution & Completion */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-800">
                  บันทึกการดำเนินการแก้ไขปัญหา / ซ่อมแซม
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      วิธีการซ่อมแซม
                    </label>
                    <AutoSuggestInput
                      value={formData.repairMethod || ''}
                      onChange={val => setFormData(prev => ({ ...prev, repairMethod: val }))}
                      suggestions={REPAIR_METHOD_PRESETS}
                      minCharsToSuggest={0}
                      openOnFocus
                      showToggleButton
                      placeholder="เลือกหรือพิมพ์วิธีการซ่อมแซม..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ค่าใช้จ่าย / งบซ่อมบำรุง (บาท)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formData.repairCost || ''}
                      onChange={e => setFormData(prev => ({ ...prev, repairCost: Number(e.target.value) || 0 }))}
                      placeholder="0 (กรณีใช้เครื่องจักร/วัสดุของ อบต.)"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono tabular-nums focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      วันที่เริ่มดำเนินการซ่อมแซม
                    </label>
                    <input
                      type="date"
                      value={formData.repairStartDate || ''}
                      onChange={e => setFormData(prev => ({ ...prev, repairStartDate: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm tabular-nums focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      วันที่ซ่อมแซมแล้วเสร็จ
                    </label>
                    <input
                      type="date"
                      value={formData.repairCompletedDate || ''}
                      onChange={e => setFormData(prev => ({ ...prev, repairCompletedDate: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm tabular-nums focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    รายละเอียดการแก้ไข / วัสดุและเครื่องจักรที่ใช้
                  </label>
                  <textarea
                    rows={2}
                    value={formData.repairDetails || ''}
                    onChange={e => setFormData(prev => ({ ...prev, repairDetails: e.target.value }))}
                    placeholder="เช่น นำรถเกรดเดอร์ปรับเกลี่ยผิวจราจร ลงหินคลุกจำนวน 4 เที่ยว และบดอัดแน่นตลอดแนว 150 เมตร..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    สรุปผลการแก้ไข / หมายเหตุปิดงาน
                  </label>
                  <input
                    type="text"
                    value={formData.resolutionNote || ''}
                    onChange={e => setFormData(prev => ({ ...prev, resolutionNote: e.target.value }))}
                    placeholder="เช่น ดำเนินการซ่อมแซมเรียบร้อย ประชาชนสามารถสัญจรไปมาได้ตามปกติ และแจ้งผู้ร้องทราบแล้ว"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Attachments: Petition scan & Before / During / After photos */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-emerald-700" />
                      <span>เอกสารใบคำร้องและภาพถ่าย ก่อน–ระหว่าง–หลังซ่อม ({formData.attachments.length} ไฟล์)</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      เลือกหมวดภาพก่อนอัปโหลด หรือแนบลิงก์ไฟล์จาก Google Drive โดยตรง
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={uploadStage}
                      onChange={e => setUploadStage(e.target.value as RepairAttachment['stage'])}
                      className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700"
                    >
                      {(Object.keys(REPAIR_ATTACHMENT_STAGE_LABELS) as RepairAttachment['stage'][]).map(k => (
                        <option key={k} value={k}>
                          {REPAIR_ATTACHMENT_STAGE_LABELS[k]}
                        </option>
                      ))}
                    </select>

                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition whitespace-nowrap shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      <span>อัปโหลดไฟล์</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setDriveLinkStage(uploadStage);
                        setShowDriveLinkForm(prev => !prev);
                        setDriveLinkError(null);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition whitespace-nowrap shrink-0 ${
                        showDriveLinkForm
                          ? 'bg-sky-600 text-white border-sky-600 hover:bg-sky-700'
                          : 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-300'
                      }`}
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>+ แนบลิงก์ Drive</span>
                    </button>
                  </div>
                </div>

                {/* Inline Drive URL form */}
                {showDriveLinkForm && (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          ชื่อไฟล์ที่จะแสดงในระบบ <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={driveLinkName}
                          onChange={e => {
                            setDriveLinkName(e.target.value);
                            if (driveLinkError) setDriveLinkError(null);
                          }}
                          placeholder="เช่น ใบคำร้อง_สายโคกสูง.pdf"
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          หมวดเอกสาร / ภาพถ่าย
                        </label>
                        <select
                          value={driveLinkStage}
                          onChange={e => setDriveLinkStage(e.target.value as RepairAttachment['stage'])}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        >
                          {(Object.keys(REPAIR_ATTACHMENT_STAGE_LABELS) as RepairAttachment['stage'][]).map(k => (
                            <option key={k} value={k}>
                              {REPAIR_ATTACHMENT_STAGE_LABELS[k]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          ลิงก์ URL ใน Google Drive <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="url"
                          value={driveLinkUrl}
                          onChange={e => {
                            setDriveLinkUrl(e.target.value);
                            if (driveLinkError) setDriveLinkError(null);
                          }}
                          placeholder="https://drive.google.com/file/d/..."
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>

                    {driveLinkError && (
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-rose-600">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{driveLinkError}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowDriveLinkForm(false);
                          setDriveLinkError(null);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 text-xs font-medium transition"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="button"
                        onClick={handleAddDriveLink}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>เพิ่มลิงก์แนบ</span>
                      </button>
                    </div>
                  </div>
                )}

                {formData.attachments.length === 0 ? (
                  <div className="p-5 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-400">
                    ยังไม่มีไฟล์ใบคำร้องหรือภาพถ่ายประกอบ (สามารถอัปโหลดหรือแนบลิงก์ Google Drive ได้ด้านบน)
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {formData.attachments.map((att, idx) => {
                      const imgSrc = getRepairImageDisplayUrl(att);
                      const isImg =
                        att.type?.startsWith('image/') ||
                        Boolean(att.previewDataUrl) ||
                        /\.(jpg|jpeg|png|webp|gif)$/i.test(att.name);

                      return (
                        <div
                          key={att.id}
                          className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col justify-between"
                        >
                          {isImg && imgSrc ? (
                            <div className="relative h-28 bg-slate-100">
                              <img
                                src={imgSrc}
                                alt={att.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveAttachment(att.id)}
                                className="absolute top-2 right-2 p-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                                title="ลบไฟล์นี้"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="relative h-28 bg-slate-50 flex flex-col items-center justify-center p-3 text-center">
                              {att.size === 0 ? (
                                <Link2 className="w-6 h-6 text-sky-600 mb-1" />
                              ) : (
                                <FileText className="w-6 h-6 text-slate-400 mb-1" />
                              )}
                              <span className="text-xs font-semibold text-slate-700 line-clamp-2">
                                {att.name}
                              </span>
                              {att.url && (
                                <a
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 hover:underline"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>เปิดใน Drive</span>
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveAttachment(att.id)}
                                className="absolute top-2 right-2 p-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                                title="ลบไฟล์นี้"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          <div className="p-2.5 space-y-1.5 border-t border-slate-100">
                            <select
                              value={att.stage}
                              onChange={e => {
                                const copy = [...formData.attachments];
                                copy[idx] = { ...copy[idx], stage: e.target.value as RepairAttachment['stage'] };
                                setFormData(prev => ({ ...prev, attachments: copy }));
                              }}
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-semibold text-slate-700"
                            >
                              {(Object.keys(REPAIR_ATTACHMENT_STAGE_LABELS) as RepairAttachment['stage'][]).map(k => (
                                <option key={k} value={k}>
                                  {REPAIR_ATTACHMENT_STAGE_LABELS[k]}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={att.caption || ''}
                              onChange={e => {
                                const copy = [...formData.attachments];
                                copy[idx] = { ...copy[idx], caption: e.target.value };
                                setFormData(prev => ({ ...prev, attachments: copy }));
                              }}
                              placeholder="คำอธิบายภาพ/เอกสาร..."
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Controls */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-2">
            <div className="text-xs text-slate-500">
              ส่วนที่ {activeTab} จาก 2
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition whitespace-nowrap shrink-0"
              >
                ยกเลิก
              </button>

              {activeTab === 1 ? (
                <button
                  type="button"
                  onClick={() => setActiveTab(2)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition whitespace-nowrap shrink-0"
                >
                  ถัดไป: บันทึกการซ่อมแซม
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveTab(1)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition whitespace-nowrap shrink-0"
                >
                  ย้อนกลับ: ใบคำร้อง
                </button>
              )}

              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition whitespace-nowrap shrink-0"
              >
                <Save className="w-4 h-4" />
                <span>บันทึกข้อมูล</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
