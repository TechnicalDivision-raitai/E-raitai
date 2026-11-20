import React, { useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import {
  Plus,
  Search,
  Download,
  Wrench,
  Eye,
  Edit3,
  Trash2,
  Phone,
  RotateCcw,
  FileText
} from 'lucide-react';
import {
  RepairRequest,
  RepairRequestStatus,
  RepairRoadType,
  UserProfile
} from '../types/project';
import { formatCurrency, formatThaiDate } from '../utils/thaiDate';
import {
  REPAIR_ROAD_TYPE_LABELS,
  REPAIR_STATUS_META,
  exportRepairRequestsToExcel
} from '../utils/repairHelpers';
import { RepairRequestModal } from './RepairRequestModal';
import { RepairRequestDetailModal } from './RepairRequestDetailModal';

interface RepairRequestsViewProps {
  requests: RepairRequest[];
  availableYears: number[];
  currentUser: UserProfile;
  onSaveRequest: (request: RepairRequest) => void;
  onDeleteRequest: (id: string) => void;
  onQuickStatusChange: (id: string, status: RepairRequestStatus) => void;
}

type StatusFilterKey = 'all' | 'active' | RepairRequestStatus;

const STATUS_TABS: { key: StatusFilterKey; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'received', label: 'รอตรวจสอบ' },
  { key: 'inspecting', label: 'สำรวจหน้างาน' },
  { key: 'in_progress', label: 'กำลังซ่อมแซม' },
  { key: 'completed', label: 'แล้วเสร็จ' },
  { key: 'budget_planned', label: 'เสนอตั้งงบ' }
];

export const RepairRequestsView: React.FC<RepairRequestsViewProps> = ({
  requests,
  availableYears,
  currentUser,
  onSaveRequest,
  onDeleteRequest,
  onQuickStatusChange
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilterKey>('all');
  const [selectedRoadType, setSelectedRoadType] = useState<RepairRoadType | 'all'>('all');

  // Modals State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<RepairRequest | null>(null);
  const [formInitialTab, setFormInitialTab] = useState<1 | 2>(1);
  const [detailRequestId, setDetailRequestId] = useState<string | null>(null);

  const isAdmin = currentUser.role === 'admin';
  const canModify = isAdmin;

  // Merge available fiscal years with any years present in repair requests
  const yearOptions = useMemo(() => {
    const set = new Set<number>(availableYears);
    requests.forEach(r => {
      if (r.fiscalYear) set.add(r.fiscalYear);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [availableYears, requests]);

  // Year-scoped subset for KPI counters
  const yearScopedRequests = useMemo(() => {
    if (selectedYear === 'all') return requests;
    return requests.filter(r => r.fiscalYear === selectedYear);
  }, [requests, selectedYear]);

  const kpi = useMemo(() => {
    const total = yearScopedRequests.length;
    const received = yearScopedRequests.filter(r => r.status === 'received').length;
    const working = yearScopedRequests.filter(
      r => r.status === 'inspecting' || r.status === 'in_progress'
    ).length;
    const completed = yearScopedRequests.filter(r => r.status === 'completed').length;
    const budgetPlanned = yearScopedRequests.filter(r => r.status === 'budget_planned').length;
    return { total, received, working, completed, budgetPlanned };
  }, [yearScopedRequests]);

  // Filtered table items
  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return yearScopedRequests
      .filter(r => {
        if (selectedStatus === 'active') {
          if (r.status !== 'inspecting' && r.status !== 'in_progress') return false;
        } else if (selectedStatus !== 'all' && r.status !== selectedStatus) {
          return false;
        }
        if (selectedRoadType !== 'all' && r.roadType !== selectedRoadType) {
          return false;
        }
        if (q) {
          const haystack = [
            r.requestCode,
            r.obtReceiveNo,
            r.engReceiveNo,
            r.subject,
            r.roadName,
            r.villageNo ? `หมู่ ${r.villageNo}` : '',
            r.requesterName,
            r.requesterPhone,
            r.problemDetails,
            r.assignedStaff,
            r.repairMethod
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Urgent/unsolved first or newest petitionDate first
        const dateA = a.petitionDate || a.createdAt || '';
        const dateB = b.petitionDate || b.createdAt || '';
        if (dateB !== dateA) return dateB.localeCompare(dateA);
        return (b.requestCode || '').localeCompare(a.requestCode || '', 'th');
      });
  }, [yearScopedRequests, selectedStatus, selectedRoadType, searchQuery]);

  const detailRequest = useMemo(
    () => (detailRequestId ? requests.find(r => r.id === detailRequestId) || null : null),
    [detailRequestId, requests]
  );

  const openCreateModal = () => {
    if (!isAdmin) return;
    setEditingRequest(null);
    setFormInitialTab(1);
    setIsFormModalOpen(true);
  };

  const openEditModal = (req: RepairRequest, tab: 1 | 2 = 1) => {
    if (!isAdmin) return;
    setDetailRequestId(null);
    setEditingRequest(req);
    setFormInitialTab(tab);
    setIsFormModalOpen(true);
  };

  const confirmDelete = (req: RepairRequest) => {
    if (!isAdmin) return;
    Swal.fire({
      title: 'ยืนยันการลบคำร้อง?',
      text: `${req.requestCode} — ${req.subject}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'ลบรายการ',
      cancelButtonText: 'ยกเลิก'
    }).then(result => {
      if (result.isConfirmed) {
        onDeleteRequest(req.id);
        if (detailRequestId === req.id) setDetailRequestId(null);
      }
    });
  };

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    selectedYear !== 'all' ||
    selectedStatus !== 'all' ||
    selectedRoadType !== 'all';

  return (
    <div className="space-y-5">
      {/* Page Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            ทะเบียนคำร้องและงานซ่อมแซมถนน
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            รับคำร้องทุกข์/ร้องเรียนเกี่ยวกับถนนสาธารณะ ติดตามการลงพื้นที่สำรวจ และการดำเนินการแก้ไขปัญหาของกองช่าง อบต.ไร่ใต้
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() =>
              exportRepairRequestsToExcel(
                filteredRequests,
                selectedYear === 'all' ? 'ทั้งหมด' : `ปีงบ_${selectedYear}`
              )
            }
            disabled={filteredRequests.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-semibold transition whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>ส่งออก Excel</span>
          </button>

          {canModify && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>บันทึกคำร้องใหม่</span>
            </button>
          )}
        </div>
      </div>

      {/* 5-Column Flat KPI Strip */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          <button
            type="button"
            onClick={() => setSelectedStatus('all')}
            className={`p-4 text-left transition hover:bg-slate-50 ${
              selectedStatus === 'all' ? 'bg-slate-50' : ''
            }`}
          >
            <div className="text-xs font-medium text-slate-500">คำร้องทั้งหมด</div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
              {kpi.total}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {selectedYear === 'all' ? 'ทุกปีงบประมาณ' : `ปีงบประมาณ ${selectedYear}`}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus('received')}
            className={`p-4 text-left transition hover:bg-slate-50 ${
              selectedStatus === 'received' ? 'bg-amber-50/50' : ''
            }`}
          >
            <div className="text-xs font-medium text-amber-700">รับเรื่อง / รอตรวจสอบ</div>
            <div className="text-2xl font-bold text-amber-700 tabular-nums mt-1">
              {kpi.received}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">รอมอบหมายลงพื้นที่</div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus('active')}
            className={`p-4 text-left transition hover:bg-slate-50 ${
              selectedStatus === 'active' ||
              selectedStatus === 'inspecting' ||
              selectedStatus === 'in_progress'
                ? 'bg-sky-50/50'
                : ''
            }`}
          >
            <div className="text-xs font-medium text-sky-700">สำรวจ / กำลังซ่อม</div>
            <div className="text-2xl font-bold text-sky-700 tabular-nums mt-1">
              {kpi.working}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">อยู่ระหว่างดำเนินการ</div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus('completed')}
            className={`p-4 text-left transition hover:bg-slate-50 ${
              selectedStatus === 'completed' ? 'bg-emerald-50/50' : ''
            }`}
          >
            <div className="text-xs font-medium text-emerald-700">แก้ไขแล้วเสร็จ</div>
            <div className="text-2xl font-bold text-emerald-700 tabular-nums mt-1">
              {kpi.completed}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">ปิดคำร้องเรียบร้อย</div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus('budget_planned')}
            className={`p-4 text-left transition hover:bg-slate-50 col-span-2 sm:col-span-1 ${
              selectedStatus === 'budget_planned' ? 'bg-slate-100/80' : ''
            }`}
          >
            <div className="text-xs font-medium text-slate-600">เสนอตั้งงบประมาณ</div>
            <div className="text-2xl font-bold text-slate-800 tabular-nums mt-1">
              {kpi.budgetPlanned}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">ส่งเข้าแผนจัดทำโครงการ</div>
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ค้นหาเลขรับ อบต./กองช่าง, ชื่อสายถนน, ชื่อผู้ร้อง, เบอร์โทร หรือรายละเอียด..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
            />
          </div>

          {/* Fiscal Year Select */}
          <select
            value={selectedYear}
            onChange={e =>
              setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            aria-label="กรองตามปีงบประมาณ"
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shrink-0"
          >
            <option value="all">ทุกปีงบประมาณ</option>
            {yearOptions.map(yr => (
              <option key={yr} value={yr}>
                ปีงบประมาณ {yr}
              </option>
            ))}
          </select>

          {/* Road Type Select */}
          <select
            value={selectedRoadType}
            onChange={e =>
              setSelectedRoadType(e.target.value as RepairRoadType | 'all')
            }
            aria-label="กรองตามประเภทถนน"
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shrink-0"
          >
            <option value="all">ทุกประเภทถนน/งาน</option>
            {(Object.keys(REPAIR_ROAD_TYPE_LABELS) as RepairRoadType[]).map(type => (
              <option key={type} value={type}>
                {REPAIR_ROAD_TYPE_LABELS[type]}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedYear('all');
                setSelectedStatus('all');
                setSelectedRoadType('all');
              }}
              className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ล้างตัวกรอง</span>
            </button>
          )}
        </div>

        {/* Status Segmented Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {STATUS_TABS.map(tab => {
            const isActive =
              selectedStatus === tab.key ||
              (selectedStatus === 'active' &&
                (tab.key === 'inspecting' || tab.key === 'in_progress'));
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSelectedStatus(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap shrink-0 ${
                  selectedStatus === tab.key
                    ? 'bg-slate-900 text-white'
                    : isActive
                    ? 'bg-sky-100 text-sky-800'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
          <span className="ml-auto text-xs text-slate-400 tabular-nums whitespace-nowrap pl-2">
            แสดง {filteredRequests.length} จาก {requests.length} รายการ
          </span>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredRequests.length === 0 ? (
          <div className="py-16 px-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {requests.length === 0
                  ? 'ยังไม่มีข้อมูลคำร้อง/งานซ่อมแซมในระบบ'
                  : 'ไม่พบคำร้องที่ตรงกับเงื่อนไขการค้นหา'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {requests.length === 0
                  ? 'เริ่มต้นบันทึกใบคำร้องทุกข์เกี่ยวกับถนนของประชาชน เพื่อติดตามการสำรวจและซ่อมแซม'
                  : 'ลองปรับเปลี่ยนคำค้นหา ปีงบประมาณ หรือสถานะการดำเนินการ'}
              </p>
            </div>
            {canModify && requests.length === 0 && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
              >
                <Plus className="w-4 h-4" />
                <span>บันทึกคำร้องแรก</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop & Tablet Responsive Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[700px] table-fixed text-left border-collapse">
                <colgroup>
                  <col className="w-[15%]" />
                  <col className="w-[39%]" />
                  <col className="w-[18%]" />
                  <col className="w-[17%]" />
                  <col className="w-[11%]" />
                </colgroup>
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-3 lg:px-4 whitespace-nowrap">รหัส / เลขรับกองช่าง</th>
                    <th className="py-3 px-3 lg:px-4">เรื่องคำร้องและสายถนน</th>
                    <th className="py-3 px-3 lg:px-4">ผู้ร้องทุกข์</th>
                    <th className="py-3 px-3 lg:px-4">สถานะและการแก้ไข</th>
                    <th className="py-3 px-3 lg:px-4 text-right whitespace-nowrap">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {filteredRequests.map(req => {
                    const statusMeta =
                      REPAIR_STATUS_META[req.status] || REPAIR_STATUS_META.received;

                    return (
                      <tr
                        key={req.id}
                        onClick={() => setDetailRequestId(req.id)}
                        className="hover:bg-slate-50/90 transition cursor-pointer group"
                      >
                        {/* Column 1: Code + Engineering Receive No. (number only) */}
                        <td className="py-3.5 px-3 lg:px-4 align-top">
                          <div className="font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                            {req.requestCode}
                          </div>
                          {req.engReceiveNo && (
                            <div
                              className="text-[11px] font-mono text-slate-500 tabular-nums mt-0.5 truncate"
                              title={`เลขที่รับกองช่าง ${req.engReceiveNo}`}
                            >
                              {req.engReceiveNo}
                            </div>
                          )}
                        </td>

                        {/* Column 2: Subject & Road Name only */}
                        <td className="py-3.5 px-3 lg:px-4 align-top">
                          <div
                            className="font-semibold text-slate-900 group-hover:text-emerald-700 transition leading-snug line-clamp-2 break-words"
                            title={req.subject}
                          >
                            {req.subject}
                          </div>
                          <div
                            className="text-[11px] text-slate-500 mt-1 truncate"
                            title={req.roadName || '-'}
                          >
                            {req.roadName || '-'}
                          </div>
                        </td>

                        {/* Column 3: Requester */}
                        <td className="py-3.5 px-3 lg:px-4 align-top">
                          <div
                            className="font-semibold text-slate-800 truncate"
                            title={req.requesterName}
                          >
                            {req.requesterName}
                          </div>
                          {req.requesterPhone && (
                            <div className="inline-flex items-center gap-1 text-[11px] text-slate-500 tabular-nums mt-1 max-w-full">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{req.requesterPhone}</span>
                            </div>
                          )}
                        </td>

                        {/* Column 4: Status & Resolution Summary */}
                        <td className="py-3.5 px-3 lg:px-4 align-top">
                          <div className="inline-flex items-center gap-1.5 font-semibold whitespace-nowrap">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${statusMeta.dotClass}`}
                            />
                            <span className={statusMeta.textClass}>
                              {statusMeta.shortLabel}
                            </span>
                          </div>

                          {req.assignedStaff && (
                            <div
                              className="text-[11px] text-slate-600 mt-1 truncate"
                              title={req.assignedStaff}
                            >
                              {req.assignedStaff}
                            </div>
                          )}

                          {req.repairCompletedDate && (
                            <div className="text-[11px] text-emerald-700 tabular-nums mt-0.5 truncate">
                              เสร็จ {formatThaiDate(req.repairCompletedDate)}
                            </div>
                          )}

                          {req.repairCost && req.repairCost > 0 ? (
                            <div className="text-[11px] text-slate-500 tabular-nums mt-0.5 truncate">
                              {formatCurrency(req.repairCost)} บาท
                            </div>
                          ) : null}
                        </td>

                        {/* Column 5: Actions */}
                        <td
                          className="py-3.5 px-3 lg:px-4 align-top text-right whitespace-nowrap"
                          onClick={e => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center justify-end gap-0.5">
                            <button
                              type="button"
                              onClick={() => setDetailRequestId(req.id)}
                              title="ดูรายละเอียดคำร้อง"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {canModify && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(req, 2)}
                                  title="บันทึกผลสำรวจ / อัปเดตการซ่อมแซม"
                                  className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 transition"
                                >
                                  <Wrench className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(req, 1)}
                                  title="แก้ไขข้อมูลใบคำร้อง"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                              </>
                            )}

                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => confirmDelete(req)}
                                title="ลบรายการ"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / High-Zoom Narrow Viewport List */}
            <div className="md:hidden divide-y divide-slate-200">
              {filteredRequests.map(req => {
                const statusMeta =
                  REPAIR_STATUS_META[req.status] || REPAIR_STATUS_META.received;

                return (
                  <div
                    key={req.id}
                    onClick={() => setDetailRequestId(req.id)}
                    className="p-4 space-y-2 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 font-mono tabular-nums min-w-0">
                        <span className="font-bold text-slate-900">{req.requestCode}</span>
                        {req.engReceiveNo && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="text-slate-500" title="เลขที่รับกองช่าง">
                              {req.engReceiveNo}
                            </span>
                          </>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1.5 font-semibold shrink-0">
                        <span className={`w-2 h-2 rounded-full ${statusMeta.dotClass}`} />
                        <span className={statusMeta.textClass}>{statusMeta.shortLabel}</span>
                      </span>
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-slate-900 leading-snug">
                        {req.subject}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {req.roadName || '-'}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                      <div className="text-slate-600 min-w-0 truncate">
                        <span className="font-medium text-slate-800">{req.requesterName}</span>
                        {req.requesterPhone && (
                          <span className="text-slate-500 tabular-nums ml-2">
                            {req.requesterPhone}
                          </span>
                        )}
                      </div>

                      <div
                        className="inline-flex items-center gap-1 shrink-0"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setDetailRequestId(req.id)}
                          title="ดูรายละเอียดคำร้อง"
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canModify && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(req, 2)}
                              title="อัปเดตผลซ่อม"
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"
                            >
                              <Wrench className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(req, 1)}
                              title="แก้ไขคำร้อง"
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => confirmDelete(req)}
                            title="ลบรายการ"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Create / Edit Modal */}
      <RepairRequestModal
        isOpen={isFormModalOpen}
        initialRequest={editingRequest}
        initialTab={formInitialTab}
        existingRequests={requests}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingRequest(null);
        }}
        onSave={saved => {
          onSaveRequest(saved);
          setIsFormModalOpen(false);
          setEditingRequest(null);
        }}
      />

      {/* Detail Modal */}
      <RepairRequestDetailModal
        isOpen={Boolean(detailRequest)}
        request={detailRequest}
        currentUser={currentUser}
        onClose={() => setDetailRequestId(null)}
        onEdit={(req, tab) => openEditModal(req, tab || 1)}
        onQuickStatusChange={onQuickStatusChange}
      />
    </div>
  );
};
