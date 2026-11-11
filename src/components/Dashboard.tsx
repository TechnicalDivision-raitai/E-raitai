import React, { useMemo } from 'react';
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertOctagon,
  Coins,
  FileCheck,
  TrendingUp,
  AlertCircle,
  Building2,
  PiggyBank,
  ArrowUpRight,
  Sparkles,
  BarChart3,
  PieChart,
  HardHat
} from 'lucide-react';
import { Project, ProjectFilter, BudgetCategory, ProjectStatus, UserProfile } from '../types/project';
import { formatCurrency, formatThaiDate } from '../utils/thaiDate';
import { STATUS_LABELS } from '../utils/excelExport';

interface DashboardProps {
  projects: Project[];
  filter: ProjectFilter;
  setFilter: React.Dispatch<React.SetStateAction<ProjectFilter>>;
  availableYears: number[];
  onSelectProject: (p: Project) => void;
  onOpenNewProjectModal: () => void;
  currentUser?: UserProfile;
}

export const Dashboard: React.FC<DashboardProps> = ({
  projects,
  filter,
  setFilter,
  availableYears,
  onSelectProject,
  onOpenNewProjectModal,
  currentUser
}) => {
  // Apply filtering based on current filter state
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
        if (!matchName && !matchCode && !matchContract && !matchContractor) {
          return false;
        }
      }
      return true;
    });
  }, [projects, filter]);

  // Metric 1: Total
  const totalCount = filteredProjects.length;

  // Metric 2: In progress
  const inProgressCount = filteredProjects.filter(p => p.status === 'in_progress').length;

  // Metric 3: Completed
  const completedCount = filteredProjects.filter(p => p.status === 'completed').length;

  // Metric 4: Not started
  const notStartedCount = filteredProjects.filter(
    p => p.status === 'not_started' || p.status === 'procurement_tor'
  ).length;

  // Metric 5: Overdue
  const overdueCount = filteredProjects.filter(p => p.status === 'overdue').length;

  // Metric 6: Total Approved Budget
  const totalApprovedBudget = filteredProjects.reduce((sum, p) => sum + (p.approvedBudget || 0), 0);

  // Metric 7: Total Contract Amount
  const totalContractAmount = filteredProjects.reduce((sum, p) => sum + (p.contractAmount || 0), 0);

  // Metric 8: Total Disbursed Amount
  const totalDisbursedAmount = filteredProjects.reduce((sum, p) => {
    const paidInProject = (p.disbursements || [])
      .filter(d => d.status === 'paid')
      .reduce((sub, d) => sub + (d.amount || 0), 0);
    return sum + paidInProject;
  }, 0);

  // Disbursement rate percentage
  const disbursementPercent = totalContractAmount > 0
    ? Math.min(100, Math.round((totalDisbursedAmount / totalContractAmount) * 100))
    : 0;

  // Metric 9: Projects count by fiscal year
  const projectsByYear = useMemo(() => {
    const map: Record<number, number> = {};
    projects.forEach(p => {
      map[p.fiscalYear] = (map[p.fiscalYear] || 0) + 1;
    });
    return availableYears.map(yr => ({
      year: yr,
      count: map[yr] || 0
    }));
  }, [projects, availableYears]);

  // Metric 10: Budget by fiscal year
  const budgetByYear = useMemo(() => {
    const map: Record<number, { approved: number; contracted: number; disbursed: number }> = {};
    projects.forEach(p => {
      if (!map[p.fiscalYear]) {
        map[p.fiscalYear] = { approved: 0, contracted: 0, disbursed: 0 };
      }
      map[p.fiscalYear].approved += p.approvedBudget || 0;
      map[p.fiscalYear].contracted += p.contractAmount || 0;
      const disbursed = (p.disbursements || [])
        .filter(d => d.status === 'paid')
        .reduce((s, d) => s + d.amount, 0);
      map[p.fiscalYear].disbursed += disbursed;
    });

    return availableYears.map(yr => ({
      year: yr,
      ...(map[yr] || { approved: 0, contracted: 0, disbursed: 0 })
    }));
  }, [projects, availableYears]);

  // Metric 11: Progress status distribution
  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {
      not_started: 0,
      procurement_tor: 0,
      contracted: 0,
      in_progress: 0,
      delivered: 0,
      inspected: 0,
      completed: 0,
      overdue: 0
    };
    filteredProjects.forEach(p => {
      counts[p.status] = (counts[p.status] || 0) + 1;
    });
    return counts;
  }, [filteredProjects]);

  // Breakdown by budget category
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { count: number; totalBudget: number }> = {};
    filteredProjects.forEach(p => {
      const cat = p.budgetCategory || 'อื่นๆ';
      if (!map[cat]) map[cat] = { count: 0, totalBudget: 0 };
      map[cat].count += 1;
      map[cat].totalBudget += p.approvedBudget || 0;
    });
    return Object.entries(map).map(([category, val]) => ({
      category,
      ...val
    }));
  }, [filteredProjects]);

  const maxYearBudget = Math.max(...budgetByYear.map(b => b.approved), 1);

  return (
    <div className="space-y-6">
      {/* Top Banner / Breadcrumb & Active Filters */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-emerald-950/20 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-10 top-6 opacity-10">
          <HardHat className="w-48 h-48 text-white" />
        </div>

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/60 border border-emerald-500/30 text-emerald-200 text-xs font-medium mb-3">
            <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
            ระบบติดตามงานโครงการ กองช่าง
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold font-heading tracking-tight text-white mb-2">
            ภาพรวมงานโครงการกองช่าง
            {filter.fiscalYear !== 'all' ? ` ประจำปีงบประมาณ พ.ศ. ${filter.fiscalYear}` : ' (ทุกปีงบประมาณ)'}
          </h2>
          <p className="text-emerald-100/90 text-sm sm:text-base leading-relaxed">
            ติดตามความคืบหน้าโครงการก่อสร้าง ปรับปรุง บำรุงรักษา งานจัดซื้อจัดจ้างตามระเบียบพัสดุ
            และรายงานสถานะการเบิกจ่ายงบประมาณขององค์กรปกครองส่วนท้องถิ่น
          </p>
        </div>

        {/* Global Filter Bar Inside Banner / Card */}
        <div className="mt-6 pt-5 border-t border-emerald-600/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Year Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-emerald-200 mb-1">
              ปีงบประมาณ
            </label>
            <select
              value={filter.fiscalYear}
              onChange={e =>
                setFilter(prev => ({
                  ...prev,
                  fiscalYear: e.target.value === 'all' ? 'all' : Number(e.target.value)
                }))
              }
              className="w-full bg-emerald-950/60 border border-emerald-500/40 text-white rounded-xl px-3 py-2 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-400"
            >
              <option value="all">ทุกปีงบประมาณ</option>
              {availableYears.map(yr => (
                <option key={yr} value={yr}>
                  ปีงบประมาณ พ.ศ. {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-emerald-200 mb-1">
              หมวดงบประมาณ
            </label>
            <select
              value={filter.category}
              onChange={e => setFilter(prev => ({ ...prev, category: e.target.value }))}
              className="w-full bg-emerald-950/60 border border-emerald-500/40 text-white rounded-xl px-3 py-2 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-400"
            >
              <option value="all">ทุกหมวดงบประมาณ</option>
              <option value="เงินสะสม">เงินสะสม</option>
              <option value="งบประมาณรายจ่าย">งบประมาณรายจ่าย</option>
              <option value="เงินอุดหนุนเฉพาะกิจ">เงินอุดหนุนเฉพาะกิจ</option>
              <option value="เงินอุดหนุนทั่วไป">เงินอุดหนุนทั่วไป</option>
              <option value="เงินกู้/งบกลาง">เงินกู้/งบกลาง</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-emerald-200 mb-1">
              สถานะโครงการ
            </label>
            <select
              value={filter.status}
              onChange={e => setFilter(prev => ({ ...prev, status: e.target.value }))}
              className="w-full bg-emerald-950/60 border border-emerald-500/40 text-white rounded-xl px-3 py-2 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-400"
            >
              <option value="all">ทุกสถานะการดำเนินงาน</option>
              <option value="not_started">ยังไม่เริ่มดำเนินการ</option>
              <option value="procurement_tor">จัดทำ TOR/ราคากลาง</option>
              <option value="contracted">ลงนามสัญญาแล้ว</option>
              <option value="in_progress">อยู่ระหว่างดำเนินการ</option>
              <option value="delivered">ส่งมอบงานแล้ว รอตรวจรับ</option>
              <option value="inspected">ตรวจรับแล้ว รอเบิกจ่าย</option>
              <option value="completed">แล้วเสร็จ/เบิกจ่ายแล้ว</option>
              <option value="overdue">เกินกำหนดสัญญา</option>
            </select>
          </div>

          {/* Keyword Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-emerald-200 mb-1">
              ค้นหาชื่อ/เลขสัญญา
            </label>
            <input
              type="text"
              value={filter.searchQuery}
              onChange={e => setFilter(prev => ({ ...prev, searchQuery: e.target.value }))}
              placeholder="พิมพ์คำค้นหา..."
              className="w-full bg-emerald-950/60 border border-emerald-500/40 text-white placeholder-emerald-300/50 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-400"
            />
          </div>
        </div>
      </div>

      {/* 5 Status Summary Cards (Requirements 1-5) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* 1. Total */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">โครงการทั้งหมด</span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <FolderKanban className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-heading text-slate-800">
            {totalCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">โครงการในระบบ</div>
        </div>

        {/* 2. In progress */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-emerald-200/80 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-emerald-700">อยู่ระหว่างดำเนินการ</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-heading text-emerald-700">
            {inProgressCount}
          </div>
          <div className="text-[11px] text-emerald-600/80 mt-1">
            {totalCount > 0 ? Math.round((inProgressCount / totalCount) * 100) : 0}% ของทั้งหมด
          </div>
        </div>

        {/* 3. Completed */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-teal-200/80 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-teal-700">ดำเนินการแล้วเสร็จ</span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-heading text-teal-700">
            {completedCount}
          </div>
          <div className="text-[11px] text-teal-600/80 mt-1">
            {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}% ของทั้งหมด
          </div>
        </div>

        {/* 4. Not started */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-blue-200/80 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-blue-700">ยังไม่เริ่ม/ทำ TOR</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-heading text-blue-700">
            {notStartedCount}
          </div>
          <div className="text-[11px] text-blue-600/80 mt-1">รอเริ่มงาน/รอเปิดซอง</div>
        </div>

        {/* 5. Overdue */}
        <div
          className={`col-span-2 sm:col-span-1 rounded-2xl p-4 sm:p-5 border shadow-xs hover:shadow-md transition ${
            overdueCount > 0
              ? 'bg-rose-50/70 border-rose-300 text-rose-900'
              : 'bg-white border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className={`text-xs font-medium ${
                overdueCount > 0 ? 'text-rose-700 font-bold' : 'text-slate-500'
              }`}
            >
              เกินกำหนดสัญญา
            </span>
            <div
              className={`p-2 rounded-xl ${
                overdueCount > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`text-2xl sm:text-3xl font-bold font-heading ${
              overdueCount > 0 ? 'text-rose-600' : 'text-slate-700'
            }`}
          >
            {overdueCount}
          </div>
          <div
            className={`text-[11px] mt-1 ${
              overdueCount > 0 ? 'text-rose-600 font-semibold' : 'text-slate-400'
            }`}
          >
            {overdueCount > 0 ? 'ต้องเร่งรัดหรือคิดค่าปรับ' : 'ปกติ ไม่มีงานค้างสัญญา'}
          </div>
        </div>
      </div>

      {/* 3 Financial Overview Cards (Requirements 6, 7, 8) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 6. Total Approved Budget */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60">
                <PiggyBank className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500">งบประมาณรวมที่อนุมัติ</div>
                <div className="text-[11px] text-slate-400">Total Approved Budget</div>
              </div>
            </div>
          </div>
          <div className="text-2xl font-bold font-heading text-slate-900">
            {formatCurrency(totalApprovedBudget)} <span className="text-sm font-normal text-slate-500">บาท</span>
          </div>
          <div className="mt-3 text-xs text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100">
            <span>จำนวน {totalCount} โครงการ</span>
            <span className="text-amber-700 font-medium">กรอบวงเงินอนุมัติ</span>
          </div>
        </div>

        {/* 7. Total Contract Amount */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500">วงเงินตามสัญญารวม</div>
                <div className="text-[11px] text-slate-400">Total Contract Amount</div>
              </div>
            </div>
            {totalApprovedBudget > totalContractAmount && totalContractAmount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                ประหยัดงบได้ {formatCurrency(totalApprovedBudget - totalContractAmount)} บ.
              </span>
            )}
          </div>
          <div className="text-2xl font-bold font-heading text-emerald-800">
            {formatCurrency(totalContractAmount)} <span className="text-sm font-normal text-slate-500">บาท</span>
          </div>
          <div className="mt-3 text-xs text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100">
            <span>สัญญาที่ลงนามแล้ว</span>
            <span className="text-emerald-700 font-medium">
              {totalApprovedBudget > 0
                ? `${Math.round((totalContractAmount / totalApprovedBudget) * 100)}% ของงบอนุมัติ`
                : '0%'}
            </span>
          </div>
        </div>

        {/* 8. Total Disbursed Amount */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200/60">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500">เบิกจ่ายเงินแล้วจริง</div>
                <div className="text-[11px] text-slate-400">Total Disbursed</div>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
              {disbursementPercent}%
            </span>
          </div>
          <div className="text-2xl font-bold font-heading text-blue-800">
            {formatCurrency(totalDisbursedAmount)} <span className="text-sm font-normal text-slate-500">บาท</span>
          </div>
          {/* Visual progress bar for disbursement */}
          <div className="mt-3 space-y-1">
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${disbursementPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>คงเหลือเบิกจ่าย:</span>
              <span className="font-semibold text-slate-700">
                {formatCurrency(Math.max(0, totalContractAmount - totalDisbursedAmount))} บาท
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts & Analytical Breakdown (Requirements 9, 10, 11) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Requirement 10: กราฟงบประมาณแยกตามปีงบประมาณ */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-700" />
              <div>
                <h3 className="text-base font-bold text-slate-800 font-heading">
                  งบประมาณแยกตามปีงบประมาณ
                </h3>
                <p className="text-xs text-slate-500">เปรียบเทียบงบประมาณที่ได้รับอนุมัติ vs วงเงินสัญญา vs เบิกจ่าย</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {budgetByYear.map(item => {
              const approvedPct = (item.approved / maxYearBudget) * 100;
              const contractPct = (item.contracted / maxYearBudget) * 100;
              const disbursedPct = (item.disbursed / maxYearBudget) * 100;

              return (
                <div key={item.year} className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-800">
                      ปีงบประมาณ พ.ศ. {item.year}
                    </span>
                    <span className="text-xs text-slate-500">
                      {projectsByYear.find(p => p.year === item.year)?.count || 0} โครงการ
                    </span>
                  </div>

                  {/* 3 bars: Approved, Contract, Disbursed */}
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
                          งบอนุมัติ:
                        </span>
                        <span className="font-semibold">{formatCurrency(item.approved)} บ.</span>
                      </div>
                      <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all duration-500"
                          style={{ width: `${approvedPct}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                          วงเงินสัญญา:
                        </span>
                        <span className="font-semibold">{formatCurrency(item.contracted)} บ.</span>
                      </div>
                      <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                          style={{ width: `${contractPct}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 inline-block" />
                          เบิกจ่ายแล้ว:
                        </span>
                        <span className="font-semibold text-blue-700">{formatCurrency(item.disbursed)} บ.</span>
                      </div>
                      <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all duration-500"
                          style={{ width: `${disbursedPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Requirement 11: กราฟแสดงสถานะความคืบหน้าของโครงการ */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-emerald-700" />
                <div>
                  <h3 className="text-base font-bold text-slate-800 font-heading">
                    สถานะความคืบหน้าโครงการ
                  </h3>
                  <p className="text-xs text-slate-500">สัดส่วนโครงการตามขั้นตอนการดำเนินงาน</p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              {[
                { key: 'in_progress', label: 'อยู่ระหว่างดำเนินงาน', count: statusDistribution.in_progress, color: 'bg-emerald-500' },
                { key: 'completed', label: 'ดำเนินการแล้วเสร็จ (เบิกจ่ายแล้ว)', count: statusDistribution.completed, color: 'bg-teal-600' },
                { key: 'inspected', label: 'ตรวจรับแล้ว รอเบิกจ่าย', count: statusDistribution.inspected, color: 'bg-blue-500' },
                { key: 'contracted', label: 'ลงนามสัญญาแล้ว/รอเข้าทำงาน', count: statusDistribution.contracted, color: 'bg-indigo-500' },
                { key: 'delivered', label: 'ส่งมอบงานแล้ว รอตรวจรับ', count: statusDistribution.delivered, color: 'bg-purple-500' },
                { key: 'procurement_tor', label: 'จัดทำ TOR/ราคากลาง', count: statusDistribution.procurement_tor, color: 'bg-amber-500' },
                { key: 'not_started', label: 'ยังไม่เริ่มดำเนินการ', count: statusDistribution.not_started, color: 'bg-slate-400' },
                { key: 'overdue', label: 'เกินกำหนดสัญญา', count: statusDistribution.overdue, color: 'bg-rose-500' }
              ].map(item => {
                const percent = totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0;
                return (
                  <div key={item.key} className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-36">
                      <span className={`w-3 h-3 rounded-full shrink-0 ${item.color}`} />
                      <span className="text-slate-700 truncate">{item.label}</span>
                    </div>

                    <div className="flex-1 max-w-40 bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="text-right font-medium text-slate-600 min-w-16">
                      <span className="font-bold text-slate-800">{item.count}</span> โครงการ
                      <span className="text-[10px] text-slate-400 ml-1">({percent}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Category Summary */}
          <div className="mt-6 pt-4 border-t border-slate-100">
            <div className="text-xs font-bold text-slate-700 mb-2">สรุปตามหมวดงบประมาณ:</div>
            <div className="flex flex-wrap gap-1.5">
              {categoryBreakdown.map(cat => (
                <span
                  key={cat.category}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/60 text-xs"
                >
                  <span className="font-medium">{cat.category}:</span>
                  <strong className="text-emerald-900">{cat.count} โครงการ</strong>
                  <span className="text-emerald-600">({formatCurrency(cat.totalBudget)} บ.)</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Projects Table Preview */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800 font-heading">
              รายการโครงการล่าสุด
            </h3>
            <p className="text-xs text-slate-500">คลิกที่โครงการเพื่อเปิดดูรายละเอียดฉบับเต็มและเอกสารแนบ</p>
          </div>
          {currentUser?.role === 'admin' && (
            <button
              onClick={onOpenNewProjectModal}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              เพิ่มโครงการใหม่ <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">รหัส / ปี</th>
                <th className="py-3 px-4">ชื่อโครงการ</th>
                <th className="py-3 px-4">หมวดงบประมาณ</th>
                <th className="py-3 px-4 text-right">วงเงินสัญญา</th>
                <th className="py-3 px-4">ผู้รับจ้าง</th>
                <th className="py-3 px-4 text-center">สถานะ</th>
                <th className="py-3 px-4 text-center">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProjects.slice(0, 5).map(p => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="font-semibold text-slate-900">{p.projectCode}</span>
                    <span className="block text-[10px] text-slate-500">ปี {p.fiscalYear}</span>
                  </td>
                  <td className="py-3 px-4 max-w-xs sm:max-w-md">
                    <button
                      onClick={() => onSelectProject(p)}
                      className="font-medium text-slate-800 hover:text-emerald-700 text-left line-clamp-1"
                    >
                      {p.name}
                    </button>
                    <span className="text-[11px] text-slate-400 block truncate">{p.location}</span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                      {p.budgetCategory}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap font-medium text-slate-900">
                    {p.contractAmount ? `${formatCurrency(p.contractAmount)} บ.` : '-'}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                    {p.contractorName || '-'}
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        p.status === 'completed'
                          ? 'bg-teal-100 text-teal-800'
                          : p.status === 'in_progress'
                          ? 'bg-emerald-100 text-emerald-800'
                          : p.status === 'overdue'
                          ? 'bg-rose-100 text-rose-800'
                          : p.status === 'inspected'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {STATUS_LABELS[p.status] || p.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <button
                      onClick={() => onSelectProject(p)}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 px-2 py-1 rounded-md hover:bg-emerald-50 transition"
                    >
                      ดูข้อมูล
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
