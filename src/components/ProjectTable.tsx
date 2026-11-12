import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  FileSpreadsheet,
  Download,
  Eye,
  Edit,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  PlusCircle,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  Sparkles,
  ExternalLink,
  HardHat,
  Paperclip
} from 'lucide-react';
import { Project, ProjectFilter, UserProfile } from '../types/project';
import { formatCurrency, formatThaiDate, getDaysRemaining } from '../utils/thaiDate';
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
}

type SortField = 'sequence' | 'fiscalYear' | 'name' | 'startDate' | 'endDate' | 'approvedBudget' | 'contractAmount';
type SortOrder = 'asc' | 'desc';

export const ProjectTable: React.FC<ProjectTableProps> = ({
  projects,
  filter,
  setFilter,
  availableYears,
  currentUser,
  onSelectProject,
  onEditProject,
  onDeleteProject,
  onOpenNewProjectModal
}) => {
  const [sortField, setSortField] = useState<SortField>('fiscalYear');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

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

  return (
    <div className="space-y-4">
      {/* Table Toolbar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
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
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 text-slate-700 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-3 text-center w-12">ลำดับ</th>

                <th
                  onClick={() => handleSort('fiscalYear')}
                  className="py-3.5 px-3 cursor-pointer hover:bg-slate-100 group whitespace-nowrap"
                >
                  <div className="flex items-center">
                    <span>ปีงบ</span>
                    {renderSortIcon('fiscalYear')}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('name')}
                  className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 group min-w-64"
                >
                  <div className="flex items-center">
                    <span>ชื่อโครงการ / รหัส</span>
                    {renderSortIcon('name')}
                  </div>
                </th>

                <th className="py-3.5 px-3 whitespace-nowrap">หมวดงบประมาณ</th>

                <th
                  onClick={() => handleSort('approvedBudget')}
                  className="py-3.5 px-3 text-right cursor-pointer hover:bg-slate-100 group whitespace-nowrap"
                >
                  <div className="flex items-center justify-end">
                    <span>งบอนุมัติ (บาท)</span>
                    {renderSortIcon('approvedBudget')}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('contractAmount')}
                  className="py-3.5 px-3 text-right cursor-pointer hover:bg-slate-100 group whitespace-nowrap"
                >
                  <div className="flex items-center justify-end">
                    <span>วงเงินสัญญา (บาท)</span>
                    {renderSortIcon('contractAmount')}
                  </div>
                </th>

                <th className="py-3.5 px-4 min-w-44">ผู้รับจ้าง / สัญญา</th>

                <th
                  onClick={() => handleSort('startDate')}
                  className="py-3.5 px-3 cursor-pointer hover:bg-slate-100 group whitespace-nowrap"
                >
                  <div className="flex items-center">
                    <span>เริ่มสัญญา</span>
                    {renderSortIcon('startDate')}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('endDate')}
                  className="py-3.5 px-3 cursor-pointer hover:bg-slate-100 group whitespace-nowrap"
                >
                  <div className="flex items-center">
                    <span>สิ้นสุดสัญญา</span>
                    {renderSortIcon('endDate')}
                  </div>
                </th>

                <th className="py-3.5 px-3 text-center whitespace-nowrap">สถานะ</th>

                <th className="py-3.5 px-3 text-center whitespace-nowrap sticky right-0 bg-slate-50/95 shadow-xs">
                  จัดการ
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {sortedProjects.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-14 text-center text-slate-400">
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
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-emerald-50/40 transition-colors group"
                    >
                      {/* 1. ลำดับ */}
                      <td className="py-3.5 px-3 text-center text-slate-500 font-medium whitespace-nowrap">
                        {idx + 1}
                      </td>

                      {/* 2. ปีงบประมาณ */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="font-bold text-slate-800">พ.ศ. {p.fiscalYear}</span>
                      </td>

                      {/* 3. ชื่อโครงการ */}
                      <td className="py-3.5 px-4 max-w-sm">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="px-1.5 py-0.2 rounded-xs bg-slate-100 text-slate-600 font-mono text-[10px] font-semibold">
                            {p.projectCode}
                          </span>
                          {p.attachments && p.attachments.length > 0 && (
                            <button
                              onClick={() => onSelectProject(p, 8)}
                              className="text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded-sm border border-emerald-200 inline-flex items-center gap-1 font-semibold transition"
                              title="คลิกเพื่อดูไฟล์แนบใน Google Drive"
                            >
                              <Paperclip className="w-2.5 h-2.5" />
                              <span>{p.attachments.length} ไฟล์ Drive</span>
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => onSelectProject(p, 1)}
                          className="font-semibold text-slate-800 hover:text-emerald-700 text-left transition line-clamp-2 leading-snug"
                        >
                          {p.name}
                        </button>
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {p.location}
                        </div>
                      </td>

                      {/* 4. หมวดงบประมาณ */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200/60">
                          {p.budgetCategory}
                        </span>
                        {p.meetingSession && (
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-32">
                            {p.meetingSession}
                          </div>
                        )}
                      </td>

                      {/* 5. งบประมาณ */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap font-medium text-slate-700">
                        {formatCurrency(p.approvedBudget)}
                      </td>

                      {/* 6. วงเงินตามสัญญา */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap font-bold text-slate-900">
                        {p.contractAmount ? formatCurrency(p.contractAmount) : '-'}
                      </td>

                      {/* 7. ผู้รับจ้าง */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-medium text-slate-800 line-clamp-1">
                          {p.contractorName || '-'}
                        </div>
                        {p.contractNo && (
                          <div className="text-[11px] text-slate-500 font-mono">
                            เลขที่: {p.contractNo}
                          </div>
                        )}
                      </td>

                      {/* 8. วันที่เริ่มสัญญา */}
                      <td className="py-3.5 px-3 whitespace-nowrap text-slate-600">
                        {formatThaiDate(p.startDate)}
                      </td>

                      {/* 9. วันที่สิ้นสุดสัญญา */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="text-slate-700">{formatThaiDate(p.endDate)}</div>
                        {p.endDate && p.status !== 'completed' && (
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

                      {/* 10. สถานะโครงการ */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            p.status === 'completed'
                              ? 'bg-teal-100 text-teal-800 border border-teal-200'
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
                        <div className="text-[10px] text-slate-400 mt-1">
                          ความคืบหน้า {p.progressPercent}%
                        </div>
                      </td>

                      {/* 11. ปุ่มจัดการข้อมูล */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap sticky right-0 bg-white group-hover:bg-emerald-50/40 shadow-xs">
                        <div className="flex items-center justify-center gap-1">
                          {/* View */}
                          <button
                            onClick={() => onSelectProject(p, 1)}
                            className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-100/60 rounded-lg transition"
                            title="ดูรายละเอียดโครงการฉบับเต็ม"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Drive Attachments (Staff and Admin can open) */}
                          {p.attachments && p.attachments.length > 0 && (
                            <button
                              onClick={() => onSelectProject(p, 8)}
                              className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-lg transition relative"
                              title={`เปิดดูไฟล์แนบใน Google Drive (${p.attachments.length} ไฟล์)`}
                            >
                              <Paperclip className="w-4 h-4" />
                              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-xs">
                                {p.attachments.length}
                              </span>
                            </button>
                          )}

                          {/* Edit (Admin only) */}
                          {currentUser.role === 'admin' && (
                            <button
                              onClick={() => onEditProject(p)}
                              className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-100/60 rounded-lg transition"
                              title="แก้ไขข้อมูลโครงการ"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete (Admin only enforcement) */}
                          {currentUser.role === 'admin' && (
                            <button
                              onClick={() => onDeleteProject(p)}
                              className="p-1.5 rounded-lg transition text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              title="ลบโครงการ"
                            >
                              <Trash2 className="w-4 h-4" />
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
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
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
