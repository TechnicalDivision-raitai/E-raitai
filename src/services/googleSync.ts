import { Project, SarabanQueueItem, SarabanQueueStatus } from '../types/project';

export const DEFAULT_GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzzWSWjjgNcPJ69Rvacq6uGZPE36RAO-JCpqwC6favyCPKjEpmNIjqjz7uEgdS6SGf5/exec';

export const DEFAULT_SHEET_NAME = 'ทะเบียนโครงการ';
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


