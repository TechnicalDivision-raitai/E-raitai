import { Project, AttachmentFile } from '../types/project';

export const DEFAULT_GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbyStljsOi5V1YVWAddO1hLihIZzur6GZ-WZ61EOYza7_DneqB72x1TYiuhiBbYjWKBh/exec';

const SCRIPT_URL_KEY = 'raitai_google_script_url_v6';
const AUTO_SYNC_KEY = 'raitai_auto_sync_enabled_v6';
const LAST_SYNC_KEY = 'raitai_last_sync_timestamp_v6';

/**
 * Get active Google Script Web App URL from localStorage or fallback to default
 */
export function getGoogleScriptUrl(): string {
  try {
    const saved = localStorage.getItem(SCRIPT_URL_KEY);
    return saved && saved.trim().length > 10 ? saved.trim() : DEFAULT_GOOGLE_SCRIPT_URL;
  } catch {
    return DEFAULT_GOOGLE_SCRIPT_URL;
  }
}

/**
 * Save custom Google Script Web App URL
 */
export function saveGoogleScriptUrl(url: string): void {
  try {
    localStorage.setItem(SCRIPT_URL_KEY, url.trim());
  } catch (e) {
    console.error('Failed to save Google Script URL', e);
  }
}

/**
 * Check if background auto-sync is enabled (default: true)
 */
export function getAutoSyncEnabled(): boolean {
  try {
    const val = localStorage.getItem(AUTO_SYNC_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setAutoSyncEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_SYNC_KEY, enabled ? 'true' : 'false');
  } catch (e) {
    console.error('Failed to save auto sync state', e);
  }
}

export function getLastSyncedTime(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

export function recordLastSyncedTime(): string {
  const now = new Date().toISOString();
  try {
    localStorage.setItem(LAST_SYNC_KEY, now);
  } catch {}
  return now;
}

/**
 * Test connection to the Google Apps Script Web App
 */
export async function testGoogleScriptConnection(
  customUrl?: string
): Promise<{ success: boolean; message: string; data?: any }> {
  const url = customUrl || getGoogleScriptUrl();

  try {
    // 1. Try GET ping
    const res = await fetch(`${url}?action=ping&t=${Date.now()}`, {
      method: 'GET',
      redirect: 'follow'
    });

    if (res.ok) {
      const json = await res.json();
      if (json && (json.status === 'success' || json.message)) {
        return { success: true, message: 'เชื่อมต่อ Google Apps Script สำเร็จ', data: json };
      }
    }
  } catch {
    // Fallback to POST ping with simple Content-Type to prevent CORS preflight error
    try {
      const postRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'ping' }),
        redirect: 'follow'
      });

      if (postRes.ok) {
        const json = await postRes.json();
        return { success: true, message: 'เชื่อมต่อ Google Apps Script ผ่าน POST สำเร็จ', data: json };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `ไม่สามารถเชื่อมต่อได้: ${err?.message || 'โปรดตรวจสอบการ Deploy Web App เป็น Anyone'}`
      };
    }
  }

  return {
    success: false,
    message: 'ไม่ได้รับการตอบรับแบบ JSON จาก Google Apps Script (โปรดตรวจสอบโค้ด Code.gs และสิทธิ์ Anyone)'
  };
}

/**
 * Fetch all projects from Google Sheet (Primary Database)
 */
export async function fetchProjectsFromGoogleSheet(
  customUrl?: string
): Promise<{ success: boolean; projects?: Project[]; count?: number; error?: string }> {
  const url = customUrl || getGoogleScriptUrl();

  try {
    // 1. Try GET action=getProjects
    const res = await fetch(`${url}?action=getProjects&t=${Date.now()}`, {
      method: 'GET',
      redirect: 'follow'
    });

    if (res.ok) {
      const result = await res.json();
      if (result && result.status === 'success' && Array.isArray(result.data)) {
        recordLastSyncedTime();
        return { success: true, projects: result.data, count: result.data.length };
      }
    }
  } catch (err) {
    console.warn('GET getProjects failed, trying POST getProjects...', err);
  }

  // 2. Try POST action=getProjects
  try {
    const postRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'getProjects' }),
      redirect: 'follow'
    });

    if (postRes.ok) {
      const result = await postRes.json();
      if (result && result.status === 'success' && Array.isArray(result.data)) {
        recordLastSyncedTime();
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
    error: 'Google Sheet ส่งข้อมูลกลับมาไม่ถูกต้อง หรือยังไม่มีสคริปต์ doGet/doPost ใน Apps Script'
  };
}

/**
 * Sync and save all projects to Google Sheet (Primary Database)
 */
export async function syncProjectsToGoogleSheet(
  projects: Project[],
  customUrl?: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  const url = customUrl || getGoogleScriptUrl();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action: 'syncProjects',
        projects: projects,
        timestamp: new Date().toISOString()
      }),
      redirect: 'follow'
    });

    if (response.ok) {
      const json = await response.json();
      if (json && json.status === 'success') {
        recordLastSyncedTime();
        return { success: true, count: json.count || projects.length };
      } else {
        return { success: false, error: json?.message || 'Google Sheet ตอบกลับสถานะล้มเหลว' };
      }
    } else {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
  } catch (err: any) {
    return {
      success: false,
      error: `ส่งข้อมูลไป Google Sheet ล้มเหลว: ${err?.message || 'ข้อผิดพลาดเครือข่าย'}`
    };
  }
}

/**
 * Upload an attachment file to Google Drive via Google Apps Script
 * Sets permission to "Anyone with the link can view" so staff can open it seamlessly
 */
export async function uploadFileToGoogleDrive(
  file: File,
  folderName: string = 'เอกสารโครงการกองช่าง_อบต.ไร่ใต้',
  customUrl?: string
): Promise<{ fileName: string; fileUrl: string; fileId?: string }> {
  const url = customUrl || getGoogleScriptUrl();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = async () => {
      try {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify({
            action: 'uploadFile',
            fileName: file.name,
            mimeType: file.type || 'application/pdf',
            fileData: base64Data,
            folderName: folderName
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

        // Fallback if Apps Script didn't return url
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
 * Ready-to-copy Google Apps Script (Code.gs) template for user
 */
export function getGoogleAppsScriptTemplateCode(): string {
  return `/**
 * =========================================================================
 * สคริปต์ Google Apps Script (Code.gs)
 * ระบบฐานข้อมูลและคลังเอกสาร Google Drive — กองช่าง อบต.ไร่ใต้
 * =========================================================================
 * 
 * วิธีการติดตั้ง (ครั้งเดียว):
 * 1. เปิด Google Sheet ที่ต้องการใช้เป็นฐานข้อมูลหลัก (เช่น ตั้งชื่อว่า "ระบบโครงการกองช่าง อบต.ไร่ใต้")
 * 2. ไปที่เมนู "ส่วนขยาย" (Extensions) > "Apps Script"
 * 3. ลบโค้ดเดิมใน Code.gs ทั้งหมด แล้ววางโค้ดนี้ลงไปแทน
 * 4. กดปุ่ม "บันทึก" (Save)
 * 5. กดปุ่ม "การทำให้ใช้งานได้" (Deploy) > "การทำให้ใช้งานได้รายการใหม่" (New deployment)
 * 6. เลือกประเภทเป็น "เว็บแอป" (Web app)
 * 7. ตั้งค่าสำคัญ:
 *    - คำอธิบาย: ฐานข้อมูลระบบโครงการกองช่าง
 *    - เรียกใช้ในฐานะ (Execute as): "ฉัน (อีเมลของคุณ)" (Me)
 *    - ผู้มีสิทธิ์เข้าถึง (Who has access): "ทุกคน" (Anyone)  <-- สำคัญมาก! เพื่อให้ทุกเครื่องเข้าถึงได้
 * 8. กด "ทำให้ใช้งานได้" (Deploy) และกดให้สิทธิ์การเข้าถึง (Authorize Access)
 * 9. คัดลอก "URL เว็บแอป" (Web App URL) ที่ลงท้ายด้วย /exec ไปใส่ในระบบ
 */

const SHEET_NAME = 'ทะเบียนโครงการ';
const DRIVE_FOLDER_NAME = 'เอกสารโครงการกองช่าง_อบต.ไร่ใต้';

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'getProjects';
    
    if (action === 'ping') {
      return createJsonResponse({
        status: 'success',
        message: 'Google Apps Script API พร้อมทำงาน',
        timestamp: new Date().toISOString()
      });
    }
    
    if (action === 'getProjects') {
      const projects = readProjectsFromSheet();
      return createJsonResponse({
        status: 'success',
        count: projects.length,
        data: projects,
        timestamp: new Date().toISOString()
      });
    }
    
    return createJsonResponse({ status: 'error', message: 'Unknown GET action: ' + action });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ status: 'error', message: 'No POST data received' });
    }
    
    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return createJsonResponse({ status: 'error', message: 'Invalid JSON body: ' + parseErr.toString() });
    }
    
    const action = payload.action;
    
    if (action === 'ping') {
      return createJsonResponse({ status: 'success', message: 'Pong', timestamp: new Date().toISOString() });
    }
    
    if (action === 'getProjects') {
      const projects = readProjectsFromSheet();
      return createJsonResponse({ status: 'success', count: projects.length, data: projects });
    }
    
    if (action === 'syncProjects' || action === 'saveProjects') {
      const projects = payload.projects || [];
      const count = writeProjectsToSheet(projects);
      return createJsonResponse({
        status: 'success',
        message: 'บันทึกข้อมูลเข้า Google Sheet สำเร็จ',
        count: count,
        timestamp: new Date().toISOString()
      });
    }
    
    if (action === 'uploadFile') {
      const uploadRes = saveFileToDrive(payload);
      return createJsonResponse({
        status: 'success',
        message: 'อัปโหลดไฟล์เข้า Google Drive สำเร็จ',
        fileUrl: uploadRes.fileUrl,
        fileId: uploadRes.fileId,
        fileName: uploadRes.fileName,
        folderName: uploadRes.folderName
      });
    }
    
    return createJsonResponse({ status: 'error', message: 'Unknown POST action: ' + action });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function readProjectsFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    return [];
  }
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return [];
  }
  
  const headers = data[0];
  const jsonColIdx = headers.indexOf('ข้อมูลระบบฉบับเต็ม (JSON)');
  
  const projects = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (!row[0] && !row[2]) continue;
    
    let project = null;
    if (jsonColIdx >= 0 && row[jsonColIdx]) {
      try {
        project = JSON.parse(row[jsonColIdx]);
      } catch (e) {
        project = null;
      }
    }
    
    if (!project) {
      project = {
        id: 'proj-' + (row[0] || r),
        projectCode: String(row[0] || ''),
        fiscalYear: Number(row[1]) || 2569,
        name: String(row[2] || ''),
        budgetCategory: String(row[3] || 'งบประมาณรายจ่าย'),
        approvedBudget: Number(row[4]) || 0,
        contractAmount: Number(row[5]) || 0,
        contractNo: String(row[6] || ''),
        startDate: row[7] ? String(row[7]) : '',
        endDate: row[8] ? String(row[8]) : '',
        contractorName: String(row[9] || ''),
        responsiblePerson: String(row[10] || ''),
        supervisorName: String(row[11] || ''),
        status: String(row[12] || 'not_started'),
        progressPercent: Number(row[13]) || 0,
        location: String(row[14] || ''),
        description: String(row[15] || ''),
        attachments: [],
        torCommittees: [],
        inspectCommittees: [],
        workNotices: [],
        deliveries: [],
        inspections: [],
        disbursements: [],
        remunerations: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    
    projects.push(project);
  }
  
  return projects;
}

function writeProjectsToSheet(projects) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  
  sheet.clear();
  
  const headers = [
    'รหัสโครงการ',
    'ปีงบประมาณ',
    'ชื่อโครงการ',
    'หมวดงบประมาณ',
    'งบอนุมัติ (บาท)',
    'วงเงินสัญญา (บาท)',
    'เลขที่สัญญา',
    'วันที่เริ่มสัญญา',
    'วันที่สิ้นสุดสัญญา',
    'ผู้รับจ้าง',
    'ผู้รับผิดชอบโครงการ',
    'ผู้ควบคุมงาน',
    'สถานะโครงการ',
    'ความคืบหน้า (%)',
    'สถานที่ดำเนินการ',
    'รายละเอียดโครงการ',
    'จำนวนเอกสารแนบ',
    'ลิงก์ไฟล์ Google Drive',
    'ข้อมูลระบบฉบับเต็ม (JSON)',
    'วันที่ปรับปรุงล่าสุด'
  ];
  
  const rows = [headers];
  
  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    const attachments = p.attachments || [];
    const attLinks = attachments.map(function(a) {
      return (a.name || 'ไฟล์') + ': ' + (a.url || '');
    }).join('\\n');
    
    const row = [
      p.projectCode || '',
      p.fiscalYear || '',
      p.name || '',
      p.budgetCategory || '',
      p.approvedBudget || 0,
      p.contractAmount || 0,
      p.contractNo || '',
      p.startDate || '',
      p.endDate || '',
      p.contractorName || '',
      p.responsiblePerson || '',
      p.supervisorName || '',
      p.status || 'not_started',
      p.progressPercent || 0,
      p.location || '',
      p.description || '',
      attachments.length,
      attLinks,
      JSON.stringify(p),
      new Date().toLocaleString('th-TH')
    ];
    rows.push(row);
  }
  
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#065f46');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  sheet.setFrozenRows(1);
  
  return projects.length;
}

function saveFileToDrive(payload) {
  const fileName = payload.fileName || ('เอกสารแนบ_' + Date.now() + '.pdf');
  const mimeType = payload.mimeType || 'application/pdf';
  const fileData = payload.fileData;
  const folderName = payload.folderName || DRIVE_FOLDER_NAME;
  
  if (!fileData) {
    throw new Error('ไม่พบข้อมูลไฟล์ (fileData)');
  }
  
  const folders = DriveApp.getFoldersByName(folderName);
  let folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(folderName);
  }
  
  const decodedBytes = Utilities.base64Decode(fileData);
  const blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
  const file = folder.createFile(blob);
  
  // กำหนดสิทธิ์ให้ทุกคนที่มีลิงก์เข้าดูไฟล์ได้ (สิทธิ์ Staff และทุกคนสามารถเปิดดูไฟล์แนบได้)
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  return {
    fileId: file.getId(),
    fileName: file.getName(),
    fileUrl: file.getUrl(),
    folderName: folder.getName()
  };
}
`;
}
