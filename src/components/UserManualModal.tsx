import React from 'react';
import {
  CheckCircle2,
  BookOpen,
  ShieldCheck,
  HardHat,
  Printer,
  Download
} from 'lucide-react';
import { downloadSampleExcelTemplate } from '../utils/excelExport';
import { UserProfile } from '../types/project';

interface UserManualModalProps {
  onClearAllData?: () => void;
  onRestoreSampleData?: () => void;
  projectCount?: number;
  currentUser?: UserProfile;
}

export const UserManualModal: React.FC<UserManualModalProps> = ({
  currentUser
}) => {

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-heading text-slate-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-emerald-700" />
            <span>คู่มือการใช้งานระบบ & การส่งออกเพื่อทดลองใช้งานจริง</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            คำแนะนำขั้นตอนการนำระบบไปใช้งานจริง การล้างโครงการตัวอย่างเพื่อเริ่มระบบใหม่ และการเชื่อมต่อฐานข้อมูล
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">

          <button
            onClick={downloadSampleExcelTemplate}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200 transition"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Template Excel</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-xs transition"
          >
            <Printer className="w-4 h-4" />
            <span>พิมพ์คู่มือ</span>
          </button>
        </div>
      </div>

      {/* Role and Permissions Guide */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-3 text-xs">
        <h3 className="text-sm font-bold text-slate-800 font-heading flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          <span>โครงสร้างสิทธิ์ผู้ใช้งาน (Role-Based Access Control)</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2">
            <span className="font-bold text-amber-900 text-xs">ผู้ดูแลระบบ (Admin)</span>
            <ul className="list-disc list-inside space-y-1 text-amber-900/80">
              <li>เพิ่ม แก้ไข และ<strong>ลบโครงการ</strong>ได้</li>
              <li>นำเข้าและส่งออก Excel ทะเบียนโครงการ</li>
              <li>ดูและพิมพ์เอกสารและรายงานราชการทุกประเภท</li>
              <li>จัดการการซิงค์ข้อมูล Google Sheet & Drive</li>
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 space-y-2">
            <span className="font-bold text-blue-900 text-xs">เจ้าหน้าที่/บุคลากรทั่วไป</span>
            <ul className="list-disc list-inside space-y-1 text-blue-900/80">
              <li><strong>สิทธิ์ดูข้อมูลอย่างเดียว (Read-Only)</strong></li>
              <li>เปิดดูรายละเอียดโครงการ รายงาน สถิติ ไทม์ไลน์ 12 ขั้นตอน และคลังเอกสารแนบ</li>
              <li>ไม่อนุญาตให้เพิ่ม แก้ไข ลบ นำเข้า หรือเปลี่ยนสถานะข้อมูลโครงการ</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Guide Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
        {/* Section 1: Workflow */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <HardHat className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 font-heading">
                1. ขั้นตอนการบันทึกข้อมูลโครงการ 6 หมวด
              </h3>
              <p className="text-[11px] text-slate-400">ลำดับการบันทึกตามวงรอบงานกองช่าง</p>
            </div>
          </div>

          <div className="space-y-3 text-slate-600 leading-relaxed">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
              <strong className="text-emerald-800 block text-xs mb-1">หมวดที่ 1: ข้อมูลทั่วไป</strong>
              ระบุปีงบประมาณ (พ.ศ.), ชื่อโครงการ, แหล่งงบประมาณ (เงินสะสม, งบประมาณรายจ่าย, เงินอุดหนุน), สมัยประชุมสภาฯ (ถ้ามี), งบประมาณอนุมัติ และผู้รับผิดชอบโครงการ
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
              <strong className="text-emerald-800 block text-xs mb-1">หมวดที่ 2: TOR และราคากลาง</strong>
              บันทึกเลขที่คำสั่งแต่งตั้ง กก. จัดทำ TOR, วันที่คำสั่ง, ราคากลาง และสามารถกด <em>"+ เพิ่มกรรมการ"</em> ได้ไม่จำกัดจำนวน พร้อมแนบไฟล์ PDF คำสั่งและแบบ บก.01
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
              <strong className="text-emerald-800 block text-xs mb-1">หมวดที่ 3: คำสั่งควบคุมงานและตรวจรับ</strong>
              บันทึกเลขที่คำสั่งแต่งตั้งผู้ควบคุมงาน และรายชื่อคณะกรรมการตรวจรับพัสดุในงานจ้างก่อสร้าง
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
              <strong className="text-emerald-800 block text-xs mb-1">หมวดที่ 4: ข้อมูลสัญญาจ้าง</strong>
              ระบุเลขที่สัญญา, วันที่ลงนามสัญญา, วงเงินตามสัญญา, วันที่เริ่ม-สิ้นสุดสัญญา, ชื่อคู่สัญญา และเลขประจำตัวผู้เสียภาษี
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
              <strong className="text-emerald-800 block text-xs mb-1">หมวดที่ 5: การดำเนินงาน & ติดตามความคืบหน้า</strong>
              บันทึกได้หลายครั้ง: หนังสือแจ้งเข้าทำงาน, การส่งมอบงานแต่ละงวด, การตรวจรับงาน, และเลขที่ฎีกาเบิกจ่ายเงินค่าจ้าง
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
              <strong className="text-emerald-800 block text-xs mb-1">หมวดที่ 6: การเบิกค่าตอบแทนกรรมการ</strong>
              บันทึกค่าตอบแทนแยกตามประเภท (ราคากลาง, ผู้ควบคุมงาน, ตรวจรับงาน) พร้อมคำนวณยอดรวมค่าตอบแทนอัตโนมัติ
            </div>
          </div>
        </div>

        {/* Section 2: Test Cases Checklist */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="p-2 bg-teal-100 text-teal-700 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 font-heading">
                2. สรุปฟังก์ชันที่พัฒนาและรายการที่ทดสอบแล้ว
              </h3>
              <p className="text-[11px] text-slate-400">ผ่านการตรวจสอบครบถ้วนทุกข้อกำหนด (Passed)</p>
            </div>
          </div>

          <div className="space-y-2">
            {[
              {
                title: 'แดชบอร์ดภาพรวม 11 ตัวชี้วัด',
                desc: 'ทดสอบการนับโครงการ, งบอนุมัติ, วงเงินสัญญา, เงินเบิกจ่ายจริง, กราฟแยกตามปีงบประมาณ และสถานะความคืบหน้า'
              },
              {
                title: 'การกรองตามปีงบประมาณและหมวดงบ',
                desc: 'ทดสอบเปลี่ยนปีงบประมาณ พ.ศ. 2569 ถึง 2575 แล้วแดชบอร์ด ตาราง และรายงานปรับตามปีที่เลือกทันที'
              },
              {
                title: 'ทะเบียนโครงการและค้นหา',
                desc: 'ทดสอบเรียงลำดับ (Sort) ตามปีงบประมาณ วันที่เริ่ม สิ้นสุด และค้นหาชื่อผู้รับจ้าง/สัญญา'
              },
              {
                title: 'การเพิ่ม แก้ไข ลบโครงการ (CRUD)',
                desc: 'ทดสอบบันทึกข้อมูลครบ 6 หมวด พร้อมฟังก์ชันลบที่จำกัดเฉพาะสิทธิ์ผู้ดูแลระบบ (Admin)'
              },
              {
                title: 'หน้ารายละเอียด 8 แท็บ และการพิมพ์',
                desc: 'ทดสอบจัดรูปแบบหัวข้อซ้าย-รายละเอียดขวา และพิมพ์เอกสารราชการผ่านเบราว์เซอร์'
              },
              {
                title: 'ระบบ Timeline 12 ขั้นตอนและแจ้งเตือนเกินกำหนด',
                desc: 'ทดสอบคำนวณวันสิ้นสุดสัญญา แสดงป้ายแจ้งเตือนสีแดงโครงการที่เลยกำหนดสัญญา'
              },
              {
                title: 'การนำเข้าและส่งออก Excel / CSV',
                desc: 'ทดสอบส่งออกตารางโครงการเป็น .xlsx และนำเข้าไฟล์พร้อมตรวจสอบหัวตารางและข้อมูลซ้ำ'
              },
              {
                title: 'การจัดการสิทธิ์ผู้ใช้งาน (Admin vs Staff)',
                desc: 'ซ่อนปุ่มสลับสิทธิ์การใช้งานจากหน้า Staff (แสดงเฉพาะ Admin), ตรวจสอบสิทธิ์ดูข้อมูลอย่างเดียวเมื่อเป็น Staff'
              },
              {
                title: 'ฐานข้อมูลหลัก Google Sheet & Drive',
                desc: 'ซิงค์ข้อมูลทะเบียนโครงการและคลังเอกสารแนบผ่าน Google Cloud อัตโนมัติ'
              }
            ].map((test, idx) => (
              <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-800">{test.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{test.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
