import * as XLSX from 'xlsx';
import { CommitteeMember, Project } from '../types/project';
import { formatThaiDate } from './thaiDate';

export const STATUS_LABELS: Record<string, string> = {
  not_started: 'ยังไม่เริ่มดำเนินการ',
  procurement_tor: 'จัดทำ TOR/ราคากลาง',
  contracted: 'ลงนามสัญญาแล้ว',
  in_progress: 'อยู่ระหว่างดำเนินการ',
  delivered: 'ส่งมอบงานแล้ว รอตรวจรับ',
  inspected: 'ตรวจรับงานแล้ว รอเบิกจ่าย',
  completed: 'แล้วเสร็จ/เบิกจ่ายแล้ว',
  overdue: 'เกินกำหนดสัญญา',
  cancelled: 'ยกเลิกโครงการ'
};

export const INSPECTION_RESULT_LABELS: Record<string, string> = {
  pass: 'ผ่าน',
  fail: 'ไม่ผ่าน',
  need_revision: 'ให้แก้ไข'
};

export const DISBURSEMENT_STATUS_LABELS: Record<string, string> = {
  paid: 'จ่ายแล้ว',
  pending: 'รอเบิกจ่าย'
};

export const REMUNERATION_STATUS_LABELS: Record<string, string> = {
  paid: 'จ่ายแล้ว',
  pending: 'รอเบิก',
  not_eligible: 'ไม่ประสงค์เบิก'
};

export interface ExcelColumnSpec {
  header: string;
  group: string;
  required: boolean;
  format: string;
  example: string;
  wch: number;
}

/**
 * Single source of truth for all 56 supported Excel import/export columns (7 workflow groups)
 */
export const EXCEL_TEMPLATE_COLUMNS: ExcelColumnSpec[] = [
  // หมวด 1: ข้อมูลทั่วไปและงบประมาณ
  { header: 'รหัสโครงการ', group: '1. ข้อมูลโครงการและงบประมาณ', required: false, format: 'ข้อความ (เว้นว่างได้ ระบบสร้างอัตโนมัติ / ใช้จับคู่เมื่ออัปเดตซ้ำ)', example: 'ถ.69-101', wch: 15 },
  { header: 'ปีงบประมาณ', group: '1. ข้อมูลโครงการและงบประมาณ', required: false, format: 'พ.ศ. 4 หลัก (เช่น 2569) หรือเลข 2 หลัก (69)', example: '2569', wch: 13 },
  { header: 'ชื่อโครงการ', group: '1. ข้อมูลโครงการและงบประมาณ', required: true, format: 'ข้อความ (จำเป็นต้องระบุทุกแถว)', example: 'โครงการก่อสร้างถนน คสล. สายบ้านหนองผักชี หมู่ที่ 3', wch: 42 },
  { header: 'หมวดงบประมาณ', group: '1. ข้อมูลโครงการและงบประมาณ', required: false, format: 'งบประมาณรายจ่าย / เงินสะสม / เงินอุดหนุนเฉพาะกิจ / เงินอุดหนุนทั่วไป หรือระบุเอง', example: 'เงินสะสม', wch: 22 },
  { header: 'สมัยประชุม/มติ', group: '1. ข้อมูลโครงการและงบประมาณ', required: false, format: 'ข้อความ (กรณีเงินสะสมหรือมีมติสภาฯ)', example: 'สมัยสามัญ สมัยที่ 1 ครั้งที่ 1/2569', wch: 28 },
  { header: 'ปี พ.ศ. มติอนุมัติ', group: '1. ข้อมูลโครงการและงบประมาณ', required: false, format: 'พ.ศ. 4 หลัก (เว้นว่างจะอ้างอิงตามปีงบประมาณ)', example: '2569', wch: 16 },
  { header: 'งบประมาณอนุมัติ (บาท)', group: '1. ข้อมูลโครงการและงบประมาณ', required: false, format: 'ตัวเลข (ใส่คอมมาหรือทศนิยมได้)', example: '1850000', wch: 20 },
  { header: 'รายละเอียดโครงการ', group: '1. ข้อมูลโครงการและงบประมาณ', required: false, format: 'ข้อความบรรยายขนาด/ปริมาณงาน/แบบแปลน', example: 'ก่อสร้างถนน คสล. กว้าง 4 ม. หนา 0.15 ม. ยาว 500 ม.', wch: 42 },
  { header: 'สถานที่ดำเนินโครงการ', group: '1. ข้อมูลโครงการและงบประมาณ', required: false, format: 'ข้อความระบุหมู่บ้าน/ตำบล/สายทาง', example: 'หมู่ที่ 3 ต.ไร่ใต้ อ.พิบูลมังสาหาร', wch: 30 },
  { header: 'ผู้รับผิดชอบโครงการ', group: '1. ข้อมูลโครงการและงบประมาณ', required: false, format: 'ชื่อ-สกุล หรือหน่วยงาน', example: 'นายศรายุทธ สงวนรัษฎ์', wch: 24 },
  { header: 'หมายเหตุ', group: '1. ข้อมูลโครงการและงบประมาณ', required: false, format: 'ข้อความเพิ่มเติม', example: 'ดำเนินการแล้วเสร็จตามแผน', wch: 28 },
  { header: 'เลขที่หนังสือขออนุมัติ', group: '1. ข้อมูลโครงการและงบประมาณ', required: false, format: 'เลขที่หนังสือขออนุมัติโครงการ (ขั้นตอนที่ 1)', example: 'อบ 74503/089', wch: 22 },
  { header: 'วันที่หนังสือขออนุมัติ', group: '1. ข้อมูลโครงการและงบประมาณ', required: false, format: 'วันที่ (2025-10-10, 10/10/2568, 10 ต.ค. 2568 หรือวันที่ Excel)', example: '2025-10-10', wch: 19 },

  // หมวด 2: ข้อมูล TOR และราคากลาง
  { header: 'เลขที่คำสั่ง TOR', group: '2. TOR และราคากลาง', required: false, format: 'ข้อความเลขที่คำสั่งแต่งตั้งกรรมการ TOR/ราคากลาง', example: '125/2568', wch: 18 },
  { header: 'วันที่คำสั่ง TOR', group: '2. TOR และราคากลาง', required: false, format: 'วันที่ (2025-10-15, 15/10/2568, 15 ต.ค. 2568 หรือวันที่ Excel)', example: '2025-10-15', wch: 17 },
  { header: 'ผู้จัดทำ TOR', group: '2. TOR และราคากลาง', required: false, format: 'ชื่อ-สกุล ผู้จัดทำร่างขอบเขตงาน (TOR)', example: 'นายศรายุทธ สงวนรัษฎ์', wch: 24 },
  { header: 'วันที่อนุมัติ TOR', group: '2. TOR และราคากลาง', required: false, format: 'วันที่ (รองรับทั้ง พ.ศ., ค.ศ. และวันที่ Excel)', example: '2025-10-20', wch: 17 },
  { header: 'ราคากลาง (บาท)', group: '2. TOR และราคากลาง', required: false, format: 'ตัวเลขจำนวนเงิน', example: '1820000', wch: 18 },
  { header: 'วันที่กำหนดราคากลาง', group: '2. TOR และราคากลาง', required: false, format: 'วันที่ (รองรับทั้ง พ.ศ., ค.ศ. และวันที่ Excel)', example: '2025-10-22', wch: 19 },
  { header: 'คณะกรรมการกำหนดราคากลาง/TOR', group: '2. TOR และราคากลาง', required: false, format: 'คั่นแต่ละคนด้วย ; (ใส่ชื่ออย่างเดียว หรือ ชื่อ|ตำแหน่ง|บทบาท)', example: 'นายจิรพงษ์ พัฒนพันธ์|ผู้อำนวยการกองช่าง|ประธานกรรมการ; นายศรายุทธ สงวนรัษฎ์|นายช่างโยธาชำนาญงาน|กรรมการ; นายพิทักษ์ โพธิ์ขาว|นายช่างไฟฟ้าชำนาญงาน|กรรมการและเลขานุการ', wch: 44 },
  { header: 'ผู้รับค่าตอบแทน TOR', group: '2. TOR และราคากลาง', required: false, format: 'ชื่อ-สกุล ผู้รับเงินค่าตอบแทนผู้จัดทำ TOR', example: 'นายศรายุทธ สงวนรัษฎ์', wch: 24 },
  { header: 'ค่าตอบแทน TOR (บาท)', group: '2. TOR และราคากลาง', required: false, format: 'ตัวเลขจำนวนเงิน', example: '1200', wch: 19 },

  // หมวด 3: คำสั่งควบคุมงานและคณะกรรมการตรวจรับ
  { header: 'เลขที่คำสั่งแต่งตั้งกรรมการ', group: '3. ควบคุมงานและตรวจรับ', required: false, format: 'เลขที่คำสั่งแต่งตั้งผู้ควบคุมงานและกรรมการตรวจรับ', example: '148/2568', wch: 24 },
  { header: 'วันที่คำสั่งแต่งตั้งกรรมการ', group: '3. ควบคุมงานและตรวจรับ', required: false, format: 'วันที่ (รองรับทั้ง พ.ศ., ค.ศ. และวันที่ Excel)', example: '2025-10-28', wch: 22 },
  { header: 'ผู้ควบคุมงาน', group: '3. ควบคุมงานและตรวจรับ', required: false, format: 'รองรับหลายคน คั่นด้วย , หรือ ; (ใส่ชื่อ หรือ ชื่อ (ตำแหน่ง))', example: 'นายศรายุทธ สงวนรัษฎ์, นายยิ่งอนันต์ สัทธรรม', wch: 36 },
  { header: 'คณะกรรมการตรวจรับพัสดุ', group: '3. ควบคุมงานและตรวจรับ', required: false, format: 'คั่นแต่ละคนด้วย ; (ใส่ชื่ออย่างเดียว หรือ ชื่อ|ตำแหน่ง|บทบาท)', example: 'นายจิรพงษ์ พัฒนพันธ์|ผู้อำนวยการกองช่าง|ประธานกรรมการ; นายพิทักษ์ โพธิ์ขาว|นายช่างไฟฟ้าชำนาญงาน|กรรมการ; นางสาวนิศาชล คงดี|ผู้ช่วยเจ้าพนักงานธุรการ|กรรมการและเลขานุการ', wch: 44 },

  // หมวด 4: ข้อมูลสัญญาจ้าง
  { header: 'เลขที่สัญญา', group: '4. สัญญาจ้างและผู้รับจ้าง', required: false, format: 'ข้อความเลขที่สัญญาจ้าง / ใบสั่งจ้าง', example: '45/2569', wch: 16 },
  { header: 'วันที่ลงนามสัญญา', group: '4. สัญญาจ้างและผู้รับจ้าง', required: false, format: 'วันที่ (รองรับทั้ง พ.ศ., ค.ศ. และวันที่ Excel)', example: '2025-10-30', wch: 18 },
  { header: 'วงเงินสัญญา (บาท)', group: '4. สัญญาจ้างและผู้รับจ้าง', required: false, format: 'ตัวเลขจำนวนเงินตามสัญญา', example: '1795000', wch: 19 },
  { header: 'วันที่เริ่มสัญญา', group: '4. สัญญาจ้างและผู้รับจ้าง', required: false, format: 'วันที่ (รองรับทั้ง พ.ศ., ค.ศ. และวันที่ Excel)', example: '2025-11-01', wch: 17 },
  { header: 'วันที่สิ้นสุดสัญญา', group: '4. สัญญาจ้างและผู้รับจ้าง', required: false, format: 'วันที่ (รองรับทั้ง พ.ศ., ค.ศ. และวันที่ Excel)', example: '2026-02-28', wch: 18 },
  { header: 'ชื่อผู้รับจ้าง', group: '4. สัญญาจ้างและผู้รับจ้าง', required: false, format: 'ชื่อ หจก. / บริษัท / ร้านผู้รับจ้าง', example: 'ห้างหุ้นส่วนจำกัด บุญเจริญการช่าง', wch: 30 },
  { header: 'เลขผู้เสียภาษี', group: '4. สัญญาจ้างและผู้รับจ้าง', required: false, format: 'เลขประจำตัวผู้เสียภาษี 13 หลัก', example: '0103556012345', wch: 18 },
  { header: 'เบอร์โทร/ติดต่อผู้รับจ้าง', group: '4. สัญญาจ้างและผู้รับจ้าง', required: false, format: 'เบอร์โทรศัพท์ หรือข้อมูลติดต่อผู้รับจ้าง', example: '081-234-5678', wch: 24 },

  // หมวด 5: การแจ้งเข้าทำงาน ส่งมอบงาน และตรวจรับ
  { header: 'เลขที่หนังสือแจ้งเข้าทำงาน', group: '5. แจ้งเข้า / ส่งมอบ / ตรวจรับ', required: false, format: 'เลขที่หนังสือแจ้งให้เริ่มงาน', example: 'อบ.78503/412', wch: 24 },
  { header: 'วันที่หนังสือแจ้งเข้าทำงาน', group: '5. แจ้งเข้า / ส่งมอบ / ตรวจรับ', required: false, format: 'วันที่ออกหนังสือแจ้งเข้าทำงาน', example: '2025-11-01', wch: 22 },
  { header: 'วันที่เข้าทำงานจริง', group: '5. แจ้งเข้า / ส่งมอบ / ตรวจรับ', required: false, format: 'วันที่ผู้รับจ้างเข้าพื้นที่ปฏิบัติงานจริง', example: '2025-11-03', wch: 19 },
  { header: 'เลขที่หนังสือส่งมอบงาน', group: '5. แจ้งเข้า / ส่งมอบ / ตรวจรับ', required: false, format: 'เลขที่หนังสือส่งมอบงานของผู้รับจ้าง', example: 'บจ.018/2569', wch: 22 },
  { header: 'วันที่หนังสือส่งมอบงาน', group: '5. แจ้งเข้า / ส่งมอบ / ตรวจรับ', required: false, format: 'วันที่ตามหนังสือส่งมอบงาน', example: '2026-02-10', wch: 20 },
  { header: 'วันที่ส่งมอบจริง', group: '5. แจ้งเข้า / ส่งมอบ / ตรวจรับ', required: false, format: 'วันที่ส่งมอบงานจริง (เว้นว่างจะอ้างอิงวันที่หนังสือส่งมอบ)', example: '2026-02-10', wch: 18 },
  { header: 'รายละเอียดการส่งมอบ', group: '5. แจ้งเข้า / ส่งมอบ / ตรวจรับ', required: false, format: 'รายละเอียดงวดงาน/การส่งมอบ', example: 'ส่งมอบงานทั้งหมดครบถ้วนตามแบบสัญญา', wch: 32 },
  { header: 'วันที่ตรวจรับงาน', group: '5. แจ้งเข้า / ส่งมอบ / ตรวจรับ', required: false, format: 'วันที่คณะกรรมการลงพื้นที่ตรวจรับ', example: '2026-02-15', wch: 18 },
  { header: 'ผลการตรวจรับ', group: '5. แจ้งเข้า / ส่งมอบ / ตรวจรับ', required: false, format: 'ผ่าน / ไม่ผ่าน / ให้แก้ไข (หรือ pass / fail / need_revision)', example: 'ผ่าน', wch: 15 },
  { header: 'หมายเหตุการตรวจรับ', group: '5. แจ้งเข้า / ส่งมอบ / ตรวจรับ', required: false, format: 'รายละเอียดผลการตรวจรับงาน', example: 'งานถูกต้องครบถ้วนตามแบบรูปรายการ', wch: 30 },

  // หมวด 6: การเบิกจ่ายเงิน และค่าตอบแทนกรรมการ
  { header: 'เลขที่ฎีกาเบิกจ่าย', group: '6. เบิกจ่ายและค่าตอบแทน', required: false, format: 'เลขที่ฎีกาเบิกจ่ายค่างาน', example: 'ฎ.2569-0120', wch: 18 },
  { header: 'วันที่เบิกจ่าย', group: '6. เบิกจ่ายและค่าตอบแทน', required: false, format: 'วันที่จัดทำฎีกาเบิกจ่าย', example: '2026-02-20', wch: 16 },
  { header: 'ยอดเบิกจ่าย (บาท)', group: '6. เบิกจ่ายและค่าตอบแทน', required: false, format: 'ตัวเลขยอดเงินที่เบิกจ่าย', example: '1795000', wch: 18 },
  { header: 'สถานะเบิกจ่าย', group: '6. เบิกจ่ายและค่าตอบแทน', required: false, format: 'จ่ายแล้ว / รอเบิกจ่าย (หรือ paid / pending)', example: 'จ่ายแล้ว', wch: 16 },
  { header: 'เลขที่เช็ค/อ้างอิงโอน', group: '6. เบิกจ่ายและค่าตอบแทน', required: false, format: 'เลขที่เช็คหรือเลขอ้างอิงการโอนเงิน', example: 'CHK-884512', wch: 20 },
  { header: 'วันที่โอนเงิน', group: '6. เบิกจ่ายและค่าตอบแทน', required: false, format: 'วันที่โอนเงินให้ผู้รับจ้าง', example: '2026-02-24', wch: 16 },
  { header: 'ค่าตอบแทนกรรมการ (บาท)', group: '6. เบิกจ่ายและค่าตอบแทน', required: false, format: 'ตัวเลขยอดเบิกค่าตอบแทนกรรมการ/ผู้ควบคุมงาน', example: '4500', wch: 22 },
  { header: 'เลขที่ฎีกาค่าตอบแทน', group: '6. เบิกจ่ายและค่าตอบแทน', required: false, format: 'เลขที่ฎีกาเบิกจ่ายค่าตอบแทน', example: 'ฎ.2569-0128', wch: 20 },
  { header: 'วันที่เบิกค่าตอบแทน', group: '6. เบิกจ่ายและค่าตอบแทน', required: false, format: 'วันที่เบิกค่าตอบแทน', example: '2026-02-26', wch: 18 },
  { header: 'สถานะค่าตอบแทน', group: '6. เบิกจ่ายและค่าตอบแทน', required: false, format: 'จ่ายแล้ว / รอเบิก / ไม่ประสงค์เบิก (หรือ paid / pending / not_eligible)', example: 'จ่ายแล้ว', wch: 18 },

  // หมวด 7: พิกัด GPS ข้อมูลโครงการย้อนหลัง และสถานะโครงการ
  { header: 'พิกัดจุดเริ่มต้น (Lat,Lng)', group: '7. พิกัด GPS และสถานะ', required: false, format: 'ละติจูด, ลองจิจูด คั่นด้วยคอมมา', example: '15.245120, 105.228910', wch: 24 },
  { header: 'พิกัดจุดสิ้นสุด (Lat,Lng)', group: '7. พิกัด GPS และสถานะ', required: false, format: 'ละติจูด, ลองจิจูด คั่นด้วยคอมมา', example: '15.249640, 105.231450', wch: 24 },
  { header: 'พิกัดป้ายโครงการ (Lat,Lng)', group: '7. พิกัด GPS และสถานะ', required: false, format: 'ละติจูด, ลองจิจูด คั่นด้วยคอมมา', example: '15.245180, 105.228950', wch: 24 },
  { header: 'หมายเหตุข้อมูลย้อนหลัง', group: '7. พิกัด GPS และสถานะ', required: false, format: 'หมายเหตุบันทึกพิกัด/ภาพถ่ายโครงการ', example: 'เก็บพิกัดจุดเริ่มต้น-สิ้นสุดครบถ้วน', wch: 28 },
  { header: 'สถานะโครงการ', group: '7. พิกัด GPS และสถานะ', required: false, format: 'ระบุภาษาไทยหรืออังกฤษได้ (หากเว้นว่าง ระบบคำนวณให้อัตโนมัติจากขั้นตอนล่าสุด)', example: 'แล้วเสร็จ/เบิกจ่ายแล้ว', wch: 24 }
];

function serializeCommittees(members?: CommitteeMember[]): string {
  if (!members || members.length === 0) return '';
  return members
    .filter(m => m?.name && m.name.trim())
    .map(m => {
      const parts = [m.name.trim()];
      if (m.position && m.position.trim()) parts.push(m.position.trim());
      if (m.role && m.role.trim()) parts.push(m.role.trim());
      return parts.join('|');
    })
    .join('; ');
}

function serializeSupervisors(project: Project): string {
  if (project.supervisors && project.supervisors.length > 0) {
    const names = project.supervisors
      .filter(s => s?.name && s.name.trim())
      .map(s => (s.position && s.position.trim() ? `${s.name.trim()} (${s.position.trim()})` : s.name.trim()));
    if (names.length > 0) return names.join(', ');
  }
  return project.supervisorName || '';
}

function serializeCoordinate(point?: { lat?: string; lng?: string }): string {
  if (!point?.lat || !point?.lng) return '';
  return `${point.lat.trim()}, ${point.lng.trim()}`;
}

/**
 * Export projects to an Excel file (.xlsx) using canonical headers
 * that are 100% round-trip compatible with ExcelImportModal.
 */
export function exportProjectsToExcel(projects: Project[], filename = 'ทะเบียนโครงการกองช่าง.xlsx') {
  const rows = projects.map((p, idx) => {
    const latestNotice = p.workNotices?.[p.workNotices.length - 1];
    const latestDelivery = p.deliveries?.[p.deliveries.length - 1];
    const latestInspection = p.inspections?.[p.inspections.length - 1];
    const latestDisbursement = p.disbursements?.[p.disbursements.length - 1];
    const totalDisbursed = (p.disbursements || []).reduce((sum, d) => sum + (d.amount || 0), 0);
    const latestRemuneration = p.remunerations?.[p.remunerations.length - 1];
    const totalRemuneration = (p.remunerations || []).reduce((sum, r) => sum + (r.amount || 0), 0);

    return {
      'ลำดับ': idx + 1,
      'รหัสโครงการ': p.projectCode,
      'ปีงบประมาณ': p.fiscalYear,
      'ชื่อโครงการ': p.name,
      'หมวดงบประมาณ': p.budgetCategory,
      'สมัยประชุม/มติ': p.meetingSession || '',
      'ปี พ.ศ. มติอนุมัติ': p.approvalYear || p.fiscalYear,
      'งบประมาณอนุมัติ (บาท)': p.approvedBudget,
      'รายละเอียดโครงการ': p.description || '',
      'สถานที่ดำเนินโครงการ': p.location || '',
      'ผู้รับผิดชอบโครงการ': p.responsiblePerson || '',
      'หมายเหตุ': p.notes || '',
      'เลขที่หนังสือขออนุมัติ': p.approvalRequestNo || '',
      'วันที่หนังสือขออนุมัติ': p.approvalRequestDate ? formatThaiDate(p.approvalRequestDate) : '',
      'เลขที่คำสั่ง TOR': p.torOrderNo || '',
      'วันที่คำสั่ง TOR': p.torOrderDate ? formatThaiDate(p.torOrderDate) : '',
      'ผู้จัดทำ TOR': p.torAuthor || '',
      'วันที่อนุมัติ TOR': p.torDate ? formatThaiDate(p.torDate) : '',
      'ราคากลาง (บาท)': p.refPrice || 0,
      'วันที่กำหนดราคากลาง': p.refPriceDate ? formatThaiDate(p.refPriceDate) : '',
      'คณะกรรมการกำหนดราคากลาง/TOR': serializeCommittees(p.torCommittees),
      'ผู้รับค่าตอบแทน TOR': p.torRemunerationPayee || '',
      'ค่าตอบแทน TOR (บาท)': p.torRemunerationAmount || 0,
      'เลขที่คำสั่งแต่งตั้งกรรมการ': p.inspectOrderNo || '',
      'วันที่คำสั่งแต่งตั้งกรรมการ': p.inspectOrderDate ? formatThaiDate(p.inspectOrderDate) : '',
      'ผู้ควบคุมงาน': serializeSupervisors(p),
      'คณะกรรมการตรวจรับพัสดุ': serializeCommittees(p.inspectCommittees),
      'เลขที่สัญญา': p.contractNo || '',
      'วันที่ลงนามสัญญา': p.contractDate ? formatThaiDate(p.contractDate) : '',
      'วงเงินสัญญา (บาท)': p.contractAmount || 0,
      'วันที่เริ่มสัญญา': p.startDate ? formatThaiDate(p.startDate) : '',
      'วันที่สิ้นสุดสัญญา': p.endDate ? formatThaiDate(p.endDate) : '',
      'ชื่อผู้รับจ้าง': p.contractorName || '',
      'เลขผู้เสียภาษี': p.contractorTaxId || '',
      'เบอร์โทร/ติดต่อผู้รับจ้าง': p.contractorContact || '',
      'เลขที่หนังสือแจ้งเข้าทำงาน': latestNotice?.bookNo || '',
      'วันที่หนังสือแจ้งเข้าทำงาน': latestNotice?.bookDate ? formatThaiDate(latestNotice.bookDate) : '',
      'วันที่เข้าทำงานจริง': latestNotice?.actualWorkDate ? formatThaiDate(latestNotice.actualWorkDate) : '',
      'เลขที่หนังสือส่งมอบงาน': latestDelivery?.bookNo || '',
      'วันที่หนังสือส่งมอบงาน': latestDelivery?.bookDate ? formatThaiDate(latestDelivery.bookDate) : '',
      'วันที่ส่งมอบจริง': latestDelivery?.actualDeliveryDate ? formatThaiDate(latestDelivery.actualDeliveryDate) : '',
      'รายละเอียดการส่งมอบ': latestDelivery?.details || '',
      'วันที่ตรวจรับงาน': latestInspection?.inspectionDate ? formatThaiDate(latestInspection.inspectionDate) : '',
      'ผลการตรวจรับ': latestInspection ? INSPECTION_RESULT_LABELS[latestInspection.result] || latestInspection.result : '',
      'หมายเหตุการตรวจรับ': latestInspection?.details || '',
      'เลขที่ฎีกาเบิกจ่าย': latestDisbursement?.petitionNo || '',
      'วันที่เบิกจ่าย': latestDisbursement?.disbursementDate ? formatThaiDate(latestDisbursement.disbursementDate) : '',
      'ยอดเบิกจ่าย (บาท)': totalDisbursed || 0,
      'สถานะเบิกจ่าย': latestDisbursement ? DISBURSEMENT_STATUS_LABELS[latestDisbursement.status] || latestDisbursement.status : '',
      'เลขที่เช็ค/อ้างอิงโอน': latestDisbursement?.checkNo || '',
      'วันที่โอนเงิน': latestDisbursement?.transferDate ? formatThaiDate(latestDisbursement.transferDate) : '',
      'ค่าตอบแทนกรรมการ (บาท)': totalRemuneration || 0,
      'เลขที่ฎีกาค่าตอบแทน': latestRemuneration?.petitionNo || '',
      'วันที่เบิกค่าตอบแทน': latestRemuneration?.withdrawDate ? formatThaiDate(latestRemuneration.withdrawDate) : '',
      'สถานะค่าตอบแทน': latestRemuneration ? REMUNERATION_STATUS_LABELS[latestRemuneration.status] || latestRemuneration.status : '',
      'พิกัดจุดเริ่มต้น (Lat,Lng)': serializeCoordinate(p.projectRecord?.startPoint),
      'พิกัดจุดสิ้นสุด (Lat,Lng)': serializeCoordinate(p.projectRecord?.endPoint),
      'พิกัดป้ายโครงการ (Lat,Lng)': serializeCoordinate(p.projectRecord?.signboardPoint),
      'หมายเหตุข้อมูลย้อนหลัง': p.projectRecord?.remark || '',
      'สถานะโครงการ': STATUS_LABELS[p.status] || p.status,
      'ความคืบหน้า (%)': p.progressPercent
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 6 }, // ลำดับ
    ...EXCEL_TEMPLATE_COLUMNS.map(c => ({ wch: c.wch })),
    { wch: 15 } // ความคืบหน้า (%)
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ทะเบียนโครงการ');
  XLSX.writeFile(workbook, filename);
}

/**
 * Generate and download comprehensive sample Excel template with 2 sheets:
 * 1) 'แบบฟอร์มนำเข้าโครงการ' — All 56 supported fields with complete & partial examples
 * 2) 'คู่มือการกรอกข้อมูล' — Field-by-field format guide in Thai
 */
export function downloadSampleExcelTemplate() {
  const sampleData: Record<string, string | number>[] = [
    {
      'รหัสโครงการ': 'ถ.69-101',
      'ปีงบประมาณ': 2569,
      'ชื่อโครงการ': 'โครงการก่อสร้างถนน คสล. สายบ้านหนองผักชี หมู่ที่ 3',
      'หมวดงบประมาณ': 'เงินสะสม',
      'สมัยประชุม/มติ': 'สมัยสามัญ สมัยที่ 1 ครั้งที่ 1/2569',
      'ปี พ.ศ. มติอนุมัติ': 2569,
      'งบประมาณอนุมัติ (บาท)': 1850000,
      'รายละเอียดโครงการ': 'ก่อสร้างถนนผิวจราจร คสล. กว้าง 4.00 เมตร หนา 0.15 เมตร ยาว 500 เมตร พร้อมลงหินคลุกไหล่ทางข้างละ 0.50 เมตร ตามแบบ อบต.ไร่ใต้',
      'สถานที่ดำเนินโครงการ': 'หมู่ที่ 3 ตำบลไร่ใต้ อ.พิบูลมังสาหาร',
      'ผู้รับผิดชอบโครงการ': 'นายศรายุทธ สงวนรัษฎ์',
      'หมายเหตุ': 'ตัวอย่างโครงการที่มีข้อมูลครบทุกขั้นตอน ตั้งแต่ขออนุมัติโครงการ TOR จนถึงเบิกจ่ายและพิกัด GPS',
      'เลขที่หนังสือขออนุมัติ': 'อบ 74503/089',
      'วันที่หนังสือขออนุมัติ': '10/10/2568',
      'เลขที่คำสั่ง TOR': '125/2568',
      'วันที่คำสั่ง TOR': '15/10/2568',
      'ผู้จัดทำ TOR': 'นายศรายุทธ สงวนรัษฎ์',
      'วันที่อนุมัติ TOR': '20/10/2568',
      'ราคากลาง (บาท)': 1820000,
      'วันที่กำหนดราคากลาง': '22/10/2568',
      'คณะกรรมการกำหนดราคากลาง/TOR': 'นายจิรพงษ์ พัฒนพันธ์|ผู้อำนวยการกองช่าง|ประธานกรรมการ; นายศรายุทธ สงวนรัษฎ์|นายช่างโยธาชำนาญงาน|กรรมการ; นายพิทักษ์ โพธิ์ขาว|นายช่างไฟฟ้าชำนาญงาน|กรรมการและเลขานุการ',
      'ผู้รับค่าตอบแทน TOR': 'นายศรายุทธ สงวนรัษฎ์',
      'ค่าตอบแทน TOR (บาท)': 1200,
      'เลขที่คำสั่งแต่งตั้งกรรมการ': '148/2568',
      'วันที่คำสั่งแต่งตั้งกรรมการ': '28/10/2568',
      'ผู้ควบคุมงาน': 'นายศรายุทธ สงวนรัษฎ์, นายยิ่งอนันต์ สัทธรรม',
      'คณะกรรมการตรวจรับพัสดุ': 'นายจิรพงษ์ พัฒนพันธ์|ผู้อำนวยการกองช่าง|ประธานกรรมการ; นายพิทักษ์ โพธิ์ขาว|นายช่างไฟฟ้าชำนาญงาน|กรรมการ; นิศาชล คงดี|ผู้ช่วยเจ้าพนักงานธุรการ|กรรมการและเลขานุการ',
      'เลขที่สัญญา': '45/2569',
      'วันที่ลงนามสัญญา': '30/10/2568',
      'วงเงินสัญญา (บาท)': 1795000,
      'วันที่เริ่มสัญญา': '01/11/2568',
      'วันที่สิ้นสุดสัญญา': '28/02/2569',
      'ชื่อผู้รับจ้าง': 'ห้างหุ้นส่วนจำกัด บุญเจริญการช่าง',
      'เลขผู้เสียภาษี': '0103556012345',
      'เบอร์โทร/ติดต่อผู้รับจ้าง': '081-234-5678',
      'เลขที่หนังสือแจ้งเข้าทำงาน': 'อบ.78503/412',
      'วันที่หนังสือแจ้งเข้าทำงาน': '01/11/2568',
      'วันที่เข้าทำงานจริง': '03/11/2568',
      'เลขที่หนังสือส่งมอบงาน': 'บจ.018/2569',
      'วันที่หนังสือส่งมอบงาน': '10/02/2569',
      'วันที่ส่งมอบจริง': '10/02/2569',
      'รายละเอียดการส่งมอบ': 'ส่งมอบงานทั้งหมดครบถ้วนถูกต้องตามแบบรูปรายการและเงื่อนไขสัญญา',
      'วันที่ตรวจรับงาน': '15/02/2569',
      'ผลการตรวจรับ': 'ผ่าน',
      'หมายเหตุการตรวจรับ': 'ตรวจรับงานถูกต้องครบถ้วนตามสัญญา',
      'เลขที่ฎีกาเบิกจ่าย': 'ฎ.2569-0120',
      'วันที่เบิกจ่าย': '20/02/2569',
      'ยอดเบิกจ่าย (บาท)': 1795000,
      'สถานะเบิกจ่าย': 'จ่ายแล้ว',
      'เลขที่เช็ค/อ้างอิงโอน': 'CHK-884512',
      'วันที่โอนเงิน': '24/02/2569',
      'ค่าตอบแทนกรรมการ (บาท)': 4500,
      'เลขที่ฎีกาค่าตอบแทน': 'ฎ.2569-0128',
      'วันที่เบิกค่าตอบแทน': '26/02/2569',
      'สถานะค่าตอบแทน': 'จ่ายแล้ว',
      'พิกัดจุดเริ่มต้น (Lat,Lng)': '15.245120, 105.228910',
      'พิกัดจุดสิ้นสุด (Lat,Lng)': '15.249640, 105.231450',
      'พิกัดป้ายโครงการ (Lat,Lng)': '15.245180, 105.228950',
      'หมายเหตุข้อมูลย้อนหลัง': 'เก็บพิกัดและภาพถ่ายก่อน-หลังดำเนินการครบถ้วน',
      'สถานะโครงการ': 'แล้วเสร็จ/เบิกจ่ายแล้ว'
    },
    {
      'รหัสโครงการ': 'ช.70-202',
      'ปีงบประมาณ': 2570,
      'ชื่อโครงการ': 'โครงการติดตั้งระบบไฟฟ้าส่องสว่างพลังงานแสงอาทิตย์ (โซลาร์เซลล์)',
      'หมวดงบประมาณ': 'งบประมาณรายจ่าย',
      'สมัยประชุม/มติ': '',
      'ปี พ.ศ. มติอนุมัติ': 2570,
      'งบประมาณอนุมัติ (บาท)': 850000,
      'รายละเอียดโครงการ': 'ติดตั้งเสาไฟถนนโคมไฟโซลาร์เซลล์ LED ขนาด 60 วัตต์ เสาเหล็กชุบกัลวาไนซ์สูง 6 เมตร จำนวน 35 ต้น',
      'สถานที่ดำเนินโครงการ': 'ถนนสายเลียบคลองชลประทาน หมู่ที่ 1-5 ต.ไร่ใต้',
      'ผู้รับผิดชอบโครงการ': 'นายพิทักษ์ โพธิ์ขาว',
      'หมายเหตุ': 'ตัวอย่างโครงการที่กรอกเฉพาะข้อมูลที่มีอยู่ (ช่องที่ยังไม่มีสามารถเว้นว่างไว้ได้ ระบบคำนวณสถานะให้อัตโนมัติ)',
      'เลขที่หนังสือขออนุมัติ': 'อบ 74503/102',
      'วันที่หนังสือขออนุมัติ': '08/10/2569',
      'เลขที่คำสั่ง TOR': '138/2569',
      'วันที่คำสั่ง TOR': '12/10/2569',
      'ผู้จัดทำ TOR': 'นายพิทักษ์ โพธิ์ขาว',
      'วันที่อนุมัติ TOR': '18/10/2569',
      'ราคากลาง (บาท)': 840000,
      'วันที่กำหนดราคากลาง': '20/10/2569',
      'คณะกรรมการกำหนดราคากลาง/TOR': 'นายจิรพงษ์ พัฒนพันธ์; นายพิทักษ์ โพธิ์ขาว; นายศรายุทธ สงวนรัษฎ์',
      'ผู้รับค่าตอบแทน TOR': '',
      'ค่าตอบแทน TOR (บาท)': '',
      'เลขที่คำสั่งแต่งตั้งกรรมการ': '152/2569',
      'วันที่คำสั่งแต่งตั้งกรรมการ': '25/11/2569',
      'ผู้ควบคุมงาน': 'นายพิทักษ์ โพธิ์ขาว',
      'คณะกรรมการตรวจรับพัสดุ': 'นายจิรพงษ์ พัฒนพันธ์; นายศรายุทธ สงวนรัษฎ์; นิศาชล คงดี',
      'เลขที่สัญญา': '52/2570',
      'วันที่ลงนามสัญญา': '28/11/2569',
      'วงเงินสัญญา (บาท)': 820000,
      'วันที่เริ่มสัญญา': '01/12/2569',
      'วันที่สิ้นสุดสัญญา': '30/01/2570',
      'ชื่อผู้รับจ้าง': 'บริษัท สยามโซลาร์เอนเนอร์ยี จำกัด',
      'เลขผู้เสียภาษี': '0105558098765',
      'เบอร์โทร/ติดต่อผู้รับจ้าง': '089-876-5432',
      'เลขที่หนังสือแจ้งเข้าทำงาน': '',
      'วันที่หนังสือแจ้งเข้าทำงาน': '',
      'วันที่เข้าทำงานจริง': '',
      'เลขที่หนังสือส่งมอบงาน': '',
      'วันที่หนังสือส่งมอบงาน': '',
      'วันที่ส่งมอบจริง': '',
      'รายละเอียดการส่งมอบ': '',
      'วันที่ตรวจรับงาน': '',
      'ผลการตรวจรับ': '',
      'หมายเหตุการตรวจรับ': '',
      'เลขที่ฎีกาเบิกจ่าย': '',
      'วันที่เบิกจ่าย': '',
      'ยอดเบิกจ่าย (บาท)': '',
      'สถานะเบิกจ่าย': '',
      'เลขที่เช็ค/อ้างอิงโอน': '',
      'วันที่โอนเงิน': '',
      'ค่าตอบแทนกรรมการ (บาท)': '',
      'เลขที่ฎีกาค่าตอบแทน': '',
      'วันที่เบิกค่าตอบแทน': '',
      'สถานะค่าตอบแทน': '',
      'พิกัดจุดเริ่มต้น (Lat,Lng)': '',
      'พิกัดจุดสิ้นสุด (Lat,Lng)': '',
      'พิกัดป้ายโครงการ (Lat,Lng)': '',
      'หมายเหตุข้อมูลย้อนหลัง': '',
      'สถานะโครงการ': ''
    }
  ];

  const headers = EXCEL_TEMPLATE_COLUMNS.map(c => c.header);
  const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });
  ws['!cols'] = EXCEL_TEMPLATE_COLUMNS.map(c => ({ wch: c.wch }));

  // Sheet 2: คู่มือการกรอกข้อมูล (อธิบายทุกคอลัมน์อย่างชัดเจน)
  const guideRows = EXCEL_TEMPLATE_COLUMNS.map((col, idx) => ({
    'ลำดับ': idx + 1,
    'หมวดข้อมูล': col.group,
    'ชื่อหัวคอลัมน์': col.header,
    'เงื่อนไข': col.required ? 'จำเป็นต้องกรอก' : 'ไม่บังคับ (เว้นว่างได้)',
    'รูปแบบข้อมูลที่รองรับ': col.format,
    'ตัวอย่างการกรอก': col.example
  }));

  guideRows.push(
    {
      'ลำดับ': EXCEL_TEMPLATE_COLUMNS.length + 1,
      'หมวดข้อมูล': 'คำแนะนำเพิ่มเติม',
      'ชื่อหัวคอลัมน์': 'รูปแบบวันที่ที่รองรับ',
      'เงื่อนไข': 'อัตโนมัติ',
      'รูปแบบข้อมูลที่รองรับ': 'รองรับวันที่ Excel โดยตรง, วัน/เดือน/พ.ศ. (15/10/2568), วัน เดือน พ.ศ. (15 ต.ค. 2568), หรือ ค.ศ. (2025-10-15)',
      'ตัวอย่างการกรอก': '28/03/2569 หรือ 28 มี.ค. 2569 หรือ 2026-03-28'
    },
    {
      'ลำดับ': EXCEL_TEMPLATE_COLUMNS.length + 2,
      'หมวดข้อมูล': 'คำแนะนำเพิ่มเติม',
      'ชื่อหัวคอลัมน์': 'การอัปเดตข้อมูลเดิม (Upsert)',
      'เงื่อนไข': 'อัตโนมัติ',
      'รูปแบบข้อมูลที่รองรับ': 'หากรหัสโครงการ / เลขที่สัญญา / ชื่อโครงการ ตรงกับในระบบ ระบบจะอัปเดตเฉพาะช่องที่กรอก และคงค่าเดิมไว้สำหรับช่องที่เว้นว่าง',
      'ตัวอย่างการกรอก': 'สามารถนำไฟล์ที่ส่งออกจากระบบมาแก้ไขแล้วนำเข้ากลับได้ทันที'
    }
  );

  const guideWs = XLSX.utils.json_to_sheet(guideRows);
  guideWs['!cols'] = [
    { wch: 8 },
    { wch: 28 },
    { wch: 30 },
    { wch: 22 },
    { wch: 56 },
    { wch: 42 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'แบบฟอร์มนำเข้าโครงการ');
  XLSX.utils.book_append_sheet(wb, guideWs, 'คู่มือการกรอกข้อมูล');
  XLSX.writeFile(wb, 'แบบฟอร์มนำเข้าโครงการกองช่าง.xlsx');
}
