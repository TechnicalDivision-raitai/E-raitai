import React, { useMemo, useRef, useState } from 'react';
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
  ChevronDown,
  ChevronUp,
  Layers,
  RefreshCw
} from 'lucide-react';
import { Project } from '../types/project';
import {
  downloadSampleExcelTemplate,
  EXCEL_TEMPLATE_COLUMNS,
  STATUS_LABELS
} from '../utils/excelExport';
import {
  parseWorkbookSheet,
  pickDefaultDataSheet,
  SheetParseResult
} from '../utils/excelImportParser';
import { formatCurrency } from '../utils/thaiDate';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingProjects: Project[];
  onImportSuccess: (newProjects: Project[]) => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  existingProjects,
  onImportSuccess
}) => {
  const [fileName, setFileName] = useState<string>('');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [parseResult, setParseResult] = useState<SheetParseResult | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showColumnGuide, setShowColumnGuide] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const groupedColumns = useMemo(() => {
    const map = new Map<string, typeof EXCEL_TEMPLATE_COLUMNS>();
    EXCEL_TEMPLATE_COLUMNS.forEach(col => {
      const list = map.get(col.group) || [];
      list.push(col);
      map.set(col.group, list);
    });
    return Array.from(map.entries());
  }, []);

  if (!isOpen) return null;

  const parsedRows = parseResult?.rows || [];

  const processFile = (file: File) => {
    setErrorMessage('');
    setFileName(file.name);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const buffer = evt.target?.result;
        if (!buffer) {
          setErrorMessage('ไม่สามารถอ่านเนื้อหาไฟล์ได้ โปรดลองใหม่อีกครั้ง');
          return;
        }
        const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
        const sheets = wb.SheetNames || [];
        if (sheets.length === 0) {
          setErrorMessage('ไม่พบชีตข้อมูลในไฟล์ Excel นี้');
          return;
        }
        const defaultSheet = pickDefaultDataSheet(sheets);
        const result = parseWorkbookSheet(wb, defaultSheet, existingProjects);

        setWorkbook(wb);
        setSheetNames(sheets);
        setSelectedSheet(defaultSheet);
        setParseResult(result);

        if (result.rows.length === 0) {
          setErrorMessage(
            `ไม่พบแถวข้อมูลในชีต "${defaultSheet}" โปรดตรวจสอบว่าเลือกชีตถูกต้องและมีหัวคอลัมน์ในไฟล์`
          );
        }
      } catch (err) {
        console.error('Error parsing excel', err);
        setErrorMessage('เกิดข้อผิดพลาดในการอ่านไฟล์ Excel โปรดตรวจสอบว่าเป็นไฟล์ .xlsx, .xls หรือ .csv ที่ไม่เสียหาย');
        setParseResult(null);
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setErrorMessage('ไม่สามารถเปิดอ่านไฟล์ที่เลือกได้');
      setIsProcessing(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    // Reset input value so selecting the same file after editing triggers onChange
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleChangeSheet = (nextSheet: string) => {
    if (!workbook) return;
    setErrorMessage('');
    setSelectedSheet(nextSheet);
    const result = parseWorkbookSheet(workbook, nextSheet, existingProjects);
    setParseResult(result);
    if (result.rows.length === 0) {
      setErrorMessage(`ไม่พบแถวข้อมูลในชีต "${nextSheet}"`);
    }
  };

  const handleResetFile = () => {
    setFileName('');
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet('');
    setParseResult(null);
    setErrorMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      setErrorMessage('ไม่พบรายการที่ถูกต้องสมบูรณ์สำหรับการนำเข้า โปรดตรวจสอบคอลัมน์ "ชื่อโครงการ"');
      return;
    }

    const projectsToImport = validRows.map(r => r.data);
    onImportSuccess(projectsToImport);
    onClose();
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const newCount = parsedRows.filter(r => r.isValid && !r.isUpdate).length;
  const duplicateCount = parsedRows.filter(r => r.isValid && r.isDuplicate).length;
  const errorCount = parsedRows.filter(r => !r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-800 to-teal-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-700/60 rounded-xl">
              <FileSpreadsheet className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold font-heading">
                นำเข้าข้อมูลทะเบียนโครงการจาก Excel (.xlsx / .xls / .csv)
              </h3>
              <p className="text-xs text-emerald-200">
                รองรับข้อมูลครบทั้ง 7 หมวด ({EXCEL_TEMPLATE_COLUMNS.length} คอลัมน์) พร้อมแปลงวันที่ พ.ศ./ค.ศ. และอัปเดตข้อมูลเดิมอัตโนมัติ
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
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Top Instructions & Template Download */}
          <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80 space-y-3 text-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-emerald-700" />
                  <span>รองรับการนำเข้าสูงสุด {EXCEL_TEMPLATE_COLUMNS.length} คอลัมน์ ครอบคลุมทั้งกระบวนการโครงการ</span>
                </div>
                <p className="text-emerald-800 leading-relaxed">
                  บังคับกรอกเพียง <strong>ชื่อโครงการ</strong> ช่องอื่นๆ สามารถกรอกเท่าที่มีหรือเว้นว่างได้ รองรับทั้งไฟล์จากแบบฟอร์มตัวอย่างและไฟล์ที่<strong>ส่งออก (Export)</strong> จากระบบนี้โดยตรง
                  <br />
                  <span className="text-emerald-700 font-semibold">
                    * รองรับวันที่ทั้งรูปแบบ Excel, พ.ศ. (15/10/2568, 15 ต.ค. 2568), ค.ศ. (2025-10-15) • หากพบรหัส/สัญญา/ชื่อซ้ำ จะอัปเดตเฉพาะช่องที่กรอกและคงค่าเดิมในช่องว่าง
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowColumnGuide(prev => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-100/70 hover:bg-emerald-200/70 text-emerald-900 font-semibold rounded-xl border border-emerald-300/80 transition"
                >
                  <Layers className="w-3.5 h-3.5 text-emerald-700" />
                  <span>ดูคอลัมน์ที่รองรับ</span>
                  {showColumnGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={downloadSampleExcelTemplate}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-emerald-100/60 text-emerald-800 font-bold rounded-xl border border-emerald-300 shadow-2xs transition"
                >
                  <Download className="w-4 h-4 text-emerald-700" />
                  <span>ดาวน์โหลดแบบฟอร์มตัวอย่าง (2 ชีต)</span>
                </button>
              </div>
            </div>

            {/* Collapsible Supported Columns Reference */}
            {showColumnGuide && (
              <div className="pt-3 border-t border-emerald-200/80 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {groupedColumns.map(([groupName, cols]) => (
                  <div
                    key={groupName}
                    className="bg-white/90 rounded-xl p-2.5 border border-emerald-200/70 space-y-1.5"
                  >
                    <div className="font-bold text-emerald-900 text-[11px] flex items-center justify-between">
                      <span>{groupName}</span>
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                        {cols.length} ช่อง
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {cols.map(c => (
                        <span
                          key={c.header}
                          title={`${c.format} | ตัวอย่าง: ${c.example}`}
                          className={`text-[10px] px-1.5 py-0.5 rounded-md border ${
                            c.required
                              ? 'bg-emerald-700 text-white border-emerald-700 font-bold'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          {c.header}
                          {c.required ? ' *' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inline Error Alert */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
              <button
                type="button"
                onClick={() => setErrorMessage('')}
                className="text-rose-500 hover:text-rose-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* File Upload Zone (Click + Drag & Drop) */}
          <div
            onDragOver={e => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-5 text-center transition ${
              isDragging
                ? 'border-emerald-500 bg-emerald-50/70'
                : 'border-slate-300 hover:border-emerald-500 bg-slate-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
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
              <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-slate-800 text-sm">
                  {fileName ? `ไฟล์ที่เลือก: ${fileName}` : 'คลิกเพื่อเลือกไฟล์ Excel หรือลากไฟล์มาวางที่นี่'}
                </span>
                <p className="text-xs text-slate-400 mt-0.5">
                  รองรับไฟล์ .xlsx, .xls และ .csv (ระบบตรวจหาแถวหัวคอลัมน์และชีตข้อมูลให้อัตโนมัติ)
                </p>
              </div>
            </label>

            {/* Sheet Selector & Reset when workbook is loaded */}
            {workbook && (
              <div className="mt-3 pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-center gap-3 text-xs">
                {sheetNames.length > 1 && (
                  <div className="inline-flex items-center gap-2">
                    <span className="text-slate-600 font-semibold">เลือกชีตข้อมูล:</span>
                    <select
                      value={selectedSheet}
                      onChange={e => handleChangeSheet(e.target.value)}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {sheetNames.map(sn => (
                        <option key={sn} value={sn}>
                          {sn}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {parseResult && (
                  <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg font-semibold">
                    จับคู่คอลัมน์สำเร็จ {parseResult.matchedFieldKeys.length} คอลัมน์
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleResetFile}
                  className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-medium px-2 py-1 rounded-lg hover:bg-slate-200/60 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>ล้างไฟล์ที่เลือก</span>
                </button>
              </div>
            )}
          </div>

          {/* Unmatched Headers Hint (non-blocking) */}
          {parseResult && parseResult.unmatchedHeaders.length > 0 && (
            <div className="px-3.5 py-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">คอลัมน์ที่ไม่ได้นำเข้า ({parseResult.unmatchedHeaders.length} คอลัมน์): </span>
                <span className="text-amber-700">{parseResult.unmatchedHeaders.join(', ')}</span>
              </div>
            </div>
          )}

          {/* Verification Statistics & Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">ทั้งหมดในชีต</div>
                  <div className="text-lg font-bold text-slate-800">{parsedRows.length} รายการ</div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="text-emerald-700">เพิ่มโครงการใหม่</div>
                  <div className="text-lg font-bold text-emerald-800">{newCount} รายการ</div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="text-amber-700">อัปเดตข้อมูลเดิม</div>
                  <div className="text-lg font-bold text-amber-800">{duplicateCount} รายการ</div>
                </div>

                <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200">
                  <div className="text-rose-700">ข้อมูลไม่สมบูรณ์</div>
                  <div className="text-lg font-bold text-rose-800">{errorCount} รายการ</div>
                </div>
              </div>

              {/* Data Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2">
                  <span>ตัวอย่างข้อมูลที่ตรวจสอบแล้วก่อนนำเข้า</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    แสดงหมวดข้อมูลที่ตรวจพบในแต่ละแถว และสถานะที่คำนวณได้
                  </span>
                </div>
                <div className="max-h-72 overflow-auto">
                  <table className="w-full text-left text-xs border-separate border-spacing-0">
                    <thead>
                      <tr className="text-slate-600 font-semibold">
                        <th className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 p-2 text-center w-10">แถว</th>
                        <th className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 p-2 w-24 whitespace-nowrap">รหัส / ปีงบ</th>
                        <th className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 p-2 min-w-52">ชื่อโครงการ / สถานที่</th>
                        <th className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 p-2 text-center whitespace-nowrap">หมวดงบ / งบอนุมัติ</th>
                        <th className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 p-2 min-w-36">ผู้รับจ้าง / สัญญา</th>
                        <th className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 p-2 min-w-44">หมวดข้อมูลที่นำเข้า</th>
                        <th className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 p-2 text-center whitespace-nowrap">สถานะโครงการ</th>
                        <th className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 p-2 text-center whitespace-nowrap">ผลการตรวจสอบ</th>
                      </tr>
                    </thead>
                    <tbody className="[&>tr>td]:border-b [&>tr>td]:border-slate-100 [&>tr:last-child>td]:border-b-0">
                      {parsedRows.map(r => (
                        <tr key={r.rowIdx} className="hover:bg-slate-50/80">
                          <td className="p-2 text-center text-slate-400 font-medium tabular-nums">{r.rowIdx}</td>
                          <td className="p-2 whitespace-nowrap">
                            <div className="font-mono font-bold text-slate-700">{r.data.projectCode}</div>
                            <div className="text-[10px] text-slate-500">ปีงบ {r.data.fiscalYear}</div>
                          </td>
                          <td className="p-2 max-w-xs">
                            <div className="font-semibold text-slate-800 line-clamp-2" title={r.data.name}>
                              {r.data.name || <span className="text-rose-500 italic">(ไม่มีชื่อโครงการ)</span>}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate mt-0.5" title={r.data.location}>
                              {r.data.location}
                            </div>
                          </td>
                          <td className="p-2 text-center whitespace-nowrap">
                            <div className="text-[11px] font-medium text-slate-700">{r.data.budgetCategory}</div>
                            <div className="text-xs font-semibold text-slate-900 tabular-nums mt-0.5">
                              {formatCurrency(r.data.approvedBudget)} บ.
                            </div>
                          </td>
                          <td className="p-2 max-w-44">
                            <div className="truncate font-medium text-slate-800" title={r.data.contractorName || '-'}>
                              {r.data.contractorName || '-'}
                            </div>
                            {r.data.contractNo && (
                              <div className="text-[10px] text-slate-500 font-mono truncate">
                                เลขที่: {r.data.contractNo}
                              </div>
                            )}
                            {r.data.contractAmount ? (
                              <div className="text-[11px] font-bold text-emerald-800 tabular-nums">
                                {formatCurrency(r.data.contractAmount)} บ.
                              </div>
                            ) : null}
                          </td>
                          <td className="p-2">
                            <div className="flex flex-wrap gap-1 max-w-52">
                              {r.importedSections.map(sec => (
                                <span
                                  key={sec}
                                  className="px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200/80 text-[10px] font-medium whitespace-nowrap"
                                >
                                  {sec}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-2 text-center whitespace-nowrap">
                            <div className="text-[11px] font-semibold text-slate-700">
                              {STATUS_LABELS[r.data.status] || r.data.status}
                            </div>
                            <div className="text-[10px] text-emerald-700 font-bold tabular-nums">
                              คืบหน้า {r.data.progressPercent}%
                            </div>
                          </td>
                          <td className="p-2 text-center whitespace-nowrap">
                            {r.isValid ? (
                              <div className="inline-flex flex-col items-center gap-0.5">
                                <div
                                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                                    r.isUpdate
                                      ? 'text-amber-800 bg-amber-50 border-amber-200'
                                      : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                  }`}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{r.isUpdate ? 'อัปเดตข้อมูลเดิม' : 'พร้อมนำเข้า'}</span>
                                </div>
                                {r.isUpdate && (
                                  <span className="text-[10px] text-slate-500">(คงค่าเดิมในช่องที่ว่าง)</span>
                                )}
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>{r.errors[0]}</span>
                              </div>
                            )}
                            {r.warnings.length > 0 && (
                              <div
                                className="text-[10px] text-amber-600 mt-0.5 max-w-44 truncate"
                                title={r.warnings.join(' | ')}
                              >
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
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-500">
            {parsedRows.length > 0
              ? `พร้อมบันทึก ${validCount} รายการ (เพิ่มใหม่ ${newCount} / อัปเดต ${duplicateCount})`
              : `รองรับการนำเข้าสูงสุด ${EXCEL_TEMPLATE_COLUMNS.length} คอลัมน์ จาก 7 หมวดข้อมูลโครงการ`}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition"
            >
              ยกเลิก
            </button>

            <button
              type="button"
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
