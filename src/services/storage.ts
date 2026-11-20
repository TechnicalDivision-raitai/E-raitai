import { Project, RepairRequest, UserProfile } from '../types/project';
import { CURRENT_USER, INITIAL_PROJECTS } from '../data/mockData';

import {
  DEFAULT_GOOGLE_SCRIPT_URL,
  uploadFileToGoogleDrive
} from './googleSync';

export const GOOGLE_SCRIPT_URL = DEFAULT_GOOGLE_SCRIPT_URL;
export const ADMIN_PASSWORD = '12345';

const STORAGE_KEY = 'raitai_engineering_projects_v5';
const USER_KEY = 'raitai_engineering_user_v5';
const REPAIR_STORAGE_KEY = 'raitai_engineering_repair_requests_v1';

export const INITIAL_REPAIR_REQUESTS: RepairRequest[] = [
  {
    id: 'rep-20261029-288',
    requestCode: 'ซ.70-001',
    fiscalYear: 2570,
    obtReceiveNo: '2686',
    obtReceiveDate: '2026-10-29',
    engReceiveNo: '288',
    engReceiveDate: '2026-10-29',
    channel: 'walk_in',
    petitionDate: '2026-10-29',
    subject: 'ขอความอนุเคราะห์ ซ่อมแซม ถนนลูกรัง สายโคกสูง - เสี่ยวนา',
    roadName: 'สายโคกสูง - ท่าช้างเสี่ยวนา (แถวบ้านยายตึม)',
    villageNo: '',
    roadType: 'gravel',
    requesterName: 'น.ส. ลัดดาวรรณ รสจันทร์',
    requesterPhone: '0900837931',
    problemDetails:
      'ขอซ่อมแซมถนนลูกรัง สายโคกสูง - ท่าช้างเสี่ยวนา แถวบ้านยายตึม ได้ชำรุด เป็นหลุมลึก มีโคลน ทำให้รถติดหล่ม ทำให้ชาวบ้านสัญจรไปมาไม่สะดวก ขอให้องค์การบริหารส่วนตำบลไร่ใต้ได้ดำเนินการซ่อมแซมให้ด้วยค่ะ',
    submittedEvidenceNote: 'รูปถ่าย จำนวน 1 ชุด',
    urgency: 'urgent',
    status: 'received',
    assignedStaff: 'กองช่าง อบต.ไร่ใต้',
    attachments: [],
    createdAt: '2026-10-29T08:30:00.000Z',
    updatedAt: '2026-10-29T08:30:00.000Z'
  }
];

export async function uploadFileToDrive(file: File): Promise<{ fileName: string; fileUrl: string }> {
  return uploadFileToGoogleDrive(file);
}

export function getStoredProjects(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_PROJECTS));
      return INITIAL_PROJECTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      if (parsed.length > 0) {
        const hasOldYears = parsed.some((p: Project) => p.fiscalYear < 2569);
        if (hasOldYears) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_PROJECTS));
          return INITIAL_PROJECTS;
        }
      }
      return parsed;
    }
    return INITIAL_PROJECTS;
  } catch (e) {
    console.error('Failed to load projects from storage', e);
    return INITIAL_PROJECTS;
  }
}

export function saveStoredProjects(projects: Project[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error('Failed to save projects to storage', e);
  }
}

export function resetToDefaultProjects(): Project[] {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_PROJECTS));
  return INITIAL_PROJECTS;
}

export function clearAllProjects(): Project[] {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  return [];
}

export function getStoredRepairRequests(): RepairRequest[] {
  try {
    const raw = localStorage.getItem(REPAIR_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(REPAIR_STORAGE_KEY, JSON.stringify(INITIAL_REPAIR_REQUESTS));
      return INITIAL_REPAIR_REQUESTS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return INITIAL_REPAIR_REQUESTS;
    let migrated = false;
    const normalized = parsed.map((item: RepairRequest) => {
      if (typeof item.requestCode === 'string' && /^ร\.(\d{2}-\d+)$/.test(item.requestCode.trim())) {
        migrated = true;
        return {
          ...item,
          requestCode: item.requestCode.trim().replace(/^ร\./, 'ซ.')
        };
      }
      return item;
    });
    if (migrated) {
      localStorage.setItem(REPAIR_STORAGE_KEY, JSON.stringify(normalized));
    }
    return normalized;
  } catch (e) {
    console.error('Failed to load repair requests from storage', e);
    return INITIAL_REPAIR_REQUESTS;
  }
}

export function saveStoredRepairRequests(items: RepairRequest[]): void {
  try {
    localStorage.setItem(REPAIR_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save repair requests to storage', e);
  }
}

const SESSION_USER_KEY = 'raitai_engineering_session_user';

export function getStoredUser(): UserProfile | null {
  try {
    const raw = sessionStorage.getItem(SESSION_USER_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveStoredUser(user: UserProfile): void {
  try {
    sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.error('Failed to save user', e);
  }
}

export function clearStoredUser(): void {
  try {
    sessionStorage.removeItem(SESSION_USER_KEY);
    localStorage.removeItem(USER_KEY);
  } catch (e) {
    console.error('Failed to clear user', e);
  }
}


