import React, { useState, useMemo } from 'react';
import {
  Search,
  FileSpreadsheet,
  Eye,
  Edit,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  PlusCircle,
  AlertCircle,
  HardHat,
  Paperclip,
  Coins,
  UserCheck,
  ListOrdered
} from 'lucide-react';
import { Project, ProjectFilter, UserProfile } from '../types/project';
import {
  calculateProjectProgress,
  formatCurrency,
  formatThaiDate,
  getDaysRemaining,
  getWorkNoticeAlert,
  isProjectCompletedOrDisbursed,
  getFirstAttachmentTab
} from '../utils/thaiDate';
import { exportProjectsToExcel, STATUS_LABELS } from '../utils/excelExport';

interface ProjectTableProps {
  projects: Project[];
  filter: ProjectFilter;
  setFilter: React.Dispatch<React.SetStateAction<ProjectFilter>>;
  availableYears: number[];
  currentUser: UserProfile;
  onSelectProject: (p: Project, initialTab?: number) => void;
  onEditProject: (p: Project) => void;
  onDeleteProject: (p: Project) => void;
  onOpenNewProjectModal: () => void;
  onEnrichKnownData?: () => void;
  fillableCount?: number;
  onOpenRenumberModal?: () => void;
  codeGapCount?: number;
}

type SortField = 'sequence' | 'fiscalYear' | 'name' | 'startDate' | 'endDate' | 'approvedBudget' | 'contractAmount';
type SortOrder = 'asc' | 'desc';

const thaiWordSegmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter('th', { granularity: 'word' })
    : null;

const NON_BREAKING_PREFIXES = new Set(['หมู่', 'งวด', 'ระยะ', 'ตอน', 'ช่วง', 'เลข', 'สาย', 'บ้าน']);
const OPENING_PUNCT = /[\(\[\{“'"\u00A0]$/;
const CLOSING_PUNCT = /^[\)\]\},.;:!?ๆ”'"\u00A0]/;

function renderThaiWordWrapped(text: string): React.ReactNode {
  if (!text) return text;

  // Prevent orphan numbers after Thai labels like "หมู่ที่ 13" or "ม. 5"
  const glued = text.replace(
    /(หมู่ที่|หมู่|ม\.|งวดที่|ระยะที่|ตอนที่|ช่วงที่|ซอย|เลขที่|ปี|พ\.ศ\.)\s+(\d+)/g,
    '$1\u00A0$2'
  );

  if (!thaiWordSegmenter) return glued;

  const segments = Array.from(thaiWordSegmenter.segment(glued), s => s.segment);
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (i > 0) {
      const prev = segments[i - 1];
      const isWhitespace = /^\s+$/.test(seg) || /^\s+$/.test(prev);
      const keepPrefixWithTi = seg === 'ที่' && NON_BREAKING_PREFIXES.has(prev);
      const avoidBreak =
        isWhitespace ||
        keepPrefixWithTi ||
        OPENING_PUNCT.test(prev) ||
        CLOSING_PUNCT.test(seg) ||
        prev === '-' ||
        seg === '-';

      if (!avoidBreak) {
        nodes.push(<wbr key={`w-${i}`} />);
      }
    }
    nodes.push(seg);
  }

  return nodes;
}

export const ProjectTable: React.FC<ProjectTableProps> = ({
  projects,
  filter,
  setFilter,
  availableYears,
  currentUser,
  onSelectProject,
  onEditProject,
  onDeleteProject,
  onOpenNewProjectModal,
  onEnrichKnownData,
  fillableCount = 0,
  onOpenRenumberModal,
  codeGapCount = 0
}) => {
  const [sortField, setSortField] = useState<SortField>('fiscalYear');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Filter projects
  const filteredProjects = useMemo(() => {
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
        const matchYear = p.fiscalYear.toString().includes(query);
        if (!matchName && !matchCode && !matchContract && !matchContractor && !matchYear) {
          return false;
        }
      }
      return true;
    });
  }, [projects, filter]);

  // Sort projects
  const sortedProjects = useMemo(() => {
    return [...filteredProjects].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'fiscalYear':
          comparison = a.fiscalYear - b.fiscalYear;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name, 'th');
          break;
        case 'startDate':
          comparison = (a.startDate || '').localeCompare(b.startDate || '');
          break;
        case 'endDate':
          comparison = (a.endDate || '').localeCompare(b.endDate || '');
          break;
        case 'approvedBudget':
          comparison = (a.approvedBudget || 0) - (b.approvedBudget || 0);
          break;
        case 'contractAmount':
          comparison = (a.contractAmount || 0) - (b.contractAmount || 0);
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredProjects, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 ml-1 inline" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-emerald-700 ml-1 inline" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-emerald-700 ml-1 inline" />
    );
  };

  const categoryTitle = useMemo(() => {
    if (filter.category === 'all') return 'รวมทุกหมวดงบประมาณ';
    if (filter.category === 'งบประมาณรายจ่าย') return 'งบประมาณรายจ่ายประจำปี';
    if (filter.category === 'เงินสะสม') return 'เงินสะสม (จ่ายขาด)';
    if (filter.category === 'เงินอุดหนุนเฉพาะกิจ') return 'เงินอุดหนุนเฉพาะกิจ';
    return filter.category;
  }, [filter.category]);

  const getBudgetCategoryBadgeClass = (category?: string): string => {
    const normalized = (category || '').trim();
    if (normalized.includes('งบประมาณรายจ่าย') || normalized.includes('ข้อบัญญัติ')) {
      return 'bg-sky-50 text-sky-800 border-sky-300';
    }
    if (normalized.includes('เงินสะสม')) {
      return 'bg-amber-50 text-amber-800 border-amber-300';
    }
    if (normalized.includes('อุดหนุนเฉพาะกิจ') || normalized.includes('เฉพาะกิจ')) {
      return 'bg-violet-50 text-violet-800 border-violet-300';
    }
    if (normalized.includes('อุดหนุนทั่วไป') || normalized.includes('อุดหนุน')) {
      return 'bg-teal-50 text-teal-800 border-teal-300';
    }
    if (!normalized) {
      return 'bg-slate-50 text-slate-600 border-slate-300';
    }
    const fallbackPalettes = [
      'bg-indigo-50 text-indigo-800 border-indigo-300',
      'bg-rose-50 text-rose-800 border-rose-300',
      'bg-cyan-50 text-cyan-800 border-cyan-300',
      'bg-orange-50 text-orange-800 border-orange-300'
    ];
    let hash = 0;
    for (let i = 0; i < normalized.length; i += 1) {
      hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
    }
    return fallbackPalettes[hash % fallbackPalettes.length];
  };

  return (
    <div className="space-y-3">
      {/* Table Toolbar */}
      <div className="bg-white rounded-2xl px-4 py-3.5 sm:px-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold font-heading text-slate-900 flex items-center gap-2">
            <span>ทะเบียนโครงการ — {categoryTitle}</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              พบ {sortedProjects.length} โครงการ
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            บัญชีรายชื่อโครงการก่อสร้างและบำรุงรักษา พร้อมสถานะสัญญาจ้างและงบประมาณ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Option 3: Re-number vacant project code gaps (Admin only, visible when gaps exist) */}
          {currentUser.role === 'admin' && onOpenRenumberModal && codeGapCount > 0 && (
            <button
              onClick={onOpenRenumberModal}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold text-xs rounded-xl border border-amber-300 transition active:scale-95 shadow-xs"
              title="พบช่องว่างของรหัสโครงการ — คลิกเพื่อตรวจสอบและเลือกจัดเรียงรหัสใหม่ (พร้อมตัวอย่างก่อนยืนยัน)"
            >
              <ListOrdered className="w-4 h-4 text-amber-700" />
              <span>จัดเรียงรหัสใหม่</span>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-600 text-white text-[10px] font-bold">
                ว่าง {codeGapCount}
              </span>
            </button>
          )}

          {/* Auto-fill Known Positions & Contractor Details Button (Admin only, visible when fillable blanks exist) */}
          {currentUser.role === 'admin' && onEnrichKnownData && fillableCount > 0 && (
            <button
              onClick={onEnrichKnownData}
              className="flex items-center gap-1.5 px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold text-xs rounded-xl border border-teal-200 transition active:scale-95 shadow-xs"
              title="เติมตำแหน่งกรรมการ/ผู้ควบคุมงาน และข้อมูลผู้รับจ้าง จากข้อมูลที่เคยบันทึกไว้ (เว้นว่างสำหรับรายชื่อที่ไม่เคยบันทึก)"
            >
              <UserCheck className="w-4 h-4 text-teal-600" />
              <span>เติมตำแหน่ง/ผู้รับจ้าง</span>
              <span className="px-1.5 py-0.2 rounded-full bg-teal-700 text-white text-[10px] font-bold">
                {fillableCount}
              </span>
            </button>
          )}

          {/* Export Excel Button */}
          <button
            onClick={() => exportProjectsToExcel(sortedProjects, `ทะเบียนโครงการ_${filter.fiscalYear}.xlsx`)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-xs rounded-xl border border-emerald-200 transition active:scale-95 shadow-xs"
            title="ส่งออกรายการที่กรองไว้เป็นไฟล์ Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>ส่งออก Excel</span>
          </button>

          {/* Add Project Button (Requirement 7: Admin only) */}
          {currentUser.role === 'admin' && (
            <button
              onClick={onOpenNewProjectModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-xl shadow-sm transition active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>เพิ่มโครงการ</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={filter.searchQuery}
            onChange={e => setFilter(prev => ({ ...prev, searchQuery: e.target.value }))}
            placeholder="ค้นหาชื่อ, เลขที่สัญญา, ผู้รับจ้าง..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        {/* Fiscal Year */}
        <div>
          <select
            value={filter.fiscalYear}
            onChange={e =>
              setFilter(prev => ({
                ...prev,
                fiscalYear: e.target.value === 'all' ? 'all' : Number(e.target.value)
              }))
            }
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            <option value="all">ทุกปีงบประมาณ</option>
            {availableYears.map(yr => (
              <option key={yr} value={yr}>
                ปีงบประมาณ พ.ศ. {yr}
              </option>
            ))}
          </select>
        </div>

        {/* Budget Category */}
        <div>
          <select
            value={filter.category}
            onChange={e => setFilter(prev => ({ ...prev, category: e.target.value }))}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            <option value="all">ทุกหมวดงบประมาณ</option>
            {Array.from(new Set(projects.map(p => p.budgetCategory).filter(Boolean)))
              .sort((a, b) => a.localeCompare(b, 'th'))
              .map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <select
            value={filter.status}
            onChange={e => setFilter(prev => ({ ...prev, status: e.target.value }))}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            <option value="all">ทุกสถานะการดำเนินงาน</option>
            <option value="not_started">ยังไม่เริ่มดำเนินการ</option>
            <option value="procurement_tor">จัดทำ TOR/ราคากลาง</option>
            <option value="contracted">ลงนามสัญญาแล้ว</option>
            <option value="in_progress">อยู่ระหว่างดำเนินการ</option>
            <option value="delivered">ส่งมอบงานแล้ว</option>
            <option value="inspected">ตรวจรับแล้ว</option>
            <option value="completed">แล้วเสร็จ/เบิกจ่ายแล้ว</option>
            <option value="overdue">เกินกำหนดสัญญา</option>
            <option value="cancelled">ยกเลิกโครงการ</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-305px)] min-h-[320px]">
          <table className="w-full text-left text-xs border-separate border-spacing-0">
            <thead>
              <tr className="text-slate-700 font-semibold">
                <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-3 px-2 text-center w-10 whitespace-nowrap">
                  ลำดับ
                </th>

                <th
                  onClick={() => handleSort('fiscalYear')}
                  className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-3 px-2 cursor-pointer hover:bg-slate-100 group whitespace-nowrap w-16"
                >
                  <div className="flex items-center">
                    <span>ปีงบ</span>
                    {renderSortIcon('fiscalYear')}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('name')}
                  className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-3 px-3 cursor-pointer hover:bg-slate-100 group min-w-[210px]"
                >
                  <div className="flex items-center">
                    <span>ชื่อโครงการ / รหัส</span>
                    {renderSortIcon('name')}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('approvedBudget')}
                  className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-3 px-2.5 text-center cursor-pointer hover:bg-slate-100 group whitespace-nowrap"
                  title="คลิกเพื่อเรียงตามงบประมาณที่ได้รับอนุมัติ"
                >
                  <div className="flex items-center justify-center">
                    <span>หมวดงบ / งบอนุมัติ</span>
                    {renderSortIcon('approvedBudget')}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('contractAmount')}
                  className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-3 px-2.5 cursor-pointer hover:bg-slate-100 group min-w-[165px] whitespace-nowrap"
                  title="คลิกเพื่อเรียงตามวงเงินสัญญา"
                >
                  <div className="flex items-center">
                    <span>ผู้รับจ้าง / สัญญา</span>
                    {renderSortIcon('contractAmount')}
                  </div>
                </th>

                <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-3 px-2.5 whitespace-nowrap">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleSort('startDate')}
                      className="inline-flex items-center hover:text-emerald-700 transition"
                      title="เรียงตามวันที่เริ่มสัญญา"
                    >
                      <span>เริ่ม</span>
                      {sortField === 'startDate' && renderSortIcon('startDate')}
                    </button>
                    <span className="text-slate-300">–</span>
                    <button
                      type="button"
                      onClick={() => handleSort('endDate')}
                      className="inline-flex items-center hover:text-emerald-700 transition"
                      title="เรียงตามวันที่สิ้นสุดสัญญา"
                    >
                      <span>สิ้นสุดสัญญา</span>
                      {sortField === 'endDate'
                        ? renderSortIcon('endDate')
                        : sortField !== 'startDate' && (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 ml-0.5 inline" />
                          )}
                    </button>
                  </div>
                </th>

                <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 py-3 px-2.5 text-center whitespace-nowrap">
                  สถานะ
                </th>

                <th className="sticky top-0 right-0 z-30 bg-slate-50 border-b border-l border-slate-200 py-3 px-2 w-[78px] text-center whitespace-nowrap shadow-[-4px_0_8px_-4px_rgba(15,23,42,0.06)]">
                  จัดการ
                </th>
              </tr>
            </thead>

            <tbody className="[&>tr>td]:border-b [&>tr>td]:border-slate-100 [&>tr:last-child>td]:border-b-0">
              {sortedProjects.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2.5 max-w-md mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1">
                        <HardHat className="w-6 h-6" />
                      </div>
                      {projects.length === 0 ? (
                        <>
                          <p className="text-base font-bold text-slate-800">
                            ระบบอยู่ในสถานะว่างเปล่าพร้อมใช้งาน (0 โครงการ)
                          </p>
                          <p className="text-xs text-slate-500">
                            ไม่มีโครงการตัวอย่างหลงเหลือในระบบ คุณสามารถเริ่มบันทึกโครงการจริงของ อบต.ไร่ใต้ หรือนำเข้าผ่านไฟล์ Excel ได้ทันที
                          </p>
                          {currentUser.role === 'admin' && (
                            <button
                              onClick={onOpenNewProjectModal}
                              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                            >
                              <PlusCircle className="w-4 h-4" />
                              <span>ลงทะเบียนโครงการใหม่</span>
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium">ไม่พบข้อมูลโครงการตามเงื่อนไขที่ค้นหา</p>
                          <button
                            onClick={() =>
                              setFilter({
                                fiscalYear: 'all',
                                category: 'all',
                                status: 'all',
                                searchQuery: ''
                              })
                            }
                            className="text-xs text-emerald-700 font-semibold hover:underline"
                          >
                            ล้างตัวกรองทั้งหมด
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                sortedProjects.map((p, idx) => {
                  const remaining = getDaysRemaining(p.endDate);
                  const isSelected = selectedRowId === p.id;
                  return (
                    <tr
                      key={p.id}
                      onClick={e => {
                        const clickedInteractive = Boolean((e.target as HTMLElement).closest('button, a'));
                        setSelectedRowId(prev =>
                          clickedInteractive ? p.id : prev === p.id ? null : p.id
                        );
                      }}
                      className={`transition-colors group cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50/75 [&>td]:shadow-[inset_0_1px_0_0_rgba(16,185,129,0.75),inset_0_-1px_0_0_rgba(16,185,129,0.75)] [&>td:first-child]:shadow-[inset_2px_1px_0_0_rgba(16,185,129,0.85),inset_0_-1px_0_0_rgba(16,185,129,0.75)]'
                          : 'hover:bg-emerald-50/40'
                      }`}
                    >
                      {/* 1. ลำดับ */}
                      <td className="py-3 px-2 text-center text-slate-500 font-medium whitespace-nowrap tabular-nums">
                        {idx + 1}
                      </td>

                      {/* 2. ปีงบประมาณ */}
                      <td className="py-3 px-2 whitespace-nowrap tabular-nums">
                        <span className="font-bold text-slate-800">{p.fiscalYear}</span>
                      </td>

                      {/* 3. ชื่อโครงการ */}
                      <td className="py-3 px-3 max-w-[300px]">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="px-1.5 py-0.2 rounded-xs bg-slate-100 text-slate-600 font-mono text-[10px] font-semibold">
                            {p.projectCode}
                          </span>
                        </div>
                        <button
                          onClick={() => onSelectProject(p, 1)}
                          className="block w-full font-semibold text-slate-800 hover:text-emerald-700 text-left transition leading-snug text-pretty [word-break:keep-all] break-words"
                        >
                          {renderThaiWordWrapped(p.name)}
                        </button>
                      </td>

                      {/* 4. หมวดงบประมาณ / งบอนุมัติ */}
                      <td className="py-3 px-2.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getBudgetCategoryBadgeClass(
                            p.budgetCategory
                          )}`}
                        >
                          {p.budgetCategory}
                        </span>
                        {p.meetingSession && (
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-32 mx-auto" title={p.meetingSession}>
                            {p.meetingSession}
                          </div>
                        )}
                        <div
                          className="mt-1 text-center text-xs font-semibold text-slate-800 tabular-nums"
                          title="งบประมาณที่ได้รับอนุมัติ"
                        >
                          {formatCurrency(p.approvedBudget)}{' '}
                          <span className="text-[10px] font-normal text-slate-400">บาท</span>
                        </div>
                      </td>

                      {/* 5. ผู้รับจ้าง / เลขที่สัญญา / วงเงินสัญญา */}
                      <td className="py-3 px-2.5 max-w-[210px]">
                        <div className="font-medium text-slate-800 truncate" title={p.contractorName || '-'}>
                          {p.contractorName || '-'}
                        </div>
                        {p.contractNo && (
                          <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                            เลขที่: {p.contractNo}
                          </div>
                        )}
                        <div
                          className="mt-0.5 text-xs font-bold text-emerald-800 tabular-nums whitespace-nowrap"
                          title="วงเงินตามสัญญาจ้าง"
                        >
                          {p.contractAmount ? (
                            <>
                              {formatCurrency(p.contractAmount)}{' '}
                              <span className="text-[10px] font-normal text-slate-400">บาท</span>
                            </>
                          ) : (
                            <span className="text-slate-400 font-normal">-</span>
                          )}
                        </div>
                      </td>

                      {/* 7. ระยะเวลาสัญญา (เริ่ม – สิ้นสุด) */}
                      <td className="py-3 px-2.5 whitespace-nowrap tabular-nums">
                        <div className="text-[11px] text-slate-500">
                          เริ่ม {formatThaiDate(p.startDate)}
                        </div>
                        <div className="text-slate-800 font-medium mt-0.5">
                          ถึง {formatThaiDate(p.endDate)}
                        </div>
                        {p.endDate && p.status !== 'completed' && p.status !== 'cancelled' && (
                          <span
                            className={`inline-block text-[10px] font-bold px-1.5 py-0.2 rounded-xs mt-0.5 ${
                              remaining.isOverdue
                                ? 'bg-rose-100 text-rose-700'
                                : remaining.days <= 30
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {remaining.label}
                          </span>
                        )}
                      </td>

                      {/* 8. สถานะโครงการ */}
                      <td className="py-3 px-2.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            p.status === 'completed'
                              ? 'bg-teal-100 text-teal-800 border border-teal-200'
                              : p.status === 'cancelled'
                              ? 'bg-slate-200/80 text-slate-600 border border-slate-300 line-through'
                              : p.status === 'in_progress'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : p.status === 'overdue'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : p.status === 'inspected'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : p.status === 'delivered'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : p.status === 'procurement_tor'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {STATUS_LABELS[p.status] || p.status}
                        </span>
                        {currentUser.role === 'admin' &&
                        p.status !== 'cancelled' &&
                        isProjectCompletedOrDisbursed(p) &&
                        (!p.remunerations ||
                          p.remunerations.length === 0 ||
                          p.remunerations.some(r => r.status !== 'paid' && r.status !== 'not_eligible')) ? (
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() => onSelectProject(p, 7)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition shadow-2xs"
                              title="โครงการแล้วเสร็จ/เบิกจ่ายแล้ว แต่ยังไม่ได้เบิกค่าตอบแทนหรือยังมีรายการที่ยังไม่เบิก คลิกเพื่อเปิดดูหมวดเบิกจ่ายและค่าตอบแทน"
                            >
                              <Coins className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>รอเบิกค่าตอบแทน</span>
                            </button>
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 mt-1">
                            ความคืบหน้า {calculateProjectProgress(p)}%
                          </div>
                        )}
                        {currentUser.role === 'admin' && getWorkNoticeAlert(p).hasAlert && (
                          <button
                            type="button"
                            onClick={() => onSelectProject(p, 5)}
                            className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
                              getWorkNoticeAlert(p).isOver15Days
                                ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                                : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                            }`}
                            title={getWorkNoticeAlert(p).fullMessage}
                          >
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>เร่งรัดเข้าทำงาน</span>
                          </button>
                        )}
                      </td>

                      {/* 9. ปุ่มจัดการข้อมูล */}
                      <td
                        className={`py-2 px-2 text-center whitespace-nowrap sticky right-0 z-10 border-l w-[78px] ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-200/80 shadow-[inset_-2px_1px_0_0_rgba(16,185,129,0.85),inset_0_-1px_0_0_rgba(16,185,129,0.75)]'
                            : 'bg-white group-hover:bg-[#f4fbf8] border-slate-100 group-hover:border-emerald-200/70 shadow-[-4px_0_8px_-4px_rgba(15,23,42,0.05)]'
                        }`}
                      >
                        <div
                          className={
                            currentUser.role === 'admin'
                              ? 'inline-grid grid-cols-2 gap-1 place-items-center'
                              : 'inline-flex items-center justify-center gap-1'
                          }
                        >
                          {/* View */}
                          <button
                            onClick={() => onSelectProject(p, 1)}
                            className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-100/60 rounded-lg transition"
                            title="ดูรายละเอียดโครงการฉบับเต็ม"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit (Admin only) */}
                          {currentUser.role === 'admin' && (
                            <button
                              onClick={() => onEditProject(p)}
                              className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-100/60 rounded-lg transition"
                              title="แก้ไขข้อมูลโครงการ"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete (Admin only enforcement) */}
                          {currentUser.role === 'admin' && (
                            <button
                              onClick={() => onDeleteProject(p)}
                              className="p-1.5 rounded-lg transition text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              title="ลบโครงการ"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Drive Attachments (Staff and Admin can open) */}
                          {p.attachments && p.attachments.length > 0 && (
                            <button
                              onClick={() => onSelectProject(p, getFirstAttachmentTab(p))}
                              className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-lg transition relative"
                              title={`เปิดดูไฟล์แนบใน Google Drive (${p.attachments.length} ไฟล์)`}
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-xs">
                                {p.attachments.length}
                              </span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer summary inside table */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div>
            แสดงผล <strong className="text-slate-800">{sortedProjects.length}</strong> จากทั้งหมด{' '}
            <strong className="text-slate-800">{projects.length}</strong> โครงการ
          </div>
          <div className="flex items-center gap-4">
            <span>
              งบรวมที่กรอง: <strong className="text-slate-800">{formatCurrency(sortedProjects.reduce((s, p) => s + (p.approvedBudget || 0), 0))}</strong> บาท
            </span>
            <span>
              สัญญารวมที่กรอง: <strong className="text-emerald-800">{formatCurrency(sortedProjects.reduce((s, p) => s + (p.contractAmount || 0), 0))}</strong> บาท
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
