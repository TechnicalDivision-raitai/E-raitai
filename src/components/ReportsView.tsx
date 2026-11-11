import React, { useState, useMemo } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Printer,
  Download,
  Filter,
  BarChart,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  HardHat,
  Coins
} from 'lucide-react';
import { Project, UserProfile } from '../types/project';
import { formatCurrency, formatThaiDate, getDaysRemaining, getCurrentThaiFiscalYear } from '../utils/thaiDate';
import { exportProjectsToExcel, STATUS_LABELS } from '../utils/excelExport';

interface ReportsViewProps {
  projects: Project[];
  availableYears: number[];
  currentUser: UserProfile;
  onSelectProject: (p: Project) => void;
}

type ReportType =
  | 'by_fiscal_year'       // รายงานแยกตามปีงบประมาณ
  | 'by_budget_category'   // รายงานแยกตามหมวดงบประมาณ
  | 'in_progress'          // รายงานที่อยู่ระหว่างดำเนินการ
  | 'completed'            // รายงานที่ดำเนินการแล้วเสร็จ
  | 'overdue'              // รายงานที่เกินกำหนดสัญญา
  | 'budget_vs_contract'   // รายงานเปรียบเทียบงบประมาณและวงเงินสัญญา
  | 'remuneration'         // รายงานการเบิกค่าตอบแทนกรรมการ
  | 'summary_all';         // รายงานสรุปภาพรวมทั้งหมด

export const ReportsView: React.FC<ReportsViewProps> = ({
  projects,
  availableYears,
  currentUser,
  onSelectProject
}) => {
  const [reportType, setReportType] = useState<ReportType>('summary_all');
  const [selectedYear, setSelectedYear] = useState<string | number>(() => getCurrentThaiFiscalYear());

  // Filter based on selected year
  const yearFilteredProjects = useMemo(() => {
    if (selectedYear === 'all') return projects;
    return projects.filter(p => p.fiscalYear === Number(selectedYear));
  }, [projects, selectedYear]);

  // Filter based on report type
  const reportProjects = useMemo(() => {
    switch (reportType) {
      case 'in_progress':
        return yearFilteredProjects.filter(p => p.status === 'in_progress');
      case 'completed':
        return yearFilteredProjects.filter(p => p.status === 'completed');
      case 'overdue':
        return yearFilteredProjects.filter(p => p.status === 'overdue');
      default:
        return yearFilteredProjects;
    }
  }, [yearFilteredProjects, reportType]);

  // Aggregate stats
  const totalApproved = reportProjects.reduce((sum, p) => sum + (p.approvedBudget || 0), 0);
  const totalContract = reportProjects.reduce((sum, p) => sum + (p.contractAmount || 0), 0);
  const totalDisbursed = reportProjects.reduce((sum, p) => {
    const paid = (p.disbursements || [])
      .filter(d => d.status === 'paid')
      .reduce((sub, d) => sub + d.amount, 0);
    return sum + paid;
  }, 0);

  // All remunerations across projects
  const allRemunerations = useMemo(() => {
    return reportProjects.flatMap(p =>
      (p.remunerations || []).map(r => ({
        ...r,
        projectCode: p.projectCode,
        projectName: p.name,
        fiscalYear: p.fiscalYear
      }))
    );
  }, [reportProjects]);

  const totalRemunerationAmount = allRemunerations.reduce((sum, r) => sum + (r.amount || 0), 0);

  const reportTitles: Record<ReportType, string> = {
    summary_all: 'รายงานสรุปภาพรวมโครงการกองช่างทั้งหมด',
    by_fiscal_year: 'รายงานโครงการแยกตามปีงบประมาณ',
    by_budget_category: 'รายงานโครงการแยกตามหมวดงบประมาณ',
    in_progress: 'รายงานโครงการที่อยู่ระหว่างดำเนินการ',
    completed: 'รายงานโครงการที่ดำเนินการแล้วเสร็จ',
    overdue: 'รายงานโครงการที่เกินกำหนดสัญญาและต้องเร่งรัด',
    budget_vs_contract: 'รายงานเปรียบเทียบวงเงินงบประมาณและวงเงินตามสัญญาจ้าง',
    remuneration: 'รายงานสรุปการเบิกจ่ายค่าตอบแทนคณะกรรมการ'
  };

  return (
    <div className="space-y-6">
      {/* Control Panel (Hidden during print) */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold font-heading text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-700" />
            <span>ระบบออกรายงานและสถิติกองช่าง</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            สร้างรายงานทางราชการ พิมพ์ออกเอกสาร PDF หรือส่งออกเป็นไฟล์ Excel/CSV
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Year Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
            <Calendar className="w-4 h-4 text-slate-500" />
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="bg-transparent font-semibold text-slate-700 focus:outline-hidden cursor-pointer"
            >
              <option value="all">ทุกปีงบประมาณ</option>
              {availableYears.map(yr => (
                <option key={yr} value={yr}>
                  พ.ศ. {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Export Excel */}
          <button
            onClick={() => exportProjectsToExcel(reportProjects, `${reportTitles[reportType]}.xlsx`)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-xs rounded-xl border border-emerald-200 transition active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>ส่งออก Excel</span>
          </button>

          {/* Print Report */}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-xl shadow-xs transition active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>พิมพ์รายงาน (Print / PDF)</span>
          </button>
        </div>
      </div>

      {/* Report Types Pills Navigation (no-print) */}
      <div className="bg-white rounded-2xl p-2.5 border border-slate-200/80 shadow-xs flex gap-1.5 overflow-x-auto scrollbar-none no-print">
        {(Object.keys(reportTitles) as ReportType[]).map(type => (
          <button
            key={type}
            onClick={() => setReportType(type)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              reportType === type
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {reportTitles[type]}
          </button>
        ))}
      </div>

      {/* Report Printable Document Container */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm printable-area space-y-6">
        {/* Official Header */}
        <div className="text-center pb-4 border-b-2 border-slate-800 space-y-1">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            รายงานทางราชการ กองช่าง องค์การบริหารส่วนตำบลดอนหวาย
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">
            {reportTitles[reportType]}
          </h2>
          <div className="text-xs text-slate-600">
            {selectedYear !== 'all' ? `ประจำปีงบประมาณ พ.ศ. ${selectedYear}` : 'รวมทุกปีงบประมาณ'}{' '}
            | ข้อมูล ณ {formatThaiDate(new Date().toISOString(), 'full')}
          </div>
        </div>

        {/* Report Financial Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div>
            <div className="text-slate-500">จำนวนโครงการในรายงาน</div>
            <div className="text-lg font-bold text-slate-800 mt-0.5">
              {reportProjects.length} โครงการ
            </div>
          </div>
          <div>
            <div className="text-slate-500">งบประมาณรวมที่อนุมัติ</div>
            <div className="text-lg font-bold text-slate-800 mt-0.5">
              {formatCurrency(totalApproved)} บ.
            </div>
          </div>
          <div>
            <div className="text-slate-500">วงเงินตามสัญญารวม</div>
            <div className="text-lg font-bold text-emerald-800 mt-0.5">
              {formatCurrency(totalContract)} บ.
            </div>
          </div>
          <div>
            <div className="text-slate-500">เบิกจ่ายแล้วจริง</div>
            <div className="text-lg font-bold text-blue-800 mt-0.5">
              {formatCurrency(totalDisbursed)} บ.
            </div>
          </div>
        </div>

        {/* Main Table for Report */}
        {reportType === 'remuneration' ? (
          /* Specialized Committee Remuneration Report */
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse border border-slate-300">
              <thead className="bg-slate-100 font-semibold text-slate-700">
                <tr>
                  <th className="p-2.5 border border-slate-300 text-center w-12">ลำดับ</th>
                  <th className="p-2.5 border border-slate-300">รหัส / โครงการ</th>
                  <th className="p-2.5 border border-slate-300">รายการค่าตอบแทน</th>
                  <th className="p-2.5 border border-slate-300">ผู้รับเงิน</th>
                  <th className="p-2.5 border border-slate-300 text-right">จำนวนเงิน (บาท)</th>
                  <th className="p-2.5 border border-slate-300 text-center">วันที่เบิก / เลขที่ฎีกา</th>
                  <th className="p-2.5 border border-slate-300 text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {allRemunerations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400">
                      ไม่พบข้อมูลการเบิกจ่ายค่าตอบแทนตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  allRemunerations.map((rem, idx) => (
                    <tr key={rem.id} className="hover:bg-slate-50">
                      <td className="p-2 border border-slate-300 text-center">{idx + 1}</td>
                      <td className="p-2 border border-slate-300 max-w-xs">
                        <span className="font-mono text-[10px] text-slate-500 block">{rem.projectCode}</span>
                        <span className="font-medium line-clamp-1">{rem.projectName}</span>
                      </td>
                      <td className="p-2 border border-slate-300 font-medium">{rem.title}</td>
                      <td className="p-2 border border-slate-300">{rem.payeeName || '-'}</td>
                      <td className="p-2 border border-slate-300 text-right font-bold text-slate-800">
                        {formatCurrency(rem.amount)}
                      </td>
                      <td className="p-2 border border-slate-300 text-center">
                        {rem.withdrawDate ? formatThaiDate(rem.withdrawDate) : '-'}{' '}
                        {rem.petitionNo ? `(${rem.petitionNo})` : ''}
                      </td>
                      <td className="p-2 border border-slate-300 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            rem.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {rem.status === 'paid' ? 'เบิกแล้ว' : 'ยังไม่เบิก'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-100 font-bold">
                <tr>
                  <td colSpan={4} className="p-2.5 border border-slate-300 text-right">
                    รวมค่าตอบแทนทั้งสิ้น:
                  </td>
                  <td className="p-2.5 border border-slate-300 text-right text-emerald-800">
                    {formatCurrency(totalRemunerationAmount)} บาท
                  </td>
                  <td colSpan={2} className="p-2.5 border border-slate-300" />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          /* Standard Projects Registry Report */
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse border border-slate-300">
              <thead className="bg-slate-100 font-semibold text-slate-700">
                <tr>
                  <th className="p-2 border border-slate-300 text-center w-10">ลำดับ</th>
                  <th className="p-2 border border-slate-300 w-20">ปีงบ / รหัส</th>
                  <th className="p-2 border border-slate-300">ชื่อโครงการ</th>
                  <th className="p-2 border border-slate-300">หมวดงบ</th>
                  <th className="p-2 border border-slate-300 text-right">งบอนุมัติ (บาท)</th>
                  <th className="p-2 border border-slate-300 text-right">วงเงินสัญญา (บาท)</th>
                  <th className="p-2 border border-slate-300">ผู้รับจ้าง / เลขสัญญา</th>
                  <th className="p-2 border border-slate-300 text-center">ระยะเวลาสัญญา</th>
                  <th className="p-2 border border-slate-300 text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {reportProjects.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      ไม่พบข้อมูลโครงการตามประเภทรายงานที่เลือก
                    </td>
                  </tr>
                ) : (
                  reportProjects.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-2 border border-slate-300 text-center">{idx + 1}</td>
                      <td className="p-2 border border-slate-300 whitespace-nowrap">
                        <span className="font-bold text-slate-800">{p.fiscalYear}</span>
                        <span className="block text-[10px] text-slate-500 font-mono">{p.projectCode}</span>
                      </td>
                      <td className="p-2 border border-slate-300 max-w-xs">
                        <button
                          onClick={() => onSelectProject(p)}
                          className="font-semibold text-slate-800 hover:text-emerald-700 text-left line-clamp-2"
                        >
                          {p.name}
                        </button>
                        <span className="text-[10px] text-slate-400 block truncate">{p.location}</span>
                      </td>
                      <td className="p-2 border border-slate-300 whitespace-nowrap">{p.budgetCategory}</td>
                      <td className="p-2 border border-slate-300 text-right font-medium">
                        {formatCurrency(p.approvedBudget)}
                      </td>
                      <td className="p-2 border border-slate-300 text-right font-bold text-slate-800">
                        {p.contractAmount ? formatCurrency(p.contractAmount) : '-'}
                      </td>
                      <td className="p-2 border border-slate-300">
                        <div className="font-medium line-clamp-1">{p.contractorName || '-'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{p.contractNo || '-'}</div>
                      </td>
                      <td className="p-2 border border-slate-300 text-center whitespace-nowrap text-[11px]">
                        {formatThaiDate(p.startDate)} - {formatThaiDate(p.endDate)}
                      </td>
                      <td className="p-2 border border-slate-300 text-center whitespace-nowrap">
                        <span className="font-medium">{STATUS_LABELS[p.status] || p.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-100 font-bold">
                <tr>
                  <td colSpan={4} className="p-2.5 border border-slate-300 text-right">
                    รวมทั้งสิ้น ({reportProjects.length} โครงการ):
                  </td>
                  <td className="p-2.5 border border-slate-300 text-right">
                    {formatCurrency(totalApproved)}
                  </td>
                  <td className="p-2.5 border border-slate-300 text-right text-emerald-800">
                    {formatCurrency(totalContract)}
                  </td>
                  <td colSpan={3} className="p-2.5 border border-slate-300 text-center text-slate-500">
                    เบิกจ่ายแล้วจริง: {formatCurrency(totalDisbursed)} บาท
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Official Signatures Footer */}
        <div className="pt-10 mt-6 border-t border-slate-300 grid grid-cols-2 gap-8 text-center text-xs">
          <div className="space-y-12">
            <p>ลงชื่อ.......................................................... ผู้จัดทำรายงาน</p>
            <div>
              <p className="font-bold">({currentUser.displayName})</p>
              <p className="text-slate-500 text-[11px]">ตำแหน่ง {currentUser.position}</p>
            </div>
          </div>

          <div className="space-y-12">
            <p>ลงชื่อ.......................................................... ผู้อำนวยการกองช่าง / ผู้รับรอง</p>
            <div>
              <p className="font-bold">(นายสมชาย รัตนวิเชียร)</p>
              <p className="text-slate-500 text-[11px]">ผู้อำนวยการกองช่าง</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
