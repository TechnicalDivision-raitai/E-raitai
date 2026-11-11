import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  ExternalLink,
  ShieldCheck,
  FolderOpen,
  ArrowUpRight,
  Sparkles,
  HelpCircle,
  Database,
  Eye,
  Check,
  Settings
} from 'lucide-react';
import { Project, UserProfile } from '../types/project';
import {
  getGoogleScriptUrl,
  saveGoogleScriptUrl,
  getAutoSyncEnabled,
  setAutoSyncEnabled,
  getLastSyncedTime,
  testGoogleScriptConnection,
  fetchProjectsFromGoogleSheet,
  syncProjectsToGoogleSheet,
  getGoogleAppsScriptTemplateCode
} from '../services/googleSync';
import Swal from 'sweetalert2';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  onUpdateProjects: (updated: Project[]) => void;
  currentUser: UserProfile;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  projects,
  onUpdateProjects,
  currentUser
}) => {
  const [scriptUrl, setScriptUrl] = useState<string>(getGoogleScriptUrl());
  const [autoSync, setAutoSync] = useState<boolean>(getAutoSyncEnabled());
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(getLastSyncedTime());
  const [activeTab, setActiveTab] = useState<'sync' | 'code' | 'help'>('sync');

  const isAdmin = currentUser.role === 'admin';
  const templateCode = getGoogleAppsScriptTemplateCode();

  useEffect(() => {
    setScriptUrl(getGoogleScriptUrl());
    setAutoSync(getAutoSyncEnabled());
    setLastSynced(getLastSyncedTime());
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveUrl = () => {
    if (!scriptUrl.trim().startsWith('https://script.google.com/')) {
      Swal.fire({
        icon: 'error',
        title: 'URL ไม่ถูกต้อง',
        text: 'กรุณาระบุ URL ของ Google Apps Script ที่ขึ้นต้นด้วย https://script.google.com/macros/s/.../exec'
      });
      return;
    }
    saveGoogleScriptUrl(scriptUrl.trim());
    Swal.fire({
      icon: 'success',
      title: 'บันทึก URL สำเร็จ',
      timer: 1500,
      showConfirmButton: false
    });
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    const res = await testGoogleScriptConnection(scriptUrl.trim());
    setIsTesting(false);
    setTestResult(res);

    if (res.success) {
      Swal.fire({
        icon: 'success',
        title: 'เชื่อมต่อสำเร็จ!',
        text: 'Google Apps Script Web App ตอบสนองพร้อมรับ-ส่งข้อมูลโครงการและอัปโหลดเข้า Google Drive',
        timer: 2000,
        showConfirmButton: false
      });
    } else {
      Swal.fire({
        icon: 'warning',
        title: 'การเชื่อมต่อมีปัญหา',
        html: `<p class="text-xs text-left">${res.message}</p><p class="text-xs text-left text-rose-600 mt-2 font-medium">* ตรวจสอบว่าใน Apps Script ได้กด Deploy เป็น "Web app" และเลือก Who has access เป็น "Anyone" (ทุกคน) หรือยัง</p>`
      });
    }
  };

  // Push / Backup current projects to Google Sheet
  const handlePushToGoogleSheet = async () => {
    if (!isAdmin) {
      Swal.fire('ไม่อนุญาต', 'เฉพาะ Admin เท่านั้นที่สามารถสำรองข้อมูลขึ้น Google Sheet ได้', 'warning');
      return;
    }

    setIsSyncing(true);
    Swal.fire({
      title: 'กำลังส่งข้อมูลขึ้น Google Sheet...',
      text: 'ระบบกำลังบันทึกทะเบียนโครงการทั้งหมดเข้าสู่ Google Sheet เพื่อให้ทุกเครื่องเข้าถึงได้',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const res = await syncProjectsToGoogleSheet(projects, scriptUrl.trim());
    setIsSyncing(false);

    if (res.success) {
      setLastSynced(new Date().toISOString());
      Swal.fire({
        icon: 'success',
        title: 'บันทึกเข้า Google Sheet สำเร็จ!',
        text: `อัปเดตข้อมูลจำนวน ${res.count || projects.length} รายการลง Google Sheet เรียบร้อยแล้ว ทุกเครื่องจะเห็นข้อมูลตรงกัน`,
        confirmButtonColor: '#059669'
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: 'ส่งข้อมูลไม่สำเร็จ',
        text: res.error || 'กรุณาตรวจสอบการตั้งค่า Apps Script'
      });
    }
  };

  // Pull / Fetch latest projects from Google Sheet
  const handlePullFromGoogleSheet = async () => {
    setIsPulling(true);
    Swal.fire({
      title: 'กำลังดึงข้อมูลจาก Google Sheet...',
      text: 'ระบบกำลังโหลดทะเบียนโครงการล่าสุดจากคลาวด์',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const res = await fetchProjectsFromGoogleSheet(scriptUrl.trim());
    setIsPulling(false);

    if (res.success && res.projects) {
      onUpdateProjects(res.projects);
      setLastSynced(new Date().toISOString());
      Swal.fire({
        icon: 'success',
        title: 'ดึงข้อมูลสำเร็จ!',
        text: `โหลดข้อมูลจาก Google Sheet จำนวน ${res.projects.length} รายการ เรียบร้อยแล้ว`,
        timer: 1800,
        showConfirmButton: false
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: 'ดึงข้อมูลไม่สำเร็จ',
        text: res.error || 'ยังไม่มีข้อมูลใน Google Sheet หรือสคริปต์ยังไม่ได้รับการอัปเดต'
      });
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(templateCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
    Swal.fire({
      icon: 'success',
      title: 'คัดลอกโค้ดสคริปต์แล้ว!',
      text: 'นำโค้ดนี้ไปวางในเมนู Extensions > Apps Script (Code.gs) ของ Google Sheet ได้ทันที',
      timer: 1800,
      showConfirmButton: false
    });
  };

  const formatLastSync = (isoString: string | null) => {
    if (!isoString) return 'ยังไม่ได้ซิงค์ในเซสชันนี้';
    try {
      const d = new Date(isoString);
      return `เมื่อ ${d.toLocaleTimeString('th-TH')} (${d.toLocaleDateString('th-TH')})`;
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-700/80 rounded-2xl shadow-inner border border-emerald-500/30">
              <FileSpreadsheet className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  Cloud Primary Database
                </span>
                <span className="text-xs text-emerald-100 flex items-center gap-1">
                  <Cloud className="w-3.5 h-3.5" />
                  Google Sheet & Google Drive
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold font-heading">
                ศูนย์จัดการฐานข้อมูล Google Sheet & คลังเอกสาร Drive
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition text-xs font-semibold"
          >
            ✕ ปิด
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('sync')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 border-b-2 ${
              activeTab === 'sync'
                ? 'bg-white text-emerald-700 border-emerald-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>สถานะและซิงค์ข้อมูลข้ามเครื่อง</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 border-b-2 ${
              activeTab === 'code'
                ? 'bg-white text-emerald-700 border-emerald-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Copy className="w-4 h-4" />
            <span>โค้ดสคริปต์ Google Apps Script (Code.gs)</span>
          </button>

          <button
            onClick={() => setActiveTab('help')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 border-b-2 ${
              activeTab === 'help'
                ? 'bg-white text-emerald-700 border-emerald-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>คู่มือการติดตั้ง Google Sheet & Drive</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
          {/* TAB 1: SYNC & STATUS */}
          {activeTab === 'sync' && (
            <div className="space-y-6">
              {/* Highlight summary card */}
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-950 font-heading">
                      Google Sheet ทำหน้าที่เป็นฐานข้อมูลหลัก (Central Cloud DB)
                    </h4>
                    <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                      ทุกเครื่องที่เปิดใช้งานระบบ (เจ้าหน้าที่, ผู้บริหาร, กองช่าง) จะเชื่อมต่อและเห็นข้อมูลตรงกันทั้งหมด
                      พร้อมบันทึกไฟล์แนบเข้า Google Drive โดยตรง
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-end">
                  <span className="text-[11px] font-semibold text-emerald-700">สถานะล่าสุด</span>
                  <span className="text-xs font-bold text-emerald-950">
                    {formatLastSync(lastSynced)}
                  </span>
                </div>
              </div>

              {/* URL Configuration */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-emerald-600" />
                    <span>Google Apps Script Web App URL (จุดเชื่อมต่อฐานข้อมูล)</span>
                  </label>
                  <span className="text-[11px] text-slate-400">ลงท้ายด้วย /exec</span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={scriptUrl}
                    onChange={e => setScriptUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    disabled={!isAdmin}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  {isAdmin && (
                    <button
                      onClick={handleSaveUrl}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition shrink-0"
                    >
                      บันทึก URL
                    </button>
                  )}
                  <button
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                    <span>{isTesting ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อ'}</span>
                  </button>
                </div>

                {testResult && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      testResult.success
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons: Push & Pull */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pull from Google Sheet */}
                <div className="p-5 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/40 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                      <RefreshCw className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-slate-800">
                        ดึงข้อมูลล่าสุดจาก Google Sheet (Pull)
                      </h5>
                      <p className="text-xs text-slate-500">
                        โหลดข้อมูลโครงการจาก Google Sheet มาอัปเดตในเครื่องนี้ทันที
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handlePullFromGoogleSheet}
                    disabled={isPulling}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isPulling ? 'animate-spin' : ''}`} />
                    <span>{isPulling ? 'กำลังดึงข้อมูล...' : 'ดึงข้อมูลจาก Google Sheet เดี๋ยวนี้'}</span>
                  </button>
                </div>

                {/* Push to Google Sheet */}
                <div className="p-5 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-emerald-50/40 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                      <Cloud className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-slate-800">
                        สำรอง/บันทึกขึ้น Google Sheet (Push/Backup)
                      </h5>
                      <p className="text-xs text-slate-500">
                        ส่งข้อมูลโครงการทั้งหมด {projects.length} รายการขึ้นบันทึกใน Google Sheet
                      </p>
                    </div>
                  </div>

                  {isAdmin ? (
                    <button
                      onClick={handlePushToGoogleSheet}
                      disabled={isSyncing}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Cloud className={`w-4 h-4 ${isSyncing ? 'animate-pulse' : ''}`} />
                      <span>{isSyncing ? 'กำลังบันทึก...' : 'สำรองข้อมูลขึ้น Google Sheet เดี๋ยวนี้'}</span>
                    </button>
                  ) : (
                    <div className="py-2.5 px-4 bg-slate-100 text-slate-400 text-xs text-center rounded-xl font-medium">
                      (เฉพาะผู้ดูแลระบบ Admin เท่านั้นที่สามารถสำรองข้อมูลได้)
                    </div>
                  )}
                </div>
              </div>

              {/* Staff Access & Google Drive Policy Guarantee */}
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/80 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  <span>นโยบายสิทธิ์การใช้งานเอกสารแนบ Google Drive</span>
                </div>
                <ul className="text-xs text-amber-800 space-y-1 pl-5 list-disc leading-relaxed">
                  <li>
                    <strong>สิทธิ์ Staff:</strong> สามารถคลิกเปิดดูไฟล์แนบเอกสารโครงการทั้งหมดผ่าน Google Drive ได้โดยตรง (ไม่จำกัดการเปิดดู)
                  </li>
                  <li>
                    <strong>ไฟล์แนบ Google Drive:</strong> เมื่ออัปโหลดไฟล์เข้าระบบ สคริปต์จะสร้างไฟล์ลงในโฟลเดอร์ Google Drive พร้อมตั้งสิทธิ์แชร์ให้อัตโนมัติ (Anyone with the link can view)
                  </li>
                  <li>
                    <strong>ฐานข้อมูลกลาง:</strong> ทุกครั้งที่มีการเพิ่ม แก้ไข หรืออัปเดตโครงการ ข้อมูลจะซิงค์กับ Google Sheet โดยอัตโนมัติ ทำให้เครื่องคอมพิวเตอร์และมือถือทุกเครื่องเห็นข้อมูลตรงกัน
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: CODE.GS TEMPLATE */}
          {activeTab === 'code' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 font-heading">
                    สคริปต์ Google Apps Script (Code.gs) ฉบับสมบูรณ์
                  </h4>
                  <p className="text-xs text-slate-500">
                    รองรับทั้งการอ่าน-เขียนฐานข้อมูล Google Sheet และการอัปโหลดไฟล์เข้า Google Drive พร้อมแชร์สิทธิ์
                  </p>
                </div>

                <button
                  onClick={handleCopyCode}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCode ? 'คัดลอกสำเร็จแล้ว' : 'คัดลอกโค้ดสคริปต์'}</span>
                </button>
              </div>

              <div className="relative">
                <pre className="p-4 bg-slate-900 text-emerald-300 font-mono text-xs rounded-2xl overflow-x-auto max-h-96 border border-slate-800 leading-relaxed">
                  {templateCode}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: STEP-BY-STEP HELP */}
          {activeTab === 'help' && (
            <div className="space-y-4 text-xs leading-relaxed">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <h4 className="font-bold text-slate-800 text-sm mb-3">
                  วิธีติดตั้ง Google Sheet เป็นฐานข้อมูลหลัก และเชื่อมต่อ Google Drive (3 นาที)
                </h4>
                <ol className="space-y-3 pl-5 list-decimal text-slate-700">
                  <li>
                    <strong>สร้าง Google Sheet ใหม่:</strong> เปิด{' '}
                    <a
                      href="https://sheets.new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 font-bold underline inline-flex items-center gap-1"
                    >
                      sheets.new <ExternalLink className="w-3 h-3" />
                    </a>{' '}
                    และตั้งชื่อไฟล์ว่า <em>"ระบบงานโครงการกองช่าง อบต.ไร่ใต้"</em>
                  </li>
                  <li>
                    <strong>เปิดตัวแก้ไขสคริปต์:</strong> ไปที่เมนูด้านบนของ Google Sheet เลือก{' '}
                    <span className="px-2 py-0.5 bg-slate-200 rounded font-semibold text-slate-800">
                      ส่วนขยาย (Extensions) &gt; Apps Script
                    </span>
                  </li>
                  <li>
                    <strong>วางโค้ดสคริปต์:</strong> ลบโค้ดเดิมในไฟล์ <code>Code.gs</code> ทั้งหมด
                    แล้วกดปุ่ม <em>"คัดลอกโค้ดสคริปต์"</em> ในแท็บด้านบน นำมาวางลงไป จากนั้นกดปุ่มแผ่นดิสก์ (บันทึกโครงการ)
                  </li>
                  <li>
                    <strong>Deploy เป็น Web App:</strong> กดปุ่มสีน้ำเงิน{' '}
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold">
                      การทำให้ใช้งานได้ (Deploy) &gt; การทำให้ใช้งานได้รายการใหม่ (New deployment)
                    </span>
                  </li>
                  <li>
                    <strong>เลือกประเภท Web app และตั้งค่าสิทธิ์ (สำคัญที่สุด):</strong>
                    <div className="mt-1.5 p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1 text-amber-900">
                      <div>
                        • เรียกใช้ในฐานะ (Execute as): <strong>"ฉัน (Me)"</strong>
                      </div>
                      <div>
                        • ผู้มีสิทธิ์เข้าถึง (Who has access):{' '}
                        <strong className="text-rose-700 underline">"ทุกคน (Anyone)"</strong>{' '}
                        (ต้องเลือกตัวเลือกนี้ เพื่อให้ทุกเครื่องและสิทธิ์ Staff ใช้งานได้โดยไม่ต้องล็อกอินบัญชีเจ้าของชีต)
                      </div>
                    </div>
                  </li>
                  <li>
                    <strong>คัดลอก URL Web App:</strong> หลังจากกด Deploy และกดยินยอมสิทธิ์ (Authorize)
                    จะได้รับ <strong>URL เว็บแอป</strong> ที่ลงท้ายด้วย <code>/exec</code> ให้นำ URL
                    นั้นมากรอกในช่อง <em>Google Apps Script Web App URL</em> ในระบบ แล้วกดบันทึก
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>สถานะระบบ: ทุกเครื่องเชื่อมโยงฐานข้อมูลเดียวกันผ่าน Google Sheet API</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-semibold transition"
          >
            เสร็จสิ้น
          </button>
        </div>
      </div>
    </div>
  );
};
