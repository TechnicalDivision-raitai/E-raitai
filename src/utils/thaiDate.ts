import { Project, ProjectStatus, UserProfile } from '../types/project';

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

/**
 * Format date string (YYYY-MM-DD) into Thai format
 * @param dateStr ISO string or YYYY-MM-DD
 * @param format 'short' | 'full' | 'official'
 */
export function formatThaiDate(dateStr?: string | null, format: 'short' | 'full' | 'official' = 'short'): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const day = d.getDate();
    const month = d.getMonth();
    const thaiYear = d.getFullYear() > 2400 ? d.getFullYear() : d.getFullYear() + 543;

    if (format === 'short') {
      return `${day} ${THAI_MONTHS_SHORT[month]} ${thaiYear}`;
    }
    if (format === 'full') {
      return `${day} ${THAI_MONTHS_FULL[month]} พ.ศ. ${thaiYear}`;
    }
    if (format === 'official') {
      return `วันที่ ${day} เดือน ${THAI_MONTHS_FULL[month]} พ.ศ. ${thaiYear}`;
    }
    return `${day}/${month + 1}/${thaiYear}`;
  } catch {
    return dateStr;
  }
}

/**
 * Format currency with commas and 2 decimals
 */
export function formatCurrency(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0.00';
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Calculate days remaining or days overdue compared to today
 */
export function getDaysRemaining(endDateStr?: string): { days: number; isOverdue: boolean; label: string } {
  if (!endDateStr) return { days: 0, isOverdue: false, label: '-' };
  try {
    const end = new Date(endDateStr);
    end.setHours(23, 59, 59, 999);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        days: Math.abs(diffDays),
        isOverdue: true,
        label: `เกินกำหนด ${Math.abs(diffDays)} วัน`
      };
    } else if (diffDays === 0) {
      return {
        days: 0,
        isOverdue: false,
        label: `สิ้นสุดสัญญาวันนี้`
      };
    } else {
      return {
        days: diffDays,
        isOverdue: false,
        label: `เหลืออีก ${diffDays} วัน`
      };
    }
  } catch {
    return { days: 0, isOverdue: false, label: '-' };
  }
}

/**
 * Converts a number to Thai Baht text (เช่น หนึ่งล้านสองแสนห้าหมื่นบาทถ้วน)
 */
export function bahtText(num: number): string {
  if (num === 0) return 'ศูนย์บาทถ้วน';
  if (isNaN(num)) return '-';

  const digits = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const units = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

  const split = num.toFixed(2).split('.');
  const integerPart = split[0];
  const decimalPart = split[1];

  function convertSection(sectionStr: string): string {
    let result = '';
    const len = sectionStr.length;
    for (let i = 0; i < len; i++) {
      const digit = parseInt(sectionStr.charAt(i), 10);
      const unitPos = len - i - 1;

      if (digit !== 0) {
        if (unitPos === 1 && digit === 1) {
          result += 'สิบ';
        } else if (unitPos === 1 && digit === 2) {
          result += 'ยี่สิบ';
        } else if (unitPos === 0 && digit === 1 && len > 1 && sectionStr.charAt(len - 2) !== '0') {
          result += 'เอ็ด';
        } else {
          result += digits[digit] + units[unitPos];
        }
      }
    }
    return result;
  }

  let text = '';
  if (integerPart.length > 6) {
    const millionIndex = integerPart.length - 6;
    const millions = integerPart.substring(0, millionIndex);
    const remainder = integerPart.substring(millionIndex);
    text = convertSection(millions) + 'ล้าน' + convertSection(remainder);
  } else {
    text = convertSection(integerPart);
  }

  if (text.length > 0) {
    text += 'บาท';
  }

  if (decimalPart === '00' || !decimalPart) {
    text += 'ถ้วน';
  } else {
    const decDigits = convertSection(decimalPart);
    text += decDigits + 'สตางค์';
  }

  return text;
}

/**
 * Calculates current Thai fiscal year (starts October 1st)
 * E.g., Oct 2026 - Sep 2027 is fiscal year 2570
 */
export function getCurrentThaiFiscalYear(): number {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const gregorianYear = now.getFullYear();
  const fiscalGregorian = month >= 10 ? gregorianYear + 1 : gregorianYear;
  return fiscalGregorian + 543;
}

/**
 * Checks whether Step 1 (ขออนุมัติโครงการ) has been recorded
 */
export function hasProjectApprovalData(p: Partial<Project> | null | undefined): boolean {
  if (!p) return false;
  return (
    Boolean(p.approvalRequestNo && String(p.approvalRequestNo).trim()) ||
    Boolean(p.approvalRequestDate && String(p.approvalRequestDate).trim()) ||
    Boolean(p.attachments && p.attachments.some(a => a.category === 'approval_request'))
  );
}

/**
 * Checks whether a committee/supervisor array has at least one member with a non-empty name
 */
function hasNamedMember(list?: Array<{ name?: string }> | null): boolean {
  return Boolean(
    Array.isArray(list) && list.some(m => Boolean(m?.name && String(m.name).trim()))
  );
}

/**
 * Counts how many of the 12 pipeline stages are completed
 */
export function countCompletedSteps(p: any): number {
  if (!p) return 0;
  if (p.status === 'completed') return 12;

  const hasText = (val: unknown): boolean => Boolean(val && String(val).trim());

  let count = 0;
  // 1. ขออนุมัติโครงการ (เลขที่หนังสือขออนุมัติ / วันที่ขออนุมัติ / ไฟล์แนบหมวดขออนุมัติ)
  if (hasProjectApprovalData(p)) count += 1;
  // 2. ออกคำสั่งแต่งตั้งกรรมการจัดทำ TOR และราคากลาง
  if (hasText(p.torOrderNo) || hasText(p.torOrderDate) || hasNamedMember(p.torCommittees)) count += 1;
  // 3. จัดทำ TOR
  if (hasText(p.torDate) || hasText(p.torAuthor)) count += 1;
  // 4. จัดทำราคากลาง
  if (hasText(p.refPriceDate) || (p.refPrice && Number(p.refPrice) > 0)) count += 1;
  // 5. ออกคำสั่งแต่งตั้งกรรมการ (ควบคุมงาน/ตรวจรับ)
  if (
    hasText(p.inspectOrderNo) ||
    hasText(p.inspectOrderDate) ||
    hasNamedMember(p.inspectCommittees) ||
    hasText(p.supervisorName) ||
    hasNamedMember(p.supervisors)
  ) count += 1;
  // 6. จัดทำสัญญาจ้าง
  if (hasText(p.contractNo) || hasText(p.contractDate) || (p.contractAmount && Number(p.contractAmount) > 0)) count += 1;
  // 7. แจ้งเข้าทำงาน
  if (p.workNotices && p.workNotices.length > 0) count += 1;
  // 8. ส่งมอบงาน
  if (p.deliveries && p.deliveries.length > 0) count += 1;
  // 9. ตรวจรับงาน
  if (p.inspections && p.inspections.some((i: any) => i.result === 'pass')) count += 1;
  // 10. จัดทำฎีกาเบิกเงิน
  if (p.disbursements && p.disbursements.length > 0) count += 1;
  // 11. เบิกจ่ายค่าตอบแทน
  if (p.remunerations && p.remunerations.length > 0) count += 1;
  // 12. ดำเนินการแล้วเสร็จ
  if (p.status === 'completed') count += 1;

  return Math.min(12, count);
}

/**
 * Calculates project progress percentage based on 12 equal weighted stages (100 / 12 = 8.333% per stage)
 */
export function calculateProjectProgress(p: any): number {
  if (!p) return 0;
  if (p.status === 'completed') return 100;
  const steps = countCompletedSteps(p);
  return Math.min(100, Math.round((steps / 12) * 100));
}

/**
 * Checks if a project is completed or fully disbursed (stop overdue alert)
 */
export function isProjectCompletedOrDisbursed(p: any): boolean {
  if (!p) return false;
  if (p.status === 'completed' || p.status === 'cancelled') return true;
  // If all disbursements are paid and there is at least one paid disbursement
  if (p.disbursements && p.disbursements.length > 0) {
    const hasDisbursements = p.disbursements.length > 0;
    const allPaid = p.disbursements.every((d: any) => d.status === 'paid');
    if (hasDisbursements && allPaid) return true;
  }
  return false;
}

/**
 * Checks whether a project has any data recorded in Tab 2 (TOR & Reference Price)
 * or any subsequent workflow stage (Tabs 3–6), including TOR attachments or Saraban TOR imports.
 * Projects with ONLY Tab 1 (General Info) data return false.
 */
export function hasTab2OrLaterWorkflowData(p: Partial<Project> | null | undefined): boolean {
  if (!p) return false;

  // Tab 2: TOR & ราคากลาง (คำสั่งแต่งตั้ง กก., วันที่จัดทำ, ราคากลาง, รายชื่อกรรมการ, หมายเหตุ, ค่าตอบแทน TOR, หรือไฟล์แนบหมวด TOR)
  const hasTorData =
    Boolean(p.torOrderNo && p.torOrderNo.trim()) ||
    Boolean(p.torOrderDate && p.torOrderDate.trim()) ||
    Boolean(p.torAuthor && p.torAuthor.trim()) ||
    Boolean(p.torDate && p.torDate.trim()) ||
    Boolean(p.refPriceDate && p.refPriceDate.trim()) ||
    (p.refPrice !== undefined && Number(p.refPrice) > 0) ||
    Boolean(p.torNotes && p.torNotes.trim()) ||
    Boolean(p.torRemunerationPayee && p.torRemunerationPayee.trim()) ||
    (p.torRemunerationAmount !== undefined && Number(p.torRemunerationAmount) > 0) ||
    Boolean(
      p.torCommittees &&
        p.torCommittees.some(
          c => Boolean(c?.name && c.name.trim()) || Boolean(c?.position && c.position.trim())
        )
    ) ||
    Boolean(p.attachments && p.attachments.some(a => a.category === 'tor'));

  if (hasTorData) return true;

  // Tabs 3–6: คำสั่งควบคุมงาน/ตรวจรับ, สัญญาจ้าง, แจ้งเข้าทำงาน, ส่งมอบ, ตรวจรับ, เบิกจ่าย, ค่าตอบแทน หรือเอกสารแนบขั้นดำเนินงาน
  const hasLaterWorkflowData =
    Boolean(p.inspectOrderNo && p.inspectOrderNo.trim()) ||
    Boolean(p.inspectOrderDate && p.inspectOrderDate.trim()) ||
    Boolean(p.supervisorName && p.supervisorName.trim()) ||
    Boolean(p.supervisors && p.supervisors.some(s => Boolean(s?.name && s.name.trim()))) ||
    Boolean(p.inspectCommittees && p.inspectCommittees.some(c => Boolean(c?.name && c.name.trim()))) ||
    Boolean(p.contractNo && p.contractNo.trim()) ||
    Boolean(p.contractDate && p.contractDate.trim()) ||
    (p.contractAmount !== undefined && Number(p.contractAmount) > 0) ||
    Boolean(p.contractorName && p.contractorName.trim()) ||
    Boolean(p.workNotices && p.workNotices.length > 0) ||
    Boolean(p.deliveries && p.deliveries.length > 0) ||
    Boolean(p.inspections && p.inspections.length > 0) ||
    Boolean(p.disbursements && p.disbursements.length > 0) ||
    Boolean(p.remunerations && p.remunerations.length > 0) ||
    Boolean(
      p.attachments &&
        p.attachments.some(a => a.category !== 'other' && a.category !== 'project_record')
    );

  return hasLaterWorkflowData;
}

/**
 * Determines whether a project should appear and be counted in "กล่องงานของฉัน" (My Inbox):
 * - Enters automatically once Step 1 (ขออนุมัติโครงการ: เลขที่หนังสือขออนุมัติ/วันที่) OR Tab 2+ data is recorded
 * - Projects with ONLY general Tab 1 data (without approval request) stay in ทะเบียนโครงการ & ภาพรวม and do NOT enter My Inbox
 * - Exits automatically once status is completed/disbursed or cancelled
 */
export function isProjectInMyInbox(
  p: Project | null | undefined,
  currentUser: UserProfile
): boolean {
  if (!p) return false;
  if (p.status === 'completed' || p.status === 'cancelled' || isProjectCompletedOrDisbursed(p)) {
    return false;
  }
  if (!hasProjectApprovalData(p) && !hasTab2OrLaterWorkflowData(p)) {
    return false;
  }

  if (currentUser.role === 'admin') return true;
  const userName = currentUser.displayName;
  return Boolean(
    (p.responsiblePerson && p.responsiblePerson.includes(userName)) ||
      (p.supervisorName && p.supervisorName.includes(userName)) ||
      (p.supervisors && p.supervisors.some(s => s?.name && s.name.includes(userName)))
  );
}

/**
 * Format Date or ISO string into Thai date + time (e.g. "14 พ.ย. 2569 02:30 น.")
 */
export function formatThaiDateTime(dateInput?: Date | string | null): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) {
    return typeof dateInput === 'string' ? dateInput : '-';
  }
  const day = d.getDate();
  const month = THAI_MONTHS_SHORT[d.getMonth()];
  const thaiYear = d.getFullYear() > 2400 ? d.getFullYear() : d.getFullYear() + 543;
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${thaiYear} ${hours}:${minutes} น.`;
}

/**
 * Derive project status automatically from the furthest recorded workflow stage
 */
export function deriveProjectStatusFromData(p: Partial<Project> | null | undefined): ProjectStatus {
  if (!p) return 'not_started';
  if (p.status === 'cancelled') return 'cancelled';

  const disbursements = p.disbursements || [];
  const inspections = p.inspections || [];
  const deliveries = p.deliveries || [];
  const workNotices = p.workNotices || [];

  // 1. เบิกจ่ายครบแล้วทั้งหมด
  if (disbursements.length > 0 && disbursements.every(d => d.status === 'paid')) {
    return 'completed';
  }

  // 2. ตรวจรับผ่านแล้ว หรือมีฎีกาเบิกจ่ายแล้ว (รอเบิกจ่าย)
  if (inspections.some(i => i.result === 'pass') || disbursements.length > 0) {
    return 'inspected';
  }

  // 3. ส่งมอบงานแล้ว (รอตรวจรับ)
  if (deliveries.length > 0) {
    return 'delivered';
  }

  // 4. แจ้งเข้าทำงานแล้ว (อยู่ระหว่างดำเนินการ)
  if (workNotices.length > 0) {
    return 'in_progress';
  }

  // 5. ลงนามสัญญาแล้ว
  if (
    Boolean(p.contractNo && p.contractNo.trim()) ||
    Boolean(p.contractDate && p.contractDate.trim()) ||
    (p.contractAmount !== undefined && Number(p.contractAmount) > 0) ||
    Boolean(p.contractorName && p.contractorName.trim())
  ) {
    return 'contracted';
  }

  // 6. ขออนุมัติโครงการ หรือ จัดทำ TOR / ราคากลาง / คำสั่งแต่งตั้งกรรมการ
  if (hasProjectApprovalData(p) || hasTab2OrLaterWorkflowData(p)) {
    return 'procurement_tor';
  }

  return 'not_started';
}

export interface WorkNoticeAlertInfo {
  hasAlert: boolean;
  isOver15Days: boolean;
  daysElapsed: number;
  daysRemainingIn15: number;
  bookNo: string;
  bookDate: string;
  shortLabel: string;
  badgeLabel: string;
  fullMessage: string;
}

/**
 * Checks if a project has a recorded work notice (แจ้งเข้าทำงาน)
 * but has NOT recorded an actual work start date (actualWorkDate) within 15 days,
 * triggering an alert to expedite the contractor (เร่งรัดผู้รับจ้างเข้าทำงาน).
 */
export function getWorkNoticeAlert(p: Partial<Project> | null | undefined): WorkNoticeAlertInfo {
  const empty: WorkNoticeAlertInfo = {
    hasAlert: false,
    isOver15Days: false,
    daysElapsed: 0,
    daysRemainingIn15: 15,
    bookNo: '',
    bookDate: '',
    shortLabel: '',
    badgeLabel: '',
    fullMessage: ''
  };

  if (!p || isProjectCompletedOrDisbursed(p) || p.status === 'completed') {
    return empty;
  }

  const notices = p.workNotices || [];
  if (notices.length === 0) {
    return empty;
  }

  // If any work notice already has an actualWorkDate recorded, no alert is needed
  const hasActualWorkDate = notices.some(
    w => Boolean(w.actualWorkDate && String(w.actualWorkDate).trim())
  );
  if (hasActualWorkDate) {
    return empty;
  }

  const latestNotice = notices[notices.length - 1] || notices[0];
  const refDateStr = (latestNotice.bookDate || '').trim();
  const bookNo = (latestNotice.bookNo || '').trim();

  if (refDateStr) {
    const noticeDate = new Date(refDateStr);
    if (!isNaN(noticeDate.getTime())) {
      noticeDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const diffMs = today.getTime() - noticeDate.getTime();
      const daysElapsed = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      // เริ่มแจ้งเตือนเมื่อผ่านไปแล้วตั้งแต่ 10 วันขึ้นไป (วันที่ 0-9 ยังไม่แจ้งเตือน)
      if (daysElapsed < 10) {
        return empty;
      }

      const daysRemainingIn15 = Math.max(0, 15 - daysElapsed);
      const isOver15Days = daysElapsed >= 15;

      if (isOver15Days) {
        return {
          hasAlert: true,
          isOver15Days: true,
          daysElapsed,
          daysRemainingIn15: 0,
          bookNo,
          bookDate: refDateStr,
          shortLabel: 'เร่งรัดผู้รับจ้างเข้าทำงาน (เกิน 15 วัน)',
          badgeLabel: `เร่งรัดผู้รับจ้างเข้าทำงาน (แจ้งเข้างานแล้ว ${daysElapsed} วัน • เกินกำหนด 15 วัน)`,
          fullMessage: `แจ้งเตือนการเร่งรัดผู้รับจ้างเข้าทำงาน: มีบันทึกแจ้งเข้าทำงาน${
            bookNo ? ` เลขที่ ${bookNo}` : ''
          } เมื่อ ${formatThaiDate(refDateStr)} (ผ่านมาแล้ว ${daysElapsed} วัน เกินกำหนด 15 วัน) แต่ยังไม่มีการบันทึกวันเข้าทำงานจริง`
        };
      }

      return {
        hasAlert: true,
        isOver15Days: false,
        daysElapsed,
        daysRemainingIn15,
        bookNo,
        bookDate: refDateStr,
        shortLabel: 'เร่งรัดผู้รับจ้างเข้าทำงาน (ภายใน 15 วัน)',
        badgeLabel: `เร่งรัดผู้รับจ้างเข้าทำงาน (ยังไม่เข้างานจริง • ครบ 15 วันในอีก ${daysRemainingIn15} วัน)`,
        fullMessage: `แจ้งเตือนการเร่งรัดผู้รับจ้างเข้าทำงาน: มีบันทึกแจ้งเข้าทำงาน${
          bookNo ? ` เลขที่ ${bookNo}` : ''
        } เมื่อ ${formatThaiDate(refDateStr)} (ผ่านมาแล้ว ${daysElapsed} วัน เหลือเวลา ${daysRemainingIn15} วันในเกณฑ์ 15 วัน) ยังไม่มีการบันทึกวันเข้าทำงานจริง`
      };
    }
  }

  return empty;
}

export const DEFAULT_DELIVERY_DETAILS =
  'ส่งมอบงานทั้งหมดครบถ้วนถูกต้องตามรูปแบบรายการและเงื่อนไขสัญญาทุกประการ';

export interface DeliveryContractStatusInfo {
  hasComparison: boolean;
  isWithinContract: boolean;
  overdueDays: number;
  earlyOrRemainingDays: number;
  label: string;
  detailMessage: string;
}

/**
 * Checks whether a delivery date (actualDeliveryDate or bookDate) is within the contract endDate.
 * Calculates overdue days from endDate to deliveryDate when past due, to assist fine calculation.
 */
export function getDeliveryContractStatus(
  deliveryDateStr?: string | null,
  contractEndDateStr?: string | null
): DeliveryContractStatusInfo {
  const empty: DeliveryContractStatusInfo = {
    hasComparison: false,
    isWithinContract: true,
    overdueDays: 0,
    earlyOrRemainingDays: 0,
    label: '',
    detailMessage: ''
  };

  if (!deliveryDateStr || !contractEndDateStr) {
    return empty;
  }

  try {
    const parseLocalDay = (raw: string): Date | null => {
      const trimmed = String(raw).trim();
      const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (isoMatch) {
        const yr = Number(isoMatch[1]);
        const gregYear = yr > 2400 ? yr - 543 : yr;
        return new Date(gregYear, Number(isoMatch[2]) - 1, Number(isoMatch[3]), 0, 0, 0, 0);
      }
      const d = new Date(trimmed);
      if (isNaN(d.getTime())) return null;
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const delDate = parseLocalDay(deliveryDateStr);
    const endDate = parseLocalDay(contractEndDateStr);
    if (!delDate || !endDate) return empty;

    const diffMs = delDate.getTime() - endDate.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return {
        hasComparison: true,
        isWithinContract: true,
        overdueDays: 0,
        earlyOrRemainingDays: 0,
        label: 'ภายในกำหนดเวลาตามสัญญา',
        detailMessage: 'ภายในกำหนดเวลาตามสัญญา'
      };
    }

    return {
      hasComparison: true,
      isWithinContract: false,
      overdueDays: diffDays,
      earlyOrRemainingDays: 0,
      label: `พ้นกำหนดระยะเวลาตามสัญญา (เกินกำหนด ${diffDays} วัน นับถึงวันส่งมอบ)`,
      detailMessage: `พ้นกำหนดระยะเวลาตามสัญญา • เกินกำหนด ${diffDays} วัน จนถึงวันส่งมอบงาน (ครบกำหนดสัญญา ${formatThaiDate(
        contractEndDateStr
      )} ส่งมอบจริง ${formatThaiDate(deliveryDateStr)} • ใช้สำหรับคำนวณค่าปรับ)`
    };
  } catch {
    return empty;
  }
}

/**
 * Returns the ProjectDetailModal tab number (1-7) matching the first attachment's workflow category.
 */
export function getFirstAttachmentTab(p?: Partial<Project> | null): number {
  const first = p?.attachments?.[0];
  if (!first) return 1;
  switch (first.category) {
    case 'approval_request':
      return 1;
    case 'tor':
      return 2;
    case 'order':
      return 3;
    case 'contract':
      return 4;
    case 'notice':
    case 'delivery':
      return 5;
    case 'inspection':
      return 6;
    case 'disbursement':
    case 'remuneration':
      return 7;
    default:
      return 1;
  }
}



