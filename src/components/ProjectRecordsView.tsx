import React, { useState, useMemo } from 'react';
import Swal from 'sweetalert2';
import {
  MapPin,
  Navigation,
  Signpost,
  Image as ImageIcon,
  Paperclip,
  ExternalLink,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Search,
  Filter,
  Compass,
  CheckCircle2,
  Eye,
  Upload,
  FileText,
  Sparkles,
  Copy,
  ChevronDown
} from 'lucide-react';
import {
  Project,
  ProjectArchiveRecord,
  ProjectArchiveAttachment,
  ProjectCoordinatePoint,
  UserProfile
} from '../types/project';
import { formatThaiDate, formatThaiDateTime } from '../utils/thaiDate';
import { uploadFileToDrive } from '../services/storage';

interface ProjectRecordsViewProps {
  projects: Project[];
  availableYears: number[];
  selectedYear: string | number;
  onSelectYear: (yr: string | number) => void;
  currentUser: UserProfile;
  onSaveProjectRecord: (projectId: string, record: ProjectArchiveRecord) => void;
}

const PHOTO_STAGE_LABELS: Record<NonNullable<ProjectArchiveAttachment['photoStage']>, { label: string; badgeClass: string }> = {
  before: { label: 'ภาพก่อนดำเนินการ', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300' },
  during: { label: 'ภาพระหว่างดำเนินการ', badgeClass: 'bg-sky-100 text-sky-800 border-sky-300' },
  after: { label: 'ภาพหลังดำเนินการเสร็จ', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  signboard: { label: 'ภาพป้ายแสดงโครงการ', badgeClass: 'bg-purple-100 text-purple-800 border-purple-300' },
  document: { label: 'ไฟล์เอกสาร/แบบแปลน', badgeClass: 'bg-slate-100 text-slate-800 border-slate-300' }
};

export function hasValidCoord(pt?: ProjectCoordinatePoint): boolean {
  if (!pt) return false;
  const lat = String(pt.lat || '').trim();
  const lng = String(pt.lng || '').trim();
  return lat.length > 0 && lng.length > 0;
}

export function getGoogleMapsPointUrl(pt?: ProjectCoordinatePoint): string {
  if (!hasValidCoord(pt)) return '';
  const lat = String(pt!.lat).trim();
  const lng = String(pt!.lng).trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

export function getGoogleMapsRouteUrl(
  startPt?: ProjectCoordinatePoint,
  endPt?: ProjectCoordinatePoint
): string {
  if (!hasValidCoord(startPt) || !hasValidCoord(endPt)) return '';
  const origin = `${String(startPt!.lat).trim()},${String(startPt!.lng).trim()}`;
  const destination = `${String(endPt!.lat).trim()},${String(endPt!.lng).trim()}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
}

/**
 * Resolves an image display URL that works across all devices, converting Google Drive view links into direct thumbnail URLs
 */
export function getArchiveImageDisplayUrl(file?: ProjectArchiveAttachment): string {
  if (!file) return '';
  if (file.previewDataUrl) return file.previewDataUrl;
  const rawUrl = file.url || '';
  if (!rawUrl) return '';
  const matchD = rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (matchD && matchD[1]) {
    return `https://drive.google.com/thumbnail?id=${matchD[1]}&sz=w1000`;
  }
  const matchId = rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId && matchId[1]) {
    return `https://drive.google.com/thumbnail?id=${matchId[1]}&sz=w1000`;
  }
  return rawUrl;
}

/**
 * Generates a small compressed JPEG data URL for image files so thumbnails can be viewed offline/retrospectively
 */
export async function createImagePreviewDataUrl(file: File): Promise<string | undefined> {
  if (!file.type.startsWith('image/')) return undefined;
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 900;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(reader.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.78));
        } catch {
          resolve(reader.result as string);
        }
      };
      img.onerror = () => resolve(undefined);
      img.src = reader.result as string;
    };
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });
}

/**
 * Helper to parse combined "lat, lng" string if user pastes directly from Google Maps
 */
export function tryParseCombinedLatLng(raw: string): { lat: string; lng: string } | null {
  const cleaned = raw.trim();
  const match = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  return { lat: match[1], lng: match[2] };
}

export const ProjectRecordsView: React.FC<ProjectRecordsViewProps> = ({
  projects,
  availableYears,
  selectedYear,
  onSelectYear,
  currentUser,
  onSaveProjectRecord
}) => {
  const isAdmin = currentUser.role === 'admin';
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [recordFilter, setRecordFilter] = useState<'all' | 'recorded' | 'unrecorded'>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (projectId: string) => {
    setExpandedIds(prev => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  // Editor Modal State
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [draftRecord, setDraftRecord] = useState<ProjectArchiveRecord>({
    startPoint: { lat: '', lng: '', note: '' },
    endPoint: { lat: '', lng: '', note: '' },
    signboardPoint: { lat: '', lng: '', note: '' },
    files: [],
    remark: ''
  });
  const [selectedUploadStage, setSelectedUploadStage] =
    useState<NonNullable<ProjectArchiveAttachment['photoStage']>>('during');

  // Lightbox Preview State
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    title: string;
    subtitle?: string;
    driveUrl?: string;
  } | null>(null);

  const categories = useMemo(() => {
    return Array.from(new Set(projects.map(p => p.budgetCategory).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'th')
    );
  }, [projects]);

  const hasAnyArchiveData = (p: Project): boolean => {
    const rec = p.projectRecord;
    if (!rec) return false;
    return (
      hasValidCoord(rec.startPoint) ||
      hasValidCoord(rec.endPoint) ||
      hasValidCoord(rec.signboardPoint) ||
      Boolean(rec.files && rec.files.length > 0) ||
      Boolean(rec.remark && rec.remark.trim())
    );
  };

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (selectedYear !== 'all' && Number(p.fiscalYear) !== Number(selectedYear)) {
        return false;
      }
      if (selectedCategory !== 'all' && p.budgetCategory !== selectedCategory) {
        return false;
      }
      if (recordFilter === 'recorded' && !hasAnyArchiveData(p)) {
        return false;
      }
      if (recordFilter === 'unrecorded' && hasAnyArchiveData(p)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchCode = (p.projectCode || '').toLowerCase().includes(q);
        const matchLoc = (p.location || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchLoc) return false;
      }
      return true;
    });
  }, [projects, selectedYear, selectedCategory, recordFilter, searchQuery]);

  const openEditor = (project: Project) => {
    const existing = project.projectRecord;
    setEditingProject(project);
    setDraftRecord({
      startPoint: {
        lat: existing?.startPoint?.lat || '',
        lng: existing?.startPoint?.lng || '',
        note: existing?.startPoint?.note || ''
      },
      endPoint: {
        lat: existing?.endPoint?.lat || '',
        lng: existing?.endPoint?.lng || '',
        note: existing?.endPoint?.note || ''
      },
      signboardPoint: {
        lat: existing?.signboardPoint?.lat || '',
        lng: existing?.signboardPoint?.lng || '',
        note: existing?.signboardPoint?.note || ''
      },
      files: existing?.files ? [...existing.files] : [],
      remark: existing?.remark || '',
      updatedAt: existing?.updatedAt
    });
  };

  const handleCoordinateInput = (
    pointKey: 'startPoint' | 'endPoint' | 'signboardPoint',
    field: 'lat' | 'lng' | 'note',
    value: string
  ) => {
    // Auto-detect if user pasted "lat, lng" together into either lat or lng input
    if (field === 'lat' || field === 'lng') {
      const parsed = tryParseCombinedLatLng(value);
      if (parsed) {
        setDraftRecord(prev => ({
          ...prev,
          [pointKey]: {
            ...(prev[pointKey] || { lat: '', lng: '', note: '' }),
            lat: parsed.lat,
            lng: parsed.lng
          }
        }));
        return;
      }
    }

    setDraftRecord(prev => ({
      ...prev,
      [pointKey]: {
        ...(prev[pointKey] || { lat: '', lng: '', note: '' }),
        [field]: value
      }
    }));
  };

  const handleUseCurrentGps = (pointKey: 'startPoint' | 'endPoint' | 'signboardPoint') => {
    if (!navigator.geolocation) {
      Swal.fire('ไม่รองรับ GPS', 'เบราว์เซอร์ของคุณไม่รองรับการดึงพิกัดปัจจุบัน', 'warning');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setDraftRecord(prev => ({
          ...prev,
          [pointKey]: {
            ...(prev[pointKey] || { lat: '', lng: '', note: '' }),
            lat,
            lng
          }
        }));
        Swal.fire({
          icon: 'success',
          title: 'ดึงพิกัด GPS สำเร็จ',
          text: `ละติจูด ${lat}, ลองจิจูด ${lng}`,
          timer: 1300,
          showConfirmButton: false
        });
      },
      () => {
        Swal.fire(
          'ไม่สามารถดึงพิกัดได้',
          'กรุณาอนุญาตการเข้าถึงตำแหน่งที่ตั้ง หรือกรอกค่าละติจูด/ลองจิจูดด้วยตนเอง',
          'info'
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleUploadArchiveFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    Swal.fire({
      title: 'กำลังอัปโหลดรูปภาพ/ไฟล์โครงการ...',
      text: 'ระบบกำลังสร้างตัวอย่างรูปภาพและสำรองไฟล์ขึ้น Google Drive',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const uploadedItems: ProjectArchiveAttachment[] = [];

    for (const file of Array.from(fileList)) {
      try {
        const [previewDataUrl, driveRes] = await Promise.all([
          createImagePreviewDataUrl(file),
          uploadFileToDrive(file)
        ]);

        uploadedItems.push({
          id: `arc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          size: file.size,
          type: file.type || 'image/jpeg',
          photoStage: selectedUploadStage,
          caption: '',
          uploadDate: new Date().toISOString().split('T')[0],
          url: driveRes.fileUrl,
          previewDataUrl
        });
      } catch (err) {
        console.error('Archive file upload error:', err);
      }
    }

    setDraftRecord(prev => ({
      ...prev,
      files: [...(prev.files || []), ...uploadedItems]
    }));

    e.target.value = '';

    Swal.fire({
      icon: 'success',
      title: 'แนบไฟล์สำเร็จ',
      text: `เพิ่มไฟล์/รูปภาพโครงการจำนวน ${uploadedItems.length} รายการเรียบร้อยแล้ว`,
      timer: 1300,
      showConfirmButton: false
    });
  };

  const handleSaveRecordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;

    const recordToSave: ProjectArchiveRecord = {
      ...draftRecord,
      updatedAt: formatThaiDateTime()
    };

    onSaveProjectRecord(editingProject.id, recordToSave);
    setEditingProject(null);

    Swal.fire({
      icon: 'success',
      title: 'บันทึกข้อมูลโครงการสำเร็จ',
      text: 'บันทึกพิกัดและรูปภาพสำหรับเรียกดูย้อนหลังเรียบร้อยแล้ว (ไม่กระทบสถานะและไทม์ไลน์โครงการ)',
      timer: 1600,
      showConfirmButton: false
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-emerald-800 to-teal-800 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-bold font-heading flex items-center gap-2.5">
              <MapPin className="w-6 h-6 text-emerald-300 shrink-0" />
              <span>ข้อมูลโครงการ</span>
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/90 max-w-3xl">
              ใช้สำหรับจัดเก็บพิกัดจุดเริ่มต้น-จุดสิ้นสุดโครงการ พิกัดป้ายแสดงโครงการ และรูปภาพ/ไฟล์แนบโครงการเพื่อเปิดดูข้อมูลย้อนหลังและเปิดแผนที่ผ่าน Google Maps ได้ทันที
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อโครงการ, รหัสโครงการ, สถานที่ดำเนินการ..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-600">ปีงบประมาณ:</span>
          </div>
          <select
            value={selectedYear}
            onChange={e => onSelectYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
          >
            <option value="all">ทุกปีงบประมาณ</option>
            {availableYears.map(yr => (
              <option key={yr} value={yr}>
                ปีงบประมาณ พ.ศ. {yr}
              </option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
          >
            <option value="all">ทุกหมวดงบประมาณ</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={recordFilter}
            onChange={e => setRecordFilter(e.target.value as 'all' | 'recorded' | 'unrecorded')}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
          >
            <option value="all">แสดงทุกโครงการ ({projects.length})</option>
            <option value="recorded">บันทึกพิกัด/รูปภาพแล้ว</option>
            <option value="unrecorded">ยังไม่ได้บันทึกข้อมูล</option>
          </select>
        </div>
      </div>

      {/* Project Archive Cards */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <MapPin className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-700">ไม่พบรายการโครงการตามเงื่อนไขที่ค้นหา</h3>
          <p className="text-xs text-slate-500">ลองเปลี่ยนตัวกรองปีงบประมาณ หรือคำค้นหาใหม่อีกครั้ง</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProjects.map(project => {
            const rec = project.projectRecord;
            const routeUrl = getGoogleMapsRouteUrl(rec?.startPoint, rec?.endPoint);
            const signUrl = getGoogleMapsPointUrl(rec?.signboardPoint);
            const archiveFiles = rec?.files || [];
            const hasData = hasAnyArchiveData(project);
            const isExpanded = Boolean(expandedIds[project.id]);

            return (
              <div
                key={project.id}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md transition overflow-hidden"
              >
                {/* Project Card Header (ปุ่มย่อ/ขยายจากแถบชื่อโครงการ) */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleExpand(project.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleExpand(project.id);
                    }
                  }}
                  aria-expanded={isExpanded}
                  className={`px-5 py-4 bg-slate-50/80 hover:bg-slate-100/70 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isExpanded ? 'border-b border-slate-200/80' : ''
                  }`}
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {project.projectCode}
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-slate-200/80 text-slate-700">
                        ปีงบประมาณ {project.fiscalYear}
                      </span>
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
                        {project.budgetCategory}
                      </span>
                      {hasData ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-emerald-600 text-white shadow-2xs">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>มีข้อมูลบันทึกย้อนหลังแล้ว</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-500 border border-slate-200">
                          <span>ยังไม่ได้บันทึกพิกัด/รูปภาพ</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-800 font-heading">{project.name}</h3>
                    </div>
                    <p className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>สถานที่: {project.location || '-'}</span>
                      {rec?.updatedAt && (
                        <span className="text-slate-400">• อัปเดตข้อมูลย้อนหลังล่าสุด: {rec.updatedAt}</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 self-start sm:self-center">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          openEditor(project);
                        }}
                        className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-900 hover:underline text-xs font-bold transition cursor-pointer bg-transparent p-0 border-0 shadow-none"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{hasData ? 'แก้ไขพิกัด / รูปภาพโครงการ' : 'บันทึกพิกัด / รูปภาพโครงการ'}</span>
                      </button>
                    )}
                    <span
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500"
                      title={isExpanded ? 'คลิกเพื่อย่อรายละเอียด' : 'คลิกเพื่อดูพิกัดและรูปภาพ'}
                    >
                      <span>{isExpanded ? 'ซ่อน' : 'ดูพิกัด'}</span>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180 text-emerald-700' : 'text-slate-400'
                        }`}
                      />
                    </span>
                  </div>
                </div>

                {/* Project Card Body: 3 Core Sections */}
                {isExpanded && (
                <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 animate-in fade-in duration-150">
                  {/* 1. พิกัดโครงการ (จุดเริ่มต้น & จุดสิ้นสุด) */}
                  <div className="lg:col-span-5 bg-emerald-50/40 rounded-2xl p-4 border border-emerald-200/80 flex flex-col justify-between space-y-3">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-emerald-200/70 pb-2">
                        <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                          <Navigation className="w-4 h-4 text-emerald-600" />
                          <span>1. พิกัดโครงการ (จุดเริ่มต้น - จุดสิ้นสุด)</span>
                        </h4>
                        {routeUrl && (
                          <a
                            href={routeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-white px-2.5 py-1 rounded-lg border border-emerald-300 shadow-2xs transition"
                            title="ดูเส้นทางจากจุดเริ่มต้นไปยังจุดสิ้นสุดบน Google Maps"
                          >
                            <Compass className="w-3.5 h-3.5 text-emerald-600" />
                            <span>ดูเส้นทางเริ่มต้น → สิ้นสุด</span>
                          </a>
                        )}
                      </div>

                      {/* จุดเริ่มต้นโครงการ */}
                      <div className="bg-white rounded-xl p-3 border border-emerald-200/90 shadow-2xs flex items-center justify-between gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span className="text-xs font-bold text-slate-800">จุดเริ่มต้นโครงการ</span>
                          </div>
                          {hasValidCoord(rec?.startPoint) ? (
                            <>
                              <div className="font-mono text-xs text-emerald-800 font-semibold">
                                ละติจูด: {rec!.startPoint!.lat} , ลองจิจูด: {rec!.startPoint!.lng}
                              </div>
                              {rec?.startPoint?.note && (
                                <div className="text-[11px] text-slate-500 truncate">
                                  จุดสังเกต: {rec.startPoint.note}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-xs text-slate-400 italic">ยังไม่ได้ระบุพิกัดจุดเริ่มต้น</div>
                          )}
                        </div>
                      </div>

                      {/* จุดสิ้นสุดโครงการ */}
                      <div className="bg-white rounded-xl p-3 border border-emerald-200/90 shadow-2xs flex items-center justify-between gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                            <span className="text-xs font-bold text-slate-800">จุดสิ้นสุดโครงการ</span>
                          </div>
                          {hasValidCoord(rec?.endPoint) ? (
                            <>
                              <div className="font-mono text-xs text-emerald-800 font-semibold">
                                ละติจูด: {rec!.endPoint!.lat} , ลองจิจูด: {rec!.endPoint!.lng}
                              </div>
                              {rec?.endPoint?.note && (
                                <div className="text-[11px] text-slate-500 truncate">
                                  จุดสังเกต: {rec.endPoint.note}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-xs text-slate-400 italic">ยังไม่ได้ระบุพิกัดจุดสิ้นสุด</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. พิกัดป้ายแสดงโครงการ */}
                  <div className="lg:col-span-3 bg-purple-50/40 rounded-2xl p-4 border border-purple-200/80 flex flex-col justify-between space-y-3">
                    <div className="space-y-3">
                      <div className="border-b border-purple-200/70 pb-2">
                        <h4 className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                          <Signpost className="w-4 h-4 text-purple-600" />
                          <span>2. พิกัดป้ายแสดงโครงการ</span>
                        </h4>
                      </div>

                      <div className="bg-white rounded-xl p-3.5 border border-purple-200/90 shadow-2xs space-y-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-purple-600 shrink-0" />
                          <span className="text-xs font-bold text-slate-800">จุดติดตั้งป้ายโครงการ</span>
                        </div>

                        {hasValidCoord(rec?.signboardPoint) ? (
                          <>
                            <div className="font-mono text-xs text-purple-800 font-semibold bg-purple-50 px-2.5 py-1.5 rounded-lg border border-purple-200">
                              <div>ละติจูด: {rec!.signboardPoint!.lat}</div>
                              <div>ลองจิจูด: {rec!.signboardPoint!.lng}</div>
                            </div>
                            {rec?.signboardPoint?.note && (
                              <div className="text-[11px] text-slate-600">
                                รายละเอียดจุดติดตั้ง: {rec.signboardPoint.note}
                              </div>
                            )}
                            {signUrl && (
                              <a
                                href={signUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-xs transition"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>ดูพิกัดป้ายบน Google Maps</span>
                              </a>
                            )}
                          </>
                        ) : (
                          <div className="text-xs text-slate-400 italic py-4 text-center">
                            ยังไม่ได้ระบุพิกัดป้ายแสดงโครงการ
                          </div>
                        )}
                      </div>

                      {rec?.remark && (
                        <div className="bg-white/80 rounded-xl p-2.5 border border-slate-200 text-[11px] text-slate-600">
                          <span className="font-bold text-slate-700">บันทึกเพิ่มเติม: </span>
                          {rec.remark}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. แนบไฟล์ เช่น รูปภาพโครงการ */}
                  <div className="lg:col-span-4 bg-sky-50/40 rounded-2xl p-4 border border-sky-200/80 flex flex-col justify-between space-y-3">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-sky-200/70 pb-2">
                        <h4 className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                          <ImageIcon className="w-4 h-4 text-sky-600" />
                          <span>3. รูปภาพและไฟล์แนบโครงการ ({archiveFiles.length})</span>
                        </h4>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => openEditor(project)}
                            className="text-[11px] font-bold text-sky-700 hover:text-sky-900 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>เพิ่มรูปภาพ/ไฟล์</span>
                          </button>
                        )}
                      </div>

                      {archiveFiles.length === 0 ? (
                        <div className="bg-white rounded-xl p-6 border border-dashed border-sky-200 text-center space-y-1.5">
                          <ImageIcon className="w-6 h-6 text-slate-300 mx-auto" />
                          <div className="text-xs text-slate-400 italic">
                            ยังไม่มีรูปภาพหรือไฟล์แนบในแฟ้มย้อนหลัง
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-52 overflow-y-auto pr-1">
                          {archiveFiles.map(file => {
                            const isImage =
                              file.type?.startsWith('image/') ||
                              Boolean(file.previewDataUrl) ||
                              /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);
                            const imgSrc = getArchiveImageDisplayUrl(file);
                            const stageMeta = file.photoStage
                              ? PHOTO_STAGE_LABELS[file.photoStage]
                              : PHOTO_STAGE_LABELS.during;

                            return (
                              <div
                                key={file.id}
                                className="group bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs flex flex-col justify-between"
                              >
                                {isImage && imgSrc ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setLightboxImage({
                                        url: imgSrc,
                                        title: file.caption || file.name,
                                        subtitle: `${project.name} (${stageMeta.label})`,
                                        driveUrl: file.url
                                      })
                                    }
                                    className="relative h-24 w-full bg-slate-100 overflow-hidden block cursor-pointer"
                                  >
                                    <img
                                      src={imgSrc}
                                      alt={file.name}
                                      className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                                    />
                                    <span
                                      className={`absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${stageMeta.badgeClass}`}
                                    >
                                      {stageMeta.label}
                                    </span>
                                  </button>
                                ) : (
                                  <a
                                    href={file.url || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="h-24 w-full bg-slate-50 flex flex-col items-center justify-center p-2 text-center hover:bg-slate-100 transition"
                                  >
                                    <FileText className="w-6 h-6 text-slate-400 mb-1" />
                                    <span className="text-[10px] font-semibold text-slate-600 line-clamp-2">
                                      {file.name}
                                    </span>
                                  </a>
                                )}

                                <div className="p-2 flex items-center justify-between gap-1 bg-white border-t border-slate-100">
                                  <span
                                    className="text-[10px] font-medium text-slate-700 truncate"
                                    title={file.caption || file.name}
                                  >
                                    {file.caption || file.name}
                                  </span>
                                  {file.url && (
                                    <a
                                      href={file.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sky-600 hover:text-sky-800 p-0.5 shrink-0"
                                      title="เปิดไฟล์ต้นฉบับ"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          Modal สำหรับบันทึก/แก้ไขข้อมูลพิกัดโครงการ พิกัดป้าย และรูปภาพแนบ
          ========================================================================= */}
      {editingProject && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-800 to-teal-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/15 rounded-xl">
                  <MapPin className="w-5 h-5 text-emerald-200" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-emerald-950/70 text-emerald-300 font-bold">
                      {editingProject.projectCode}
                    </span>
                    <span className="text-xs text-emerald-200">
                      บันทึกข้อมูลโครงการย้อนหลัง (ไม่กระทบสถานะ/ไทม์ไลน์)
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold font-heading line-clamp-1">
                    {editingProject.name}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingProject(null)}
                className="p-2 rounded-xl text-emerald-200 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveRecordSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Tip Box */}
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>เคล็ดลับ:</strong> สามารถคัดลอกพิกัดจาก Google Maps เช่น{' '}
                    <code className="px-1.5 py-0.5 bg-white rounded border border-emerald-200 font-mono">
                      15.244812, 105.221540
                    </code>{' '}
                    มาวางในช่องละติจูดได้เลย ระบบจะแยกช่องละติจูดและลองจิจูดให้อัตโนมัติ
                  </span>
                </div>
              </div>

              {/* 1. พิกัดโครงการ: จุดเริ่มต้น & จุดสิ้นสุด */}
              <div className="space-y-4 bg-slate-50/80 p-5 rounded-2xl border border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-emerald-600" />
                      <span>1. พิกัดโครงการ (จุดเริ่มต้นโครงการ และ จุดสิ้นสุดโครงการ)</span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      กรอกค่าละติจูด (Latitude) และลองจิจูด (Longitude) ของจุดเริ่มต้นและจุดสิ้นสุดโครงการ
                    </p>
                  </div>
                  {getGoogleMapsRouteUrl(draftRecord.startPoint, draftRecord.endPoint) && (
                    <a
                      href={getGoogleMapsRouteUrl(draftRecord.startPoint, draftRecord.endPoint)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition self-start"
                    >
                      <Compass className="w-3.5 h-3.5" />
                      <span>ทดสอบดูเส้นทางบน Google Maps</span>
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 1.1 จุดเริ่มต้นโครงการ */}
                  <div className="bg-white p-4 rounded-2xl border border-emerald-200 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span>จุดเริ่มต้นโครงการ (Start Point)</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleUseCurrentGps('startPoint')}
                          className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                        >
                          ดึงพิกัดปัจจุบัน
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          ละติจูด (Latitude)
                        </label>
                        <input
                          type="text"
                          value={draftRecord.startPoint?.lat || ''}
                          onChange={e => handleCoordinateInput('startPoint', 'lat', e.target.value)}
                          placeholder="เช่น 15.244812"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:border-emerald-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          ลองจิจูด (Longitude)
                        </label>
                        <input
                          type="text"
                          value={draftRecord.startPoint?.lng || ''}
                          onChange={e => handleCoordinateInput('startPoint', 'lng', e.target.value)}
                          placeholder="เช่น 105.221540"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:border-emerald-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        จุดสังเกต / รายละเอียดจุดเริ่มต้น (ถ้ามี)
                      </label>
                      <input
                        type="text"
                        value={draftRecord.startPoint?.note || ''}
                        onChange={e => handleCoordinateInput('startPoint', 'note', e.target.value)}
                        placeholder="เช่น หน้าศาลาประชาคมหมู่ที่ 1 กม.0+000"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:border-emerald-600"
                      />
                    </div>
                  </div>

                  {/* 1.2 จุดสิ้นสุดโครงการ */}
                  <div className="bg-white p-4 rounded-2xl border border-rose-200 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        <span>จุดสิ้นสุดโครงการ (End Point)</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleUseCurrentGps('endPoint')}
                          className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                        >
                          ดึงพิกัดปัจจุบัน
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          ละติจูด (Latitude)
                        </label>
                        <input
                          type="text"
                          value={draftRecord.endPoint?.lat || ''}
                          onChange={e => handleCoordinateInput('endPoint', 'lat', e.target.value)}
                          placeholder="เช่น 15.251240"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:border-emerald-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          ลองจิจูด (Longitude)
                        </label>
                        <input
                          type="text"
                          value={draftRecord.endPoint?.lng || ''}
                          onChange={e => handleCoordinateInput('endPoint', 'lng', e.target.value)}
                          placeholder="เช่น 105.228910"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:border-emerald-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        จุดสังเกต / รายละเอียดจุดสิ้นสุด (ถ้ามี)
                      </label>
                      <input
                        type="text"
                        value={draftRecord.endPoint?.note || ''}
                        onChange={e => handleCoordinateInput('endPoint', 'note', e.target.value)}
                        placeholder="เช่น เชื่อมต่อถนนสายหลัก หมู่ที่ 5 กม.0+950"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:border-emerald-600"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. พิกัดป้ายแสดงโครงการ */}
              <div className="space-y-4 bg-purple-50/50 p-5 rounded-2xl border border-purple-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-200 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-purple-950 flex items-center gap-2">
                      <Signpost className="w-4 h-4 text-purple-600" />
                      <span>2. พิกัดป้ายแสดงโครงการ (Project Signboard Coordinates)</span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      กรอกค่าละติจูดและลองจิจูดของจุดติดตั้งป้ายประชาสัมพันธ์โครงการ
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleUseCurrentGps('signboardPoint')}
                      className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-purple-200 transition cursor-pointer"
                    >
                      ดึงพิกัดปัจจุบัน (GPS)
                    </button>
                    {getGoogleMapsPointUrl(draftRecord.signboardPoint) && (
                      <a
                        href={getGoogleMapsPointUrl(draftRecord.signboardPoint)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>เปิดดูพิกัดป้ายบน Google Maps</span>
                      </a>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-2xl border border-purple-200 shadow-2xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      ละติจูดป้ายโครงการ (Latitude)
                    </label>
                    <input
                      type="text"
                      value={draftRecord.signboardPoint?.lat || ''}
                      onChange={e => handleCoordinateInput('signboardPoint', 'lat', e.target.value)}
                      placeholder="เช่น 15.244850"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:border-purple-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      ลองจิจูดป้ายโครงการ (Longitude)
                    </label>
                    <input
                      type="text"
                      value={draftRecord.signboardPoint?.lng || ''}
                      onChange={e => handleCoordinateInput('signboardPoint', 'lng', e.target.value)}
                      placeholder="เช่น 105.221580"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:border-purple-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      บริเวณที่ติดตั้งป้ายโครงการ
                    </label>
                    <input
                      type="text"
                      value={draftRecord.signboardPoint?.note || ''}
                      onChange={e => handleCoordinateInput('signboardPoint', 'note', e.target.value)}
                      placeholder="เช่น บริเวณปากทางเข้าโครงการ หมู่ที่ 1"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:border-purple-600"
                    />
                  </div>
                </div>
              </div>

              {/* 3. แนบไฟล์ เช่น รูปภาพโครงการ */}
              <div className="space-y-4 bg-sky-50/50 p-5 rounded-2xl border border-sky-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sky-200 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-sky-950 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-sky-600" />
                      <span>3. แนบไฟล์ เช่น รูปภาพโครงการ (ก่อนทำ / ระหว่างทำ / หลังทำ / ป้ายโครงการ)</span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      อัปโหลดภาพถ่ายหน้างาน รูปป้ายโครงการ หรือเอกสารที่ต้องการเก็บไว้ดูย้อนหลัง
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={selectedUploadStage}
                      onChange={e =>
                        setSelectedUploadStage(
                          e.target.value as NonNullable<ProjectArchiveAttachment['photoStage']>
                        )
                      }
                      className="px-3 py-2 bg-white border border-sky-300 rounded-xl text-xs font-semibold text-slate-700"
                    >
                      <option value="before">หมวด: ภาพก่อนดำเนินการ</option>
                      <option value="during">หมวด: ภาพระหว่างดำเนินการ</option>
                      <option value="after">หมวด: ภาพหลังดำเนินการเสร็จ</option>
                      <option value="signboard">หมวด: ภาพป้ายแสดงโครงการ</option>
                      <option value="document">หมวด: ไฟล์เอกสาร/แบบแปลน</option>
                    </select>

                    <label className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition">
                      <Upload className="w-3.5 h-3.5" />
                      <span>เลือกไฟล์ / รูปภาพแนบ</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={handleUploadArchiveFiles}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Uploaded Files Grid */}
                {(draftRecord.files || []).length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-sky-300 space-y-2">
                    <ImageIcon className="w-8 h-8 text-sky-300 mx-auto" />
                    <div className="text-xs font-semibold text-slate-600">
                      ยังไม่มีไฟล์แนบหรือรูปภาพโครงการ
                    </div>
                    <div className="text-[11px] text-slate-400">
                      คลิกปุ่ม "เลือกไฟล์ / รูปภาพแนบ" ด้านบนเพื่ออัปโหลดรูปภาพโครงการได้หลายไฟล์พร้อมกัน
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {(draftRecord.files || []).map((file, idx) => {
                      const imgSrc = getArchiveImageDisplayUrl(file);
                      const isImage =
                        file.type?.startsWith('image/') ||
                        Boolean(file.previewDataUrl) ||
                        /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);

                      return (
                        <div
                          key={file.id}
                          className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs flex flex-col justify-between"
                        >
                          {isImage && imgSrc ? (
                            <div className="relative h-36 bg-slate-100">
                              <img
                                src={imgSrc}
                                alt={file.name}
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setDraftRecord(prev => ({
                                    ...prev,
                                    files: (prev.files || []).filter(f => f.id !== file.id)
                                  }))
                                }
                                className="absolute top-2 right-2 p-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-700 text-white shadow-xs cursor-pointer"
                                title="ลบไฟล์นี้"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="relative h-36 bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
                              <FileText className="w-8 h-8 text-slate-400 mb-1.5" />
                              <span className="text-xs font-semibold text-slate-700 line-clamp-2">
                                {file.name}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setDraftRecord(prev => ({
                                    ...prev,
                                    files: (prev.files || []).filter(f => f.id !== file.id)
                                  }))
                                }
                                className="absolute top-2 right-2 p-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-700 text-white shadow-xs cursor-pointer"
                                title="ลบไฟล์นี้"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          <div className="p-3 space-y-2">
                            <select
                              value={file.photoStage || 'during'}
                              onChange={e => {
                                const updated = [...(draftRecord.files || [])];
                                updated[idx] = {
                                  ...updated[idx],
                                  photoStage: e.target.value as any
                                };
                                setDraftRecord(prev => ({ ...prev, files: updated }));
                              }}
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-[11px] font-semibold text-slate-700"
                            >
                              <option value="before">ภาพก่อนดำเนินการ</option>
                              <option value="during">ภาพระหว่างดำเนินการ</option>
                              <option value="after">ภาพหลังดำเนินการเสร็จ</option>
                              <option value="signboard">ภาพป้ายแสดงโครงการ</option>
                              <option value="document">ไฟล์เอกสาร/แบบแปลน</option>
                            </select>

                            <input
                              type="text"
                              value={file.caption || ''}
                              onChange={e => {
                                const updated = [...(draftRecord.files || [])];
                                updated[idx] = {
                                  ...updated[idx],
                                  caption: e.target.value
                                };
                                setDraftRecord(prev => ({ ...prev, files: updated }));
                              }}
                              placeholder="คำอธิบายภาพ เช่น จุดเริ่มต้น กม.0+000"
                              className="w-full px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* หมายเหตุ / บันทึกย้อนหลังเพิ่มเติม */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  หมายเหตุ / บันทึกข้อมูลย้อนหลังเพิ่มเติม (ถ้ามี)
                </label>
                <textarea
                  rows={2}
                  value={draftRecord.remark || ''}
                  onChange={e => setDraftRecord(prev => ({ ...prev, remark: e.target.value }))}
                  placeholder="ระบุรายละเอียดเพิ่มเติมสำหรับการค้นหาหรือตรวจสอบย้อนหลัง..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:border-emerald-600"
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  * ข้อมูลในส่วนนี้ใช้สำหรับเปิดดูย้อนหลังเท่านั้น ไม่กระทบสถานะโครงการ
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingProject(null)}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-md transition cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>บันทึกข้อมูลพิกัดและรูปภาพ</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Image Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold">{lightboxImage.title}</h4>
                {lightboxImage.subtitle && (
                  <p className="text-xs text-slate-300">{lightboxImage.subtitle}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {lightboxImage.driveUrl && (
                  <a
                    href={lightboxImage.driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>เปิดไฟล์ต้นฉบับ</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setLightboxImage(null)}
                  className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="bg-slate-950 flex items-center justify-center max-h-[75vh] overflow-auto p-4">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                className="max-h-[70vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
