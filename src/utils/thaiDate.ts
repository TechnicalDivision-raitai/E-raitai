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
 * Counts how many of the 12 pipeline stages are completed
 */
export function countCompletedSteps(p: any): number {
  if (!p) return 0;
  if (p.status === 'completed') return 12;

  let count = 0;
  // 1. บันทึกข้อมูลโครงการ
  if (p.name) count += 1;
  // 2. ออกคำสั่งแต่งตั้งกรรมการจัดทำ TOR และราคากลาง
  if (p.torOrderNo || p.torOrderDate || (p.torCommittees && p.torCommittees.length > 0)) count += 1;
  // 3. จัดทำ TOR
  if (p.torDate || p.torAuthor) count += 1;
  // 4. จัดทำราคากลาง
  if (p.refPriceDate || (p.refPrice && Number(p.refPrice) > 0)) count += 1;
  // 5. ออกคำสั่งแต่งตั้งกรรมการ (ควบคุมงาน/ตรวจรับ)
  if (p.inspectOrderNo || p.inspectOrderDate || (p.inspectCommittees && p.inspectCommittees.length > 0) || p.supervisorName) count += 1;
  // 6. จัดทำสัญญาจ้าง
  if (p.contractNo || p.contractDate || (p.contractAmount && Number(p.contractAmount) > 0)) count += 1;
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
