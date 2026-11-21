import * as XLSX from 'xlsx';
import {
  BudgetCategory,
  CommitteeMember,
  CommitteeRemuneration,
  DeliveryRecord,
  DisbursementRecord,
  InspectionRecord,
  Project,
  ProjectArchiveRecord,
  ProjectCoordinatePoint,
  ProjectStatus,
  RAI_TAI_PERSONNEL,
  WorkNotice
} from '../types/project';
import {
  calculateProjectProgress,
  DEFAULT_DELIVERY_DETAILS,
  deriveProjectStatusFromData,
  getCurrentThaiFiscalYear
} from './thaiDate';

export interface ParsedExcelRow {
  rowIdx: number;
  data: Project;
  raw: Record<string, unknown>;
  isValid: boolean;
  isDuplicate: boolean;
  isUpdate: boolean;
  errors: string[];
  warnings: string[];
  importedSections: string[];
}

export interface SheetParseResult {
  sheetName: string;
  headerRowIndex: number;
  rawHeaders: string[];
  matchedFieldKeys: string[];
  unmatchedHeaders: string[];
  rows: ParsedExcelRow[];
}

// =========================================================================
// Low-level Normalization & Value Parsers
// =========================================================================

const THAI_DIGITS_MAP: Record<string, string> = {
  '๐': '0',
  '๑': '1',
  '๒': '2',
  '๓': '3',
  '๔': '4',
  '๕': '5',
  '๖': '6',
  '๗': '7',
  '๘': '8',
  '๙': '9'
};

export function normalizeThaiDigits(value: string): string {
  return value.replace(/[๐-๙]/g, ch => THAI_DIGITS_MAP[ch] ?? ch);
}

export function normalizeHeaderName(raw: string): string {
  return normalizeThaiDigits(String(raw || ''))
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, '')
    .replace(/[():：]/g, '')
    .replace(/บาท/g, '')
    .toLowerCase()
    .trim();
}

const EMPTY_PLACEHOLDERS = new Set(['', '-', '–', '—', 'ไม่มี', 'ไม่ระบุ', 'n/a', 'na', 'null', 'undefined']);

function isBlankValue(raw: unknown): boolean {
  if (raw === null || raw === undefined) return true;
  if (typeof raw === 'number') return isNaN(raw);
  if (raw instanceof Date) return isNaN(raw.getTime());
  const str = String(raw).trim().toLowerCase();
  return EMPTY_PLACEHOLDERS.has(str);
}

function cleanString(raw: unknown): string {
  if (isBlankValue(raw)) return '';
  return String(raw).trim();
}

export function parseNumberValue(raw: unknown): number | undefined {
  if (isBlankValue(raw)) return undefined;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  const cleaned = normalizeThaiDigits(String(raw))
    .replace(/,/g, '')
    .replace(/[฿\s]/g, '')
    .replace(/(บาท|บ\.)/gi, '')
    .trim();
  if (!cleaned || EMPTY_PLACEHOLDERS.has(cleaned.toLowerCase())) return undefined;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : undefined;
}

export function parseFiscalYearValue(raw: unknown): number | undefined {
  if (isBlankValue(raw)) return undefined;
  const str = normalizeThaiDigits(String(raw)).replace(/[^\d]/g, '');
  if (!str) return undefined;
  const num = parseInt(str, 10);
  if (!Number.isFinite(num) || num <= 0) return undefined;
  if (num < 100) return 2500 + num; // เช่น 69 -> 2569
  if (num >= 1900 && num <= 2200) return num + 543; // ค.ศ. -> พ.ศ.
  if (num >= 2400 && num <= 2700) return num;
  return undefined;
}

const THAI_MONTH_LOOKUP: Record<string, number> = {
  'ม.ค.': 1, 'มค': 1, 'มกราคม': 1, 'มกรา': 1,
  'ก.พ.': 2, 'กพ': 2, 'กุมภาพันธ์': 2, 'กุมภา': 2,
  'มี.ค.': 3, 'มีค': 3, 'มีนาคม': 3, 'มีนา': 3,
  'เม.ย.': 4, 'เมย': 4, 'เมษายน': 4, 'เมษา': 4,
  'พ.ค.': 5, 'พค': 5, 'พฤษภาคม': 5, 'พฤษภา': 5,
  'มิ.ย.': 6, 'มิย': 6, 'มิถุนายน': 6, 'มิถุนา': 6,
  'ก.ค.': 7, 'กค': 7, 'กรกฎาคม': 7, 'กรกฎา': 7,
  'ส.ค.': 8, 'สค': 8, 'สิงหาคม': 8, 'สิงหา': 8,
  'ก.ย.': 9, 'กย': 9, 'กันยายน': 9, 'กันยา': 9,
  'ต.ค.': 10, 'ตค': 10, 'ตุลาคม': 10, 'ตุลา': 10,
  'พ.ย.': 11, 'พย': 11, 'พฤศจิกายน': 11, 'พฤศจิกา': 11,
  'ธ.ค.': 12, 'ธค': 12, 'ธันวาคม': 12, 'ธันวา': 12,
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12
};

function toIsoDate(year: number, month: number, day: number): string | undefined {
  let gregYear = year;
  if (gregYear < 100) {
    // 2-digit year: assume Buddhist era (e.g., 68 -> 2568 -> 2025) if >= 40, else 2000+
    gregYear = gregYear >= 40 ? 2500 + gregYear - 543 : 2000 + gregYear;
  } else if (gregYear > 2400) {
    gregYear = gregYear - 543;
  }
  if (gregYear < 1950 || gregYear > 2200 || month < 1 || month > 12 || day < 1 || day > 31) {
    return undefined;
  }
  const probe = new Date(gregYear, month - 1, day);
  if (
    isNaN(probe.getTime()) ||
    probe.getFullYear() !== gregYear ||
    probe.getMonth() !== month - 1 ||
    probe.getDate() !== day
  ) {
    return undefined;
  }
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${gregYear}-${mm}-${dd}`;
}

/**
 * Parses Excel serial dates, Date objects, ISO YYYY-MM-DD (BE or CE),
 * DD/MM/YYYY (BE or CE), and Thai text dates (e.g. "28 มี.ค. 2569") into YYYY-MM-DD.
 */
export function parseExcelDate(raw: unknown): string | undefined {
  if (isBlankValue(raw)) return undefined;

  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return toIsoDate(raw.getFullYear(), raw.getMonth() + 1, raw.getDate());
  }

  // Excel serial date number (e.g., 45962)
  if (typeof raw === 'number' && raw > 20000 && raw < 90000) {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return toIsoDate(parsed.y, parsed.m, parsed.d);
    }
  }

  const str = normalizeThaiDigits(String(raw)).trim();
  if (!str || EMPTY_PLACEHOLDERS.has(str.toLowerCase())) return undefined;

  // Numeric string that represents an Excel serial date
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const serial = Number(str);
    if (serial > 20000 && serial < 90000) {
      const parsed = XLSX.SSF.parse_date_code(serial);
      if (parsed && parsed.y && parsed.m && parsed.d) {
        return toIsoDate(parsed.y, parsed.m, parsed.d);
      }
    }
  }

  // ISO YYYY-MM-DD or YYYY/MM/DD (also handles Buddhist YYYY like 2569-03-28)
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return toIsoDate(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10), parseInt(isoMatch[3], 10));
  }

  // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (Thai standard day-first)
  const dmyMatch = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (dmyMatch) {
    return toIsoDate(parseInt(dmyMatch[3], 10), parseInt(dmyMatch[2], 10), parseInt(dmyMatch[1], 10));
  }

  // Thai text date: e.g. "28 มี.ค. 2569", "วันที่ 15 ตุลาคม พ.ศ. 2568", "1 พ.ย. 68"
  const cleanedThai = str
    .replace(/วันที่/g, '')
    .replace(/เดือน/g, '')
    .replace(/พ\.?ศ\.?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const thaiTextMatch = cleanedThai.match(/^(\d{1,2})\s+([ก-๙a-zA-Z.]+)\s+(\d{2,4})/);
  if (thaiTextMatch) {
    const day = parseInt(thaiTextMatch[1], 10);
    const monthToken = thaiTextMatch[2].toLowerCase().trim();
    const year = parseInt(thaiTextMatch[3], 10);
    const month = THAI_MONTH_LOOKUP[monthToken] || THAI_MONTH_LOOKUP[monthToken.replace(/\./g, '')];
    if (month) {
      return toIsoDate(year, month, day);
    }
  }

  return undefined;
}

export function parseProjectStatus(raw: unknown): ProjectStatus | undefined {
  const str = cleanString(raw).toLowerCase();
  if (!str) return undefined;

  const validCodes: ProjectStatus[] = [
    'not_started',
    'procurement_tor',
    'contracted',
    'in_progress',
    'delivered',
    'inspected',
    'completed',
    'overdue'
  ];
  if (validCodes.includes(str as ProjectStatus)) {
    return str as ProjectStatus;
  }

  if (str.includes('เกินกำหนด') || str.includes('ล่าช้า') || str.includes('พ้นกำหนด')) return 'overdue';
  if (str.includes('แล้วเสร็จ') || str.includes('เสร็จสิ้น') || str.includes('เบิกจ่ายแล้ว') || str.includes('จ่ายแล้ว')) {
    return 'completed';
  }
  if (str.includes('ตรวจรับแล้ว') || str.includes('รอเบิก')) return 'inspected';
  if (str.includes('ส่งมอบ')) return 'delivered';
  if (str.includes('อยู่ระหว่างดำเนิน') || str.includes('กำลังดำเนิน') || str.includes('กำลังก่อสร้าง')) {
    return 'in_progress';
  }
  if (str.includes('ลงนาม') || str.includes('สัญญาแล้ว') || str.includes('รอเข้าทำงาน')) return 'contracted';
  if (str.includes('tor') || str.includes('ราคากลาง') || str.includes('จัดซื้อ') || str.includes('จัดจ้าง')) {
    return 'procurement_tor';
  }
  if (str.includes('ยังไม่เริ่ม') || str.includes('รอดำเนิน')) return 'not_started';

  return undefined;
}

export function parseInspectionResult(raw: unknown): 'pass' | 'fail' | 'need_revision' | undefined {
  const str = cleanString(raw).toLowerCase();
  if (!str) return undefined;
  if (str === 'fail' || str.includes('ไม่ผ่าน')) return 'fail';
  if (str === 'need_revision' || str.includes('แก้ไข') || str.includes('ปรับปรุง')) return 'need_revision';
  if (str === 'pass' || str.includes('ผ่าน') || str.includes('ถูกต้อง') || str.includes('ครบถ้วน')) return 'pass';
  return undefined;
}

export function parseDisbursementStatus(raw: unknown): 'pending' | 'paid' | undefined {
  const str = cleanString(raw).toLowerCase();
  if (!str) return undefined;
  if (str === 'paid' || str.includes('จ่ายแล้ว') || str.includes('โอนแล้ว') || str.includes('เรียบร้อย') || str.includes('เบิกแล้ว')) {
    return 'paid';
  }
  if (str === 'pending' || str.includes('รอ')) return 'pending';
  return undefined;
}

export function parseRemunerationStatus(raw: unknown): 'pending' | 'paid' | 'not_eligible' | undefined {
  const str = cleanString(raw).toLowerCase();
  if (!str) return undefined;
  if (str === 'not_eligible' || str.includes('ไม่ประสงค์') || str.includes('ไม่มีสิทธิ์') || str.includes('ไม่เบิก')) {
    return 'not_eligible';
  }
  if (str === 'paid' || str.includes('จ่ายแล้ว') || str.includes('โอนแล้ว') || str.includes('เบิกแล้ว')) {
    return 'paid';
  }
  if (str === 'pending' || str.includes('รอ')) return 'pending';
  return undefined;
}

function lookupPersonnelPosition(name: string): string {
  const normalized = name.replace(/\s+/g, ' ').trim();
  const matched = RAI_TAI_PERSONNEL.find(p => {
    const pn = p.name.replace(/\s+/g, ' ').trim();
    return pn === normalized || normalized.includes(pn) || pn.includes(normalized);
  });
  return matched?.position || '';
}

function normalizeCommitteeRole(
  rawRole: string | undefined,
  mode: 'committee' | 'supervisor',
  idx: number,
  total: number
): CommitteeMember['role'] {
  if (mode === 'supervisor') return 'ผู้ควบคุมงาน';
  const r = (rawRole || '').trim();
  if (r.includes('ประธาน')) return 'ประธานกรรมการ';
  if (r.includes('เลขา')) return 'กรรมการและเลขานุการ';
  if (r.includes('ควบคุมงาน')) return 'ผู้ควบคุมงาน';
  if (r.includes('กรรมการ')) return 'กรรมการ';

  if (idx === 0) return 'ประธานกรรมการ';
  if (total >= 3 && idx === total - 1) return 'กรรมการและเลขานุการ';
  return 'กรรมการ';
}

/**
 * Smart multi-person parser for TOR committees, inspection committees, and multiple supervisors.
 * Accepts:
 * - "นาย ก|ตำแหน่ง|ประธานกรรมการ; นาย ข|ตำแหน่ง|กรรมการ"
 * - "นาย ก (นายช่างโยธา), นาย ข (ผู้ช่วยนายช่าง)"
 * - "นาย ก, นาย ข, นาย ค"
 * - Newline-separated lists
 */
export function parseCommitteeMembers(
  raw: unknown,
  mode: 'committee' | 'supervisor',
  idPrefix: string
): CommitteeMember[] {
  const str = cleanString(raw);
  if (!str) return [];

  // Prefer ; or newline when present; otherwise fall back to comma
  const splitRegex = /[;\r\n]/.test(str) ? /[;\r\n]+/ : /[,]+/;
  const rawTokens = str
    .split(splitRegex)
    .map(t => t.replace(/^\d+[.)]\s*/, '').trim())
    .filter(t => t && !EMPTY_PLACEHOLDERS.has(t.toLowerCase()));

  return rawTokens.map((token, idx) => {
    let name = token;
    let position = '';
    let explicitRole: string | undefined;

    if (token.includes('|')) {
      const parts = token.split('|').map(p => p.trim());
      name = parts[0] || '';
      position = parts[1] || '';
      explicitRole = parts[2] || '';
    } else {
      // Check optional prefix like "ประธาน: นาย..." or "กรรมการและเลขานุการ: ..."
      const rolePrefixMatch = token.match(/^(ประธานกรรมการ|ประธาน|กรรมการและเลขานุการ|กรรมการ|ผู้ควบคุมงาน)\s*[:：-]\s*(.+)$/);
      if (rolePrefixMatch) {
        explicitRole = rolePrefixMatch[1];
        name = rolePrefixMatch[2].trim();
      }
      // Check optional trailing "(ตำแหน่ง)"
      const parenMatch = name.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (parenMatch) {
        name = parenMatch[1].trim();
        position = parenMatch[2].trim();
      }
    }

    if (!position && name) {
      position = lookupPersonnelPosition(name);
    }

    return {
      id: `${idPrefix}-${idx + 1}`,
      name,
      position,
      role: normalizeCommitteeRole(explicitRole, mode, idx, rawTokens.length)
    };
  }).filter(m => Boolean(m.name));
}

export function parseCoordinatePoint(raw: unknown): ProjectCoordinatePoint | undefined {
  const str = normalizeThaiDigits(cleanString(raw));
  if (!str) return undefined;

  // Match two signed decimal numbers (lat, lng)
  const matches = str.match(/-?\d+(?:\.\d+)?/g);
  if (!matches || matches.length < 2) return undefined;
  const latNum = Number(matches[0]);
  const lngNum = Number(matches[1]);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return undefined;
  if (Math.abs(latNum) > 90 || Math.abs(lngNum) > 180) return undefined;

  return {
    lat: matches[0],
    lng: matches[1]
  };
}

// =========================================================================
// Column Alias Dictionary (Canonical + Export + Common Variations)
// =========================================================================

const FIELD_ALIASES: Record<string, string[]> = {
  // หมวด 1: ข้อมูลโครงการและงบประมาณ
  projectCode: ['รหัสโครงการ', 'รหัส', 'รหัสงาน', 'projectcode', 'code'],
  fiscalYear: ['ปีงบประมาณ', 'ปีงบ', 'ปีพศ', 'ปี', 'fiscalyear'],
  name: ['ชื่อโครงการ', 'โครงการ', 'รายการโครงการ', 'ชื่อรายการ', 'name', 'projectname'],
  budgetCategory: ['หมวดงบประมาณ', 'หมวดงบ', 'แหล่งงบประมาณ', 'ประเภทงบ', 'ประเภทงบประมาณ', 'budgetcategory', 'category'],
  meetingSession: ['สมัยประชุม/มติ', 'สมัยประชุม', 'มติสภา', 'สมัยประชุมครั้งที่', 'ครั้งที่ประชุม', 'meetingsession'],
  approvalYear: ['ปี พ.ศ. มติอนุมัติ', 'ปีพศมติอนุมัติ', 'ปีมติอนุมัติ', 'ปีอนุมัติ', 'ปีที่อนุมัติ', 'approvalyear'],
  approvedBudget: ['งบประมาณอนุมัติ (บาท)', 'งบประมาณอนุมัติ', 'งบอนุมัติ', 'งบประมาณที่ได้รับอนุมัติ', 'งบประมาณ', 'วงเงินงบประมาณ', 'approvedbudget'],
  description: ['รายละเอียดโครงการ', 'รายละเอียด', 'ปริมาณงาน', 'ลักษณะงาน', 'description'],
  location: ['สถานที่ดำเนินโครงการ', 'สถานที่ดำเนินการ', 'สถานที่ก่อสร้าง', 'สถานที่', 'พื้นที่ดำเนินการ', 'หมู่บ้าน', 'location'],
  responsiblePerson: ['ผู้รับผิดชอบโครงการ', 'ผู้รับผิดชอบ', 'เจ้าของเรื่อง', 'responsibleperson'],
  notes: ['หมายเหตุ', 'หมายเหตุโครงการ', 'บันทึกเพิ่มเติม', 'notes'],

  // หมวด 2: ข้อมูล TOR และราคากลาง
  torOrderNo: ['เลขที่คำสั่ง TOR', 'เลขที่คำสั่งTOR', 'คำสั่งTOR', 'คำสั่งแต่งตั้งTOR', 'tororderno'],
  torOrderDate: ['วันที่คำสั่ง TOR', 'วันที่คำสั่งTOR', 'tororderdate'],
  torAuthor: ['ผู้จัดทำ TOR', 'ผู้จัดทำTOR', 'ชื่อผู้จัดทำTOR', 'torauthor'],
  torDate: ['วันที่อนุมัติ TOR', 'วันที่จัดทำ TOR', 'วันที่TOR', 'วันที่อนุมัติTOR', 'tordate'],
  refPrice: ['ราคากลาง (บาท)', 'ราคากลาง', 'วงเงินราคากลาง', 'refprice'],
  refPriceDate: ['วันที่กำหนดราคากลาง', 'วันที่ราคากลาง', 'วันที่อนุมัติราคากลาง', 'refpricedate'],
  torCommittees: ['คณะกรรมการกำหนดราคากลาง/TOR', 'คณะกรรมการTOR', 'กรรมการTOR', 'กรรมการกำหนดราคากลาง', 'คณะกรรมการกำหนดราคากลาง', 'torcommittees'],
  torRemunerationPayee: ['ผู้รับค่าตอบแทน TOR', 'ผู้รับเงินค่าตอบแทนTOR', 'ผู้รับค่าตอบแทนTOR', 'torremunerationpayee'],
  torRemunerationAmount: ['ค่าตอบแทน TOR (บาท)', 'ค่าตอบแทนTOR', 'ยอดค่าตอบแทนTOR', 'torremunerationamount'],

  // หมวด 3: คำสั่งควบคุมงานและคณะกรรมการตรวจรับ
  inspectOrderNo: ['เลขที่คำสั่งแต่งตั้งกรรมการ', 'เลขที่คำสั่งควบคุมงาน', 'เลขที่คำสั่งตรวจรับ', 'คำสั่งตรวจรับ', 'คำสั่งควบคุมงาน', 'inspectorderno'],
  inspectOrderDate: ['วันที่คำสั่งแต่งตั้งกรรมการ', 'วันที่คำสั่งควบคุมงาน', 'วันที่คำสั่งตรวจรับ', 'inspectorderdate'],
  supervisors: ['ผู้ควบคุมงาน', 'ชื่อผู้ควบคุมงาน', 'คณะผู้ควบคุมงาน', 'supervisorname', 'supervisors'],
  inspectCommittees: ['คณะกรรมการตรวจรับพัสดุ', 'คณะกรรมการตรวจรับ', 'กรรมการตรวจรับ', 'กรรมการตรวจรับพัสดุ', 'inspectcommittees'],

  // หมวด 4: ข้อมูลสัญญาจ้าง
  contractNo: ['เลขที่สัญญา', 'เลขสัญญา', 'เลขที่ใบสั่งจ้าง', 'สัญญาเลขที่', 'contractno'],
  contractDate: ['วันที่ลงนามสัญญา', 'วันที่ทำสัญญา', 'วันที่สัญญา', 'ลงวันที่สัญญา', 'contractdate'],
  contractAmount: ['วงเงินสัญญา (บาท)', 'วงเงินสัญญา', 'วงเงินตามสัญญา', 'ค่างานตามสัญญา', 'ราคาจ้าง', 'contractamount'],
  startDate: ['วันที่เริ่มสัญญา', 'เริ่มสัญญา', 'วันเริ่มสัญญา', 'วันเริ่มต้นสัญญา', 'startdate'],
  endDate: ['วันที่สิ้นสุดสัญญา', 'สิ้นสุดสัญญา', 'วันสิ้นสุดสัญญา', 'ครบกำหนดสัญญา', 'วันครบกำหนดสัญญา', 'enddate'],
  contractorName: ['ชื่อผู้รับจ้าง', 'ผู้รับจ้าง', 'คู่สัญญา', 'บริษัทผู้รับจ้าง', 'หจก', 'contractorname'],
  contractorTaxId: ['เลขผู้เสียภาษี', 'เลขประจำตัวผู้เสียภาษี', 'เลขผู้เสียภาษีผู้รับจ้าง', 'taxid', 'contractortaxid'],
  contractorContact: ['เบอร์โทร/ติดต่อผู้รับจ้าง', 'ติดต่อผู้รับจ้าง', 'เบอร์โทรผู้รับจ้าง', 'เบอร์ติดต่อผู้รับจ้าง', 'โทรศัพท์ผู้รับจ้าง', 'contractorcontact'],

  // หมวด 5: แจ้งเข้าทำงาน ส่งมอบงาน และตรวจรับ
  workNoticeBookNo: ['เลขที่หนังสือแจ้งเข้าทำงาน', 'หนังสือแจ้งเข้าทำงาน', 'เลขที่แจ้งเข้าทำงาน', 'worknoticebookno'],
  workNoticeBookDate: ['วันที่หนังสือแจ้งเข้าทำงาน', 'วันที่แจ้งเข้าทำงาน', 'วันแจ้งเข้าทำงาน', 'worknoticebookdate'],
  actualWorkDate: ['วันที่เข้าทำงานจริง', 'วันเข้าทำงานจริง', 'วันเริ่มเข้าทำงาน', 'actualworkdate'],
  deliveryBookNo: ['เลขที่หนังสือส่งมอบงาน', 'หนังสือส่งมอบงาน', 'เลขที่ส่งมอบงาน', 'deliverybookno'],
  deliveryBookDate: ['วันที่หนังสือส่งมอบงาน', 'วันที่ส่งมอบงาน', 'วันส่งมอบงาน', 'deliverybookdate'],
  actualDeliveryDate: ['วันที่ส่งมอบจริง', 'วันส่งมอบจริง', 'วันส่งมอบงานจริง', 'actualdeliverydate'],
  deliveryDetails: ['รายละเอียดการส่งมอบ', 'หมายเหตุส่งมอบ', 'รายละเอียดส่งมอบงาน', 'deliverydetails'],
  inspectionDate: ['วันที่ตรวจรับงาน', 'วันที่ตรวจรับ', 'วันตรวจรับงาน', 'inspectiondate'],
  inspectionResult: ['ผลการตรวจรับ', 'ผลตรวจรับ', 'ผลการตรวจรับงาน', 'inspectionresult'],
  inspectionDetails: ['หมายเหตุการตรวจรับ', 'รายละเอียดตรวจรับ', 'รายละเอียดการตรวจรับ', 'inspectiondetails'],

  // หมวด 6: เบิกจ่ายและค่าตอบแทน
  disbursementPetitionNo: ['เลขที่ฎีกาเบิกจ่าย', 'เลขที่ฎีกา', 'ฎีกาเบิกจ่าย', 'petitionno'],
  disbursementDate: ['วันที่เบิกจ่าย', 'วันที่จัดทำฎีกา', 'วันที่ฎีกา', 'disbursementdate'],
  disbursementAmount: ['ยอดเบิกจ่าย (บาท)', 'ยอดเบิกจ่าย', 'เบิกจ่ายแล้ว (บาท)', 'เบิกจ่ายแล้ว', 'จำนวนเงินเบิกจ่าย', 'disbursementamount'],
  disbursementStatus: ['สถานะเบิกจ่าย', 'สถานะการเบิกจ่าย', 'disbursementstatus'],
  disbursementCheckNo: ['เลขที่เช็ค/อ้างอิงโอน', 'เลขที่เช็ค', 'เลขอ้างอิงโอน', 'checkno'],
  disbursementTransferDate: ['วันที่โอนเงิน', 'วันโอนเงิน', 'วันที่จ่ายเงิน', 'transferdate'],
  remunerationAmount: ['ค่าตอบแทนกรรมการ (บาท)', 'ค่าตอบแทนกรรมการ', 'เบิกค่าตอบแทนกรรมการ', 'ยอดค่าตอบแทนกรรมการ', 'remunerationamount'],
  remunerationPetitionNo: ['เลขที่ฎีกาค่าตอบแทน', 'ฎีกาค่าตอบแทน', 'remunerationpetitionno'],
  remunerationDate: ['วันที่เบิกค่าตอบแทน', 'วันเบิกค่าตอบแทน', 'remunerationdate'],
  remunerationStatus: ['สถานะค่าตอบแทน', 'สถานะการเบิกค่าตอบแทน', 'remunerationstatus'],

  // หมวด 7: พิกัด GPS และสถานะ
  startCoord: ['พิกัดจุดเริ่มต้น (Lat,Lng)', 'พิกัดจุดเริ่มต้น', 'พิกัดเริ่มต้น', 'จุดเริ่มต้น', 'startcoord'],
  endCoord: ['พิกัดจุดสิ้นสุด (Lat,Lng)', 'พิกัดจุดสิ้นสุด', 'พิกัดสิ้นสุด', 'จุดสิ้นสุด', 'endcoord'],
  signboardCoord: ['พิกัดป้ายโครงการ (Lat,Lng)', 'พิกัดป้ายโครงการ', 'พิกัดป้าย', 'ป้ายโครงการ', 'signboardcoord'],
  archiveRemark: ['หมายเหตุข้อมูลย้อนหลัง', 'บันทึกข้อมูลย้อนหลัง', 'บันทึกย้อนหลัง', 'archiveremark'],
  status: ['สถานะโครงการ', 'สถานะ', 'สถานะการดำเนินงาน', 'status']
};

// Build reverse lookup map: normalizedAlias -> fieldKey
const NORMALIZED_ALIAS_MAP = new Map<string, string>();
Object.entries(FIELD_ALIASES).forEach(([fieldKey, aliases]) => {
  aliases.forEach(alias => {
    NORMALIZED_ALIAS_MAP.set(normalizeHeaderName(alias), fieldKey);
  });
});

function buildNextProjectCode(
  fiscalYear: number,
  usedCodes: Set<string>,
  prefix = 'ช'
): string {
  const yy = String(fiscalYear).slice(-2);
  let seq = 1;
  while (seq < 9999) {
    const candidate = `${prefix}.${yy}-${String(seq).padStart(3, '0')}`;
    if (!usedCodes.has(candidate.toLowerCase())) {
      usedCodes.add(candidate.toLowerCase());
      return candidate;
    }
    seq += 1;
  }
  const fallback = `${prefix}.${yy}-${Date.now().toString().slice(-3)}`;
  usedCodes.add(fallback.toLowerCase());
  return fallback;
}

/**
 * Picks the best data sheet from a workbook (automatically skipping instruction sheets)
 */
export function pickDefaultDataSheet(sheetNames: string[]): string {
  if (sheetNames.length === 0) return '';
  const nonGuide = sheetNames.find(
    name => !name.includes('คู่มือ') && !name.toLowerCase().includes('guide') && !name.toLowerCase().includes('instruction')
  );
  return nonGuide || sheetNames[0];
}

/**
 * Parse a specific sheet of an XLSX workbook into validated, merged Project records
 */
export function parseWorkbookSheet(
  wb: XLSX.WorkBook,
  sheetName: string,
  existingProjects: Project[]
): SheetParseResult {
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    return {
      sheetName,
      headerRowIndex: 0,
      rawHeaders: [],
      matchedFieldKeys: [],
      unmatchedHeaders: [],
      rows: []
    };
  }

  // Read as 2D array first so we can auto-detect the header row even if row 1 is a title banner
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: true });
  if (matrix.length === 0) {
    return {
      sheetName,
      headerRowIndex: 0,
      rawHeaders: [],
      matchedFieldKeys: [],
      unmatchedHeaders: [],
      rows: []
    };
  }

  // Scan first 6 rows to locate the row with the highest number of recognized column headers
  let headerRowIndex = 0;
  let bestScore = -1;
  const maxScan = Math.min(6, matrix.length);
  for (let r = 0; r < maxScan; r += 1) {
    const rowCells = matrix[r] || [];
    let score = 0;
    for (const cell of rowCells) {
      const norm = normalizeHeaderName(String(cell ?? ''));
      if (norm && NORMALIZED_ALIAS_MAP.has(norm)) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      headerRowIndex = r;
    }
  }

  const headerRow = (matrix[headerRowIndex] || []).map(cell => String(cell ?? '').trim());
  const colIndexToField = new Map<number, string>();
  const matchedFieldSet = new Set<string>();
  const unmatchedHeaders: string[] = [];

  headerRow.forEach((h, colIdx) => {
    if (!h) return;
    const norm = normalizeHeaderName(h);
    const fieldKey = NORMALIZED_ALIAS_MAP.get(norm);
    if (fieldKey) {
      if (!colIndexToField.has(colIdx)) {
        colIndexToField.set(colIdx, fieldKey);
        matchedFieldSet.add(fieldKey);
      }
    } else if (norm !== 'ลำดับ' && norm !== 'no' && norm !== 'ความคืบหน้า%' && norm !== 'ความคืบหน้า') {
      unmatchedHeaders.push(h);
    }
  });

  // Track all used project codes (existing + newly generated in this batch) to avoid collisions
  const usedCodes = new Set<string>(
    existingProjects.map(p => (p.projectCode || '').trim().toLowerCase()).filter(Boolean)
  );
  // Detect preferred prefix from existing projects (e.g. ถ. or ช.)
  const existingPrefixMatch = existingProjects
    .map(p => (p.projectCode || '').trim().match(/^([ก-ฮa-zA-Z]+)\./)?.[1])
    .find(Boolean);
  const defaultCodePrefix = existingPrefixMatch || 'ช';
  const defaultFiscalYear = getCurrentThaiFiscalYear();

  const parsedRows: ParsedExcelRow[] = [];

  for (let r = headerRowIndex + 1; r < matrix.length; r += 1) {
    const rowArr = matrix[r] || [];
    // Skip completely empty rows
    const hasAnyValue = rowArr.some(cell => !isBlankValue(cell));
    if (!hasAnyValue) continue;

    // Build normalized field map & raw record for this row
    const fields: Record<string, unknown> = {};
    const rawObj: Record<string, unknown> = {};
    headerRow.forEach((h, colIdx) => {
      if (h) rawObj[h] = rowArr[colIdx];
      const fk = colIndexToField.get(colIdx);
      if (fk && (fields[fk] === undefined || isBlankValue(fields[fk]))) {
        fields[fk] = rowArr[colIdx];
      }
    });

    const errors: string[] = [];
    const warnings: string[] = [];
    const importedSections: string[] = ['ข้อมูลหลัก'];

    // --- Section 1: General & Budget ---
    const importedCode = cleanString(fields.projectCode);
    const parsedFiscalYear = parseFiscalYearValue(fields.fiscalYear);
    const name = cleanString(fields.name);
    const budgetCategory = cleanString(fields.budgetCategory) as BudgetCategory;
    const meetingSession = cleanString(fields.meetingSession);
    const parsedApprovalYear = parseFiscalYearValue(fields.approvalYear);
    const approvedBudget = parseNumberValue(fields.approvedBudget);
    const description = cleanString(fields.description);
    const location = cleanString(fields.location);
    const responsiblePerson = cleanString(fields.responsiblePerson);
    const notes = cleanString(fields.notes);

    // --- Section 2: TOR & Ref Price ---
    const torOrderNo = cleanString(fields.torOrderNo);
    const torOrderDate = parseExcelDate(fields.torOrderDate);
    const torAuthor = cleanString(fields.torAuthor);
    const torDate = parseExcelDate(fields.torDate);
    const refPrice = parseNumberValue(fields.refPrice);
    const refPriceDate = parseExcelDate(fields.refPriceDate);
    const torCommittees = parseCommitteeMembers(fields.torCommittees, 'committee', `imp-tor-${r}`);
    const torRemunerationPayee = cleanString(fields.torRemunerationPayee);
    const torRemunerationAmount = parseNumberValue(fields.torRemunerationAmount);

    const hasTorSection = Boolean(
      torOrderNo ||
        torOrderDate ||
        torAuthor ||
        torDate ||
        (refPrice !== undefined && refPrice > 0) ||
        refPriceDate ||
        torCommittees.length > 0 ||
        torRemunerationPayee ||
        (torRemunerationAmount !== undefined && torRemunerationAmount > 0)
    );
    if (hasTorSection) importedSections.push('TOR/ราคากลาง');

    // --- Section 3: Supervision & Inspection Committees ---
    const inspectOrderNo = cleanString(fields.inspectOrderNo);
    const inspectOrderDate = parseExcelDate(fields.inspectOrderDate);
    const parsedSupervisors = parseCommitteeMembers(fields.supervisors, 'supervisor', `imp-sup-${r}`);
    const supervisorNameStr = parsedSupervisors.map(s => s.name).join(', ');
    const inspectCommittees = parseCommitteeMembers(fields.inspectCommittees, 'committee', `imp-ins-${r}`);

    const hasCommitteeSection = Boolean(
      inspectOrderNo || inspectOrderDate || parsedSupervisors.length > 0 || inspectCommittees.length > 0
    );
    if (hasCommitteeSection) {
      importedSections.push(
        parsedSupervisors.length > 1 ? `ควบคุมงาน ${parsedSupervisors.length} คน` : 'กรรมการ/ควบคุมงาน'
      );
    }

    // --- Section 4: Contract & Contractor ---
    const contractNo = cleanString(fields.contractNo);
    const contractDate = parseExcelDate(fields.contractDate);
    const contractAmount = parseNumberValue(fields.contractAmount);
    const startDate = parseExcelDate(fields.startDate);
    const endDate = parseExcelDate(fields.endDate);
    const contractorName = cleanString(fields.contractorName);
    const contractorTaxId = cleanString(fields.contractorTaxId);
    const contractorContact = cleanString(fields.contractorContact);

    const hasContractSection = Boolean(
      contractNo ||
        contractDate ||
        (contractAmount !== undefined && contractAmount > 0) ||
        startDate ||
        endDate ||
        contractorName ||
        contractorTaxId ||
        contractorContact
    );
    if (hasContractSection) importedSections.push('สัญญาจ้าง');

    // --- Section 5: Work Notice, Delivery, Inspection ---
    const workNoticeBookNo = cleanString(fields.workNoticeBookNo);
    const workNoticeBookDate = parseExcelDate(fields.workNoticeBookDate);
    const actualWorkDate = parseExcelDate(fields.actualWorkDate);
    const hasWorkNotice = Boolean(workNoticeBookNo || workNoticeBookDate || actualWorkDate);

    const deliveryBookNo = cleanString(fields.deliveryBookNo);
    const deliveryBookDate = parseExcelDate(fields.deliveryBookDate);
    const actualDeliveryDate = parseExcelDate(fields.actualDeliveryDate) || deliveryBookDate;
    const deliveryDetails = cleanString(fields.deliveryDetails);
    const hasDelivery = Boolean(deliveryBookNo || deliveryBookDate || actualDeliveryDate || deliveryDetails);

    const inspectionDate = parseExcelDate(fields.inspectionDate);
    const inspectionResult = parseInspectionResult(fields.inspectionResult);
    const inspectionDetails = cleanString(fields.inspectionDetails);
    const hasInspection = Boolean(inspectionDate || inspectionResult || inspectionDetails);

    if (hasWorkNotice) importedSections.push('แจ้งเข้าทำงาน');
    if (hasDelivery) importedSections.push('ส่งมอบงาน');
    if (hasInspection) importedSections.push('ตรวจรับงาน');

    // --- Section 6: Disbursement & Remuneration ---
    const disbursementPetitionNo = cleanString(fields.disbursementPetitionNo);
    const disbursementDate = parseExcelDate(fields.disbursementDate);
    const disbursementAmount = parseNumberValue(fields.disbursementAmount);
    const disbursementStatus = parseDisbursementStatus(fields.disbursementStatus);
    const disbursementCheckNo = cleanString(fields.disbursementCheckNo);
    const disbursementTransferDate = parseExcelDate(fields.disbursementTransferDate);
    const hasDisbursement = Boolean(
      disbursementPetitionNo ||
        disbursementDate ||
        (disbursementAmount !== undefined && disbursementAmount > 0) ||
        disbursementStatus ||
        disbursementCheckNo ||
        disbursementTransferDate
    );

    const remunerationAmount = parseNumberValue(fields.remunerationAmount);
    const remunerationPetitionNo = cleanString(fields.remunerationPetitionNo);
    const remunerationDate = parseExcelDate(fields.remunerationDate);
    const remunerationStatus = parseRemunerationStatus(fields.remunerationStatus);
    const hasRemuneration = Boolean(
      (remunerationAmount !== undefined && remunerationAmount > 0) ||
        remunerationPetitionNo ||
        remunerationDate ||
        remunerationStatus
    );

    if (hasDisbursement) importedSections.push('เบิกจ่าย');
    if (hasRemuneration) importedSections.push('ค่าตอบแทน');

    // --- Section 7: Archive GPS Coordinates & Status ---
    const startPoint = parseCoordinatePoint(fields.startCoord);
    const endPoint = parseCoordinatePoint(fields.endCoord);
    const signboardPoint = parseCoordinatePoint(fields.signboardCoord);
    const archiveRemark = cleanString(fields.archiveRemark);
    const hasArchive = Boolean(startPoint || endPoint || signboardPoint || archiveRemark);
    if (hasArchive) importedSections.push('พิกัด GPS');

    const explicitStatus = parseProjectStatus(fields.status);

    // Date parse warnings (if user typed non-empty unparseable date text)
    const dateChecks: [string, unknown, string | undefined][] = [
      ['วันที่เริ่มสัญญา', fields.startDate, startDate],
      ['วันที่สิ้นสุดสัญญา', fields.endDate, endDate],
      ['วันที่ลงนามสัญญา', fields.contractDate, contractDate],
      ['วันที่คำสั่ง TOR', fields.torOrderDate, torOrderDate],
      ['วันที่ตรวจรับงาน', fields.inspectionDate, inspectionDate]
    ];
    dateChecks.forEach(([label, rawVal, parsedVal]) => {
      if (!isBlankValue(rawVal) && !parsedVal) {
        warnings.push(`รูปแบบ${label}ไม่ถูกต้อง ("${String(rawVal).trim()}")`);
      }
    });

    // Duplicate detection: Priority 1 - projectCode, Priority 2 - contractNo, Priority 3 - name
    const matchedByCode = importedCode
      ? existingProjects.find(
          p => p.projectCode && p.projectCode.trim().toLowerCase() === importedCode.toLowerCase()
        )
      : undefined;

    const matchedByContractOrName = existingProjects.find(
      p =>
        (contractNo && p.contractNo && p.contractNo.trim().toLowerCase() === contractNo.toLowerCase()) ||
        (name && p.name.trim().toLowerCase() === name.toLowerCase())
    );

    const matchedExisting = matchedByCode || matchedByContractOrName;
    const isDuplicate = Boolean(matchedExisting);
    const isUpdate = isDuplicate;

    // Validation
    if (!name && !matchedExisting) {
      errors.push('ไม่มีชื่อโครงการ');
    }
    const finalBudgetCheck = approvedBudget ?? matchedExisting?.approvedBudget ?? 0;
    if (finalBudgetCheck <= 0) {
      warnings.push('งบประมาณเป็น 0');
    }

    if (isDuplicate && matchedExisting) {
      warnings.push(
        matchedByCode
          ? `พบรหัส "${matchedExisting.projectCode}" ซ้ำ: อัปเดตเฉพาะช่องที่กรอก`
          : `พบชื่อ/สัญญาซ้ำกับ "${matchedExisting.name}": อัปเดตเฉพาะช่องที่กรอก`
      );
    }

    const nowIso = new Date().toISOString();
    const effectiveFiscalYear = parsedFiscalYear || matchedExisting?.fiscalYear || defaultFiscalYear;

    // Build workflow records when provided in Excel
    const newWorkNotice: WorkNotice | null = hasWorkNotice
      ? {
          id: `wn-imp-${Date.now()}-${r}`,
          bookNo: workNoticeBookNo,
          bookDate: workNoticeBookDate || actualWorkDate || '',
          actualWorkDate: actualWorkDate || ''
        }
      : null;

    const newDelivery: DeliveryRecord | null = hasDelivery
      ? {
          id: `del-imp-${Date.now()}-${r}`,
          installment: 1,
          bookNo: deliveryBookNo,
          bookDate: deliveryBookDate || actualDeliveryDate || '',
          actualDeliveryDate: actualDeliveryDate || deliveryBookDate || '',
          details: deliveryDetails || DEFAULT_DELIVERY_DETAILS
        }
      : null;

    const newInspection: InspectionRecord | null = hasInspection
      ? {
          id: `ins-imp-${Date.now()}-${r}`,
          installment: 1,
          inspectionDate: inspectionDate || '',
          result: inspectionResult || 'pass',
          details: inspectionDetails || 'คณะกรรมการตรวจรับงานถูกต้องครบถ้วนตามสัญญา'
        }
      : null;

    const newDisbursement: DisbursementRecord | null = hasDisbursement
      ? {
          id: `dis-imp-${Date.now()}-${r}`,
          installment: 1,
          disbursementDate: disbursementDate || disbursementTransferDate || '',
          petitionNo: disbursementPetitionNo,
          amount:
            disbursementAmount ??
            contractAmount ??
            matchedExisting?.contractAmount ??
            approvedBudget ??
            matchedExisting?.approvedBudget ??
            0,
          status: disbursementStatus || (disbursementTransferDate || disbursementCheckNo ? 'paid' : 'pending'),
          checkNo: disbursementCheckNo || undefined,
          transferDate: disbursementTransferDate || undefined
        }
      : null;

    const newRemuneration: CommitteeRemuneration | null = hasRemuneration
      ? {
          id: `rem-imp-${Date.now()}-${r}`,
          type: 'inspection',
          title: 'ค่าตอบแทนคณะกรรมการตรวจรับงาน / ผู้ควบคุมงาน',
          payeeName:
            inspectCommittees[0]?.name ||
            parsedSupervisors[0]?.name ||
            matchedExisting?.inspectCommittees?.[0]?.name ||
            matchedExisting?.supervisorName ||
            responsiblePerson ||
            'คณะกรรมการตรวจรับพัสดุ',
          amount: remunerationAmount ?? 0,
          withdrawDate: remunerationDate || '',
          petitionNo: remunerationPetitionNo,
          status: remunerationStatus || (remunerationPetitionNo ? 'paid' : 'pending')
        }
      : null;

    // Merge helper for archive record
    const mergeArchive = (existing?: ProjectArchiveRecord): ProjectArchiveRecord | undefined => {
      if (!hasArchive) return existing;
      return {
        ...existing,
        startPoint: startPoint || existing?.startPoint,
        endPoint: endPoint || existing?.endPoint,
        signboardPoint: signboardPoint || existing?.signboardPoint,
        remark: archiveRemark || existing?.remark,
        files: existing?.files || [],
        updatedAt: nowIso
      };
    };

    // Merge helpers for workflow arrays on upsert (update first matching or append without creating duplicates)
    const mergeWorkNotices = (existing: WorkNotice[]): WorkNotice[] => {
      if (!newWorkNotice) return existing;
      if (existing.length === 0) return [newWorkNotice];
      const matchIdx = existing.findIndex(
        w =>
          (newWorkNotice.bookNo && w.bookNo === newWorkNotice.bookNo) ||
          (newWorkNotice.bookDate && w.bookDate === newWorkNotice.bookDate)
      );
      if (matchIdx >= 0) {
        return existing.map((w, i) =>
          i === matchIdx
            ? {
                ...w,
                bookNo: newWorkNotice.bookNo || w.bookNo,
                bookDate: newWorkNotice.bookDate || w.bookDate,
                actualWorkDate: newWorkNotice.actualWorkDate || w.actualWorkDate
              }
            : w
        );
      }
      return [...existing, newWorkNotice];
    };

    const mergeDeliveries = (existing: DeliveryRecord[]): DeliveryRecord[] => {
      if (!newDelivery) return existing;
      if (existing.length === 0) return [newDelivery];
      const matchIdx = existing.findIndex(
        d =>
          (newDelivery.bookNo && d.bookNo === newDelivery.bookNo) ||
          (newDelivery.bookDate && d.bookDate === newDelivery.bookDate)
      );
      if (matchIdx >= 0) {
        return existing.map((d, i) =>
          i === matchIdx
            ? {
                ...d,
                bookNo: newDelivery.bookNo || d.bookNo,
                bookDate: newDelivery.bookDate || d.bookDate,
                actualDeliveryDate: newDelivery.actualDeliveryDate || d.actualDeliveryDate,
                details: deliveryDetails || d.details
              }
            : d
        );
      }
      return [...existing, { ...newDelivery, installment: existing.length + 1 }];
    };

    const mergeInspections = (existing: InspectionRecord[]): InspectionRecord[] => {
      if (!newInspection) return existing;
      if (existing.length === 0) return [newInspection];
      const matchIdx = existing.findIndex(
        ins => newInspection.inspectionDate && ins.inspectionDate === newInspection.inspectionDate
      );
      if (matchIdx >= 0) {
        return existing.map((ins, i) =>
          i === matchIdx
            ? {
                ...ins,
                inspectionDate: newInspection.inspectionDate || ins.inspectionDate,
                result: inspectionResult || ins.result,
                details: inspectionDetails || ins.details
              }
            : ins
        );
      }
      return [...existing, { ...newInspection, installment: existing.length + 1 }];
    };

    const mergeDisbursements = (existing: DisbursementRecord[]): DisbursementRecord[] => {
      if (!newDisbursement) return existing;
      if (existing.length === 0) return [newDisbursement];
      const matchIdx = existing.findIndex(
        d =>
          (newDisbursement.petitionNo && d.petitionNo === newDisbursement.petitionNo) ||
          (newDisbursement.disbursementDate && d.disbursementDate === newDisbursement.disbursementDate)
      );
      if (matchIdx >= 0) {
        return existing.map((d, i) =>
          i === matchIdx
            ? {
                ...d,
                petitionNo: newDisbursement.petitionNo || d.petitionNo,
                disbursementDate: newDisbursement.disbursementDate || d.disbursementDate,
                amount: disbursementAmount ?? d.amount,
                status: disbursementStatus || d.status,
                checkNo: newDisbursement.checkNo || d.checkNo,
                transferDate: newDisbursement.transferDate || d.transferDate
              }
            : d
        );
      }
      return [...existing, { ...newDisbursement, installment: existing.length + 1 }];
    };

    const mergeRemunerations = (existing: CommitteeRemuneration[]): CommitteeRemuneration[] => {
      if (!newRemuneration) return existing;
      if (existing.length === 0) return [newRemuneration];
      const matchIdx = existing.findIndex(
        rem => newRemuneration.petitionNo && rem.petitionNo === newRemuneration.petitionNo
      );
      if (matchIdx >= 0) {
        return existing.map((rem, i) =>
          i === matchIdx
            ? {
                ...rem,
                amount: remunerationAmount ?? rem.amount,
                withdrawDate: newRemuneration.withdrawDate || rem.withdrawDate,
                status: remunerationStatus || rem.status
              }
            : rem
        );
      }
      return [...existing, newRemuneration];
    };

    let project: Project;
    if (matchedExisting) {
      project = {
        ...matchedExisting,
        projectCode: importedCode || matchedExisting.projectCode,
        fiscalYear: effectiveFiscalYear,
        name: name || matchedExisting.name,
        budgetCategory: budgetCategory || matchedExisting.budgetCategory,
        meetingSession: meetingSession || matchedExisting.meetingSession,
        approvalYear: parsedApprovalYear ?? matchedExisting.approvalYear ?? effectiveFiscalYear,
        approvedBudget: approvedBudget ?? matchedExisting.approvedBudget,
        description: description || matchedExisting.description,
        location: location || matchedExisting.location,
        responsiblePerson: responsiblePerson || matchedExisting.responsiblePerson,
        notes: notes || matchedExisting.notes,

        // Section 2
        torOrderNo: torOrderNo || matchedExisting.torOrderNo,
        torOrderDate: torOrderDate || matchedExisting.torOrderDate,
        torAuthor: torAuthor || matchedExisting.torAuthor,
        torDate: torDate || matchedExisting.torDate,
        refPrice: refPrice ?? matchedExisting.refPrice,
        refPriceDate: refPriceDate || matchedExisting.refPriceDate,
        torCommittees: torCommittees.length > 0 ? torCommittees : matchedExisting.torCommittees,
        torRemunerationPayee: torRemunerationPayee || matchedExisting.torRemunerationPayee,
        torRemunerationAmount: torRemunerationAmount ?? matchedExisting.torRemunerationAmount,

        // Section 3
        inspectOrderNo: inspectOrderNo || matchedExisting.inspectOrderNo,
        inspectOrderDate: inspectOrderDate || matchedExisting.inspectOrderDate,
        supervisorName: supervisorNameStr || matchedExisting.supervisorName,
        supervisors: parsedSupervisors.length > 0 ? parsedSupervisors : matchedExisting.supervisors,
        inspectCommittees: inspectCommittees.length > 0 ? inspectCommittees : matchedExisting.inspectCommittees,

        // Section 4
        contractNo: contractNo || matchedExisting.contractNo,
        contractDate: contractDate || matchedExisting.contractDate,
        contractAmount: contractAmount ?? matchedExisting.contractAmount,
        startDate: startDate || matchedExisting.startDate,
        endDate: endDate || matchedExisting.endDate,
        contractorName: contractorName || matchedExisting.contractorName,
        contractorTaxId: contractorTaxId || matchedExisting.contractorTaxId,
        contractorContact: contractorContact || matchedExisting.contractorContact,

        // Section 5 & 6
        workNotices: mergeWorkNotices(matchedExisting.workNotices || []),
        deliveries: mergeDeliveries(matchedExisting.deliveries || []),
        inspections: mergeInspections(matchedExisting.inspections || []),
        disbursements: mergeDisbursements(matchedExisting.disbursements || []),
        remunerations: mergeRemunerations(matchedExisting.remunerations || []),

        // Section 7
        projectRecord: mergeArchive(matchedExisting.projectRecord),
        status: explicitStatus || matchedExisting.status,
        updatedAt: nowIso
      };
      // If no explicit status was provided in Excel, advance status if new workflow stages were added
      if (!explicitStatus) {
        const derived = deriveProjectStatusFromData(project);
        if (project.status === 'not_started' || derived === 'completed') {
          project.status = derived;
        }
      }
    } else {
      const assignedCode =
        importedCode || buildNextProjectCode(effectiveFiscalYear, usedCodes, defaultCodePrefix);
      if (importedCode) {
        usedCodes.add(importedCode.toLowerCase());
      }

      project = {
        id: `prj-imported-${Date.now()}-${r}`,
        projectCode: assignedCode,
        fiscalYear: effectiveFiscalYear,
        name,
        budgetCategory: budgetCategory || 'งบประมาณรายจ่าย',
        meetingSession: meetingSession || undefined,
        approvalYear: parsedApprovalYear ?? effectiveFiscalYear,
        approvedBudget: approvedBudget ?? 0,
        description: description || undefined,
        location: location || 'ต.ไร่ใต้ อ.พิบูลมังสาหาร',
        responsiblePerson: responsiblePerson || 'กองช่าง อบต.ไร่ใต้',
        notes: notes || undefined,

        // Section 2
        torOrderNo: torOrderNo || undefined,
        torOrderDate: torOrderDate || undefined,
        torAuthor: torAuthor || undefined,
        torDate: torDate || undefined,
        refPrice: refPrice ?? 0,
        refPriceDate: refPriceDate || undefined,
        torCommittees,
        torRemunerationPayee: torRemunerationPayee || undefined,
        torRemunerationAmount: torRemunerationAmount ?? undefined,

        // Section 3
        inspectOrderNo: inspectOrderNo || undefined,
        inspectOrderDate: inspectOrderDate || undefined,
        supervisorName: supervisorNameStr || undefined,
        supervisors: parsedSupervisors.length > 0 ? parsedSupervisors : undefined,
        inspectCommittees,

        // Section 4
        contractNo: contractNo || undefined,
        contractDate: contractDate || undefined,
        contractAmount: contractAmount ?? 0,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        contractorName: contractorName || undefined,
        contractorTaxId: contractorTaxId || undefined,
        contractorContact: contractorContact || undefined,

        // Section 5 & 6
        workNotices: newWorkNotice ? [newWorkNotice] : [],
        deliveries: newDelivery ? [newDelivery] : [],
        inspections: newInspection ? [newInspection] : [],
        disbursements: newDisbursement ? [newDisbursement] : [],
        remunerations: newRemuneration ? [newRemuneration] : [],
        attachments: [],

        // Section 7
        projectRecord: mergeArchive(undefined),
        status: explicitStatus || 'not_started',
        progressPercent: 0,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      // Auto-derive workflow status when status column is left blank
      if (!explicitStatus) {
        project.status = deriveProjectStatusFromData(project);
      }
    }

    project.progressPercent = calculateProjectProgress(project);

    parsedRows.push({
      rowIdx: r + 1, // 1-based Excel row number
      data: project,
      raw: rawObj,
      isValid: errors.length === 0,
      isDuplicate,
      isUpdate,
      errors,
      warnings,
      importedSections
    });
  }

  return {
    sheetName,
    headerRowIndex,
    rawHeaders: headerRow.filter(Boolean),
    matchedFieldKeys: Array.from(matchedFieldSet),
    unmatchedHeaders,
    rows: parsedRows
  };
}
