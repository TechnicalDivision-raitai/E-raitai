import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  X,
  FileCheck,
  HardHat
} from 'lucide-react';
import { Project, BudgetCategory, ProjectStatus } from '../types/project';
import { downloadSampleExcelTemplate } from '../utils/excelExport';
import { formatCurrency, calculateProjectProgress } from '../utils/thaiDate';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingProjects: Project[];
  onImportSuccess: (newProjects: Project[]) => void;
}

interface ParsedRow {
  rowIdx: number;
  data: Project;
  raw: any;
  isValid: boolean;
  isDuplicate: boolean;
  isUpdate: boolean;
  errors: string[];
  warnings: string[];
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  existingProjects,
  onImportSuccess
}) => {
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' });

        const rows: ParsedRow[] = jsonData.map((row: any, idx: number) => {
          const errors: string[] = [];
          const warnings: string[] = [];

          const importedCode = String(row['รหัสโครงการ'] || row['รหัส'] || '').trim();
          const fiscalYear = Number(row['ปีงบประมาณ']) || 2569;
          const name = String(row['ชื่อโครงการ'] || '').trim();
          const category = (String(row['หมวดงบประมาณ'] || 'งบประมาณรายจ่าย').trim()) as BudgetCategory;
          const importedDescription = String(row['รายละเอียดโครงการ'] || row['รายละเอียด'] || '').trim();
          const meetingSession = String(row['สมัยประชุม'] || '').trim();
          const approvedBudget = Number(row['งบประมาณอนุมัติ'] || 0);
          const location = String(row['สถานที่ดำเนินโครงการ'] || '').trim();
          const responsiblePerson = String(row['ผู้รับผิดชอบโครงการ'] || '').trim();

          const contractNo = String(row['เลขที่สัญญา'] || '').trim();
          const contractorName = String(row['ชื่อผู้รับจ้าง'] || '').trim();
          const contractAmount = Number(row['วงเงินสัญญา'] || 0);
          const startDate = String(row['วันที่เริ่มสัญญา'] || '').trim();
          const endDate = String(row['วันที่สิ้นสุดสัญญา'] || '').trim();
          const rawStatus = String(row['สถานะ'] || '').trim() as ProjectStatus;

          // Validation
          if (!name) {
            errors.push('ไม่มีชื่อโครงการ');
          }
          if (approvedBudget <= 0) {
            warnings.push('งบประมาณเป็น 0');
          }

          // Duplicate checking: Priority 1 - Match by projectCode, Priority 2 - Match by contractNo or name
          const matchedByCode = importedCode
            ? existingProjects.find(p => p.projectCode && p.projectCode.trim().toLowerCase() === importedCode.toLowerCase())
            : undefined;

          const matchedByContractOrName = existingProjects.find(
            p =>
              (contractNo && p.contractNo && p.contractNo.trim().toLowerCase() === contractNo.toLowerCase()) ||
              p.name.trim().toLowerCase() === name.toLowerCase()
          );

          const matchedExisting = matchedByCode || matchedByContractOrName;
          const isDuplicate = Boolean(matchedExisting);
          const isUpdate = isDuplicate;

          if (isDuplicate && matchedExisting) {
            warnings.push(
              matchedByCode
                ? `พบรหัสโครงการ "${matchedExisting.projectCode}" ซ้ำ: จะอัปเดตข้อมูลและคงค่าเดิมในช่องที่ว่าง`
                : `พบชื่อ/สัญญาซ้ำกับ "${matchedExisting.name}": จะอัปเดตข้อมูลและคงค่าเดิมในช่องที่ว่าง`
            );
          }

          // Construct project object with upsert merge (Requirement 3: หากพบรหัสซ้ำ อัปเดตข้อมูลและคงข้อมูลเดิมในช่องที่เว้นว่างไว้)
          let project: Project;
          if (matchedExisting) {
            project = {
              ...matchedExisting,
              projectCode: importedCode || matchedExisting.projectCode,
              fiscalYear: row['ปีงบประมาณ'] ? fiscalYear : matchedExisting.fiscalYear,
              name: name || matchedExisting.name,
              budgetCategory: row['หมวดงบประมาณ'] ? category : matchedExisting.budgetCategory,
              description: importedDescription !== '' ? importedDescription : matchedExisting.description,
              meetingSession: meetingSession !== '' ? meetingSession : matchedExisting.meetingSession,
              approvedBudget: row['งบประมาณอนุมัติ'] !== undefined && row['งบประมาณอนุมัติ'] !== '' ? approvedBudget : matchedExisting.approvedBudget,
              location: location !== '' ? location : matchedExisting.location,
              responsiblePerson: responsiblePerson !== '' ? responsiblePerson : matchedExisting.responsiblePerson,
              contractNo: contractNo !== '' ? contractNo : matchedExisting.contractNo,
              contractorName: contractorName !== '' ? contractorName : matchedExisting.contractorName,
              contractAmount: row['วงเงินสัญญา'] !== undefined && row['วงเงินสัญญา'] !== '' ? contractAmount : matchedExisting.contractAmount,
              startDate: startDate !== '' ? startDate : matchedExisting.startDate,
              endDate: endDate !== '' ? endDate : matchedExisting.endDate,
              status: rawStatus ? rawStatus : matchedExisting.status,
              notes: row['หมายเหตุ'] !== undefined && row['หมายเหตุ'] !== '' ? String(row['หมายเหตุ']).trim() : matchedExisting.notes,
              supervisorName: row['ผู้ควบคุมงาน'] !== undefined && row['ผู้ควบคุมงาน'] !== '' ? String(row['ผู้ควบคุมงาน']).trim() : matchedExisting.supervisorName,
              refPrice: row['ราคากลาง'] !== undefined && row['ราคากลาง'] !== '' ? Number(row['ราคากลาง']) : matchedExisting.refPrice,
              torOrderNo: row['เลขที่คำสั่งTOR'] !== undefined && row['เลขที่คำสั่งTOR'] !== '' ? String(row['เลขที่คำสั่งTOR']).trim() : matchedExisting.torOrderNo,
              updatedAt: new Date().toISOString()
            };
          } else {
            project = {
              id: `prj-imported-${Date.now()}-${idx}`,
              projectCode: importedCode || `ช.${String(fiscalYear).slice(-2)}-${Math.floor(Math.random() * 900 + 100)}`,
              fiscalYear,
              name,
              budgetCategory: category,
              description: importedDescription,
              meetingSession,
              approvedBudget,
              location: location || 'ต.ไร่ใต้ อ.พิบูลมังสาหาร',
              responsiblePerson: responsiblePerson || 'นายศรายุทธ  สงวนรัษฐ์',
              contractNo,
              contractorName,
              contractAmount,
              startDate: startDate || undefined,
              endDate: endDate || undefined,
              status: rawStatus || 'not_started',
              progressPercent: 0,
              notes: String(row['หมายเหตุ'] || ''),
              supervisorName: String(row['ผู้ควบคุมงาน'] || ''),
              refPrice: Number(row['ราคากลาง'] || 0),
              torOrderNo: String(row['เลขที่คำสั่งTOR'] || ''),
              torCommittees: [],
              inspectCommittees: [],
              workNotices: [],
              deliveries: [],
              inspections: [],
              disbursements: [],
              remunerations: [],
              attachments: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
          }

          // Recalculate progress automatically based on the 12 steps (Requirement 4)
          project.progressPercent = calculateProjectProgress(project);

          return {
            rowIdx: idx + 1,
            data: project,
            raw: row,
            isValid: errors.length === 0,
            isDuplicate,
            isUpdate,
            errors,
            warnings
          };
        });

        setParsedRows(rows);
      } catch (err) {
        console.error('Error parsing excel', err);
        alert('เกิดข้อผิดพลาดในการอ่านไฟล์ Excel โปรดตรวจสอบรูปแบบไฟล์');
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      alert('ไม่พบรายการที่ถูกต้องสมบูรณ์สำหรับการนำเข้า');
      return;
    }

    const projectsToImport = validRows.map(r => r.data);
    onImportSuccess(projectsToImport);
    onClose();
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const duplicateCount = parsedRows.filter(r => r.isDuplicate).length;
  const errorCount = parsedRows.filter(r => !r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-800 to-teal-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-700/60 rounded-xl">
              <FileSpreadsheet className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold font-heading">
                นำเข้าข้อมูลทะเบียนโครงการจาก Excel (.xlsx / .csv)
              </h3>
              <p className="text-xs text-emerald-200">
                ตรวจสอบความถูกต้อง ตรวจหาข้อมูลซ้ำ และยืนยันก่อนบันทึกลงระบบ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-emerald-200 hover:text-white hover:bg-emerald-700/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Top Instructions & Template Download */}
          <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-emerald-700" />
                <span>คำแนะนำการเตรียมไฟล์ Excel</span>
              </div>
              <p className="text-emerald-800 leading-relaxed">
                ไฟล์ควรมีหัวตาราง ได้แก่ <strong>รหัสโครงการ, ปีงบประมาณ, ชื่อโครงการ, หมวดงบประมาณ, รายละเอียดโครงการ, งบประมาณอนุมัติ, วงเงินสัญญา, ชื่อผู้รับจ้าง</strong>
                <br />
                <span className="text-emerald-700 font-semibold">
                  * หากพบรหัสโครงการซ้ำ ระบบจะทำการอัปเดตข้อมูลที่นำเข้ามา และคงข้อมูลเดิมในระบบสำหรับช่องที่เว้นว่างไว้
                </span>
              </p>
            </div>

            <button
              onClick={downloadSampleExcelTemplate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-emerald-100/60 text-emerald-800 font-bold rounded-xl border border-emerald-300 shadow-2xs shrink-0 transition"
            >
              <Download className="w-4 h-4 text-emerald-700" />
              <span>ดาวน์โหลดไฟล์ตัวอย่าง Template</span>
            </button>
          </div>

          {/* File Upload Zone */}
          <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center bg-slate-50/50 transition">
            <input
              type="file"
              id="excel-file-input"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label
              htmlFor="excel-file-input"
              className="cursor-pointer flex flex-col items-center justify-center gap-2"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <span className="font-bold text-slate-800 text-sm">
                  {fileName ? `ไฟล์ที่เลือก: ${fileName}` : 'คลิกเพื่อเลือกไฟล์ Excel หรือลากไฟล์มาวางที่นี่'}
                </span>
                <p className="text-xs text-slate-400 mt-1">รองรับไฟล์ .xlsx, .xls และ .csv</p>
              </div>
            </label>
          </div>

          {/* Verification Statistics */}
          {parsedRows.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">โครงการทั้งหมดในไฟล์</div>
                  <div className="text-lg font-bold text-slate-800">{parsedRows.length} รายการ</div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="text-emerald-700">ข้อมูลสมบูรณ์พร้อมนำเข้า</div>
                  <div className="text-lg font-bold text-emerald-800">{validCount} รายการ</div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="text-amber-700">พบซ้ำ (จะอัปเดตข้อมูล)</div>
                  <div className="text-lg font-bold text-amber-800">{duplicateCount} รายการ</div>
                </div>
              </div>

              {/* Data Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 border-b border-slate-200 flex justify-between items-center">
                  <span>ตัวอย่างข้อมูลที่ตรวจสอบแล้วก่อนนำเข้า</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    แสดงรายละเอียดโครงการและรหัสเพื่อตรวจสอบความถูกต้อง
                  </span>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="p-2 text-center w-8">แถว</th>
                        <th className="p-2 w-24">รหัสโครงการ</th>
                        <th className="p-2 w-14">ปีงบ</th>
                        <th className="p-2 min-w-44">ชื่อโครงการ</th>
                        <th className="p-2 min-w-52">รายละเอียดโครงการ</th>
                        <th className="p-2 w-24">หมวดงบ</th>
                        <th className="p-2 text-right w-24">งบอนุมัติ</th>
                        <th className="p-2 w-32">ผู้รับจ้าง / สัญญา</th>
                        <th className="p-2 text-center w-32">สถานะการตรวจสอบ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedRows.map(r => (
                        <tr key={r.rowIdx} className="hover:bg-slate-50">
                          <td className="p-2 text-center text-slate-400 font-medium">{r.rowIdx}</td>
                          <td className="p-2 font-mono font-bold text-slate-700">
                            {r.data.projectCode}
                          </td>
                          <td className="p-2 font-bold text-slate-800">{r.data.fiscalYear}</td>
                          <td className="p-2 font-medium text-slate-800 line-clamp-2">
                            {r.data.name}
                          </td>
                          <td className="p-2 text-slate-600 max-w-xs truncate" title={r.data.description || '-'}>
                            {r.data.description || '-'}
                          </td>
                          <td className="p-2 whitespace-nowrap">{r.data.budgetCategory}</td>
                          <td className="p-2 text-right font-medium whitespace-nowrap">
                            {formatCurrency(r.data.approvedBudget)} บ.
                          </td>
                          <td className="p-2">
                            <div className="truncate font-medium">{r.data.contractorName || '-'}</div>
                            <span className="text-[10px] text-slate-400 font-mono">{r.data.contractNo}</span>
                          </td>
                          <td className="p-2 text-center whitespace-nowrap">
                            {r.isValid ? (
                              <div className="inline-flex flex-col items-center gap-0.5">
                                <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{r.isUpdate ? 'อัปเดตข้อมูลเดิม' : 'พร้อมนำเข้า'}</span>
                                </div>
                                {r.isUpdate && (
                                  <span className="text-[10px] text-emerald-600">
                                    (คงค่าเดิมในช่องที่ว่าง)
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>{r.errors[0]}</span>
                              </div>
                            )}
                            {r.warnings.length > 0 && (
                              <div className="text-[10px] text-amber-600 mt-0.5 max-w-xs truncate">
                                {r.warnings.join(', ')}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {parsedRows.length > 0 && `พร้อมบันทึก ${validCount} รายการ`}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition"
            >
              ยกเลิก
            </button>

            <button
              onClick={handleConfirmImport}
              disabled={validCount === 0 || isProcessing}
              className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white text-xs font-bold shadow-md shadow-emerald-700/20 active:scale-95 transition"
            >
              ยืนยันการนำเข้าข้อมูล ({validCount} โครงการ)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
