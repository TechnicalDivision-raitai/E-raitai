import {
  AttachmentFile,
  CommitteeRemuneration,
  DeliveryRecord,
  DisbursementRecord,
  InspectionRecord,
  Project,
  SarabanDocCategory,
  SarabanQueueItem,
  WorkNotice
} from '../types/project';
import {
  DEFAULT_DELIVERY_DETAILS,
  calculateProjectProgress,
  deriveProjectStatusFromData,
  formatThaiDateTime
} from './thaiDate';

export const DEFAULT_INSPECTION_DETAILS_BY_RESULT: Record<
  'pass' | 'fail' | 'need_revision',
  string
> = {
  pass: 'ตรวจรับงานถูกต้องตามแบบรูปรายการละเอียด',
  need_revision: 'ให้ผู้รับจ้างดำเนินการแก้ไขปรับปรุงให้ถูกต้องตามแบบรูปรายการ',
  fail: 'ไม่ผ่านการตรวจรับงานตามแบบรูปรายการละเอียด'
};

export const DEFAULT_REMUNERATION_TITLES: Record<CommitteeRemuneration['type'], string> = {
  tor_author: 'ค่าตอบแทนผู้จัดทำ TOR / กำหนดแบบรูปรายการ',
  tor: 'ค่าตอบแทนคณะกรรมการกำหนดราคากลาง',
  supervisor: 'ค่าตอบแทนผู้ควบคุมงาน',
  inspection: 'ค่าตอบแทนคณะกรรมการตรวจรับงานจ้าง'
};

export function getDefaultDetailsForSarabanCategory(
  docCategory: SarabanDocCategory,
  inspectionResult: 'pass' | 'fail' | 'need_revision' = 'pass'
): string {
  switch (docCategory) {
    case 'delivery':
      return DEFAULT_DELIVERY_DETAILS;
    case 'inspection':
      return DEFAULT_INSPECTION_DETAILS_BY_RESULT[inspectionResult] || DEFAULT_INSPECTION_DETAILS_BY_RESULT.pass;
    case 'work_notice':
    default:
      return '';
  }
}

export interface SarabanDocCategoryMeta {
  code: SarabanDocCategory;
  label: string;
  stepNo: number | null;
  detailTab: number;
  attachmentCategory: AttachmentFile['category'];
  targetSummary: string;
}

export const SARABAN_DOC_CATEGORY_META: Record<SarabanDocCategory, SarabanDocCategoryMeta> = {
  project_approval: {
    code: 'project_approval',
    label: 'หนังสือขออนุมัติโครงการ',
    stepNo: 1,
    detailTab: 1,
    attachmentCategory: 'approval_request',
    targetSummary: 'อัปเดตเลขที่หนังสือขออนุมัติ วันที่ขออนุมัติ และแนบไฟล์ในแท็บ 1 (เริ่มนับขั้นตอนที่ 1 และเข้ากล่องงาน)'
  },
  tor_order: {
    code: 'tor_order',
    label: 'คำสั่งแต่งตั้ง กก. TOR / ราคากลาง',
    stepNo: 2,
    detailTab: 2,
    attachmentCategory: 'tor',
    targetSummary: 'อัปเดตเลขที่คำสั่ง วันที่คำสั่ง TOR และแนบไฟล์หมวด TOR'
  },
  tor_approval: {
    code: 'tor_approval',
    label: 'ขออนุมัติ / จัดทำ TOR',
    stepNo: 3,
    detailTab: 2,
    attachmentCategory: 'tor',
    targetSummary: 'อัปเดตวันที่จัดทำ TOR ผู้จัดทำ และแนบไฟล์หมวด TOR'
  },
  ref_price: {
    code: 'ref_price',
    label: 'ขออนุมัติราคากลาง',
    stepNo: 4,
    detailTab: 2,
    attachmentCategory: 'tor',
    targetSummary: 'อัปเดตวันที่ราคากลาง วงเงินราคากลาง และแนบไฟล์หมวด TOR'
  },
  inspect_order: {
    code: 'inspect_order',
    label: 'คำสั่งแต่งตั้งควบคุมงาน / ตรวจรับ',
    stepNo: 5,
    detailTab: 3,
    attachmentCategory: 'order',
    targetSummary: 'อัปเดตเลขที่คำสั่ง วันที่คำสั่ง ผู้ควบคุมงาน และแนบไฟล์หมวดคำสั่ง'
  },
  contract: {
    code: 'contract',
    label: 'สัญญาจ้างก่อสร้าง',
    stepNo: 6,
    detailTab: 4,
    attachmentCategory: 'contract',
    targetSummary: 'อัปเดตเลขที่สัญญา วันที่ วงเงิน คู่สัญญา วันเริ่ม-สิ้นสุด และแนบไฟล์สัญญา'
  },
  work_notice: {
    code: 'work_notice',
    label: 'หนังสือแจ้งเข้าทำงาน',
    stepNo: 7,
    detailTab: 5,
    attachmentCategory: 'notice',
    targetSummary: 'เพิ่มรายการแจ้งเข้าทำงานและแนบไฟล์หมวดแจ้งเข้าทำงาน'
  },
  delivery: {
    code: 'delivery',
    label: 'หนังสือส่งมอบงาน',
    stepNo: 8,
    detailTab: 5,
    attachmentCategory: 'delivery',
    targetSummary: 'เพิ่มรายการส่งมอบงานตามงวดและแนบไฟล์หมวดส่งมอบงาน'
  },
  inspection: {
    code: 'inspection',
    label: 'รายงานผลตรวจรับงาน',
    stepNo: 9,
    detailTab: 5,
    attachmentCategory: 'inspection',
    targetSummary: 'เพิ่มผลการตรวจรับงานและแนบไฟล์หมวดตรวจรับงาน'
  },
  disbursement: {
    code: 'disbursement',
    label: 'ฎีกาเบิกจ่ายเงิน',
    stepNo: 10,
    detailTab: 6,
    attachmentCategory: 'disbursement',
    targetSummary: 'เพิ่มรายการฎีกาเบิกจ่ายเงินและแนบไฟล์หมวดเบิกจ่าย'
  },
  remuneration: {
    code: 'remuneration',
    label: 'เบิกค่าตอบแทนกรรมการ',
    stepNo: 11,
    detailTab: 6,
    attachmentCategory: 'remuneration',
    targetSummary: 'เพิ่มรายการเบิกค่าตอบแทนกรรมการและแนบไฟล์หมวดค่าตอบแทน'
  },
  other: {
    code: 'other',
    label: 'เอกสารประกอบทั่วไป',
    stepNo: null,
    detailTab: 1,
    attachmentCategory: 'other',
    targetSummary: 'แนบไฟล์เข้าคลังเอกสารโครงการโดยไม่เปลี่ยนแปลงขั้นตอน'
  }
};

export interface SarabanReviewOverrides {
  targetProjectId: string;
  bookNo: string;
  bookDate: string; // YYYY-MM-DD
  torAuthor: string;
  refPrice: string;
  supervisorName: string;
  contractAmount: string;
  contractorName: string;
  startDate: string;
  endDate: string;
  actualWorkDate: string;
  installment: number;
  actualDeliveryDate: string;
  inspectionResult: 'pass' | 'fail' | 'need_revision';
  details: string;
  amount: string;
  paymentStatus: 'pending' | 'paid';
  remunerationType: CommitteeRemuneration['type'];
  remunerationTitle: string;
  payeeName: string;
}

export function normalizeIsoDate(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  const match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    let yr = Number(match[1]);
    if (yr > 2400) yr -= 543;
    const mm = String(Number(match[2])).padStart(2, '0');
    const dd = String(Number(match[3])).padStart(2, '0');
    return `${yr}-${mm}-${dd}`;
  }
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    let yr = d.getFullYear();
    if (yr > 2400) yr -= 543;
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mm}-${dd}`;
  }
  return trimmed;
}

export function buildDefaultReviewOverrides(
  item: SarabanQueueItem,
  matchedProjectId?: string
): SarabanReviewOverrides {
  const p = item.payload || {};
  const isoBookDate = normalizeIsoDate(item.bookDate);
  const inspectionResult: 'pass' | 'fail' | 'need_revision' =
    p.result === 'fail' || p.result === 'need_revision' ? p.result : 'pass';
  const remunerationType: CommitteeRemuneration['type'] =
    p.type === 'tor_author' || p.type === 'tor' || p.type === 'supervisor' || p.type === 'inspection'
      ? p.type
      : 'inspection';
  const sarabanNote = String(p.details || p.notes || '').trim();

  return {
    targetProjectId: matchedProjectId || item.projectId || '',
    bookNo: item.bookNo || '',
    bookDate: isoBookDate,
    torAuthor: String(p.torAuthor || ''),
    refPrice: p.refPrice !== undefined && p.refPrice !== null ? String(p.refPrice) : '',
    supervisorName: String(p.supervisorName || ''),
    contractAmount: p.contractAmount !== undefined && p.contractAmount !== null ? String(p.contractAmount) : '',
    contractorName: String(p.contractorName || ''),
    startDate: normalizeIsoDate(p.startDate),
    endDate: normalizeIsoDate(p.endDate),
    actualWorkDate: normalizeIsoDate(p.actualWorkDate),
    installment: Number(p.installment) > 0 ? Number(p.installment) : 1,
    actualDeliveryDate: normalizeIsoDate(p.actualDeliveryDate) || isoBookDate,
    inspectionResult,
    details: sarabanNote || getDefaultDetailsForSarabanCategory(item.docCategory, inspectionResult),
    amount: p.amount !== undefined && p.amount !== null ? String(p.amount) : '',
    paymentStatus: p.status === 'paid' ? 'paid' : 'pending',
    remunerationType,
    remunerationTitle: String(p.title || '').trim() || DEFAULT_REMUNERATION_TITLES[remunerationType],
    payeeName: String(p.payeeName || '')
  };
}

export function applySarabanQueueToProject(
  project: Project,
  item: SarabanQueueItem,
  overrides?: SarabanReviewOverrides
): Project {
  const ov = overrides || buildDefaultReviewOverrides(item, project.id);
  const meta = SARABAN_DOC_CATEGORY_META[item.docCategory] || SARABAN_DOC_CATEGORY_META.other;
  const nowIso = new Date().toISOString();
  const nowThai = formatThaiDateTime();
  const bookNo = ov.bookNo.trim();
  const bookDate = normalizeIsoDate(ov.bookDate) || nowIso.slice(0, 10);

  // Build attachment if fileUrl is present
  const existingAttachments = Array.isArray(project.attachments) ? [...project.attachments] : [];
  let newAttachment: AttachmentFile | null = null;

  if (item.fileUrl && item.fileUrl.trim()) {
    const cleanUrl = item.fileUrl.trim();
    const alreadyExists = existingAttachments.some(
      a => a.url === cleanUrl && a.category === meta.attachmentCategory
    );
    if (!alreadyExists) {
      newAttachment = {
        id: `saraban-${item.queueId}`,
        name: item.fileName || `${meta.label}${bookNo ? `_${bookNo}` : ''}.pdf`,
        size: Number(item.fileSize) || 0,
        type: item.mimeType || 'application/pdf',
        category: meta.attachmentCategory,
        uploadDate: bookDate || nowIso.slice(0, 10),
        url: cleanUrl
      };
      existingAttachments.push(newAttachment);
    }
  }

  let updated: Project = {
    ...project,
    attachments: existingAttachments,
    fileUrl: project.fileUrl || newAttachment?.url,
    fileName: project.fileName || newAttachment?.name,
    updatedAt: nowIso
  };

  switch (item.docCategory) {
    case 'project_approval':
      updated = {
        ...updated,
        approvalRequestNo: bookNo || updated.approvalRequestNo,
        approvalRequestDate: bookDate || updated.approvalRequestDate
      };
      break;

    case 'tor_order':
      updated = {
        ...updated,
        torOrderNo: bookNo || updated.torOrderNo,
        torOrderDate: bookDate || updated.torOrderDate
      };
      break;

    case 'tor_approval':
      updated = {
        ...updated,
        torDate: bookDate || updated.torDate,
        torAuthor: ov.torAuthor.trim() || updated.torAuthor
      };
      break;

    case 'ref_price': {
      const parsedRef = Number(ov.refPrice);
      updated = {
        ...updated,
        refPriceDate: bookDate || updated.refPriceDate,
        refPrice: !isNaN(parsedRef) && parsedRef > 0 ? parsedRef : updated.refPrice
      };
      break;
    }

    case 'inspect_order':
      updated = {
        ...updated,
        inspectOrderNo: bookNo || updated.inspectOrderNo,
        inspectOrderDate: bookDate || updated.inspectOrderDate,
        supervisorName: ov.supervisorName.trim() || updated.supervisorName
      };
      break;

    case 'contract': {
      const parsedContract = Number(ov.contractAmount);
      updated = {
        ...updated,
        contractNo: bookNo || updated.contractNo,
        contractDate: bookDate || updated.contractDate,
        contractAmount: !isNaN(parsedContract) && parsedContract > 0 ? parsedContract : updated.contractAmount,
        contractorName: ov.contractorName.trim() || updated.contractorName,
        startDate: ov.startDate || updated.startDate,
        endDate: ov.endDate || updated.endDate
      };
      break;
    }

    case 'work_notice': {
      const list = Array.isArray(updated.workNotices) ? [...updated.workNotices] : [];
      const rec: WorkNotice = {
        id: `wn-${item.queueId}`,
        bookNo: bookNo || '-',
        bookDate,
        actualWorkDate: ov.actualWorkDate || '',
        notes: ov.details.trim(),
        attachments: newAttachment ? [newAttachment] : undefined
      };
      const dupIdx = list.findIndex(w => w.id === rec.id);
      if (dupIdx >= 0) list[dupIdx] = rec;
      else list.push(rec);
      updated = { ...updated, workNotices: list };
      break;
    }

    case 'delivery': {
      const list = Array.isArray(updated.deliveries) ? [...updated.deliveries] : [];
      const rec: DeliveryRecord = {
        id: `del-${item.queueId}`,
        installment: ov.installment || 1,
        bookNo: bookNo || '-',
        bookDate,
        actualDeliveryDate: ov.actualDeliveryDate || bookDate,
        details: ov.details.trim() || DEFAULT_DELIVERY_DETAILS,
        attachments: newAttachment ? [newAttachment] : undefined
      };
      const dupIdx = list.findIndex(d => d.id === rec.id);
      if (dupIdx >= 0) list[dupIdx] = rec;
      else list.push(rec);
      updated = { ...updated, deliveries: list };
      break;
    }

    case 'inspection': {
      const list = Array.isArray(updated.inspections) ? [...updated.inspections] : [];
      const insResult = ov.inspectionResult || 'pass';
      const rec: InspectionRecord = {
        id: `ins-${item.queueId}`,
        installment: ov.installment || 1,
        inspectionDate: bookDate,
        result: insResult,
        details: ov.details.trim() || DEFAULT_INSPECTION_DETAILS_BY_RESULT[insResult],
        attachments: newAttachment ? [newAttachment] : undefined
      };
      const dupIdx = list.findIndex(i => i.id === rec.id);
      if (dupIdx >= 0) list[dupIdx] = rec;
      else list.push(rec);
      updated = { ...updated, inspections: list };
      break;
    }

    case 'disbursement': {
      const list = Array.isArray(updated.disbursements) ? [...updated.disbursements] : [];
      const parsedAmt = Number(ov.amount);
      const rec: DisbursementRecord = {
        id: `dis-${item.queueId}`,
        installment: ov.installment || 1,
        disbursementDate: bookDate,
        petitionNo: bookNo || '-',
        amount: !isNaN(parsedAmt) ? parsedAmt : 0,
        status: ov.paymentStatus || 'pending',
        attachments: newAttachment ? [newAttachment] : undefined
      };
      const dupIdx = list.findIndex(d => d.id === rec.id);
      if (dupIdx >= 0) list[dupIdx] = rec;
      else list.push(rec);
      updated = { ...updated, disbursements: list };
      break;
    }

    case 'remuneration': {
      const list = Array.isArray(updated.remunerations) ? [...updated.remunerations] : [];
      const parsedAmt = Number(ov.amount);
      const remType = ov.remunerationType || 'inspection';
      const rec: CommitteeRemuneration = {
        id: `rem-${item.queueId}`,
        type: remType,
        title: ov.remunerationTitle.trim() || DEFAULT_REMUNERATION_TITLES[remType],
        payeeName: ov.payeeName || '',
        amount: !isNaN(parsedAmt) ? parsedAmt : 0,
        withdrawDate: bookDate,
        petitionNo: bookNo || '-',
        status: ov.paymentStatus || 'pending',
        attachments: newAttachment ? [newAttachment] : undefined
      };
      const dupIdx = list.findIndex(r => r.id === rec.id);
      if (dupIdx >= 0) list[dupIdx] = rec;
      else list.push(rec);
      updated = { ...updated, remunerations: list };
      break;
    }

    case 'other':
    default:
      break;
  }

  // Recalculate workflow status & 12-stage progress
  const derivedStatus =
    project.status === 'completed' ? 'completed' : deriveProjectStatusFromData(updated);
  const progressPercent = calculateProjectProgress({
    ...updated,
    status: derivedStatus
  });

  return {
    ...updated,
    status: derivedStatus,
    progressPercent,
    statusUpdatedAt:
      derivedStatus !== project.status ? nowThai : project.statusUpdatedAt || nowThai
  };
}

/**
 * Remove records & attachment previously applied by a SarabanQueueItem (used when deleting an already-approved queue item)
 */
export function rollbackSarabanQueueFromProject(
  project: Project,
  item: SarabanQueueItem
): Project {
  const attId = `saraban-${item.queueId}`;
  const isoBookDate = normalizeIsoDate(item.bookDate);
  const cleanBookNo = (item.bookNo || '').trim();
  const cleanFileUrl = (item.fileUrl || '').trim();

  const nextAttachments = (project.attachments || []).filter(a => {
    if (a.id === attId) return false;
    if (cleanFileUrl && a.url === cleanFileUrl && a.id?.startsWith('saraban-')) return false;
    return true;
  });

  let updated: Project = {
    ...project,
    attachments: nextAttachments,
    fileUrl: project.fileUrl && cleanFileUrl && project.fileUrl === cleanFileUrl ? undefined : project.fileUrl,
    fileName: project.fileUrl && cleanFileUrl && project.fileUrl === cleanFileUrl ? undefined : project.fileName,
    workNotices: (project.workNotices || []).filter(w => w.id !== `wn-${item.queueId}`),
    deliveries: (project.deliveries || []).filter(d => d.id !== `del-${item.queueId}`),
    inspections: (project.inspections || []).filter(i => i.id !== `ins-${item.queueId}`),
    disbursements: (project.disbursements || []).filter(d => d.id !== `dis-${item.queueId}`),
    remunerations: (project.remunerations || []).filter(r => r.id !== `rem-${item.queueId}`),
    updatedAt: new Date().toISOString()
  };

  if (item.docCategory === 'project_approval') {
    if (updated.approvalRequestNo === cleanBookNo) updated.approvalRequestNo = undefined;
    if (updated.approvalRequestDate === isoBookDate) updated.approvalRequestDate = undefined;
  } else if (item.docCategory === 'tor_order') {
    if (updated.torOrderNo === cleanBookNo) updated.torOrderNo = undefined;
    if (updated.torOrderDate === isoBookDate) updated.torOrderDate = undefined;
  } else if (item.docCategory === 'tor_approval') {
    if (updated.torDate === isoBookDate) updated.torDate = undefined;
  } else if (item.docCategory === 'ref_price') {
    if (updated.refPriceDate === isoBookDate) updated.refPriceDate = undefined;
  } else if (item.docCategory === 'inspect_order') {
    if (updated.inspectOrderNo === cleanBookNo) updated.inspectOrderNo = undefined;
    if (updated.inspectOrderDate === isoBookDate) updated.inspectOrderDate = undefined;
  } else if (item.docCategory === 'contract') {
    if (updated.contractNo === cleanBookNo) updated.contractNo = undefined;
    if (updated.contractDate === isoBookDate) updated.contractDate = undefined;
  }

  const derivedStatus =
    project.status === 'completed' && nextAttachments.length === (project.attachments || []).length
      ? 'completed'
      : deriveProjectStatusFromData(updated);
  const progressPercent = calculateProjectProgress({
    ...updated,
    status: derivedStatus
  });

  return {
    ...updated,
    status: derivedStatus,
    progressPercent,
    statusUpdatedAt: formatThaiDateTime()
  };
}

export const SARABAN_GAS_ADDON_SNIPPET = `// ============================================================================
// ส่วนเสริม Google Apps Script สำหรับเชื่อมต่อระบบสารบรรณ (แนวทาง B: SarabanQueue)
// วิธีติดตั้ง:
// 1) นำฟังก์ชันด้านล่างไปวางต่อท้ายไฟล์ Code.gs ของโปรเจกต์ Google Apps Script เดิม
// 2) เพิ่มเคสใน doGet(e):
//      if (action === 'getProjectOptions') return handleGetProjectOptions_(e);
//      if (action === 'getSarabanQueue')   return handleGetSarabanQueue_(e);
// 3) เพิ่มเคสใน doPost(e):
//      if (action === 'getProjectOptions')   return handleGetProjectOptions_({ parameter: payload });
//      if (action === 'pushSarabanQueue')    return handlePushSarabanQueue_(payload);
//      if (action === 'getSarabanQueue')     return handleGetSarabanQueue_({ parameter: payload });
//      if (action === 'resolveSarabanQueue') return handleResolveSarabanQueue_(payload);
//      if (action === 'deleteSarabanQueue')  return handleDeleteSarabanQueue_(payload);
// 4) กด Deploy > Manage deployments > แก้ไขเป็น New version แล้วกด Deploy
// ============================================================================

var SARABAN_QUEUE_SHEET_NAME = 'SarabanQueue';
var SARABAN_QUEUE_HEADERS = [
  'queueId', 'idempotencyKey', 'createdAt', 'projectId', 'projectCode',
  'fiscalYear', 'docCategory', 'bookNo', 'bookDate', 'subject',
  'payloadJson', 'fileName', 'fileUrl', 'fileSize', 'mimeType',
  'submittedBy', 'queueStatus', 'reviewedBy', 'reviewedAt', 'rejectReason'
];

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizeIsoDateGas_(raw) {
  if (!raw) return '';
  var s = String(raw).trim();
  var m = s.match(/^(\\d{4})-(\\d{1,2})-(\\d{1,2})/);
  if (m) {
    var yr = Number(m[1]);
    if (yr > 2400) yr -= 543;
    var mm = ('0' + Number(m[2])).slice(-2);
    var dd = ('0' + Number(m[3])).slice(-2);
    return yr + '-' + mm + '-' + dd;
  }
  return s;
}

function getOrCreateSarabanQueueSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SARABAN_QUEUE_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SARABAN_QUEUE_SHEET_NAME);
    sheet.appendRow(SARABAN_QUEUE_HEADERS);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(SARABAN_QUEUE_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readProjectsFromRegistry_(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName || 'ทะเบียนโครงการ');
  if (!sheet || sheet.getLastRow() < 2) return [];

  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var projects = [];

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var parsedObj = null;

    // 1) รองรับกรณีเก็บ JSON String ทั้งก้อนในคอลัมน์ใดคอลัมน์หนึ่ง
    for (var c = row.length - 1; c >= 0; c--) {
      var cell = row[c];
      if (typeof cell === 'string' && cell.trim().charAt(0) === '{') {
        try {
          var tmp = JSON.parse(cell);
          if (tmp && (tmp.id || tmp.projectCode || tmp.name)) {
            parsedObj = tmp;
            break;
          }
        } catch (err) {}
      }
    }

    // 2) Fallback: อ่านตามชื่อหัวคอลัมน์
    if (!parsedObj) {
      var rowObj = {};
      for (var i = 0; i < headers.length; i++) {
        if (headers[i]) rowObj[headers[i]] = row[i];
      }
      if (rowObj.id || rowObj.projectCode || rowObj.name) {
        parsedObj = rowObj;
      }
    }

    if (parsedObj) projects.push(parsedObj);
  }
  return projects;
}

// Endpoint 1: GET ?action=getProjectOptions&fiscalYear=all
function handleGetProjectOptions_(e) {
  var params = (e && e.parameter) || {};
  var fiscalYear = params.fiscalYear ? String(params.fiscalYear).trim() : 'all';
  var sheetName = params.sheetName || 'ทะเบียนโครงการ';
  var projects = (typeof readProjectsFromSheet === 'function')
    ? readProjectsFromSheet(sheetName)
    : readProjectsFromRegistry_(sheetName);

  var options = [];
  for (var i = 0; i < projects.length; i++) {
    var p = projects[i];
    if (fiscalYear && fiscalYear !== 'all' && String(p.fiscalYear) !== fiscalYear) {
      continue;
    }
    options.push({
      id: String(p.id || ''),
      projectCode: String(p.projectCode || ''),
      fiscalYear: Number(p.fiscalYear) || 0,
      name: String(p.name || ''),
      status: String(p.status || 'not_started'),
      contractNo: String(p.contractNo || '')
    });
  }

  return jsonOut_({ status: 'success', count: options.length, data: options });
}

// Endpoint 2: POST action: "pushSarabanQueue"
function handlePushSarabanQueue_(body) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sheet = getOrCreateSarabanQueueSheet_();
    var values = sheet.getDataRange().getValues();
    var idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey).trim() : '';

    // ตรวจสอบกันส่งซ้ำ
    if (idempotencyKey && values.length > 1) {
      for (var r = 1; r < values.length; r++) {
        var existingKey = String(values[r][1] || '').trim();
        var existingStatus = String(values[r][16] || '').trim();
        if (existingKey === idempotencyKey && (existingStatus === 'pending' || existingStatus === 'approved')) {
          return jsonOut_({
            status: 'success',
            queueId: String(values[r][0]),
            queueStatus: existingStatus,
            duplicated: true,
            message: 'รายการนี้ถูกส่งเข้าคิวไว้แล้ว (' + values[r][0] + ')'
          });
        }
      }
    }

    var now = new Date();
    var dateCode = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyyMMdd');
    var seq = 1;
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0] || '').indexOf('SQ-' + dateCode + '-') === 0) seq++;
    }
    var queueId = 'SQ-' + dateCode + '-' + ('000' + seq).slice(-3);

    var att = body.attachment || {};
    var payloadStr = JSON.stringify(body.payload || {});
    var newRow = [
      queueId,
      idempotencyKey,
      now.toISOString(),
      String(body.projectId || ''),
      String(body.projectCode || ''),
      Number(body.fiscalYear) || '',
      String(body.docCategory || 'other'),
      String(body.bookNo || ''),
      normalizeIsoDateGas_(body.bookDate),
      String(body.subject || ''),
      payloadStr,
      String(att.fileName || ''),
      String(att.fileUrl || ''),
      Number(att.fileSize) || 0,
      String(att.mimeType || ''),
      String(body.submittedBy || ''),
      'pending',
      '',
      '',
      ''
    ];

    sheet.appendRow(newRow);
    return jsonOut_({
      status: 'success',
      queueId: queueId,
      queueStatus: 'pending',
      duplicated: false,
      message: 'ส่งรายการเข้าคิวรอยืนยันในระบบโครงการเรียบร้อยแล้ว'
    });
  } finally {
    lock.releaseLock();
  }
}

// Endpoint 3: GET ?action=getSarabanQueue&queueStatus=pending|all
function handleGetSarabanQueue_(e) {
  var params = (e && e.parameter) || {};
  var filterStatus = params.queueStatus ? String(params.queueStatus).trim() : 'all';
  var sheet = getOrCreateSarabanQueueSheet_();
  var values = sheet.getDataRange().getValues();
  var items = [];
  var pendingCount = 0;

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var qId = String(row[0] || '').trim();
    if (!qId) continue;

    var qStatus = String(row[16] || 'pending').trim();
    if (qStatus === 'pending') pendingCount++;
    if (filterStatus !== 'all' && qStatus !== filterStatus) continue;

    var parsedPayload = {};
    try {
      parsedPayload = row[10] ? JSON.parse(String(row[10])) : {};
    } catch (err) {}

    items.push({
      queueId: qId,
      idempotencyKey: String(row[1] || ''),
      createdAt: row[2] instanceof Date ? row[2].toISOString() : String(row[2] || ''),
      projectId: String(row[3] || ''),
      projectCode: String(row[4] || ''),
      fiscalYear: Number(row[5]) || 0,
      docCategory: String(row[6] || 'other'),
      bookNo: String(row[7] || ''),
      bookDate: row[8] instanceof Date
        ? Utilities.formatDate(row[8], 'Asia/Bangkok', 'yyyy-MM-dd')
        : String(row[8] || ''),
      subject: String(row[9] || ''),
      payload: parsedPayload,
      fileName: String(row[11] || ''),
      fileUrl: String(row[12] || ''),
      fileSize: Number(row[13]) || 0,
      mimeType: String(row[14] || ''),
      submittedBy: String(row[15] || ''),
      queueStatus: qStatus,
      reviewedBy: String(row[17] || ''),
      reviewedAt: row[18] instanceof Date ? row[18].toISOString() : String(row[18] || ''),
      rejectReason: String(row[19] || '')
    });
  }

  items.reverse(); // ล่าสุดอยู่บนสุด
  return jsonOut_({ status: 'success', pendingCount: pendingCount, data: items });
}

// Endpoint 4: POST action: "resolveSarabanQueue"
function handleResolveSarabanQueue_(body) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var queueId = String(body.queueId || '').trim();
    var decision = String(body.decision || '').trim();
    if (!queueId || (decision !== 'approve' && decision !== 'reject')) {
      return jsonOut_({ status: 'error', message: 'Invalid queueId or decision' });
    }

    var sheet = getOrCreateSarabanQueueSheet_();
    var values = sheet.getDataRange().getValues();
    var targetRow = -1;

    for (var r = 1; r < values.length; r++) {
      if (String(values[r][0] || '').trim() === queueId) {
        targetRow = r + 1;
        break;
      }
    }

    if (targetRow < 0) {
      return jsonOut_({ status: 'error', message: 'ไม่พบรายการคิว ' + queueId });
    }

    var nextStatus = decision === 'approve' ? 'approved' : 'rejected';
    var reviewedAt = new Date().toISOString();

    sheet.getRange(targetRow, 17).setValue(nextStatus);
    sheet.getRange(targetRow, 18).setValue(String(body.reviewedBy || ''));
    sheet.getRange(targetRow, 19).setValue(reviewedAt);
    sheet.getRange(targetRow, 20).setValue(decision === 'reject' ? String(body.rejectReason || '') : '');

    return jsonOut_({
      status: 'success',
      queueId: queueId,
      queueStatus: nextStatus,
      reviewedAt: reviewedAt
    });
  } finally {
    lock.releaseLock();
  }
}

// Endpoint 5: POST action: "deleteSarabanQueue"
function handleDeleteSarabanQueue_(body) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var queueId = String(body.queueId || '').trim();
    var idempotencyKey = String(body.idempotencyKey || '').trim();
    var sheet = getOrCreateSarabanQueueSheet_();
    var values = sheet.getDataRange().getValues();
    var targetRow = -1;
    var rowData = null;

    for (var r = 1; r < values.length; r++) {
      var rQueueId = String(values[r][0] || '').trim();
      var rIdemKey = String(values[r][1] || '').trim();
      if ((queueId && rQueueId === queueId) || (!queueId && idempotencyKey && rIdemKey === idempotencyKey)) {
        targetRow = r + 1;
        rowData = values[r];
        queueId = rQueueId;
        break;
      }
    }

    if (targetRow < 0) {
      return jsonOut_({
        status: 'success',
        deleted: false,
        queueId: queueId,
        message: 'ไม่พบรายการคิวในชีต (อาจถูกลบไปแล้ว)'
      });
    }

    var prevStatus = String(rowData[16] || '').trim();
    var rowProjectId = String(body.projectId || rowData[3] || '').trim();
    var rowProjectCode = String(rowData[4] || '').trim();
    var rowDocCat = String(body.docCategory || rowData[6] || '').trim();
    var rowBookNo = String(rowData[7] || '').trim();
    var rowBookDate = normalizeIsoDateGas_(rowData[8]);
    var rowFileUrl = String(rowData[12] || '').trim();
    var rolledBackProject = false;

    if (prevStatus === 'approved' && typeof readProjectsFromSheet === 'function' && typeof writeProjectsToSheet === 'function') {
      var projects = readProjectsFromSheet();
      if (body.updatedProject && body.updatedProject.id) {
        var updIdx = projects.findIndex(function(p) {
          return String(p.id) === String(body.updatedProject.id);
        });
        if (updIdx >= 0) {
          projects[updIdx] = body.updatedProject;
          writeProjectsToSheet(projects);
          rolledBackProject = true;
        }
      } else {
        var pIdx = projects.findIndex(function(p) {
          if (rowProjectId && String(p.id) === rowProjectId) return true;
          if (rowProjectCode && String(p.projectCode || '').trim() === rowProjectCode) return true;
          return false;
        });
        if (pIdx >= 0) {
          var proj = projects[pIdx];
          proj.attachments = (proj.attachments || []).filter(function(a) {
            if (a.id === 'saraban-' + queueId) return false;
            if (rowFileUrl && a.url === rowFileUrl && String(a.id || '').indexOf('saraban-') === 0) return false;
            return true;
          });
          proj.workNotices = (proj.workNotices || []).filter(function(w) { return w.id !== 'wn-' + queueId; });
          proj.deliveries = (proj.deliveries || []).filter(function(d) { return d.id !== 'del-' + queueId; });
          proj.inspections = (proj.inspections || []).filter(function(i) { return i.id !== 'ins-' + queueId; });
          proj.disbursements = (proj.disbursements || []).filter(function(d) { return d.id !== 'dis-' + queueId; });
          proj.remunerations = (proj.remunerations || []).filter(function(r) { return r.id !== 'rem-' + queueId; });
          if (rowDocCat === 'project_approval') {
            if (proj.approvalRequestNo === rowBookNo) proj.approvalRequestNo = '';
            if (proj.approvalRequestDate === rowBookDate) proj.approvalRequestDate = '';
          }
          if (rowDocCat === 'tor_order' && proj.torOrderNo === rowBookNo) proj.torOrderNo = '';
          if (rowDocCat === 'tor_approval' && proj.torDate === rowBookDate) proj.torDate = '';
          if (rowDocCat === 'ref_price' && proj.refPriceDate === rowBookDate) proj.refPriceDate = '';
          if (rowDocCat === 'inspect_order' && proj.inspectOrderNo === rowBookNo) proj.inspectOrderNo = '';
          if (rowDocCat === 'contract' && proj.contractNo === rowBookNo) proj.contractNo = '';
          projects[pIdx] = proj;
          writeProjectsToSheet(projects);
          rolledBackProject = true;
        }
      }
    }

    sheet.deleteRow(targetRow);

    return jsonOut_({
      status: 'success',
      deleted: true,
      queueId: queueId,
      rolledBackProject: rolledBackProject,
      message: 'ลบรายการคิวเรียบร้อยแล้ว'
    });
  } finally {
    lock.releaseLock();
  }
}`;
