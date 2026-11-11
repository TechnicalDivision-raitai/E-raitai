import { Project, UserProfile } from '../types/project';
import { CURRENT_USER, INITIAL_PROJECTS } from '../data/mockData';

import {
  getGoogleScriptUrl,
  uploadFileToGoogleDrive
} from './googleSync';

export const GOOGLE_SCRIPT_URL = getGoogleScriptUrl();
export const ADMIN_PASSWORD = '12345';

const STORAGE_KEY = 'raitai_engineering_projects_v5';
const USER_KEY = 'raitai_engineering_user_v5';

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
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Validate that projects conform to 2569-2575 range
      const hasOldYears = parsed.some((p: Project) => p.fiscalYear < 2569);
      if (hasOldYears) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_PROJECTS));
        return INITIAL_PROJECTS;
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

export function getStoredUser(): UserProfile {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) {
      localStorage.setItem(USER_KEY, JSON.stringify(CURRENT_USER));
      return CURRENT_USER;
    }
    return JSON.parse(raw);
  } catch {
    return CURRENT_USER;
  }
}

export function saveStoredUser(user: UserProfile): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.error('Failed to save user', e);
  }
}


