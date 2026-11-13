import { Project, UserProfile } from '../types/project';
import { CURRENT_USER, INITIAL_PROJECTS } from '../data/mockData';

import {
  DEFAULT_GOOGLE_SCRIPT_URL,
  uploadFileToGoogleDrive
} from './googleSync';

export const GOOGLE_SCRIPT_URL = DEFAULT_GOOGLE_SCRIPT_URL;
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


