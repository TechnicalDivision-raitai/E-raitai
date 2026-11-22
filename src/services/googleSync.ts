import { Project, RepairRequest, SarabanQueueItem, SarabanQueueStatus } from '../types/project';

export const DEFAULT_GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzzWSWjjgNcPJ69Rvacq6uGZPE36RAO-JCpqwC6favyCPKjEpmNIjqjz7uEgdS6SGf5/exec';

export const DEFAULT_SHEET_NAME = 'ทะเบียนโครงการ';
export const DEFAULT_REPAIR_SHEET_NAME = 'ทะเบียนคำร้องซ่อมแซม';
export const DEFAULT_DRIVE_FOLDER_ID = '1ipu4fVApRwLvi_jJlJaFSB_Mlsl5PU1X';
export const DEFAULT_DRIVE_FOLDER_NAME = 'เอกสารโครงการกองช่าง_อบต.ไร่ใต้';

export function getGoogleScriptUrl(): string {
  return DEFAULT_GOOGLE_SCRIPT_URL;
}

/**
 * Fetch all projects from Google Sheet (Primary Database)
 */
export async function fetchProjectsFromGoogleSheet(): Promise<{
  success: boolean;
  projects?: Project[];
  count?: number;
  error?: string;
}> {
  const scriptUrl = DEFAULT_GOOGLE_SCRIPT_URL;

  try {
    const params = new URLSearchParams({
      action: 'getProjects',
      sheetName: DEFAULT_SHEET_NAME,
      t: String(Date.now())
    });

    const res = await fetch(`${scriptUrl}?${params.toString()}`, {
      method: 'GET',
      redirect: 'follow'
    });

    if (res.ok) {
      const result = await res.json();
      if (result && result.status === 'success' && Array.isArray(result.data)) {
        return { success: true, projects: result.data, count: result.data.length };
      }
    }
  } catch (err) {
    console.warn('GET getProjects failed, trying POST getProjects...', err);
  }

  try {
    const postRes = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'getProjects',
        sheetName: DEFAULT_SHEET_NAME
      }),
      redirect: 'follow'
    });

    if (postRes.ok) {
      const result = await postRes.json();
      if (result && result.status === 'success' && Array.isArray(result.data)) {
        return { success: true, projects: result.data, count: result.data.length };
      }
    }
  } catch (postErr: any) {
    return {
      success: false,
      error: `ไม่สามารถดึงข้อมูลจาก Google Sheet ได้: ${postErr?.message || 'ข้อผิดพลาดเครือข่าย'}`
    };
  }

  return {
    success: false,
    error: 'Google Sheet ส่งข้อมูลกลับมาไม่ถูกต้อง'
  };
}

/**
 * Sync and save all projects to Google Sheet (Primary Database)
 */
export async function syncProjectsToGoogleSheet(
  projects: Project[]
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    // Strip large local base64 previewDataUrl when a cloud Drive URL is present so Google Sheet cells never exceed 50,000 chars
    const cloudSafeProjects = projects.map(p => {
      if (!p.projectRecord?.files?.length) return p;
      return {
        ...p,
        projectRecord: {
          ...p.projectRecord,
          files: p.projectRecord.files.map(f => {
            if (f.url && f.url.startsWith('http')) {
              const { previewDataUrl: _omit, ...rest } = f;
              return rest;
            }
            return f;
          })
        }
      };
    });

    const response = await fetch(DEFAULT_GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action: 'syncProjects',
        projects: cloudSafeProjects,
        sheetName: DEFAULT_SHEET_NAME,
        timestamp: new Date().toISOString()
      }),
      redirect: 'follow'
    });

    if (response.ok) {
      const json = await response.json();
      if (json && json.status === 'success') {
        return { success: true, count: json.count || projects.length };
      }
      return { success: false, error: json?.message || 'Google Sheet ตอบกลับสถานะล้มเหลว' };
    }
    return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
  } catch (err: any) {
    return {
      success: false,
      error: `ส่งข้อมูลไป Google Sheet ล้มเหลว: ${err?.message || 'ข้อผิดพลาดเครือข่าย'}`
    };
  }
}

/**
 * Upload an attachment file to Google Drive via Google Apps Script
 */
export async function uploadFileToGoogleDrive(
  file: File,
  folderName: string = DEFAULT_DRIVE_FOLDER_NAME
): Promise<{ fileName: string; fileUrl: string; fileId?: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = async () => {
      try {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];

        const response = await fetch(DEFAULT_GOOGLE_SCRIPT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify({
            action: 'uploadFile',
            fileName: file.name,
            mimeType: file.type || 'application/pdf',
            fileData: base64Data,
            folderId: DEFAULT_DRIVE_FOLDER_ID,
            folderName
          }),
          redirect: 'follow'
        });

        if (response.ok) {
          const result = await response.json();
          if (result && result.status === 'success' && result.fileUrl) {
            resolve({
              fileName: file.name,
              fileUrl: result.fileUrl,
              fileId: result.fileId
            });
            return;
          }
        }

        const blobUrl = URL.createObjectURL(file);
        resolve({ fileName: file.name, fileUrl: blobUrl });
      } catch (err) {
        console.warn('Drive upload network error, fallback to blob URL:', err);
        const blobUrl = URL.createObjectURL(file);
        resolve({ fileName: file.name, fileUrl: blobUrl });
      }
    };

    reader.onerror = error => reject(error);
  });
}

/**
 * Fetch Saraban integration queue items from Google Sheet (`SarabanQueue`)
 */
export async function fetchSarabanQueue(
  queueStatus: SarabanQueueStatus | 'all' = 'all'
): Promise<{
  success: boolean;
  items?: SarabanQueueItem[];
  pendingCount?: number;
  needsScriptUpdate?: boolean;
  error?: string;
}> {
  const scriptUrl = DEFAULT_GOOGLE_SCRIPT_URL;

  const parseQueueResponse = (result: any) => {
    if (result && result.status === 'success' && Array.isArray(result.data)) {
      const items: SarabanQueueItem[] = result.data;
      const pendingCount =
        typeof result.pendingCount === 'number'
          ? result.pendingCount
          : items.filter(i => i.queueStatus === 'pending').length;
      return { success: true, items, pendingCount };
    }
    const msg = String(result?.message || result?.error || '');
    if (msg.toLowerCase().includes('unknown') && msg.toLowerCase().includes('action')) {
      return {
        success: false,
        needsScriptUpdate: true,
        error: 'Google Apps Script ยังไม่ได้อัปเดตเวอร์ชันสำหรับรับคิวสารบรรณ'
      };
    }
    return null;
  };

  try {
    const params = new URLSearchParams({
      action: 'getSarabanQueue',
      queueStatus,
      t: String(Date.now())
    });

    const res = await fetch(`${scriptUrl}?${params.toString()}`, {
      method: 'GET',
      redirect: 'follow'
    });

    if (res.ok) {
      const text = await res.text();
      try {
        const result = JSON.parse(text);
        const parsed = parseQueueResponse(result);
        if (parsed) return parsed;
      } catch {
        if (text.toLowerCase().includes('unknown') && text.toLowerCase().includes('action')) {
          return {
            success: false,
            needsScriptUpdate: true,
            error: 'Google Apps Script ยังไม่ได้อัปเดตเวอร์ชันสำหรับรับคิวสารบรรณ'
          };
        }
      }
    }
  } catch (err) {
    console.warn('GET getSarabanQueue failed, trying POST getSarabanQueue...', err);
  }

  try {
    const postRes = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'getSarabanQueue',
        queueStatus
      }),
      redirect: 'follow'
    });

    if (postRes.ok) {
      const text = await postRes.text();
      try {
        const result = JSON.parse(text);
        const parsed = parseQueueResponse(result);
        if (parsed) return parsed;
      } catch {
        if (text.toLowerCase().includes('unknown') && text.toLowerCase().includes('action')) {
          return {
            success: false,
            needsScriptUpdate: true,
            error: 'Google Apps Script ยังไม่ได้อัปเดตเวอร์ชันสำหรับรับคิวสารบรรณ'
          };
        }
      }
    }
  } catch (postErr: any) {
    return {
      success: false,
      error: `ไม่สามารถดึงคิวจากสารบรรณได้: ${postErr?.message || 'ข้อผิดพลาดเครือข่าย'}`
    };
  }

  return {
    success: false,
    error: 'Google Sheet ส่งข้อมูลคิวสารบรรณกลับมาไม่ถูกต้อง'
  };
}

/**
 * Approve or Reject a Saraban Queue item via Google Apps Script
 */
export async function resolveSarabanQueue(params: {
  queueId: string;
  decision: 'approve' | 'reject';
  reviewedBy: string;
  updatedProject?: Project;
  rejectReason?: string;
}): Promise<{
  success: boolean;
  queueStatus?: SarabanQueueStatus;
  reviewedAt?: string;
  needsScriptUpdate?: boolean;
  error?: string;
}> {
  try {
    let cloudSafeProject = params.updatedProject;
    if (cloudSafeProject?.projectRecord?.files?.length) {
      cloudSafeProject = {
        ...cloudSafeProject,
        projectRecord: {
          ...cloudSafeProject.projectRecord,
          files: cloudSafeProject.projectRecord.files.map(f => {
            if (f.url && f.url.startsWith('http')) {
              const { previewDataUrl: _omit, ...rest } = f;
              return rest;
            }
            return f;
          })
        }
      };
    }

    const response = await fetch(DEFAULT_GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action: 'resolveSarabanQueue',
        queueId: params.queueId,
        decision: params.decision,
        reviewedBy: params.reviewedBy,
        updatedProject: cloudSafeProject,
        rejectReason: params.rejectReason || ''
      }),
      redirect: 'follow'
    });

    if (response.ok) {
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        if (json && json.status === 'success') {
          return {
            success: true,
            queueStatus: json.queueStatus,
            reviewedAt: json.reviewedAt
          };
        }
        const msg = String(json?.message || json?.error || '');
        if (msg.toLowerCase().includes('unknown') && msg.toLowerCase().includes('action')) {
          return {
            success: false,
            needsScriptUpdate: true,
            error: 'Google Apps Script ยังไม่ได้อัปเดตเวอร์ชันสำหรับยืนยันคิวสารบรรณ'
          };
        }
        return { success: false, error: msg || 'Google Sheet ตอบกลับสถานะล้มเหลว' };
      } catch {
        return { success: false, error: 'รูปแบบผลลัพธ์จาก Google Apps Script ไม่ถูกต้อง' };
      }
    }
    return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
  } catch (err: any) {
    return {
      success: false,
      error: `อัปเดตสถานะคิวสารบรรณล้มเหลว: ${err?.message || 'ข้อผิดพลาดเครือข่าย'}`
    };
  }
}

/**
 * Delete a Saraban Queue item (and optionally update/rollback the affected project)
 */
export async function deleteSarabanQueue(params: {
  queueId: string;
  idempotencyKey?: string;
  docId?: string;
  docCategory?: string;
  projectId?: string;
  updatedProject?: Project;
}): Promise<{
  success: boolean;
  deleted?: boolean;
  rolledBackProject?: boolean;
  needsScriptUpdate?: boolean;
  error?: string;
}> {
  try {
    let cloudSafeProject = params.updatedProject;
    if (cloudSafeProject?.projectRecord?.files?.length) {
      cloudSafeProject = {
        ...cloudSafeProject,
        projectRecord: {
          ...cloudSafeProject.projectRecord,
          files: cloudSafeProject.projectRecord.files.map(f => {
            if (f.url && f.url.startsWith('http')) {
              const { previewDataUrl: _omit, ...rest } = f;
              return rest;
            }
            return f;
          })
        }
      };
    }

    const response = await fetch(DEFAULT_GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action: 'deleteSarabanQueue',
        queueId: params.queueId,
        idempotencyKey: params.idempotencyKey || '',
        docId: params.docId || '',
        docCategory: params.docCategory || '',
        projectId: params.projectId || '',
        updatedProject: cloudSafeProject
      }),
      redirect: 'follow'
    });

    if (response.ok) {
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        if (json && json.status === 'success') {
          return {
            success: true,
            deleted: json.deleted !== false,
            rolledBackProject: Boolean(json.rolledBackProject)
          };
        }
        const msg = String(json?.message || json?.error || '');
        if (msg.toLowerCase().includes('unknown') && msg.toLowerCase().includes('action')) {
          return {
            success: false,
            needsScriptUpdate: true,
            error: 'Google Apps Script ยังไม่ได้อัปเดตเวอร์ชันสำหรับลบคิว (deleteSarabanQueue)'
          };
        }
        return { success: false, error: msg || 'Google Sheet ตอบกลับสถานะล้มเหลว' };
      } catch {
        return { success: false, error: 'รูปแบบผลลัพธ์จาก Google Apps Script ไม่ถูกต้อง' };
      }
    }
    return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
  } catch (err: any) {
    return {
      success: false,
      error: `ลบรายการคิวสารบรรณล้มเหลว: ${err?.message || 'ข้อผิดพลาดเครือข่าย'}`
    };
  }
}

/**
 * Strip oversized local base64 previews before writing RepairRequest JSON into Google Sheet cells (50,000-char limit)
 */
function sanitizeRepairRequestsForCloud(requests: RepairRequest[]): RepairRequest[] {
  return requests.map(req => {
    if (!req.attachments?.length) return req;
    return {
      ...req,
      attachments: req.attachments.map(att => {
        const hasCloudUrl = Boolean(att.url && att.url.startsWith('http'));
        const isTooLargeLocalPreview = Boolean(att.previewDataUrl && att.previewDataUrl.length > 20000);
        if (hasCloudUrl || isTooLargeLocalPreview) {
          const { previewDataUrl: _omit, ...rest } = att;
          return rest;
        }
        return att;
      })
    };
  });
}

/**
 * Fetch all repair requests from Google Sheet (`ทะเบียนคำร้องซ่อมแซม`)
 */
export async function fetchRepairRequestsFromGoogleSheet(): Promise<{
  success: boolean;
  repairRequests?: RepairRequest[];
  count?: number;
  sheetExists?: boolean;
  needsScriptUpdate?: boolean;
  error?: string;
}> {
  const scriptUrl = DEFAULT_GOOGLE_SCRIPT_URL;

  const parseRepairResponse = (result: any) => {
    if (result && result.status === 'success' && Array.isArray(result.data)) {
      return {
        success: true,
        repairRequests: result.data as RepairRequest[],
        count: result.data.length,
        sheetExists: result.sheetExists !== false
      };
    }
    const msg = String(result?.message || result?.error || '');
    if (msg.toLowerCase().includes('unknown') && msg.toLowerCase().includes('action')) {
      return {
        success: false,
        needsScriptUpdate: true,
        error: 'Google Apps Script ยังไม่ได้ติดตั้งฟังก์ชันซิงค์ใบคำร้องซ่อมแซม (getRepairRequests)'
      };
    }
    return null;
  };

  try {
    const params = new URLSearchParams({
      action: 'getRepairRequests',
      sheetName: DEFAULT_REPAIR_SHEET_NAME,
      t: String(Date.now())
    });

    const res = await fetch(`${scriptUrl}?${params.toString()}`, {
      method: 'GET',
      redirect: 'follow'
    });

    if (res.ok) {
      const text = await res.text();
      try {
        const result = JSON.parse(text);
        const parsed = parseRepairResponse(result);
        if (parsed) return parsed;
      } catch {
        if (text.toLowerCase().includes('unknown') && text.toLowerCase().includes('action')) {
          return {
            success: false,
            needsScriptUpdate: true,
            error: 'Google Apps Script ยังไม่ได้ติดตั้งฟังก์ชันซิงค์ใบคำร้องซ่อมแซม (getRepairRequests)'
          };
        }
      }
    }
  } catch (err) {
    console.warn('GET getRepairRequests failed, trying POST getRepairRequests...', err);
  }

  try {
    const postRes = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'getRepairRequests',
        sheetName: DEFAULT_REPAIR_SHEET_NAME
      }),
      redirect: 'follow'
    });

    if (postRes.ok) {
      const text = await postRes.text();
      try {
        const result = JSON.parse(text);
        const parsed = parseRepairResponse(result);
        if (parsed) return parsed;
      } catch {
        if (text.toLowerCase().includes('unknown') && text.toLowerCase().includes('action')) {
          return {
            success: false,
            needsScriptUpdate: true,
            error: 'Google Apps Script ยังไม่ได้ติดตั้งฟังก์ชันซิงค์ใบคำร้องซ่อมแซม (getRepairRequests)'
          };
        }
      }
    }
  } catch (postErr: any) {
    return {
      success: false,
      error: `ไม่สามารถดึงข้อมูลคำร้องซ่อมแซมจาก Google Sheet ได้: ${postErr?.message || 'ข้อผิดพลาดเครือข่าย'}`
    };
  }

  return {
    success: false,
    error: 'Google Sheet ส่งข้อมูลคำร้องซ่อมแซมกลับมาไม่ถูกต้อง'
  };
}

/**
 * Sync and save all repair requests to Google Sheet (`ทะเบียนคำร้องซ่อมแซม`)
 */
export async function syncRepairRequestsToGoogleSheet(
  requests: RepairRequest[]
): Promise<{
  success: boolean;
  count?: number;
  needsScriptUpdate?: boolean;
  error?: string;
}> {
  try {
    const cloudSafeRequests = sanitizeRepairRequestsForCloud(requests);

    const response = await fetch(DEFAULT_GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action: 'syncRepairRequests',
        repairRequests: cloudSafeRequests,
        sheetName: DEFAULT_REPAIR_SHEET_NAME,
        timestamp: new Date().toISOString()
      }),
      redirect: 'follow'
    });

    if (response.ok) {
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        if (json && json.status === 'success') {
          return { success: true, count: json.count ?? requests.length };
        }
        const msg = String(json?.message || json?.error || '');
        if (msg.toLowerCase().includes('unknown') && msg.toLowerCase().includes('action')) {
          return {
            success: false,
            needsScriptUpdate: true,
            error: 'Google Apps Script ยังไม่ได้ติดตั้งฟังก์ชันบันทึกคำร้องซ่อมแซม (syncRepairRequests)'
          };
        }
        return { success: false, error: msg || 'Google Sheet ตอบกลับสถานะล้มเหลว' };
      } catch {
        return { success: false, error: 'รูปแบบผลลัพธ์จาก Google Apps Script ไม่ถูกต้อง' };
      }
    }
    return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
  } catch (err: any) {
    return {
      success: false,
      error: `ส่งข้อมูลคำร้องซ่อมแซมไป Google Sheet ล้มเหลว: ${err?.message || 'ข้อผิดพลาดเครือข่าย'}`
    };
  }
}

/**
 * Copy-paste Google Apps Script add-on snippet for syncing Repair Requests across all devices
 */
export const REPAIR_REQUESTS_GAS_SNIPPET = `// =========================================================================
// ส่วนเสริม Google Apps Script สำหรับซิงค์ "คำร้อง/งานซ่อมแซม" ข้ามอุปกรณ์
// ชื่อชีตอัตโนมัติ: ทะเบียนคำร้องซ่อมแซม
// =========================================================================
// วิธีติดตั้งในไฟล์ Code.gs ของโปรเจกต์ Google Apps Script เดิม:
// 1) ในฟังก์ชัน doGet(e) เพิ่มก่อนบรรทัด return Unknown GET action:
//    if (action === 'getRepairRequests') {
//      return handleGetRepairRequests_(e && e.parameter ? e.parameter : {});
//    }
//
// 2) ในฟังก์ชัน doPost(e) เพิ่มก่อนบรรทัด return Unknown POST action:
//    if (action === 'getRepairRequests') {
//      return handleGetRepairRequests_(payload);
//    }
//    if (action === 'syncRepairRequests' || action === 'saveRepairRequests') {
//      return handleSyncRepairRequests_(payload);
//    }
//
// 3) วางฟังก์ชันด้านล่างต่อท้ายไฟล์ Code.gs แล้วกด Deploy > Manage deployments
//    > กดรูปดินสอ (Edit) > เลือก Version: New version > กด Deploy
// =========================================================================

const REPAIR_SHEET_NAME = 'ทะเบียนคำร้องซ่อมแซม';

function handleGetRepairRequests_(params) {
  const sheetName = (params && params.sheetName) || REPAIR_SHEET_NAME;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return createJsonResponse({
      status: 'success',
      sheetExists: false,
      count: 0,
      data: [],
      timestamp: new Date().toISOString()
    });
  }

  const items = readRepairRequestsFromSheet_(sheet);
  return createJsonResponse({
    status: 'success',
    sheetExists: true,
    count: items.length,
    data: items,
    timestamp: new Date().toISOString()
  });
}

function handleSyncRepairRequests_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheetName = (payload && payload.sheetName) || REPAIR_SHEET_NAME;
    const items = Array.isArray(payload && payload.repairRequests)
      ? payload.repairRequests
      : [];
    const count = writeRepairRequestsToSheet_(items, sheetName);
    return createJsonResponse({
      status: 'success',
      message: 'บันทึกข้อมูลคำร้องซ่อมแซมเข้า Google Sheet สำเร็จ',
      count: count,
      timestamp: new Date().toISOString()
    });
  } finally {
    lock.releaseLock();
  }
}

function readRepairRequestsFromSheet_(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0].map(function (h) { return String(h || '').trim(); });
  const jsonColIdx = headers.indexOf('ข้อมูลระบบฉบับเต็ม (JSON)');
  const items = [];

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (!row[0] && !row[5]) continue;

    var parsed = null;
    if (jsonColIdx >= 0 && row[jsonColIdx]) {
      try {
        parsed = JSON.parse(String(row[jsonColIdx]));
      } catch (e) {
        parsed = null;
      }
    }

    if (parsed && parsed.id) {
      items.push(parsed);
    }
  }
  return items;
}

function writeRepairRequestsToSheet_(items, sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName || REPAIR_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName || REPAIR_SHEET_NAME);
  }

  sheet.clear();

  const headers = [
    'รหัสคำร้อง',
    'ปีงบประมาณ',
    'เลขรับ อบต.',
    'เลขรับกองช่าง',
    'วันที่ยื่นคำร้อง',
    'เรื่อง/หัวข้อคำร้อง',
    'สายถนน/สถานที่',
    'หมู่ที่',
    'ประเภทผิวทาง',
    'ผู้ยื่นคำร้อง',
    'เบอร์โทรผู้ยื่น',
    'ความเร่งด่วน',
    'สถานะ',
    'ผู้รับผิดชอบ',
    'งบซ่อมแซม (บาท)',
    'วันที่แล้วเสร็จ',
    'จำนวนไฟล์แนบ',
    'ลิงก์ไฟล์ Google Drive',
    'ข้อมูลระบบฉบับเต็ม (JSON)',
    'วันที่ปรับปรุงล่าสุด'
  ];

  const rows = [headers];

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var attachments = item.attachments || [];
    var attLinks = attachments.map(function (a) {
      return (a.name || 'ไฟล์') + ': ' + (a.url || '');
    }).join('\\n');

    rows.push([
      item.requestCode || '',
      item.fiscalYear || '',
      item.obtReceiveNo || '',
      item.engReceiveNo || '',
      item.petitionDate || '',
      item.subject || '',
      item.roadName || '',
      item.villageNo || '',
      item.roadType || '',
      item.requesterName || '',
      item.requesterPhone || '',
      item.urgency || 'normal',
      item.status || 'received',
      item.assignedStaff || '',
      item.estimatedBudget || 0,
      item.repairCompletedDate || '',
      attachments.length,
      attLinks,
      JSON.stringify(item),
      new Date().toLocaleString('th-TH')
    ]);
  }

  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#155d96');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  sheet.setFrozenRows(1);

  return items.length;
}`;


