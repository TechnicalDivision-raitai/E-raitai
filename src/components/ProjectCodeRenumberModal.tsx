import React, { useEffect, useState } from 'react';
import { X, AlertTriangle, ArrowRight, ListOrdered, CheckCircle2 } from 'lucide-react';
import { ProjectCodeGapGroup, ProjectCodeRenumberItem } from '../utils/projectCodeUtils';

interface ProjectCodeRenumberModalProps {
  isOpen: boolean;
  onClose: () => void;
  gapGroups: ProjectCodeGapGroup[];
  onApplyRenumber: (group: ProjectCodeGapGroup, changes: ProjectCodeRenumberItem[]) => void;
}

export const ProjectCodeRenumberModal: React.FC<ProjectCodeRenumberModalProps> = ({
  isOpen,
  onClose,
  gapGroups,
  onApplyRenumber
}) => {
  const [selectedKey, setSelectedKey] = useState<string>('');

  useEffect(() => {
    if (isOpen && gapGroups.length > 0) {
      const stillExists = gapGroups.some(g => g.key === selectedKey);
      if (!stillExists) {
        setSelectedKey(gapGroups[0].key);
      }
    }
  }, [isOpen, gapGroups, selectedKey]);

  if (!isOpen) return null;

  const activeGroup = gapGroups.find(g => g.key === selectedKey) || gapGroups[0];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-800 to-teal-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-700/60 rounded-xl">
              <ListOrdered className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold font-heading">
                จัดเรียงรหัสโครงการใหม่ (ปิดช่องว่างเลขรหัส)
              </h3>
              <p className="text-xs text-emerald-200">
                ตรวจสอบรายการที่จะเปลี่ยนรหัสก่อนกดยืนยัน เพื่อไม่ให้กระทบแฟ้มเอกสารที่จัดพิมพ์ไปแล้ว
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-emerald-200 hover:text-white hover:bg-emerald-700/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {gapGroups.length === 0 || !activeGroup ? (
            <div className="py-12 text-center space-y-2 text-slate-500">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <div className="text-sm font-bold text-slate-800">
                รหัสโครงการทั้งหมดเรียงต่อเนื่องครบถ้วนแล้ว
              </div>
              <p className="text-xs text-slate-500">ไม่พบช่องว่างของรหัสโครงการในระบบขณะนี้</p>
            </div>
          ) : (
            <>
              {/* Paper Document Check Reminder */}
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 leading-relaxed">
                  <div className="font-bold">คำแนะนำก่อนจัดเรียงรหัสใหม่</div>
                  <p>
                    • <strong>กรณียังไม่ได้จัดพิมพ์เอกสาร/ปกแฟ้ม:</strong> สามารถกด <strong>ยืนยันจัดเรียงรหัสใหม่</strong> ด้านล่างเพื่อให้รหัสเรียงต่อเนื่องกันทั้งหมดได้เลย
                    <br />
                    • <strong>กรณีจัดพิมพ์เอกสารไปแล้ว:</strong> แนะนำให้กด <strong>ยกเลิก (ไม่จัดเรียงใหม่)</strong> แล้วค่อยกดเลือกใช้เลขว่างที่ระบบแนะนำในหน้า <em>เพิ่มโครงการใหม่</em> แทน เพื่อไม่ให้รหัสเอกสารเดิมคลาดเคลื่อน
                  </p>
                </div>
              </div>

              {/* Group Switcher */}
              {gapGroups.length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">เลือกหมวดรหัส:</span>
                  {gapGroups.map(g => (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => setSelectedKey(g.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                        g.key === activeGroup.key
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {g.prefixLabel} ปีงบ {g.fiscalYear} (ว่าง {g.missingCodes.length})
                    </button>
                  ))}
                </div>
              )}

              {/* Vacant Codes Summary */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-bold text-slate-700">
                    {activeGroup.prefixLabel} ปีงบประมาณ {activeGroup.fiscalYear} — พบเลขว่าง:
                  </span>
                  {activeGroup.missingCodes.map(code => (
                    <span
                      key={code}
                      className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-mono font-bold text-[11px]"
                    >
                      {code}
                    </span>
                  ))}
                </div>
                <span className="text-slate-500">
                  จะขยับรหัสจำนวน <strong className="text-slate-800">{activeGroup.changes.length}</strong> โครงการ
                </span>
              </div>

              {/* Before / After Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 border-b border-slate-200">
                  ตัวอย่างเปรียบเทียบรหัสเดิม → รหัสใหม่
                </div>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs border-separate border-spacing-0">
                    <thead>
                      <tr className="text-slate-600 font-semibold">
                        <th className="sticky top-0 bg-slate-50 border-b border-slate-200 p-2.5 text-center w-12">
                          ลำดับ
                        </th>
                        <th className="sticky top-0 bg-slate-50 border-b border-slate-200 p-2.5">
                          ชื่อโครงการ
                        </th>
                        <th className="sticky top-0 bg-slate-50 border-b border-slate-200 p-2.5 text-center w-28 whitespace-nowrap">
                          รหัสเดิม
                        </th>
                        <th className="sticky top-0 bg-slate-50 border-b border-slate-200 p-2.5 text-center w-8" />
                        <th className="sticky top-0 bg-slate-50 border-b border-slate-200 p-2.5 text-center w-28 whitespace-nowrap">
                          รหัสใหม่
                        </th>
                      </tr>
                    </thead>
                    <tbody className="[&>tr>td]:border-b [&>tr>td]:border-slate-100 [&>tr:last-child>td]:border-b-0">
                      {activeGroup.changes.map((item, idx) => (
                        <tr key={item.projectId} className="hover:bg-slate-50/80">
                          <td className="p-2.5 text-center text-slate-400 tabular-nums">{idx + 1}</td>
                          <td className="p-2.5 font-medium text-slate-800">{item.projectName}</td>
                          <td className="p-2.5 text-center whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono font-semibold line-through decoration-slate-400">
                              {item.oldCode}
                            </span>
                          </td>
                          <td className="p-2.5 text-center text-slate-400">
                            <ArrowRight className="w-3.5 h-3.5 mx-auto" />
                          </td>
                          <td className="p-2.5 text-center whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono font-bold">
                              {item.newCode}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-500">
            {activeGroup ? `พร้อมจัดเรียง ${activeGroup.changes.length} โครงการในหมวด ${activeGroup.prefixLabel}` : ''}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition"
            >
              ยกเลิก (ไม่จัดเรียงใหม่)
            </button>
            {activeGroup && (
              <button
                type="button"
                onClick={() => onApplyRenumber(activeGroup, activeGroup.changes)}
                className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-700/20 active:scale-95 transition"
              >
                ยืนยันจัดเรียงรหัสใหม่ ({activeGroup.changes.length} โครงการ)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
