import * as XLSX from 'xlsx';
import {
  RepairAttachment,
  RepairChannel,
  RepairRequest,
  RepairRequestStatus,
  RepairRoadType,
  RepairUrgency
} from '../types/project';
import { formatThaiDate } from './thaiDate';

export const REPAIR_STATUS_META: Record<
  RepairRequestStatus,
  {
    label: string;
    shortLabel: string;
    textClass: string;
    dotClass: string;
    stepIndex: number;
  }
> = {
  received: {
    label: 'รับคำร้องแล้ว / รอตรวจสอบ',
    shortLabel: 'รอตรวจสอบ',
    textClass: 'text-amber-700',
    dotClass: 'bg-amber-500',
    stepIndex: 1
  },
  inspecting: {
    label: 'ลงพื้นที่สำรวจหน้างาน',
    shortLabel: 'สำรวจหน้างาน',
    textClass: 'text-sky-700',
    dotClass: 'bg-sky-500',
    stepIndex: 2
  },
  in_progress: {
    label: 'กำลังดำเนินการซ่อมแซม',
    shortLabel: 'กำลังซ่อมแซม',
    textClass: 'text-indigo-700',
    dotClass: 'bg-indigo-500',
    stepIndex: 3
  },
  completed: {
    label: 'แก้ไข / ซ่อมแซมแล้วเสร็จ',
    shortLabel: 'แล้วเสร็จ',
    textClass: 'text-emerald-700',
    dotClass: 'bg-emerald-600',
    stepIndex: 4
  },
  budget_planned: {
    label: 'เสนอตั้งงบประมาณ / จัดทำโครงการ',
    shortLabel: 'เสนอตั้งงบ',
    textClass: 'text-slate-700',
    dotClass: 'bg-slate-500',
    stepIndex: 4
  }
};

export const REPAIR_URGENCY_META: Record<
  RepairUrgency,
  { label: string; textClass: string }
> = {
  normal: { label: 'ปกติ', textClass: 'text-slate-600' },
  urgent: { label: 'เร่งด่วน', textClass: 'text-amber-700 font-semibold' },
  emergency: { label: 'ฉุกเฉิน / สัญจรไม่ได้', textClass: 'text-rose-700 font-bold' }
};

export const REPAIR_CHANNEL_LABELS: Record<RepairChannel, string> = {
  walk_in: 'ยื่นคำร้องด้วยตนเอง',
  council_member: 'สมาชิกสภาฯ / ผู้นำชุมชน',
  phone: 'แจ้งทางโทรศัพท์',
  letter: 'หนังสือราชการ / บันทึกข้อความ',
  online: 'ช่องทางออนไลน์ / ไลน์'
};

export const REPAIR_ROAD_TYPE_LABELS: Record<RepairRoadType, string> = {
  gravel: 'ถนนลูกรัง / หินคลุก',
  concrete: 'ถนน คสล. (คอนกรีต)',
  asphalt: 'ถนนลาดยาง / แอสฟัลต์',
  drainage: 'ท่อ / รางระบายน้ำ',
  bridge: 'สะพาน / คอสะพาน',
  other: 'สาธารณูปโภคอื่น'
};

export const REPAIR_ATTACHMENT_STAGE_LABELS: Record<RepairAttachment['stage'], string> = {
  petition: 'ใบคำร้อง / เอกสารแนบ',
  before: 'ภาพก่อนซ่อมแซม',
  during: 'ภาพระหว่างซ่อมแซม',
  after: 'ภาพหลังซ่อมแล้วเสร็จ'
};

export const REPAIR_METHOD_PRESETS = [
  'เกรดปรับเกลี่ยถนนลูกรัง',
  'ลงหินคลุก / ลูกรัง พร้อมบดอัดแน่น',
  'ปะซ่อมหลุมบ่อด้วยยางมะตอยสำเร็จรูป',
  'ซ่อมแซมผิวทาง คสล. / เทคอนกรีตเสริมเหล็ก',
  'ขุดลอกรางระบายน้ำ / วางท่อระบายน้ำใหม่',
  'ซ่อมแซมคอสะพาน / ท่อลอดเหลี่ยม',
  'ตัดแต่งกิ่งไม้ / เปิดทางสัญจร',
  'เสนอเข้าแผนพัฒนา / ตั้งงบประมาณจัดทำโครงการ'
];

export function generateNextRepairCode(
  fiscalYear: number,
  existing: RepairRequest[],
  excludeId?: string
): string {
  const yy = String(fiscalYear).slice(-2);
  const head = `ซ.${yy}-`;
  let maxSeq = 0;

  existing.forEach(item => {
    if (excludeId && item.id === excludeId) return;
    const code = (item.requestCode || '').trim();
    if (!code.startsWith(head)) return;
    const suffix = code.slice(head.length);
    if (/^\d+$/.test(suffix)) {
      const n = parseInt(suffix, 10);
      if (n > maxSeq) maxSeq = n;
    }
  });

  return `${head}${String(maxSeq + 1).padStart(3, '0')}`;
}

export function extractRoadFromSubject(subject?: string | null): string | null {
  const text = (subject || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const match = text.match(/(?:สาย(?!ไฟ|เคเบิล|เมน|ส่งน้ำ)|ซอย)[^\n]*/);
  if (!match) return null;
  const cleaned = match[0]
    .replace(/\s*(?:ต\.\s*ไร่ใต้|ตำบล\s*ไร่ใต้|อ\.\s*พิบูลมังสาหาร|จ\.\s*อุบลราชธานี).*$/, '')
    .trim();
  const body = cleaned.replace(/^(?:สายทาง|สาย|ซอย)/, '').trim();
  return body.length >= 2 ? cleaned : null;
}

export function getRepairImageDisplayUrl(att?: RepairAttachment): string {
  if (!att) return '';
  if (att.previewDataUrl) return att.previewDataUrl;
  const rawUrl = att.url || '';
  if (!rawUrl) return '';
  const matchD = rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (matchD && matchD[1]) {
    return `https://drive.google.com/thumbnail?id=${matchD[1]}&sz=w1000`;
  }
  const matchId = rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId && matchId[1]) {
    return `https://drive.google.com/thumbnail?id=${matchId[1]}&sz=w1000`;
  }
  return rawUrl;
}

export function exportRepairRequestsToExcel(items: RepairRequest[], label = 'ทั้งหมด') {
  const rows = items.map((r, index) => ({
    'ลำดับ': index + 1,
    'รหัสคำร้อง': r.requestCode,
    'ปีงบประมาณ': r.fiscalYear,
    'เลขรับ อบต.': r.obtReceiveNo || '-',
    'วันที่รับ อบต.': r.obtReceiveDate ? formatThaiDate(r.obtReceiveDate) : '-',
    'เลขรับกองช่าง': r.engReceiveNo || '-',
    'วันที่รับกองช่าง': r.engReceiveDate ? formatThaiDate(r.engReceiveDate) : '-',
    'วันที่ยื่นคำร้อง': r.petitionDate ? formatThaiDate(r.petitionDate) : '-',
    'เรื่อง': r.subject,
    'สายถนน / จุดชำรุด': r.roadName,
    'หมู่ที่': r.villageNo || '-',
    'ประเภทถนน/งาน': REPAIR_ROAD_TYPE_LABELS[r.roadType] || r.roadType,
    'ชื่อผู้ร้อง': r.requesterName,
    'เบอร์ติดต่อ': r.requesterPhone || '-',
    'ระดับความเร่งด่วน': REPAIR_URGENCY_META[r.urgency]?.label || r.urgency,
    'รายละเอียดความเดือดร้อน': r.problemDetails,
    'สถานะการดำเนินการ': REPAIR_STATUS_META[r.status]?.label || r.status,
    'ผู้รับผิดชอบ/ชุดช่าง': r.assignedStaff || '-',
    'วันที่ลงพื้นที่สำรวจ': r.inspectionDate ? formatThaiDate(r.inspectionDate) : '-',
    'ผลการตรวจสอบหน้างาน': r.inspectionSummary || '-',
    'วิธีการซ่อมแซม': r.repairMethod || '-',
    'รายละเอียดการแก้ไข': r.repairDetails || '-',
    'วันที่เริ่มซ่อม': r.repairStartDate ? formatThaiDate(r.repairStartDate) : '-',
    'วันที่ซ่อมแล้วเสร็จ': r.repairCompletedDate ? formatThaiDate(r.repairCompletedDate) : '-',
    'ค่าใช้จ่ายซ่อมบำรุง (บาท)': r.repairCost || 0,
    'หมายเหตุปิดงาน': r.resolutionNote || '-'
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'คำร้องงานซ่อมแซม');
  XLSX.writeFile(wb, `ทะเบียนคำร้องงานซ่อมแซม_${label}.xlsx`);
}
