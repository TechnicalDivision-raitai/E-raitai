import React from 'react';
import Swal from 'sweetalert2';
import {
  Inbox,
  CheckCircle2,
  Clock,
  Paperclip,
  Eye,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { Project, UserProfile, ProjectStatus } from '../types/project';
import { formatThaiDateTime, deriveProjectStatusFromData } from '../utils/thaiDate';
import { STATUS_LABELS } from '../utils/excelExport';

interface MyInboxViewProps {
  projects: Project[];
  currentUser: UserProfile;
  onSelectProject: (p: Project) => void;
  onUpdateProject: (p: Project) => void;
}

export const MyInboxView: React.FC<MyInboxViewProps> = ({
  projects,
  currentUser,
  onSelectProject,
  onUpdateProject
}) => {
  // Requirement 5: ตัวเลขกล่องงานของฉันนับเฉพาะโครงการที่เริ่มดำเนินงานแล้วและยังไม่เสร็จ โดยคำนึงถึงผู้รับผิดชอบหรือผู้ควบคุมงาน
  const myProjects = projects.filter(p => {
    const isStartedAndNotCompleted = p.status !== 'not_started' && p.status !== 'completed';
    if (!isStartedAndNotCompleted) return false;

    if (currentUser.role === 'admin') return true;
    return (
      (p.responsiblePerson && p.responsiblePerson.includes(currentUser.displayName)) ||
      (p.supervisorName && p.supervisorName.includes(currentUser.displayName))
    );
  });

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
        overdue: STATUS_LABELS.overdue
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
        return 'bg-teal-100 text-teal-800 border border-teal-200';
      case 'in_progress':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case 'delivered':
        return 'bg-purple-100 text-purple-800 border border-purple-200';
      case 'inspected':
        return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
      case 'overdue':
        return 'bg-rose-100 text-rose-800 border border-rose-200';
      case 'procurement_tor':
        return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'contracted':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-800 font-heading flex items-center gap-2">
              <Inbox className="w-5 h-5 text-emerald-600" />
              <span>กล่องงานของฉัน (My Inbox)</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              รายการโครงการและงานมอบหมายที่ท่านต้องรับทราบและกำกับดูแล ({myProjects.length} โครงการ)
            </p>
          </div>
        </div>

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
                      <p className="text-sm font-medium">ไม่มีงานหรือโครงการค้างรับทราบในขณะนี้</p>
                    </div>
                  </td>
                </tr>
              ) : (
                myProjects.map(p => {
                  const isAcked = p.ackStatus === 'รับทราบแล้ว';
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
      </div>
    </div>
  );
};
