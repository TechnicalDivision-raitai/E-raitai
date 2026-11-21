import React, { useState } from 'react';
import Swal from 'sweetalert2';
import {
  Inbox,
  CheckCircle2,
  Clock,
  Paperclip,
  Eye,
  AlertCircle,
  ArrowDownToLine
} from 'lucide-react';
import { Project, UserProfile, ProjectStatus, SarabanQueueItem } from '../types/project';
import {
  formatThaiDateTime,
  deriveProjectStatusFromData,
  getWorkNoticeAlert,
  isProjectInMyInbox
} from '../utils/thaiDate';
import { STATUS_LABELS } from '../utils/excelExport';
import { SarabanQueuePanel } from './SarabanQueuePanel';

interface MyInboxViewProps {
  projects: Project[];
  currentUser: UserProfile;
  onSelectProject: (p: Project, tab?: number) => void;
  onUpdateProject: (p: Project) => void;
  sarabanQueueItems: SarabanQueueItem[];
  sarabanQueueLoading: boolean;
  sarabanNeedsScriptUpdate: boolean;
  sarabanQueueError?: string | null;
  onRefreshSarabanQueue: () => void;
  onApproveSarabanItem: (
    item: SarabanQueueItem,
    mergedProject: Project
  ) => Promise<{ success: boolean; error?: string }>;
  onRejectSarabanItem: (
    item: SarabanQueueItem,
    reason: string
  ) => Promise<{ success: boolean; error?: string }>;
  onDeleteSarabanItem: (
    item: SarabanQueueItem,
    rollbackProject?: Project
  ) => Promise<{ success: boolean; error?: string }>;
}

export const MyInboxView: React.FC<MyInboxViewProps> = ({
  projects,
  currentUser,
  onSelectProject,
  onUpdateProject,
  sarabanQueueItems,
  sarabanQueueLoading,
  sarabanNeedsScriptUpdate,
  sarabanQueueError,
  onRefreshSarabanQueue,
  onApproveSarabanItem,
  onRejectSarabanItem,
  onDeleteSarabanItem
}) => {
  const pendingSarabanCount = sarabanQueueItems.filter(i => i.queueStatus === 'pending').length;
  const [activeSubTab, setActiveSubTab] = useState<'inbox' | 'saraban'>(
    pendingSarabanCount > 0 ? 'saraban' : 'inbox'
  );

  // แสดงเฉพาะโครงการที่เริ่มบันทึกข้อมูลตั้งแต่แท็บ 2 (TOR/ราคากลาง) ขึ้นไป และยังไม่เสร็จสิ้น/เบิกจ่ายแล้ว หรือยกเลิก
  const myProjects = projects.filter(p => isProjectInMyInbox(p, currentUser));

  const handleAcknowledge = (project: Project) => {
    if (currentUser.role !== 'admin') {
      Swal.fire('ไม่อนุญาต', 'สิทธิ์เจ้าหน้าที่ (Staff) ไม่สามารถกดรับทราบงานได้', 'warning');
      return;
    }

    const ackTimeStr = formatThaiDateTime();
    const derived = deriveProjectStatusFromData(project);
    const nextStatus: ProjectStatus =
      project.status === 'not_started'
        ? derived !== 'not_started'
          ? derived
          : 'procurement_tor'
        : project.status;

    const updated: Project = {
      ...project,
      ackStatus: 'รับทราบแล้ว',
      ackTime: ackTimeStr,
      statusUpdatedAt: ackTimeStr,
      status: nextStatus,
      updatedAt: new Date().toISOString()
    };

    onUpdateProject(updated);

    Swal.fire({
      icon: 'success',
      title: 'รับทราบงานสำเร็จ',
      text: `บันทึกการรับทราบงานโครงการ "${project.name}" เรียบร้อยแล้ว (${ackTimeStr})`,
      timer: 1800,
      showConfirmButton: false
    });
  };

  const handleUpdateStatus = (project: Project) => {
    Swal.fire({
      title: 'เปลี่ยนสถานะการดำเนินงานโครงการ',
      input: 'select',
      inputOptions: {
        not_started: STATUS_LABELS.not_started,
        procurement_tor: STATUS_LABELS.procurement_tor,
        contracted: STATUS_LABELS.contracted,
        in_progress: STATUS_LABELS.in_progress,
        delivered: STATUS_LABELS.delivered,
        inspected: STATUS_LABELS.inspected,
        completed: STATUS_LABELS.completed,
        overdue: STATUS_LABELS.overdue,
        cancelled: STATUS_LABELS.cancelled
      },
      inputValue: project.status,
      showCancelButton: true,
      confirmButtonText: 'บันทึกสถานะ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#059669'
    }).then(result => {
      if (result.isConfirmed && result.value) {
        const nowStr = formatThaiDateTime();
        const updated: Project = {
          ...project,
          status: result.value as ProjectStatus,
          statusUpdatedAt: nowStr,
          updatedAt: new Date().toISOString()
        };
        onUpdateProject(updated);

        Swal.fire({
          icon: 'success',
          title: 'อัปเดตสถานะสำเร็จ',
          text: `เปลี่ยนสถานะเป็น "${STATUS_LABELS[result.value]}" เรียบร้อยแล้ว (${nowStr})`,
          timer: 1500,
          showConfirmButton: false
        });
      }
    });
  };

  const getStatusBadgeClasses = (status: ProjectStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-teal-50 text-teal-800 border-2 border-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.45)]';
      case 'in_progress':
        return 'bg-emerald-50 text-emerald-800 border-2 border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.45)]';
      case 'delivered':
        return 'bg-purple-50 text-purple-800 border-2 border-purple-400 shadow-[0_0_10px_rgba(192,132,252,0.45)]';
      case 'inspected':
        return 'bg-indigo-50 text-indigo-800 border-2 border-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.45)]';
      case 'overdue':
        return 'bg-rose-50 text-rose-800 border-2 border-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.45)]';
      case 'procurement_tor':
        return 'bg-sky-50 text-sky-900 border-2 border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.45)]';
      case 'contracted':
        return 'bg-blue-50 text-blue-800 border-2 border-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.45)]';
      case 'cancelled':
        return 'bg-slate-100 text-slate-600 border-2 border-slate-400 line-through';
      default:
        return 'bg-slate-50 text-slate-700 border-2 border-slate-300 shadow-[0_0_8px_rgba(148,163,184,0.35)]';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800 font-heading flex items-center gap-2">
              <Inbox className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>กล่องงานของฉัน (My Inbox)</span>
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {activeSubTab === 'inbox'
                ? 'แสดงโครงการที่เริ่มบันทึกข้อมูลตั้งแต่หมวดที่ 2 (TOR/ราคากลาง) ขึ้นไป และจะนำออกอัตโนมัติเมื่อเบิกจ่ายแล้ว/เสร็จสิ้น หรือยกเลิก'
                : 'รายการเอกสารที่ส่งซิงค์มาจากระบบสารบรรณ รอตรวจสอบและกดยืนยันรับเข้าสู่ทะเบียนโครงการ'}
            </p>
          </div>

          {/* Segmented Tab Switcher */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveSubTab('inbox')}
              className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                activeSubTab === 'inbox'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              โครงการที่ดูแล ({myProjects.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('saraban')}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                activeSubTab === 'saraban'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-600" />
              <span>คิวรับจากสารบรรณ ({pendingSarabanCount})</span>
            </button>
          </div>
        </div>

        {/* Prompt Banner when pending Saraban items exist while viewing inbox tab */}
        {activeSubTab === 'inbox' && pendingSarabanCount > 0 && (
          <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-emerald-900">
              <ArrowDownToLine className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="tabular-nums">
                มีเอกสารส่งมาจากระบบสารบรรณรอตรวจสอบรับเข้าโครงการจำนวน{' '}
                <strong>{pendingSarabanCount} รายการ</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveSubTab('saraban')}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition whitespace-nowrap shrink-0"
            >
              ตรวจสอบคิวสารบรรณ
            </button>
          </div>
        )}

        {activeSubTab === 'saraban' ? (
          <SarabanQueuePanel
            projects={projects}
            queueItems={sarabanQueueItems}
            isLoading={sarabanQueueLoading}
            needsScriptUpdate={sarabanNeedsScriptUpdate}
            errorMessage={sarabanQueueError}
            currentUser={currentUser}
            onRefreshQueue={onRefreshSarabanQueue}
            onApproveItem={onApproveSarabanItem}
            onRejectItem={onRejectSarabanItem}
            onDeleteItem={onDeleteSarabanItem}
            onSelectProject={onSelectProject}
          />
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase font-semibold border-b border-gray-200">
              <tr>
                <th className="p-3">รหัสโครงการ</th>
                <th className="p-3">หมวดงบประมาณ</th>
                <th className="p-3">ชื่อโครงการ / สถานที่</th>
                <th className="p-3">ผู้รับผิดชอบ</th>
                <th className="p-3 text-center">สถานะโครงการ / รับทราบ</th>
                <th className="p-3 text-center">ไฟล์แนบ</th>
                <th className="p-3 text-center">การกระทำ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {myProjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                      <p className="text-sm font-medium">ไม่มีงานหรือโครงการค้างดำเนินการในกล่องงานขณะนี้</p>
                      <p className="text-xs text-gray-400">
                        โครงการที่บันทึกเฉพาะหมวดที่ 1 (ข้อมูลทั่วไป) จะอยู่ในทะเบียนโครงการ และจะเข้ากล่องงานอัตโนมัติเมื่อเริ่มบันทึกข้อมูลหมวดที่ 2 (TOR/ราคากลาง)
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                myProjects.map(p => {
                  const isAcked = p.ackStatus === 'รับทราบแล้ว';
                  const workNoticeAlert = getWorkNoticeAlert(p);
                  const latestStatusTime =
                    p.statusUpdatedAt ||
                    p.ackTime ||
                    (p.updatedAt ? formatThaiDateTime(p.updatedAt) : 'รับทราบแล้ว');

                  return (
                    <tr key={p.id} className="hover:bg-gray-50 transition">
                      <td className="p-3 font-bold text-emerald-700 whitespace-nowrap font-mono">
                        {p.projectCode}
                        <span className="block text-[10px] text-gray-400">ปี {p.fiscalYear}</span>
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-medium text-[11px]">
                          {p.budgetCategory}
                        </span>
                      </td>

                      <td className="p-3 max-w-xs">
                        <button
                          onClick={() => onSelectProject(p)}
                          className="font-medium text-gray-800 hover:text-emerald-700 text-left line-clamp-2"
                        >
                          {p.name}
                        </button>
                        <div className="text-[10px] text-gray-400 truncate mt-0.5">{p.location}</div>
                        {workNoticeAlert.hasAlert && (
                          <button
                            type="button"
                            onClick={() => onSelectProject(p, 5)}
                            className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border text-left transition ${
                              workNoticeAlert.isOver15Days
                                ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                                : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                            }`}
                            title={workNoticeAlert.fullMessage}
                          >
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>{workNoticeAlert.badgeLabel}</span>
                          </button>
                        )}
                      </td>

                      <td className="p-3 text-gray-600 whitespace-nowrap">
                        {p.responsiblePerson || p.supervisorName || '-'}
                      </td>

                      {/* คอลัมน์รวม: สถานะโครงการ (บน) + ปุ่มกดรับทราบงาน / วันที่อัปเดตสถานะล่าสุด (ล่าง) */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${getStatusBadgeClasses(
                              p.status
                            )}`}
                          >
                            {STATUS_LABELS[p.status] || p.status}
                          </span>

                          {isAcked ? (
                            <span
                              className="inline-flex items-center gap-1 text-emerald-700 text-[10px] font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200"
                              title="วันเวลาที่รับทราบ / เปลี่ยนสถานะล่าสุด"
                            >
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              <span>{latestStatusTime}</span>
                            </span>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              {currentUser.role === 'admin' ? (
                                <button
                                  onClick={() => handleAcknowledge(p)}
                                  className="bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold px-3 py-1 rounded-lg transition active:scale-95 shadow-xs"
                                >
                                  กดรับทราบงาน
                                </button>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  รอรับทราบ
                                </span>
                              )}
                              {p.statusUpdatedAt && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                                  <Clock className="w-2.5 h-2.5 shrink-0" />
                                  <span>{p.statusUpdatedAt}</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* ไฟล์แนบ */}
                      <td className="p-3 text-center whitespace-nowrap">
                        {p.fileUrl || (p.attachments && p.attachments.length > 0) ? (
                          <a
                            href={p.fileUrl || '#'}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => {
                              if (!p.fileUrl) {
                                e.preventDefault();
                                onSelectProject(p);
                              }
                            }}
                            className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-medium transition"
                          >
                            <Paperclip className="w-3.5 h-3.5 mr-1" />
                            <span>เปิดดูไฟล์</span>
                          </a>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>

                      {/* การกระทำ (ซ่อนปุ่มเปลี่ยนสถานะในสิทธิ์ staff ตามข้อ 7) */}
                      <td className="p-3 text-center whitespace-nowrap space-x-1.5">
                        {currentUser.role === 'admin' && (
                          <button
                            onClick={() => handleUpdateStatus(p)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2.5 py-1 rounded-lg transition font-medium"
                            title="เปลี่ยนสถานะการดำเนินงาน"
                          >
                            เปลี่ยนสถานะ
                          </button>
                        )}
                        <button
                          onClick={() => onSelectProject(p)}
                          className="text-gray-600 hover:text-emerald-700 p-1 rounded-md"
                          title="ดูรายละเอียดโครงการ"
                        >
                          <Eye className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
};
