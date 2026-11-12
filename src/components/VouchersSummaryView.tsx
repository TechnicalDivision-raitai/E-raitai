import React, { useState, useMemo } from 'react';
import {
  PieChart,
  Receipt,
  Coins,
  Filter,
  Calendar,
  ArrowUpRight,
  FileCheck,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { Project } from '../types/project';
import { formatCurrency, formatThaiDate, getCurrentThaiFiscalYear } from '../utils/thaiDate';

interface VouchersSummaryViewProps {
  projects: Project[];
  availableYears: number[];
  onSelectProject: (p: Project) => void;
  selectedYear?: string | number;
  onSelectYear?: (year: string | number) => void;
}

export const VouchersSummaryView: React.FC<VouchersSummaryViewProps> = ({
  projects,
  availableYears,
  onSelectProject,
  selectedYear = 'all',
  onSelectYear
}) => {
  // Filter projects by fiscal year (from top header filter)
  const filteredProjects = useMemo(() => {
    if (!selectedYear || selectedYear === 'all') return projects;
    return projects.filter(p => p.fiscalYear === Number(selectedYear));
  }, [projects, selectedYear]);

  // Aggregate all disbursements & remunerations into voucher rows
  const allVouchers = useMemo(() => {
    const list: Array<{
      id: string;
      project: Project;
      petitionNo: string;
      voucherDate: string;
      category: string;
      payee: string;
      amount: number;
      status: 'pending' | 'paid';
    }> = [];

    filteredProjects.forEach(p => {
      // 1. Project progress disbursements
      (p.disbursements || []).forEach(d => {
        list.push({
          id: `disb-${d.id}`,
          project: p,
          petitionNo: d.petitionNo || `ฎีกาเบิกงวดที่ ${d.installment}`,
          voucherDate: d.disbursementDate,
          category: 'ค่าจ้างเหมาก่อสร้างตามสัญญา',
          payee: p.contractorName || '-',
          amount: d.amount || 0,
          status: d.status
        });
      });

      // 2. Committee remunerations
      (p.remunerations || []).forEach(r => {
        list.push({
          id: `rem-${r.id}`,
          project: p,
          petitionNo: r.petitionNo || `ฎีกาค่าตอบแทน`,
          voucherDate: r.withdrawDate,
          category: r.title || 'ค่าตอบแทนคณะกรรมการ',
          payee: r.payeeName || '-',
          amount: r.amount || 0,
          status: r.status
        });
      });
    });

    return list.sort((a, b) => (b.voucherDate || '').localeCompare(a.voucherDate || ''));
  }, [filteredProjects]);

  // Financial totals
  const totalVouchersCount = allVouchers.length;
  const grandTotalAmount = allVouchers.reduce((sum, v) => sum + v.amount, 0);
  const paidTotalAmount = allVouchers.filter(v => v.status === 'paid').reduce((sum, v) => sum + v.amount, 0);

  // Group by category
  const categorySummary = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    allVouchers.forEach(v => {
      const cat = v.category || 'อื่นๆ';
      if (!map[cat]) map[cat] = { count: 0, total: 0 };
      map[cat].count += 1;
      map[cat].total += v.amount;
    });
    return Object.entries(map).map(([category, val]) => ({
      category,
      ...val
    }));
  }, [allVouchers]);

  return (
    <div className="space-y-6">
      {/* Top Filter Info Bar (Single Top Header Filter Used) */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <Filter className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 font-heading">
              สรุปรายงานข้อมูลฎีกาและการเบิกจ่าย
            </h3>
            <p className="text-xs text-gray-500">
              ควบคุมตัวกรองปีงบประมาณผ่านแถบด้านบน (Header) แสดงยอดเงิน สัดส่วน และรายการฎีกาตามปีที่เลือก
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-rose-50/80 border border-rose-200/90 rounded-xl px-4 py-2">
          <Calendar className="w-4 h-4 text-rose-600" />
          <span className="text-xs font-semibold text-rose-900">ปีงบประมาณที่กรอง:</span>
          <span className="text-sm font-bold text-rose-950">
            {selectedYear === 'all' ? 'ทุกปีงบประมาณ' : `พ.ศ. ${selectedYear}`}
          </span>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase">จำนวนฎีกาทั้งหมด</span>
          <div className="flex items-end justify-between mt-2">
            <span className="text-2xl md:text-3xl font-bold font-heading text-gray-800">
              {totalVouchersCount}
            </span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="text-[11px] text-gray-400 mt-2">
            ฎีกาค่าจ้างและค่าตอบแทนกรรมการ
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between md:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">
              ยอดเงินขอเบิกรวมทั้งหมด
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
              เบิกจ่ายแล้วจริง {formatCurrency(paidTotalAmount)} บ.
            </span>
          </div>
          <div className="flex items-end justify-between mt-2">
            <span className="text-2xl md:text-3xl font-bold font-heading text-rose-600">
              {formatCurrency(grandTotalAmount)} บาท
            </span>
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div className="w-full bg-gray-100 h-2 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all duration-500"
              style={{
                width: `${grandTotalAmount > 0 ? Math.round((paidTotalAmount / grandTotalAmount) * 100) : 0}%`
              }}
            />
          </div>
        </div>
      </div>

      {/* Tables: Category Breakdown & Recent Vouchers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown Table */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-gray-800 font-heading mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
              <PieChart className="w-4 h-4 text-rose-500" />
              <span>สรุปยอดเงินแยกตามประเภทฎีกา</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-gray-50 text-gray-500 uppercase font-semibold">
                  <tr>
                    <th className="p-3">ประเภทฎีกา</th>
                    <th className="p-3 text-center">จำนวน</th>
                    <th className="p-3 text-right">ยอดเงินรวม (บาท)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {categorySummary.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-gray-400">
                        ยังไม่มีข้อมูลสำหรับสรุปงานฎีกาในปีนี้
                      </td>
                    </tr>
                  ) : (
                    categorySummary.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-800">{item.category}</td>
                        <td className="p-3 text-center font-semibold text-gray-600">
                          {item.count} รายการ
                        </td>
                        <td className="p-3 text-right font-bold text-rose-700">
                          {formatCurrency(item.total)} บาท
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 mt-4 flex items-center justify-between text-xs text-gray-500">
            <span>รวม {categorySummary.length} หมวดค่าใช้จ่าย</span>
            <span className="font-bold text-gray-800">
              ยอดสุทธิ: {formatCurrency(grandTotalAmount)} บาท
            </span>
          </div>
        </div>

        {/* Recent Vouchers List */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-gray-800 font-heading mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <span>รายการงานฎีกาล่าสุด</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-gray-50 text-gray-500 uppercase font-semibold">
                  <tr>
                    <th className="p-3">เลขผู้เบิก</th>
                    <th className="p-3">โครงการ / ผู้รับเงิน</th>
                    <th className="p-3 text-right">จำนวนเงิน (บาท)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-gray-400">
                        ไม่มีรายการงานฎีกาในปีนี้
                      </td>
                    </tr>
                  ) : (
                    allVouchers.slice(0, 6).map(v => (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="p-3 font-bold text-rose-600 whitespace-nowrap font-mono">
                          {v.petitionNo}
                          <span className="block text-[10px] text-gray-400 font-normal">
                            {formatThaiDate(v.voucherDate)}
                          </span>
                        </td>
                        <td className="p-3 max-w-xs">
                          <button
                            onClick={() => onSelectProject(v.project)}
                            className="font-medium text-gray-800 hover:text-emerald-700 text-left line-clamp-1"
                          >
                            {v.project.name}
                          </button>
                          <div className="text-[10px] text-gray-400 truncate">
                            ผู้รับ: {v.payee}
                          </div>
                        </td>
                        <td className="p-3 text-right font-bold text-rose-700 whitespace-nowrap">
                          {formatCurrency(v.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 mt-4 text-right">
            <span className="text-[11px] text-gray-400">
              อ้างอิงข้อมูลฎีกาจากหมวดที่ 5 และหมวดที่ 6 ของแต่ละโครงการ
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
