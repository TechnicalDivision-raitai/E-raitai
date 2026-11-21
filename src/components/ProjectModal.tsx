import React, { useState } from 'react';
import Swal from 'sweetalert2';
import {
  X,
  Plus,
  Trash2,
  Save,
  FileText,
  FileCheck,
  HardHat,
  Users,
  Coins,
  Calendar,
  AlertCircle,
  Upload,
  CheckCircle2,
  Paperclip,
  Clock,
  ExternalLink,
  MapPin,
  Navigation,
  Signpost,
  Image as ImageIcon,
  Compass,
  Link2
} from 'lucide-react';
import {
  Project,
  BudgetCategory,
  ProjectStatus,
  CommitteeMember,
  WorkNotice,
  DeliveryRecord,
  InspectionRecord,
  DisbursementRecord,
  CommitteeRemuneration,
  AttachmentFile,
  ProjectArchiveAttachment,
  RAI_TAI_PERSONNEL
} from '../types/project';
import {
  formatCurrency,
  formatThaiDate,
  formatThaiDateTime,
  getCurrentThaiFiscalYear,
  hasProjectApprovalData,
  calculateProjectProgress,
  countCompletedSteps,
  deriveProjectStatusFromData,
  getWorkNoticeAlert,
  DEFAULT_DELIVERY_DETAILS,
  getDeliveryContractStatus
} from '../utils/thaiDate';
import { uploadFileToDrive } from '../services/storage';
import { findMissingProjectCodes } from '../utils/projectCodeUtils';
import { AutoSuggestInput } from './AutoSuggestInput';
import {
  getGoogleMapsPointUrl,
  getGoogleMapsRouteUrl,
  getArchiveImageDisplayUrl,
  createImagePreviewDataUrl,
  tryParseCombinedLatLng
} from './ProjectRecordsView';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: Project) => void;
  initialProject?: Project | null;
  existingCategories?: string[];
  existingProjects?: Project[];
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialProject,
  existingCategories = [],
  existingProjects = []
}) => {
  const [activeTab, setActiveTab] = useState<number>(1);
  const [hasManualStatusChange, setHasManualStatusChange] = useState<boolean>(false);
  const [livePositionOverrides, setLivePositionOverrides] = useState<
    Record<string, { position: string; timestamp: number }>
  >({});
  const [liveContractorOverrides, setLiveContractorOverrides] = useState<
    Record<
      string,
      {
        taxId?: { value: string; timestamp: number };
        contact?: { value: string; timestamp: number };
      }
    >
  >({});
  const [openDriveLinkTarget, setOpenDriveLinkTarget] = useState<
    AttachmentFile['category'] | 'archive' | null
  >(null);
  const [driveLinkName, setDriveLinkName] = useState<string>('');
  const [driveLinkUrl, setDriveLinkUrl] = useState<string>('');
  const [driveLinkError, setDriveLinkError] = useState<string | null>(null);
  const [projectCodePrefix, setProjectCodePrefix] = useState<'ถ.' | 'อ.'>('ถ.');
  const [hasManualCodeEdit, setHasManualCodeEdit] = useState<boolean>(false);
  const [hasManualPrefixChoice, setHasManualPrefixChoice] = useState<boolean>(false);
  const [hasManualLocationEdit, setHasManualLocationEdit] = useState<boolean>(false);
  const [hiddenSuggestions, setHiddenSuggestions] = useState<string[]>(() => {
    const defaultHidden = ['นายศรายุทธ สงวนรัษฐ์'];
    try {
      const raw = localStorage.getItem('rai_tai_hidden_suggestions_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return Array.from(new Set([...defaultHidden, ...parsed.map(String)]));
        }
      }
    } catch {
      // ignore storage errors
    }
    return defaultHidden;
  });
  const baselineDerivedRef = React.useRef<ProjectStatus>('not_started');

  // Helper to normalize Thai names (collapse multiple spaces into a single space and trim)
  const normalizeName = (name?: string | null): string => {
    if (!name) return '';
    return name.replace(/\s+/g, ' ').trim();
  };

  const hiddenSuggestionSet = React.useMemo(
    () => new Set(hiddenSuggestions.map(s => normalizeName(s)).filter(Boolean)),
    [hiddenSuggestions]
  );

  const handleHideSuggestion = (item: string) => {
    const clean = normalizeName(item);
    if (!clean) return;
    setHiddenSuggestions(prev => {
      if (prev.some(existing => normalizeName(existing) === clean)) return prev;
      const next = [...prev, clean];
      try {
        localStorage.setItem('rai_tai_hidden_suggestions_v1', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const DEFAULT_PROJECT_LOCATION = 'ต.ไร่ใต้ อ.พิบูลมังสาหาร จ.อุบลราชธานี';
  const DEFAULT_RESPONSIBLE_PERSON = 'กองช่าง อบต.ไร่ใต้';

  // Extract road/soi name (e.g. "สายหนองตาใกล้", "สายพ่อฤทธิ์") from project name
  const extractRoadNameFromProjectName = (projectName?: string | null): string | null => {
    const text = (projectName || '').replace(/\s+/g, ' ').trim();
    if (!text) return null;

    const match = text.match(
      /(?:สาย(?!ไฟ|เคเบิล|เมน|ส่งน้ำ|อากาศ|สื่อสาร|พาน|ยาง|โทรศัพท์|อินเทอร์เน็ต|แลน)|ซอย)[^\n]*/
    );
    if (!match) return null;

    let extracted = match[0];
    const stopRegex =
      /\s*(?:กว้าง\s*\d|ยาว\s*\d|หนา\s*\d|ลึก\s*\d|สูง\s*\d|ขนาด\s*\d|ขนาดกว้าง|ระยะทาง|ปริมาณงาน|พื้นที่|จำนวน\s*\d|พร้อม|งบประมาณ|ประจำปี|ปีงบประมาณ|ตามแบบ|อบต\.|องค์การบริหารส่วนตำบล|ต\.\s*ไร่ใต้|ตำบล\s*ไร่ใต้|อ\.\s*พิบูลมังสาหาร|อำเภอ\s*พิบูลมังสาหาร|จ\.\s*อุบลราชธานี|จังหวัด\s*อุบลราชธานี).*$/;
    extracted = extracted.replace(stopRegex, '').trim();
    extracted = extracted.replace(/[\s,;/\-–—(]+$/, '').trim();

    const withoutKeyword = extracted.replace(/^(?:สายทาง|สาย|ซอย)/, '').trim();
    if (withoutKeyword.length < 2) return null;

    return extracted;
  };

  const buildLocationFromProjectName = (projectName?: string | null): string | null => {
    const roadName = extractRoadNameFromProjectName(projectName);
    if (!roadName) return null;
    return `${roadName} ${DEFAULT_PROJECT_LOCATION}`;
  };

  // Detect project code prefix ('ถ.' for road, 'อ.' for building) from an existing code
  const detectPrefixFromCode = (code?: string | null): 'ถ.' | 'อ.' => {
    const trimmed = (code || '').trim();
    if (trimmed.startsWith('อ.')) return 'อ.';
    return 'ถ.';
  };

  // Infer road vs building prefix from Thai project name (earliest matching keyword wins)
  const inferProjectCodePrefix = (projectName?: string | null): 'ถ.' | 'อ.' | null => {
    const text = (projectName || '').trim();
    if (!text) return null;

    const roadKeywords = [
      'ถนน',
      'คสล.',
      'คอนกรีตเสริมเหล็ก',
      'ลาดยาง',
      'แอสฟัลต์',
      'ลูกรัง',
      'หินคลุก',
      'ทางหลวง',
      'สายทาง',
      'ซอย',
      'ไหล่ทาง',
      'สะพาน',
      'บล็อกประสาน',
      'ผิวจราจร',
      'ซ่อมแซมทาง',
      'บุกเบิกทาง',
      'เกรดปรับเกลี่ย'
    ];
    const buildingKeywords = [
      'อาคาร',
      'ศาลา',
      'หอประชุม',
      'ศูนย์พัฒนาเด็ก',
      'ห้องน้ำ',
      'ห้องสุขา',
      'สุขา',
      'โรงจอดรถ',
      'โรงอาหาร',
      'หลังคา',
      'โดม',
      'เมรุ',
      'บ้านพัก',
      'สำนักงาน',
      'โรงเรียน',
      'สถานีอนามัย',
      'รพ.สต',
      'ห้องประชุม',
      'ป้อมยาม',
      'รั้วอาคาร',
      'กำแพงแก้ว'
    ];

    const findEarliestIndex = (keywords: string[]): number => {
      let earliest = -1;
      for (const kw of keywords) {
        const idx = text.indexOf(kw);
        if (idx !== -1 && (earliest === -1 || idx < earliest)) {
          earliest = idx;
        }
      }
      return earliest;
    };

    const roadIdx = findEarliestIndex(roadKeywords);
    const buildingIdx = findEarliestIndex(buildingKeywords);

    if (roadIdx === -1 && buildingIdx === -1) return null;
    if (roadIdx === -1) return 'อ.';
    if (buildingIdx === -1) return 'ถ.';
    return roadIdx <= buildingIdx ? 'ถ.' : 'อ.';
  };

  // Generate sequential running project code e.g. ถ.69-001, ถ.70-001, อ.69-001, อ.70-001
  const generateNextProjectCode = (
    prefix: 'ถ.' | 'อ.',
    fiscalYear: number,
    excludeProjectId?: string
  ): string => {
    const yy = String(fiscalYear).slice(-2);
    const head = `${prefix}${yy}-`;
    let maxSeq = 0;

    existingProjects.forEach(p => {
      if (excludeProjectId && p.id === excludeProjectId) return;
      const code = (p.projectCode || '').trim();
      if (!code.startsWith(head)) return;
      const suffix = code.slice(head.length);
      if (/^\d+$/.test(suffix)) {
        const num = parseInt(suffix, 10);
        if (num > maxSeq) maxSeq = num;
      }
    });

    return `${head}${String(maxSeq + 1).padStart(3, '0')}`;
  };

  // Extract recorded person names across all existing projects and personnel directory
  const suggestedPersonNames = React.useMemo(() => {
    const names = new Set<string>();

    const addClean = (raw?: string | null) => {
      const clean = normalizeName(raw);
      if (clean && clean.length >= 2 && !hiddenSuggestionSet.has(clean)) {
        names.add(clean);
      }
    };

    // 1. Personnel directory
    RAI_TAI_PERSONNEL.forEach(p => addClean(p.name));

    // 2. Scan all existing projects
    existingProjects.forEach(p => {
      addClean(p.responsiblePerson);
      addClean(p.torAuthor);
      if (p.supervisorName) {
        p.supervisorName.split(/[\n,]+/).forEach(part => {
          const cleanNameOnly = part.replace(/\s*\(.*?\)\s*/g, '');
          addClean(cleanNameOnly);
        });
      }
      (p.supervisors || []).forEach(s => addClean(s.name));
      (p.torCommittees || []).forEach(c => addClean(c.name));
      (p.inspectCommittees || []).forEach(c => addClean(c.name));
      (p.remunerations || []).forEach(r => addClean(r.payeeName));
    });

    return Array.from(names).sort((a, b) => a.localeCompare(b, 'th'));
  }, [existingProjects, hiddenSuggestionSet]);

  // Extract recorded contractor names across all existing projects and current live edits
  const suggestedContractorNames = React.useMemo(() => {
    const names = new Set<string>();
    existingProjects.forEach(p => {
      const clean = normalizeName(p.contractorName);
      if (clean && clean.length >= 2 && !hiddenSuggestionSet.has(clean)) names.add(clean);
    });
    Object.keys(liveContractorOverrides).forEach(name => {
      const clean = normalizeName(name);
      if (clean && clean.length >= 2 && !hiddenSuggestionSet.has(clean)) names.add(clean);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'th'));
  }, [existingProjects, liveContractorOverrides, hiddenSuggestionSet]);

  // Map each contractor's normalized name to their latest known Tax ID and contact/address
  // across all recorded projects (prioritizing explicit per-field edit timestamps) and live edits.
  const contractorProfileMap = React.useMemo(() => {
    const taxMap = new Map<string, { value: string; timestamp: number }>();
    const contactMap = new Map<string, { value: string; timestamp: number }>();

    const recordTaxId = (rawName?: string | null, rawTaxId?: string | null, timestamp = 0) => {
      const cleanName = normalizeName(rawName);
      const cleanTaxId = (rawTaxId || '').trim();
      if (!cleanName || !cleanTaxId) return;
      const existing = taxMap.get(cleanName);
      if (!existing || timestamp >= existing.timestamp) {
        taxMap.set(cleanName, { value: cleanTaxId, timestamp });
      }
    };

    const recordContact = (rawName?: string | null, rawContact?: string | null, timestamp = 0) => {
      const cleanName = normalizeName(rawName);
      const cleanContact = normalizeName(rawContact);
      if (!cleanName || !cleanContact) return;
      const existing = contactMap.get(cleanName);
      if (!existing || timestamp >= existing.timestamp) {
        contactMap.set(cleanName, { value: cleanContact, timestamp });
      }
    };

    const orderedProjects = [...existingProjects].sort((a, b) => {
      const ta = Date.parse(a.createdAt || '') || 0;
      const tb = Date.parse(b.createdAt || '') || 0;
      return ta - tb;
    });

    orderedProjects.forEach((p, projIdx) => {
      const baseProjectTs = Date.parse(p.createdAt || '') || projIdx + 1;
      const taxTs = p.contractorTaxIdUpdatedAt
        ? Date.parse(p.contractorTaxIdUpdatedAt) || baseProjectTs
        : baseProjectTs;
      const contactTs = p.contractorContactUpdatedAt
        ? Date.parse(p.contractorContactUpdatedAt) || baseProjectTs
        : baseProjectTs;

      recordTaxId(p.contractorName, p.contractorTaxId, taxTs);
      recordContact(p.contractorName, p.contractorContact, contactTs);
    });

    Object.entries(liveContractorOverrides).forEach(([cleanName, entry]) => {
      if (entry.taxId) {
        recordTaxId(cleanName, entry.taxId.value, entry.taxId.timestamp);
      }
      if (entry.contact) {
        recordContact(cleanName, entry.contact.value, entry.contact.timestamp);
      }
    });

    const resolved = new Map<string, { taxId?: string; contact?: string }>();
    const allNames = new Set<string>([...taxMap.keys(), ...contactMap.keys()]);
    allNames.forEach(name => {
      resolved.set(name, {
        taxId: taxMap.get(name)?.value,
        contact: contactMap.get(name)?.value
      });
    });
    return resolved;
  }, [existingProjects, liveContractorOverrides]);

  const getBoundContractorHint = (name: string): string | undefined => {
    const clean = normalizeName(name);
    if (!clean) return undefined;
    const profile = contractorProfileMap.get(clean);
    if (!profile) return undefined;
    if (profile.taxId) return `เลขผู้เสียภาษี: ${profile.taxId}`;
    if (profile.contact) return profile.contact;
    return undefined;
  };

  // Map each person's normalized name to their latest known position across personnel directory,
  // all recorded projects (prioritizing explicit positionUpdatedAt timestamps), and live in-modal edits.
  const personPositionMap = React.useMemo(() => {
    const map = new Map<string, { position: string; timestamp: number }>();

    const recordCandidate = (rawName?: string | null, rawPos?: string | null, timestamp = 0) => {
      const cleanName = normalizeName(rawName);
      const cleanPos = normalizeName(rawPos);
      if (!cleanName || !cleanPos) return;
      const existing = map.get(cleanName);
      if (!existing || timestamp >= existing.timestamp) {
        map.set(cleanName, { position: cleanPos, timestamp });
      }
    };

    // 1. Base directory defaults (lowest timestamp priority so any later position change overrides them)
    RAI_TAI_PERSONNEL.forEach(p => {
      recordCandidate(p.name, p.position, 0);
    });

    // 2. Scan existing projects from oldest to newest createdAt so newer records win on ties
    const orderedProjects = [...existingProjects].sort((a, b) => {
      const ta = Date.parse(a.createdAt || '') || 0;
      const tb = Date.parse(b.createdAt || '') || 0;
      return ta - tb;
    });

    orderedProjects.forEach((p, projIdx) => {
      const baseProjectTs = Date.parse(p.createdAt || '') || projIdx + 1;

      if (p.supervisorName) {
        p.supervisorName.split(/[\n,]+/).forEach(part => {
          const match = part.match(/\(([^)]+)\)/);
          if (match && match[1]) {
            const cleanSupName = part.replace(/\s*\(.*?\)\s*/g, '');
            recordCandidate(cleanSupName, match[1], baseProjectTs);
          }
        });
      }

      (p.supervisors || []).forEach(s => {
        const memberTs = s.positionUpdatedAt
          ? Date.parse(s.positionUpdatedAt) || baseProjectTs
          : baseProjectTs;
        recordCandidate(s.name, s.position, memberTs);
      });

      (p.torCommittees || []).forEach(c => {
        const memberTs = c.positionUpdatedAt
          ? Date.parse(c.positionUpdatedAt) || baseProjectTs
          : baseProjectTs;
        recordCandidate(c.name, c.position, memberTs);
      });

      (p.inspectCommittees || []).forEach(c => {
        const memberTs = c.positionUpdatedAt
          ? Date.parse(c.positionUpdatedAt) || baseProjectTs
          : baseProjectTs;
        recordCandidate(c.name, c.position, memberTs);
      });
    });

    // 3. Apply live edits made during the current modal session
    Object.entries(livePositionOverrides).forEach(([cleanName, entry]) => {
      recordCandidate(cleanName, entry.position, entry.timestamp);
    });

    const resolved = new Map<string, string>();
    map.forEach((val, key) => resolved.set(key, val.position));
    return resolved;
  }, [existingProjects, livePositionOverrides]);

  const getBoundPositionHint = (name: string): string | undefined => {
    const clean = normalizeName(name);
    return clean ? personPositionMap.get(clean) : undefined;
  };

  // Extract recorded official positions across personnel directory and all existing projects
  const suggestedPositions = React.useMemo(() => {
    const positions = new Set<string>();

    const addCleanPos = (raw?: string | null) => {
      const clean = normalizeName(raw);
      if (clean && clean.length >= 2 && !hiddenSuggestionSet.has(clean)) {
        positions.add(clean);
      }
    };

    // 1. Personnel directory positions
    RAI_TAI_PERSONNEL.forEach(p => addCleanPos(p.position));

    // 2. Scan all existing projects
    existingProjects.forEach(p => {
      if (p.supervisorName) {
        p.supervisorName.split(/[\n,]+/).forEach(part => {
          const match = part.match(/\(([^)]+)\)/);
          if (match && match[1]) {
            addCleanPos(match[1]);
          }
        });
      }
      (p.supervisors || []).forEach(s => addCleanPos(s.position));
      (p.torCommittees || []).forEach(c => addCleanPos(c.position));
      (p.inspectCommittees || []).forEach(c => addCleanPos(c.position));
    });

    // 3. Live position overrides
    Object.values(livePositionOverrides).forEach(v => addCleanPos(v.position));

    return Array.from(positions).sort((a, b) => a.localeCompare(b, 'th'));
  }, [existingProjects, livePositionOverrides, hiddenSuggestionSet]);

  // Standardized Remuneration Titles
  const REMUNERATION_TITLES: Record<CommitteeRemuneration['type'], string> = {
    tor_author: 'ค่าตอบแทนผู้จัดทำ TOR / กำหนดแบบรูปรายการ',
    tor: 'ค่าตอบแทนคณะกรรมการกำหนดราคากลาง',
    supervisor: 'ค่าตอบแทนผู้ควบคุมงาน',
    inspection: 'ค่าตอบแทนคณะกรรมการตรวจรับงานจ้าง'
  };

  // Infer remuneration category from its title text
  const inferRemunerationType = (
    title: string,
    fallback: CommitteeRemuneration['type']
  ): CommitteeRemuneration['type'] => {
    const clean = (title || '').trim();
    if (clean.includes('ราคากลาง')) return 'tor';
    if (clean.toUpperCase().includes('TOR') || clean.includes('จัดทำแบบ') || clean.includes('ผู้จัดทำ')) {
      return 'tor_author';
    }
    if (clean.includes('ควบคุมงาน')) return 'supervisor';
    if (clean.includes('ตรวจรับ')) return 'inspection';
    return fallback;
  };

  // Automatically resolve payee name from Tab 2 (TOR) and Tab 3 (Supervisor & Inspection)
  const getDefaultPayeeByType = (
    type: CommitteeRemuneration['type'],
    projectData: Project
  ): string => {
    const formatCommitteePayee = (members?: CommitteeMember[]): string => {
      const valid = (members || []).filter(m => normalizeName(m.name).length > 0);
      if (valid.length === 0) return '';
      const chairman = valid.find(m => m.role === 'ประธานกรรมการ') || valid[0];
      const leadName = normalizeName(chairman.name);
      return valid.length > 1 ? `${leadName} และคณะ` : leadName;
    };

    switch (type) {
      case 'tor_author':
        return normalizeName(projectData.torAuthor) || normalizeName(projectData.torRemunerationPayee);
      case 'tor':
        return formatCommitteePayee(projectData.torCommittees);
      case 'supervisor': {
        const validSupervisors = (projectData.supervisors || []).filter(
          s => normalizeName(s.name).length > 0
        );
        if (validSupervisors.length > 0) {
          const lead = normalizeName(validSupervisors[0].name);
          return validSupervisors.length > 1 ? `${lead} และคณะ` : lead;
        }
        const parts = (projectData.supervisorName || '')
          .split(/[\n,]+/)
          .map(part => normalizeName(part.replace(/\s*\(.*?\)\s*/g, '')))
          .filter(Boolean);
        if (parts.length === 0) return '';
        return parts.length > 1 ? `${parts[0]} และคณะ` : parts[0];
      }
      case 'inspection':
        return formatCommitteePayee(projectData.inspectCommittees);
      default:
        return '';
    }
  };

  // Parse legacy supervisorName string into structured supervisors list
  const resolveInitialSupervisors = (projectData?: Partial<Project> | null): CommitteeMember[] => {
    if (Array.isArray(projectData?.supervisors) && projectData!.supervisors!.length > 0) {
      return projectData!.supervisors!.map((s, idx) => ({
        ...s,
        id: s.id || `sup-${idx + 1}`,
        role: 'ผู้ควบคุมงาน'
      }));
    }
    const raw = (projectData?.supervisorName || '').trim();
    if (raw) {
      const parts = raw
        .split(/[\n,]+/)
        .map(p => p.trim())
        .filter(Boolean);
      if (parts.length > 0) {
        return parts.map((part, idx) => {
          const match = part.match(/\(([^)]+)\)/);
          const pos = match && match[1] ? match[1].trim() : '';
          const cleanName = part.replace(/\s*\(.*?\)\s*/g, '').trim();
          return {
            id: `sup-init-${idx + 1}`,
            name: cleanName || part,
            position: pos,
            role: 'ผู้ควบคุมงาน',
            phone: ''
          };
        });
      }
    }
    return [{ id: 'sup-1', name: '', position: '', role: 'ผู้ควบคุมงาน', phone: '' }];
  };

  const buildSupervisorNameSummary = (list?: CommitteeMember[]): string => {
    return (list || [])
      .map(s => (s.name || '').trim())
      .filter(Boolean)
      .join(', ');
  };

  // Normalize legacy TOR title and auto-fill empty payee names from Tab 2 / Tab 3
  const syncRemunerationsWithTabs = (projectData: Project): Project => {
    const normalizedSupervisors = resolveInitialSupervisors(projectData);
    const syncedSupervisorName =
      buildSupervisorNameSummary(normalizedSupervisors) || projectData.supervisorName || '';
    const withSupervisors: Project = {
      ...projectData,
      supervisors: normalizedSupervisors,
      supervisorName: syncedSupervisorName
    };
    const updatedRemunerations = (withSupervisors.remunerations || []).map(r => {
      const normalizedTitle =
        r.title === 'ค่าตอบแทนคณะกรรมการจัดทำแบบรูปและราคากลาง'
          ? REMUNERATION_TITLES.tor
          : r.title;
      const inferredType = inferRemunerationType(normalizedTitle, r.type);
      const currentPayee = normalizeName(r.payeeName);
      const autoPayee = getDefaultPayeeByType(inferredType, withSupervisors);
      return {
        ...r,
        type: inferredType,
        title: normalizedTitle,
        payeeName: currentPayee || autoPayee
      };
    });
    return {
      ...withSupervisors,
      remunerations: updatedRemunerations
    };
  };

  // Form State
  const [formData, setFormData] = useState<Project>(() => {
    if (initialProject) return syncRemunerationsWithTabs(JSON.parse(JSON.stringify(initialProject)));
    const nextYear = getCurrentThaiFiscalYear();
    return {
      id: `prj-${Date.now()}`,
      projectCode: generateNextProjectCode('ถ.', nextYear),
      fiscalYear: nextYear,
      name: '',
      budgetCategory: 'งบประมาณรายจ่าย',
      meetingSession: '',
      approvalYear: nextYear,
      approvedBudget: 0,
      description: '',
      location: DEFAULT_PROJECT_LOCATION,
      responsiblePerson: DEFAULT_RESPONSIBLE_PERSON,
      notes: '',
      approvalRequestNo: '',
      approvalRequestDate: '',

      torOrderNo: '',
      torOrderDate: '',
      torAuthor: '',
      torDate: '',
      refPriceDate: '',
      refPrice: 0,
      torCommittees: [
        { id: 'cm-1', name: '', position: '', role: 'ประธานกรรมการ', phone: '' }
      ],
      torRemunerationPayee: '',
      torRemunerationAmount: 0,

      inspectOrderNo: '',
      inspectOrderDate: '',
      supervisorName: '',
      supervisors: [
        { id: 'sup-1', name: '', position: '', role: 'ผู้ควบคุมงาน', phone: '' }
      ],
      inspectCommittees: [
        { id: 'cm-2', name: '', position: '', role: 'ประธานกรรมการ', phone: '' }
      ],

      contractNo: '',
      contractDate: '',
      contractAmount: 0,
      startDate: '',
      endDate: '',
      contractorName: '',
      contractorTaxId: '',
      contractorContact: '',

      workNotices: [],
      deliveries: [],
      inspections: [],
      disbursements: [],
      remunerations: [],
      attachments: [],

      status: 'not_started',
      progressPercent: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });

  // Automatically populate all existing project details when editing or opening modal
  React.useEffect(() => {
    if (isOpen) {
      if (initialProject) {
        const cloned: Project = JSON.parse(JSON.stringify(initialProject));
        if (Array.isArray(cloned.deliveries)) {
          cloned.deliveries = cloned.deliveries.map(d => ({
            ...d,
            actualDeliveryDate: d.actualDeliveryDate || d.bookDate || '',
            details: d.details && d.details.trim() ? d.details : DEFAULT_DELIVERY_DETAILS
          }));
        }
        setFormData(syncRemunerationsWithTabs(cloned));
      } else {
        const nextYear = getCurrentThaiFiscalYear();
        setFormData({
          id: `prj-${Date.now()}`,
          projectCode: generateNextProjectCode('ถ.', nextYear),
          fiscalYear: nextYear,
          name: '',
          budgetCategory: 'งบประมาณรายจ่าย',
          meetingSession: '',
          approvalYear: nextYear,
          approvedBudget: 0,
          description: '',
          location: DEFAULT_PROJECT_LOCATION,
          responsiblePerson: DEFAULT_RESPONSIBLE_PERSON,
          notes: '',
          approvalRequestNo: '',
          approvalRequestDate: '',

          torOrderNo: '',
          torOrderDate: '',
          torAuthor: '',
          torDate: '',
          refPriceDate: '',
          refPrice: 0,
          torCommittees: [
            { id: 'cm-1', name: '', position: '', role: 'ประธานกรรมการ', phone: '' }
          ],
          torRemunerationPayee: '',
          torRemunerationAmount: 0,

          inspectOrderNo: '',
          inspectOrderDate: '',
          supervisorName: '',
          supervisors: [
            { id: 'sup-1', name: '', position: '', role: 'ผู้ควบคุมงาน', phone: '' }
          ],
          inspectCommittees: [
            { id: 'cm-2', name: '', position: '', role: 'ประธานกรรมการ', phone: '' }
          ],

          contractNo: '',
          contractDate: '',
          contractAmount: 0,
          startDate: '',
          endDate: '',
          contractorName: '',
          contractorTaxId: '',
          contractorContact: '',

          workNotices: [],
          deliveries: [],
          inspections: [],
          disbursements: [],
          remunerations: [],
          attachments: [],

          status: 'not_started',
          progressPercent: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      setActiveTab(1);
      setHasManualStatusChange(false);
      setProjectCodePrefix(initialProject ? detectPrefixFromCode(initialProject.projectCode) : 'ถ.');
      setHasManualCodeEdit(Boolean(initialProject));
      setHasManualPrefixChoice(Boolean(initialProject));
      setHasManualLocationEdit(Boolean(initialProject));
      setLivePositionOverrides({});
      setLiveContractorOverrides({});
      setOpenDriveLinkTarget(null);
      setDriveLinkName('');
      setDriveLinkUrl('');
      setDriveLinkError(null);
      baselineDerivedRef.current = initialProject
        ? deriveProjectStatusFromData(initialProject)
        : 'not_started';
    }
  }, [isOpen, initialProject]);

  // Auto-advance or sync project status whenever workflow stage fields change (unless user manually picked status in Tab 1)
  React.useEffect(() => {
    if (!isOpen) return;
    const derived = deriveProjectStatusFromData(formData);
    if (derived !== baselineDerivedRef.current) {
      baselineDerivedRef.current = derived;
      if (!hasManualStatusChange) {
        setFormData(prev => (prev.status === derived ? prev : { ...prev, status: derived }));
      }
    }
  }, [
    isOpen,
    hasManualStatusChange,
    formData.approvalRequestNo,
    formData.approvalRequestDate,
    formData.torOrderNo,
    formData.torOrderDate,
    formData.torAuthor,
    formData.torDate,
    formData.refPriceDate,
    formData.refPrice,
    formData.torNotes,
    formData.torCommittees,
    formData.torRemunerationPayee,
    formData.torRemunerationAmount,
    formData.inspectOrderNo,
    formData.inspectOrderDate,
    formData.supervisorName,
    formData.supervisors,
    formData.inspectCommittees,
    formData.contractNo,
    formData.contractDate,
    formData.contractAmount,
    formData.contractorName,
    formData.workNotices,
    formData.deliveries,
    formData.inspections,
    formData.disbursements,
    formData.remunerations,
    formData.attachments
  ]);

  // Keep empty remuneration payees synchronized with Tab 2 & Tab 3 when opening Tab 6
  React.useEffect(() => {
    if (activeTab === 6) {
      setFormData(prev => syncRemunerationsWithTabs(prev));
    }
  }, [activeTab]);

  // Live duplicate projectCode check while typing (excludes current project when editing)
  const duplicateCodeProject = React.useMemo(() => {
    const normalized = (formData.projectCode || '').trim().replace(/\s+/g, '').toLowerCase();
    if (!normalized) return null;
    return (
      existingProjects.find(p => {
        if (initialProject && p.id === initialProject.id) return false;
        if (formData.id && p.id === formData.id) return false;
        const existingNorm = (p.projectCode || '').trim().replace(/\s+/g, '').toLowerCase();
        return existingNorm === normalized;
      }) || null
    );
  }, [formData.projectCode, formData.id, existingProjects, initialProject]);

  // Option 1: Detect vacant sequential codes (e.g. ถ.69-025) so user can reuse with 1 click
  const vacantProjectCodes = React.useMemo(
    () =>
      findMissingProjectCodes(
        existingProjects,
        projectCodePrefix,
        formData.fiscalYear,
        initialProject?.id
      ),
    [existingProjects, projectCodePrefix, formData.fiscalYear, initialProject?.id]
  );

  if (!isOpen) return null;

  // Committee Helpers
  const addTorCommittee = () => {
    setFormData(prev => ({
      ...prev,
      torCommittees: [
        ...prev.torCommittees,
        {
          id: `cm-${Date.now()}`,
          name: '',
          position: '',
          role: 'กรรมการ',
          phone: ''
        }
      ]
    }));
  };

  const removeTorCommittee = (id: string) => {
    setFormData(prev => ({
      ...prev,
      torCommittees: prev.torCommittees.filter(c => c.id !== id)
    }));
  };

  const addInspectCommittee = () => {
    setFormData(prev => ({
      ...prev,
      inspectCommittees: [
        ...prev.inspectCommittees,
        {
          id: `cm-${Date.now()}`,
          name: '',
          position: '',
          role: 'กรรมการ',
          phone: ''
        }
      ]
    }));
  };

  const removeInspectCommittee = (id: string) => {
    setFormData(prev => ({
      ...prev,
      inspectCommittees: prev.inspectCommittees.filter(c => c.id !== id)
    }));
  };

  // Supervisors Helpers (supports multiple supervisors for large projects)
  const addSupervisor = () => {
    setFormData(prev => {
      const current = prev.supervisors || [];
      const next = [
        ...current,
        {
          id: `sup-${Date.now()}`,
          name: '',
          position: '',
          role: 'ผู้ควบคุมงาน' as const,
          phone: ''
        }
      ];
      return {
        ...prev,
        supervisors: next,
        supervisorName: buildSupervisorNameSummary(next)
      };
    });
  };

  const removeSupervisor = (id: string) => {
    setFormData(prev => {
      const next = (prev.supervisors || []).filter(s => s.id !== id);
      return {
        ...prev,
        supervisors: next,
        supervisorName: buildSupervisorNameSummary(next)
      };
    });
  };

  // Shared handler for committee/supervisor name changes: auto-binds the person's latest position while preserving manual edits
  const handleCommitteeNameChange = (
    listKey: 'torCommittees' | 'inspectCommittees' | 'supervisors',
    idx: number,
    newName: string
  ) => {
    const updated = [...(formData[listKey] || [])];
    const current = updated[idx];
    if (!current) return;
    const prevCleanName = normalizeName(current.name);
    const nextCleanName = normalizeName(newName);
    const prevBoundPos = prevCleanName ? personPositionMap.get(prevCleanName) || '' : '';
    const nextBoundPos = nextCleanName ? personPositionMap.get(nextCleanName) || '' : '';
    const currentCleanPos = normalizeName(current.position);

    let nextPosition = current.position;
    let nextPositionUpdatedAt = current.positionUpdatedAt;

    if (nextBoundPos) {
      if (!currentCleanPos || nextCleanName !== prevCleanName || currentCleanPos === prevBoundPos) {
        nextPosition = nextBoundPos;
        nextPositionUpdatedAt = undefined;
      }
    } else if (nextCleanName !== prevCleanName && prevBoundPos && currentCleanPos === prevBoundPos) {
      nextPosition = '';
      nextPositionUpdatedAt = undefined;
    }

    updated[idx] = {
      ...current,
      name: newName,
      position: nextPosition,
      positionUpdatedAt: nextPositionUpdatedAt
    };
    setFormData({
      ...formData,
      [listKey]: updated,
      ...(listKey === 'supervisors' ? { supervisorName: buildSupervisorNameSummary(updated) } : {})
    });
  };

  // Shared handler for committee/supervisor position changes: allows free editing and records the latest position for this person
  const handleCommitteePositionChange = (
    listKey: 'torCommittees' | 'inspectCommittees' | 'supervisors',
    idx: number,
    newPosition: string
  ) => {
    const nowIso = new Date().toISOString();
    const updated = [...(formData[listKey] || [])];
    if (!updated[idx]) return;
    updated[idx] = {
      ...updated[idx],
      position: newPosition,
      positionUpdatedAt: nowIso
    };
    setFormData({ ...formData, [listKey]: updated });

    const cleanName = normalizeName(updated[idx].name);
    const cleanPos = normalizeName(newPosition);
    if (cleanName && cleanPos) {
      setLivePositionOverrides(prev => ({
        ...prev,
        [cleanName]: { position: cleanPos, timestamp: Date.now() }
      }));
    }
  };

  // Contractor binding handlers: auto-fill latest known Tax ID and contact/address when selecting
  // or typing a known contractor name, while preserving free manual edits and adopting the latest edit.
  const handleContractorNameChange = (newName: string) => {
    const prevCleanName = normalizeName(formData.contractorName);
    const nextCleanName = normalizeName(newName);
    const prevBound = prevCleanName ? contractorProfileMap.get(prevCleanName) : undefined;
    const nextBound = nextCleanName ? contractorProfileMap.get(nextCleanName) : undefined;
    const currentCleanTaxId = (formData.contractorTaxId || '').trim();
    const currentCleanContact = normalizeName(formData.contractorContact);

    let nextTaxId = formData.contractorTaxId || '';
    let nextTaxIdUpdatedAt = formData.contractorTaxIdUpdatedAt;

    if (nextBound?.taxId) {
      if (
        !currentCleanTaxId ||
        nextCleanName !== prevCleanName ||
        currentCleanTaxId === (prevBound?.taxId || '')
      ) {
        nextTaxId = nextBound.taxId;
        nextTaxIdUpdatedAt = undefined;
      }
    } else if (
      nextCleanName !== prevCleanName &&
      prevBound?.taxId &&
      currentCleanTaxId === prevBound.taxId
    ) {
      nextTaxId = '';
      nextTaxIdUpdatedAt = undefined;
    }

    let nextContact = formData.contractorContact || '';
    let nextContactUpdatedAt = formData.contractorContactUpdatedAt;

    if (nextBound?.contact) {
      if (
        !currentCleanContact ||
        nextCleanName !== prevCleanName ||
        currentCleanContact === (prevBound?.contact || '')
      ) {
        nextContact = nextBound.contact;
        nextContactUpdatedAt = undefined;
      }
    } else if (
      nextCleanName !== prevCleanName &&
      prevBound?.contact &&
      currentCleanContact === prevBound.contact
    ) {
      nextContact = '';
      nextContactUpdatedAt = undefined;
    }

    setFormData(prev => ({
      ...prev,
      contractorName: newName,
      contractorTaxId: nextTaxId,
      contractorTaxIdUpdatedAt: nextTaxIdUpdatedAt,
      contractorContact: nextContact,
      contractorContactUpdatedAt: nextContactUpdatedAt
    }));
  };

  const handleContractorTaxIdChange = (newTaxId: string) => {
    const nowIso = new Date().toISOString();
    setFormData(prev => ({
      ...prev,
      contractorTaxId: newTaxId,
      contractorTaxIdUpdatedAt: nowIso
    }));

    const cleanName = normalizeName(formData.contractorName);
    const cleanTaxId = newTaxId.trim();
    if (cleanName && cleanTaxId) {
      setLiveContractorOverrides(prev => ({
        ...prev,
        [cleanName]: {
          ...prev[cleanName],
          taxId: { value: cleanTaxId, timestamp: Date.now() }
        }
      }));
    }
  };

  const handleContractorContactChange = (newContact: string) => {
    const nowIso = new Date().toISOString();
    setFormData(prev => ({
      ...prev,
      contractorContact: newContact,
      contractorContactUpdatedAt: nowIso
    }));

    const cleanName = normalizeName(formData.contractorName);
    const cleanContact = normalizeName(newContact);
    if (cleanName && cleanContact) {
      setLiveContractorOverrides(prev => ({
        ...prev,
        [cleanName]: {
          ...prev[cleanName],
          contact: { value: cleanContact, timestamp: Date.now() }
        }
      }));
    }
  };

  // Category 5 Helpers (Work Notice, Delivery, Inspection, Disbursement)
  const addWorkNotice = () => {
    setFormData(prev => {
      const next: Project = {
        ...prev,
        workNotices: [
          ...prev.workNotices,
          {
            id: `wn-${Date.now()}`,
            bookNo: '',
            bookDate: '',
            actualWorkDate: '',
            notes: ''
          }
        ]
      };
      const derived = deriveProjectStatusFromData(next);
      baselineDerivedRef.current = derived;
      return hasManualStatusChange ? next : { ...next, status: derived };
    });
  };

  const addDelivery = () => {
    setFormData(prev => {
      const next: Project = {
        ...prev,
        deliveries: [
          ...prev.deliveries,
          {
            id: `del-${Date.now()}`,
            installment: prev.deliveries.length + 1,
            bookNo: '',
            bookDate: '',
            actualDeliveryDate: '',
            details: DEFAULT_DELIVERY_DETAILS
          }
        ]
      };
      const derived = deriveProjectStatusFromData(next);
      baselineDerivedRef.current = derived;
      return hasManualStatusChange ? next : { ...next, status: derived };
    });
  };

  const addInspection = () => {
    setFormData(prev => {
      const next: Project = {
        ...prev,
        inspections: [
          ...prev.inspections,
          {
            id: `insp-${Date.now()}`,
            installment: prev.inspections.length + 1,
            inspectionDate: '',
            result: 'pass',
            details: 'ตรวจรับงานถูกต้องตามแบบรูปรายการละเอียด'
          }
        ]
      };
      const derived = deriveProjectStatusFromData(next);
      baselineDerivedRef.current = derived;
      return hasManualStatusChange ? next : { ...next, status: derived };
    });
  };

  const addDisbursement = () => {
    setFormData(prev => {
      const next: Project = {
        ...prev,
        disbursements: [
          ...prev.disbursements,
          {
            id: `disb-${Date.now()}`,
            installment: prev.disbursements.length + 1,
            disbursementDate: '',
            petitionNo: '',
            amount: prev.contractAmount || 0,
            status: 'pending'
          }
        ]
      };
      const derived = deriveProjectStatusFromData(next);
      baselineDerivedRef.current = derived;
      return hasManualStatusChange ? next : { ...next, status: derived };
    });
  };

  // Category 6: Remuneration Helpers
  const addRemuneration = (type: 'tor_author' | 'tor' | 'supervisor' | 'inspection') => {
    const defaultAmounts = {
      tor_author: 1500,
      tor: 4500,
      supervisor: 3000,
      inspection: 4500
    };
    setFormData(prev => ({
      ...prev,
      remunerations: [
        ...prev.remunerations,
        {
          id: `rem-${Date.now()}`,
          type,
          title: REMUNERATION_TITLES[type],
          payeeName: getDefaultPayeeByType(type, prev),
          amount: defaultAmounts[type],
          withdrawDate: '',
          petitionNo: '',
          status: 'pending'
        }
      ]
    }));
  };

  // File Upload Helper with Google Drive integration
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, category: AttachmentFile['category']) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Swal.fire({
      title: 'กำลังอัปโหลดไฟล์แนบ...',
      text: 'กรุณารอสักครู่ ระบบกำลังส่งไฟล์ขึ้น Google Drive / คลาวด์เอกสาร',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const newAttachments: AttachmentFile[] = [];

    for (const file of Array.from(files)) {
      try {
        const driveRes = await uploadFileToDrive(file);
        newAttachments.push({
          id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: file.name,
          size: file.size,
          type: file.type || 'application/pdf',
          category,
          url: driveRes.fileUrl,
          uploadDate: new Date().toISOString().split('T')[0]
        });
      } catch (err) {
        console.error('Upload error', err);
      }
    }

    setFormData(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...newAttachments],
      fileUrl: newAttachments[0]?.url || prev.fileUrl,
      fileName: newAttachments[0]?.name || prev.fileName
    }));

    Swal.fire({
      icon: 'success',
      title: 'อัปโหลดไฟล์แนบสำเร็จ',
      text: `อัปโหลดจำนวน ${newAttachments.length} ไฟล์ เรียบร้อยแล้ว`,
      timer: 1300,
      showConfirmButton: false
    });
  };

  const ATTACHMENT_CATEGORY_LABELS: Record<AttachmentFile['category'], string> = {
    approval_request: 'ขออนุมัติโครงการ',
    other: 'เอกสารทั่วไป',
    tor: 'TOR / ราคากลาง',
    order: 'คำสั่งควบคุมงาน/ตรวจรับ',
    contract: 'สัญญาจ้างและแบบแปลน',
    notice: 'หนังสือแจ้งเข้าทำงาน',
    delivery: 'หนังสือส่งมอบงาน',
    inspection: 'รายงานผลตรวจรับงาน',
    disbursement: 'ฎีกาเบิกจ่ายเงิน',
    remuneration: 'เบิกค่าตอบแทนกรรมการ',
    project_record: 'บันทึกข้อมูลโครงการ'
  };

  const toggleDriveLinkForm = (target: AttachmentFile['category'] | 'archive') => {
    setOpenDriveLinkTarget(prev => (prev === target ? null : target));
    setDriveLinkError(null);
  };

  // Attach an existing Google Drive file by pasting its URL + custom display name (fast path for large files)
  const handleAddDriveLinkAttachment = (target: AttachmentFile['category'] | 'archive') => {
    const cleanName = driveLinkName.trim();
    const rawUrl = driveLinkUrl.trim();

    if (!cleanName) {
      setDriveLinkError('กรุณาระบุชื่อไฟล์ที่จะแสดงในระบบ');
      return;
    }
    if (!rawUrl) {
      setDriveLinkError('กรุณาวางลิงก์ URL ของไฟล์จาก Google Drive');
      return;
    }

    const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    try {
      const parsed = new URL(normalizedUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setDriveLinkError('รูปแบบ URL ไม่ถูกต้อง กรุณาใช้ลิงก์ที่ขึ้นต้นด้วย https://');
        return;
      }
    } catch {
      setDriveLinkError('รูปแบบ URL ไม่ถูกต้อง กรุณาตรวจสอบลิงก์ Google Drive อีกครั้ง');
      return;
    }

    if (target === 'archive') {
      const isImageName = /\.(jpg|jpeg|png|webp|gif)$/i.test(cleanName);
      const newArchiveFile: ProjectArchiveAttachment = {
        id: `arc-link-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: cleanName,
        size: 0,
        type: isImageName ? 'image/jpeg' : 'application/vnd.google-apps.file',
        photoStage: isImageName ? 'during' : 'document',
        caption: '',
        uploadDate: new Date().toISOString().split('T')[0],
        url: normalizedUrl
      };

      setFormData(prev => ({
        ...prev,
        projectRecord: {
          ...(prev.projectRecord || {}),
          files: [...(prev.projectRecord?.files || []), newArchiveFile],
          updatedAt: formatThaiDateTime()
        }
      }));
    } else {
      const newAtt: AttachmentFile = {
        id: `att-link-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: cleanName,
        size: 0,
        type: 'application/vnd.google-apps.file',
        category: target,
        url: normalizedUrl,
        uploadDate: new Date().toISOString().split('T')[0]
      };

      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, newAtt],
        fileUrl: prev.fileUrl || newAtt.url,
        fileName: prev.fileName || newAtt.name
      }));
    }

    setDriveLinkName('');
    setDriveLinkUrl('');
    setDriveLinkError(null);
    setOpenDriveLinkTarget(null);

    Swal.fire({
      icon: 'success',
      title: 'แนบลิงก์ไฟล์สำเร็จ',
      text: `เพิ่มลิงก์ "${cleanName}" เรียบร้อยแล้ว`,
      timer: 1300,
      showConfirmButton: false
    });
  };

  const renderDriveLinkInlineForm = (
    target: AttachmentFile['category'] | 'archive',
    placeholderName: string
  ) => {
    if (openDriveLinkTarget !== target) return null;

    return (
      <div className="mt-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs font-bold text-slate-800">
              แนบไฟล์ขนาดใหญ่ด้วยลิงก์ Google Drive (URL)
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              อัปโหลดไฟล์ขึ้น Google Drive โดยตรงแล้ววางลิงก์ที่นี่ (แนะนำเปิดสิทธิ์เป็น &ldquo;ทุกคนที่มีลิงก์สามารถดูได้&rdquo;)
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpenDriveLinkTarget(null);
              setDriveLinkError(null);
            }}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
            title="ปิดช่องแนบลิงก์"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              ชื่อไฟล์ที่จะแสดงในระบบ <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={driveLinkName}
              onChange={e => {
                setDriveLinkName(e.target.value);
                if (driveLinkError) setDriveLinkError(null);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddDriveLinkAttachment(target);
                }
              }}
              placeholder={placeholderName}
              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              ลิงก์ URL ของไฟล์ใน Google Drive <span className="text-rose-500">*</span>
            </label>
            <input
              type="url"
              value={driveLinkUrl}
              onChange={e => {
                setDriveLinkUrl(e.target.value);
                if (driveLinkError) setDriveLinkError(null);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddDriveLinkAttachment(target);
                }
              }}
              placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>

        {driveLinkError && (
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-rose-600">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{driveLinkError}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              setOpenDriveLinkTarget(null);
              setDriveLinkError(null);
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 text-xs font-medium transition"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => handleAddDriveLinkAttachment(target)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-2xs"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>เพิ่มลิงก์แนบ</span>
          </button>
        </div>
      </div>
    );
  };

  const removeAttachment = (id: string, fileName?: string) => {
    Swal.fire({
      title: 'ยืนยันการลบไฟล์แนบ?',
      text: `คุณต้องการลบไฟล์ "${fileName || 'เอกสารแนบ'}" ออกจากโครงการใช่หรือไม่`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'ยืนยันลบไฟล์',
      cancelButtonText: 'ยกเลิก'
    }).then(result => {
      if (result.isConfirmed) {
        setFormData(prev => ({
          ...prev,
          attachments: prev.attachments.filter(a => a.id !== id)
        }));
        Swal.fire({
          icon: 'success',
          title: 'ลบไฟล์แนบเรียบร้อยแล้ว',
          timer: 1200,
          showConfirmButton: false
        });
      }
    });
  };

  // Total remuneration calculation (exclude items marked as not eligible)
  const totalRemuneration = (formData.remunerations || [])
    .filter(r => r.status !== 'not_eligible')
    .reduce((sum, r) => sum + (r.amount || 0), 0);
  const paidRemuneration = (formData.remunerations || [])
    .filter(r => r.status === 'paid')
    .reduce((sum, r) => sum + (r.amount || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (duplicateCodeProject) {
      setActiveTab(1);
      Swal.fire({
        icon: 'warning',
        title: 'รหัสโครงการซ้ำในระบบ',
        text: `รหัส "${formData.projectCode.trim()}" ซ้ำกับโครงการ "${duplicateCodeProject.name}" (ปีงบประมาณ ${duplicateCodeProject.fiscalYear}) กรุณาแก้ไขรหัสโครงการก่อนบันทึก`,
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#047857'
      });
      return;
    }
    if (!formData.name.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'กรุณากรอกชื่อโครงการ',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#047857'
      });
      setActiveTab(1);
      return;
    }
    if (!formData.fiscalYear) {
      Swal.fire({
        icon: 'warning',
        title: 'กรุณาระบุปีงบประมาณ',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#047857'
      });
      setActiveTab(1);
      return;
    }

    const cleanedTorCommittees = (formData.torCommittees || []).filter(
      c => (c.name || '').trim().length > 0 || (c.position || '').trim().length > 0
    );
    const cleanedSupervisors = (formData.supervisors || []).filter(
      s => (s.name || '').trim().length > 0 || (s.position || '').trim().length > 0
    );
    const cleanedInspectCommittees = (formData.inspectCommittees || []).filter(
      c => (c.name || '').trim().length > 0 || (c.position || '').trim().length > 0
    );
    const finalFormData: Project = {
      ...formData,
      torCommittees: cleanedTorCommittees,
      supervisors: cleanedSupervisors,
      supervisorName: buildSupervisorNameSummary(cleanedSupervisors),
      inspectCommittees: cleanedInspectCommittees
    };

    const finalProgress = calculateProjectProgress(finalFormData);
    const previousStatus = initialProject?.status;
    const didStatusChange = initialProject
      ? finalFormData.status !== previousStatus
      : finalFormData.status !== 'not_started';

    onSave({
      ...finalFormData,
      progressPercent: finalProgress,
      statusUpdatedAt: didStatusChange ? formatThaiDateTime() : finalFormData.statusUpdatedAt,
      updatedAt: new Date().toISOString()
    });
  };

  const tabs = [
    { num: 1, title: '1. ข้อมูลทั่วไป', icon: FileText },
    { num: 2, title: '2. TOR & ราคากลาง', icon: Coins },
    { num: 3, title: '3. ควบคุม & ตรวจรับ', icon: Users },
    { num: 4, title: '4. สัญญาจ้าง', icon: FileCheck },
    { num: 5, title: '5. ดำเนินงาน & ฎีกา', icon: Clock },
    { num: 6, title: '6. ค่าตอบแทนกรรมการ', icon: HardHat },
    { num: 7, title: '7. บันทึกข้อมูลโครงการ', icon: MapPin }
  ];

  const handleArchiveCoordChange = (
    pointKey: 'startPoint' | 'endPoint' | 'signboardPoint',
    field: 'lat' | 'lng' | 'note',
    value: string
  ) => {
    const currentRec = formData.projectRecord || {};
    if (field === 'lat' || field === 'lng') {
      const parsed = tryParseCombinedLatLng(value);
      if (parsed) {
        setFormData({
          ...formData,
          projectRecord: {
            ...currentRec,
            [pointKey]: {
              ...(currentRec[pointKey] || { lat: '', lng: '', note: '' }),
              lat: parsed.lat,
              lng: parsed.lng
            },
            updatedAt: formatThaiDateTime()
          }
        });
        return;
      }
    }
    setFormData({
      ...formData,
      projectRecord: {
        ...currentRec,
        [pointKey]: {
          ...(currentRec[pointKey] || { lat: '', lng: '', note: '' }),
          [field]: value
        },
        updatedAt: formatThaiDateTime()
      }
    });
  };

  const handleArchiveFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    stage: NonNullable<ProjectArchiveAttachment['photoStage']> = 'during'
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Swal.fire({
      title: 'กำลังอัปโหลดรูปภาพ/ไฟล์โครงการ...',
      text: 'กรุณารอสักครู่ ระบบกำลังสร้างตัวอย่างรูปภาพและสำรองไฟล์',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const uploaded: ProjectArchiveAttachment[] = [];
    for (const file of Array.from(files)) {
      try {
        const [previewDataUrl, driveRes] = await Promise.all([
          createImagePreviewDataUrl(file),
          uploadFileToDrive(file)
        ]);
        uploaded.push({
          id: `arc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          size: file.size,
          type: file.type || 'image/jpeg',
          photoStage: stage,
          caption: '',
          uploadDate: new Date().toISOString().split('T')[0],
          url: driveRes.fileUrl,
          previewDataUrl
        });
      } catch (err) {
        console.error('Archive upload error', err);
      }
    }

    setFormData(prev => ({
      ...prev,
      projectRecord: {
        ...(prev.projectRecord || {}),
        files: [...(prev.projectRecord?.files || []), ...uploaded],
        updatedAt: formatThaiDateTime()
      }
    }));

    e.target.value = '';
    Swal.fire({
      icon: 'success',
      title: 'แนบไฟล์สำเร็จ',
      text: `เพิ่มรูปภาพ/ไฟล์โครงการ ${uploaded.length} รายการเรียบร้อยแล้ว`,
      timer: 1300,
      showConfirmButton: false
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-800 to-teal-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-700/60 rounded-xl">
              <HardHat className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold font-heading">
                {initialProject ? 'แก้ไขข้อมูลโครงการกองช่าง' : 'บันทึกโครงการใหม่'}
              </h3>
              <p className="text-xs text-emerald-200">
                รหัสโครงการ: <span className="font-mono">{formData.projectCode}</span> | ปีงบประมาณ พ.ศ. {formData.fiscalYear}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-emerald-200 hover:text-white hover:bg-emerald-700/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation (6 Categories) */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 flex gap-1 overflow-x-auto scrollbar-none py-1.5">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.num;
            return (
              <button
                key={tab.num}
                type="button"
                onClick={() => {
                  setActiveTab(tab.num);
                  setOpenDriveLinkTarget(null);
                  setDriveLinkError(null);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-700' : 'text-slate-400'}`} />
                <span>{tab.title}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* =========================================================================
              หมวดที่ 1: ข้อมูลทั่วไปของโครงการ
              ========================================================================= */}
          {activeTab === 1 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="border-b border-slate-200 pb-2">
                <h4 className="text-sm font-bold text-slate-800 font-heading">
                  หมวดที่ 1: ข้อมูลทั่วไปของโครงการ
                </h4>
                <p className="text-xs text-slate-500">กรอกข้อมูลพื้นฐาน งบประมาณ และสถานที่ดำเนินงาน</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ปีงบประมาณ <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.fiscalYear}
                    onChange={e => {
                      const yr = Number(e.target.value);
                      const oldCode = (formData.projectCode || '').trim();
                      let newCode = oldCode;

                      if (!hasManualCodeEdit) {
                        newCode = generateNextProjectCode(projectCodePrefix, yr, initialProject?.id);
                      } else {
                        const match = oldCode.match(/^(ถ\.|อ\.|ช\.)\d{2}-(.*)$/);
                        if (match) {
                          newCode = `${match[1]}${String(yr).slice(-2)}-${match[2]}`;
                        }
                      }

                      const shouldSyncApprovalYear =
                        !formData.approvalYear || formData.approvalYear === formData.fiscalYear;

                      setFormData({
                        ...formData,
                        fiscalYear: yr,
                        projectCode: newCode,
                        ...(shouldSyncApprovalYear ? { approvalYear: yr } : {})
                      });
                    }}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold text-slate-800"
                  >
                    {(() => {
                      const currentFY = getCurrentThaiFiscalYear();
                      const maxFutureFY = Math.max(2575, currentFY + 5);
                      const minPastFY = Math.min(2565, formData.fiscalYear || 2565);
                      const currentAndFutureYears: number[] = [];
                      for (let y = currentFY; y <= maxFutureFY; y++) {
                        currentAndFutureYears.push(y);
                      }
                      const pastYears: number[] = [];
                      for (let y = currentFY - 1; y >= minPastFY; y--) {
                        pastYears.push(y);
                      }
                      return (
                        <>
                          <optgroup label="ปีงบประมาณปัจจุบันและล่วงหน้า">
                            {currentAndFutureYears.map(yr => (
                              <option key={yr} value={yr}>
                                ปีงบประมาณ พ.ศ. {yr}
                                {yr === currentFY ? ' (ปีงบประมาณปัจจุบัน)' : ''}
                              </option>
                            ))}
                          </optgroup>
                          {pastYears.length > 0 && (
                            <optgroup label="เพิ่มโครงการย้อนหลัง">
                              {pastYears.map(yr => (
                                <option key={yr} value={yr}>
                                  ปีงบประมาณ พ.ศ. {yr} (ย้อนหลัง)
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </>
                      );
                    })()}
                  </select>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    ค่าเริ่มต้นอ้างอิงปีงบประมาณปัจจุบัน (พ.ศ. {getCurrentThaiFiscalYear()}) หากเพิ่มย้อนหลังเลือกปีเดิมได้
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      รหัสโครงการ
                    </label>
                    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[10px] font-semibold">
                      <button
                        type="button"
                        onClick={() => {
                          setProjectCodePrefix('ถ.');
                          setHasManualPrefixChoice(true);
                          setHasManualCodeEdit(false);
                          setFormData(prev => ({
                            ...prev,
                            projectCode: generateNextProjectCode('ถ.', prev.fiscalYear, initialProject?.id)
                          }));
                        }}
                        className={`px-2 py-0.5 rounded-md transition whitespace-nowrap ${
                          projectCodePrefix === 'ถ.'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="รันเลขโครงการถนนอัตโนมัติ (ถ.ปีงบ-xxx)"
                      >
                        ถนน (ถ.)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProjectCodePrefix('อ.');
                          setHasManualPrefixChoice(true);
                          setHasManualCodeEdit(false);
                          setFormData(prev => ({
                            ...prev,
                            projectCode: generateNextProjectCode('อ.', prev.fiscalYear, initialProject?.id)
                          }));
                        }}
                        className={`px-2 py-0.5 rounded-md transition whitespace-nowrap ${
                          projectCodePrefix === 'อ.'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="รันเลขโครงการอาคารอัตโนมัติ (อ.ปีงบ-xxx)"
                      >
                        อาคาร (อ.)
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.projectCode}
                      onChange={e => {
                        const val = e.target.value;
                        setHasManualCodeEdit(true);
                        if (val.trim().startsWith('อ.')) {
                          setProjectCodePrefix('อ.');
                        } else if (val.trim().startsWith('ถ.')) {
                          setProjectCodePrefix('ถ.');
                        }
                        setFormData({ ...formData, projectCode: val });
                      }}
                      placeholder="เช่น ถ.69-001 หรือ อ.69-001"
                      aria-invalid={Boolean(duplicateCodeProject)}
                      className={`w-full pl-3 pr-9 py-2 rounded-xl text-sm font-mono transition border ${
                        duplicateCodeProject
                          ? 'bg-rose-50/60 border-rose-500 text-rose-900 focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                          : 'bg-slate-50 border-slate-300 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
                      }`}
                    />
                    {formData.projectCode.trim() && (
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        {duplicateCodeProject ? (
                          <AlertCircle className="w-4 h-4 text-rose-600" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        )}
                      </div>
                    )}
                  </div>
                  {duplicateCodeProject ? (
                    <div className="mt-1.5 p-2 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-800 space-y-1">
                      <div className="flex items-start gap-1.5 font-semibold leading-snug">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                        <span>
                          รหัสซ้ำกับ: {duplicateCodeProject.name} (ปีงบ {duplicateCodeProject.fiscalYear})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const nextCode = generateNextProjectCode(
                            projectCodePrefix,
                            formData.fiscalYear,
                            initialProject?.id
                          );
                          setHasManualCodeEdit(false);
                          setFormData(prev => ({ ...prev, projectCode: nextCode }));
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white hover:bg-rose-100/70 text-rose-700 font-bold border border-rose-300 text-[10px] transition"
                      >
                        ใช้รหัสถัดไปอัตโนมัติ (
                        {generateNextProjectCode(projectCodePrefix, formData.fiscalYear, initialProject?.id)})
                      </button>
                    </div>
                  ) : (
                    <div className="text-[10px] mt-0.5 flex items-center justify-between gap-2">
                      <span className="text-slate-400">
                        รันอัตโนมัติ: ถ. = ถนน, อ. = อาคาร (แก้ไขเองได้)
                      </span>
                      {formData.projectCode.trim() && (
                        <span className="text-emerald-700 font-semibold whitespace-nowrap">
                          ไม่ซ้ำในระบบ
                        </span>
                      )}
                    </div>
                  )}
                  {!duplicateCodeProject &&
                    vacantProjectCodes.length > 0 &&
                    !vacantProjectCodes.includes(formData.projectCode.trim()) && (
                      <div className="mt-1.5 p-2 rounded-xl bg-amber-50/90 border border-amber-200/90 text-[11px] text-amber-900 space-y-1">
                        <div className="font-semibold text-[10px] text-amber-800">
                          พบเลขรหัสว่างในหมวดนี้ ({vacantProjectCodes.length} รหัส) — คลิกเพื่อนำกลับมาใช้ได้:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {vacantProjectCodes.slice(0, 6).map(code => (
                            <button
                              key={code}
                              type="button"
                              onClick={() => {
                                setHasManualCodeEdit(true);
                                setFormData(prev => ({ ...prev, projectCode: code }));
                              }}
                              className="px-2 py-0.5 rounded-md bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-mono font-bold text-[10px] transition shadow-2xs"
                              title={`คลิกเพื่อใช้รหัสว่าง ${code}`}
                            >
                              {code}
                            </button>
                          ))}
                          {vacantProjectCodes.length > 6 && (
                            <span className="text-[10px] text-amber-700 self-center">
                              +{vacantProjectCodes.length - 6} รหัส
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    สถานะโครงการ
                  </label>
                  <select
                    value={formData.status}
                    onChange={e => {
                      setHasManualStatusChange(true);
                      setFormData({ ...formData, status: e.target.value as ProjectStatus });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="not_started">ยังไม่เริ่มดำเนินการ</option>
                    <option value="procurement_tor">จัดทำ TOR/ราคากลาง</option>
                    <option value="contracted">ลงนามสัญญาแล้ว</option>
                    <option value="in_progress">อยู่ระหว่างดำเนินการ</option>
                    <option value="delivered">ส่งมอบงานแล้ว รอตรวจรับ</option>
                    <option value="inspected">ตรวจรับงานแล้ว รอเบิกจ่าย</option>
                    <option value="completed">แล้วเสร็จ/เบิกจ่ายแล้ว</option>
                    <option value="overdue">เกินกำหนดสัญญา</option>
                    <option value="cancelled">ยกเลิกโครงการ</option>
                  </select>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {formData.statusUpdatedAt
                      ? `อัปเดตสถานะล่าสุด: ${formData.statusUpdatedAt}`
                      : 'อัปเดตอัตโนมัติตามขั้นตอนข้อมูล (หรือเลือกปรับเองได้)'}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อโครงการ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => {
                    const nextName = e.target.value;
                    let nextCodePrefix: 'ถ.' | 'อ.' | null = null;
                    if (!initialProject && !hasManualCodeEdit && !hasManualPrefixChoice) {
                      const inferred = inferProjectCodePrefix(nextName);
                      if (inferred && inferred !== projectCodePrefix) {
                        nextCodePrefix = inferred;
                        setProjectCodePrefix(inferred);
                      }
                    }

                    const autoLocation =
                      !initialProject && !hasManualLocationEdit
                        ? buildLocationFromProjectName(nextName) || DEFAULT_PROJECT_LOCATION
                        : null;

                    setFormData(prev => ({
                      ...prev,
                      name: nextName,
                      ...(nextCodePrefix
                        ? { projectCode: generateNextProjectCode(nextCodePrefix, prev.fiscalYear) }
                        : {}),
                      ...(autoLocation !== null ? { location: autoLocation } : {})
                    }));
                  }}
                  placeholder="เช่น โครงการก่อสร้างถนน คสล. สายหนองตาใกล้ หมู่ที่ 3"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    หมวดงบประมาณ <span className="text-rose-500">*</span>
                  </label>
                  <AutoSuggestInput
                    value={formData.budgetCategory || ''}
                    onChange={val => setFormData({ ...formData, budgetCategory: val })}
                    suggestions={Array.from(
                      new Set([
                        'เงินสะสม',
                        'งบประมาณรายจ่าย',
                        'เงินอุดหนุนเฉพาะกิจ',
                        'เงินอุดหนุนทั่วไป',
                        'เงินกู้/งบกลาง',
                        'กันเงินงบประมาณ',
                        ...existingCategories
                      ])
                    )}
                    minCharsToSuggest={0}
                    openOnFocus
                    showToggleButton
                    placeholder="พิมพ์ชื่อหมวด เช่น กันเงินงบประมาณ..."
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    สมัยประชุม/ครั้งที่ (กรณีเงินสะสม)
                  </label>
                  <input
                    type="text"
                    value={formData.meetingSession || ''}
                    onChange={e => setFormData({ ...formData, meetingSession: e.target.value })}
                    placeholder="เช่น สมัยสามัญ สมัยที่ 2 ครั้งที่ 1/2569"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      ปี พ.ศ. ของมติหรือการอนุมัติ
                    </label>
                    {formData.approvalYear !== formData.fiscalYear && (
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, approvalYear: formData.fiscalYear })
                        }
                        className="text-[10px] font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
                      >
                        ตามปีงบประมาณ
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    value={formData.approvalYear || ''}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        approvalYear: e.target.value ? Number(e.target.value) : undefined
                      })
                    }
                    placeholder={`เช่น ${formData.fiscalYear}`}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    งบประมาณที่ได้รับอนุมัติ (บาท) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.approvedBudget || ''}
                    onChange={e => setFormData({ ...formData, approvedBudget: Number(e.target.value) })}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-emerald-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {formatCurrency(formData.approvedBudget)} บาท
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ความคืบหน้า (คำนวณอัตโนมัติจาก 12 ขั้นตอน)
                  </label>
                  <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex-1">
                      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${calculateProjectProgress(formData)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 flex justify-between gap-2">
                        <span>ผ่านแล้ว {countCompletedSteps(formData)}/12 ขั้นตอน</span>
                        <span className="font-semibold text-slate-700">เริ่มที่ขออนุมัติโครงการ</span>
                      </div>
                    </div>
                    <span className="font-bold text-sm px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg">
                      {calculateProjectProgress(formData)}%
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ผู้รับผิดชอบโครงการ (กองช่าง อบต.ไร่ใต้)
                  </label>
                  <AutoSuggestInput
                    value={formData.responsiblePerson || ''}
                    onChange={val => setFormData({ ...formData, responsiblePerson: val })}
                    suggestions={suggestedPersonNames}
                    onRemoveSuggestion={handleHideSuggestion}
                    placeholder="พิมพ์ชื่อเพื่อค้นหา เช่น นายศรายุทธ..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    สถานที่ดำเนินโครงการ
                  </label>
                  {(() => {
                    const suggestedLoc = buildLocationFromProjectName(formData.name);
                    if (!suggestedLoc || suggestedLoc === formData.location.trim()) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          setHasManualLocationEdit(false);
                          setFormData(prev => ({ ...prev, location: suggestedLoc }));
                        }}
                        className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline transition"
                      >
                        ดึงชื่อถนนจากชื่อโครงการ
                      </button>
                    );
                  })()}
                </div>
                <input
                  type="text"
                  value={formData.location}
                  onChange={e => {
                    setHasManualLocationEdit(true);
                    setFormData({ ...formData, location: e.target.value });
                  }}
                  placeholder="เช่น สายหนองตาใกล้ ต.ไร่ใต้ อ.พิบูลมังสาหาร จ.อุบลราชธานี"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <div className="text-[10px] text-slate-400 mt-0.5">
                  หากชื่อโครงการระบุสายถนน (เช่น สายหนองตาใกล้, สายพ่อฤทธิ์) ระบบจะดึงมาเติมให้อัตโนมัติพร้อม ต.ไร่ใต้ อ.พิบูลมังสาหาร จ.อุบลราชธานี
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  รายละเอียดโครงการ
                </label>
                <textarea
                  rows={3}
                  value={formData.description || ''}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="รายละเอียดแบบรูปรายการ ปริมาณงาน ความกว้าง ความยาว ความหนา หรือมาตรฐานช่าง..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หมายเหตุ
                </label>
                <input
                  type="text"
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="บันทึกข้อความเพิ่มเติม หรือสถานะพิเศษ..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* ขั้นตอนที่ 1: หนังสือขออนุมัติโครงการ (เริ่มนับความคืบหน้าและนำเข้ากล่องงานของฉัน) */}
              <div className="p-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h5 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>ขออนุมัติโครงการ (ขั้นตอนที่ 1 จาก 12 ขั้นตอน)</span>
                    </h5>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      เมื่อบันทึกเลขที่หรือวันที่หนังสือขออนุมัติ (หรือรับข้อมูลจากระบบสารบรรณ) ระบบจะเริ่มนับความคืบหน้าขั้นตอนที่ 1 และแสดงในกล่องงานของฉันอัตโนมัติ
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap shrink-0 self-start sm:self-center ${
                      hasProjectApprovalData(formData)
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-white text-slate-500 border-slate-200'
                    }`}
                  >
                    {hasProjectApprovalData(formData) ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>นับขั้นตอนที่ 1 แล้ว • เข้ากล่องงาน</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>ยังไม่บันทึกขออนุมัติ (ยังไม่เข้ากล่องงาน)</span>
                      </>
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      เลขที่หนังสือขออนุมัติ
                    </label>
                    <input
                      type="text"
                      value={formData.approvalRequestNo || ''}
                      onChange={e =>
                        setFormData({ ...formData, approvalRequestNo: e.target.value })
                      }
                      placeholder="เช่น อบ 74503/... หรือ ที่ กช. ..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      วันที่หนังสือขออนุมัติ{' '}
                      {formData.approvalRequestDate && (
                        <span className="font-normal text-emerald-700">
                          ({formatThaiDate(formData.approvalRequestDate)})
                        </span>
                      )}
                    </label>
                    <input
                      type="date"
                      value={formData.approvalRequestDate || ''}
                      onChange={e =>
                        setFormData({ ...formData, approvalRequestDate: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-slate-500">
                    รองรับการรับหนังสือขออนุมัติจากคิวสารบรรณ (รหัสหมวด <span className="font-mono text-emerald-800 font-semibold">project_approval</span>)
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleDriveLinkForm('approval_request')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition whitespace-nowrap ${
                        openDriveLinkTarget === 'approval_request'
                          ? 'bg-sky-600 text-white border-sky-600 hover:bg-sky-700'
                          : 'bg-white hover:bg-sky-50 text-sky-800 border-sky-300'
                      }`}
                    >
                      <Link2 className="w-3 h-3" />
                      <span>แนบลิงก์หนังสือขออนุมัติ</span>
                    </button>
                    <label className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-800 rounded-lg text-[11px] font-bold border border-emerald-300 transition whitespace-nowrap">
                      <Upload className="w-3 h-3" />
                      <span>อัปโหลดหนังสือขออนุมัติ</span>
                      <input
                        type="file"
                        multiple
                        onChange={e => handleFileUpload(e, 'approval_request')}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {renderDriveLinkInlineForm('approval_request', 'เช่น หนังสือขออนุมัติโครงการ.pdf')}
              </div>

              {/* รายการไฟล์แนบในระบบทั้งหมด (Google Drive) */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-emerald-700 shrink-0" />
                    <h5 className="text-xs font-bold text-slate-800">
                      รายการไฟล์แนบและคลังเอกสารในระบบ ({formData.attachments?.length || 0} ไฟล์)
                    </h5>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleDriveLinkForm('other')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition shadow-2xs whitespace-nowrap shrink-0 ${
                        openDriveLinkTarget === 'other'
                          ? 'bg-sky-600 text-white border-sky-600 hover:bg-sky-700'
                          : 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-300'
                      }`}
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>+ แนบลิงก์ Drive (URL)</span>
                    </button>
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-300 transition shadow-2xs whitespace-nowrap shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      <span>+ อัปโหลดไฟล์แนบเพิ่ม</span>
                      <input
                        type="file"
                        multiple
                        onChange={e => handleFileUpload(e, 'other')}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* ฟอร์มแนบลิงก์ Google Drive (URL) */}
                {renderDriveLinkInlineForm('other', 'เช่น เอกสารประกอบโครงการทั่วไป.pdf')}

                {formData.attachments && formData.attachments.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {formData.attachments.map(att => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 hover:bg-emerald-50/40 rounded-xl border border-slate-200 text-xs transition"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          {att.size === 0 ? (
                            <Link2 className="w-4 h-4 text-sky-600 shrink-0" />
                          ) : (
                            <Paperclip className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                          <div className="overflow-hidden">
                            <div className="font-semibold text-slate-800 truncate" title={att.name}>
                              {att.name}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              หมวด:{' '}
                              <span className="font-semibold text-emerald-800">
                                {ATTACHMENT_CATEGORY_LABELS[att.category] || att.category}
                              </span>{' '}
                              · {att.size > 0 ? `${(att.size / 1024).toFixed(1)} KB` : 'ลิงก์ Drive'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {att.url && (
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded-lg transition inline-flex items-center gap-1 font-bold text-[10px]"
                              title="เปิดดูไฟล์ใน Google Drive"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span className="hidden sm:inline">Drive</span>
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => removeAttachment(att.id, att.name)}
                            className="px-2 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 rounded-lg transition inline-flex items-center gap-1 text-[10px] font-semibold"
                            title="ลบไฟล์แนบออกจากโครงการ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>ลบ</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                    ยังไม่มีไฟล์แนบในโครงการนี้ (สามารถอัปโหลดไฟล์หรือแนบลิงก์ Google Drive ได้ที่นี่หรือตามหมวดงาน)
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              หมวดที่ 2: ข้อมูลการจัดทำ TOR และราคากลาง
              ========================================================================= */}
          {activeTab === 2 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="border-b border-slate-200 pb-2">
                <h4 className="text-sm font-bold text-slate-800 font-heading">
                  หมวดที่ 2: ข้อมูลการจัดทำ TOR และราคากลาง
                </h4>
                <p className="text-xs text-slate-500">
                  บันทึกคำสั่งแต่งตั้ง คณะกรรมการจัดทำแบบรูปรายการและกำหนดราคากลาง
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เลขที่คำสั่งแต่งตั้ง กก. จัดทำ TOR/ราคากลาง
                  </label>
                  <input
                    type="text"
                    value={formData.torOrderNo || ''}
                    onChange={e => setFormData({ ...formData, torOrderNo: e.target.value })}
                    placeholder="เช่น 142/2567"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    วันที่ออกคำสั่ง
                  </label>
                  <input
                    type="date"
                    value={formData.torOrderDate || ''}
                    onChange={e => setFormData({ ...formData, torOrderDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ผู้จัดทำ TOR
                  </label>
                  <AutoSuggestInput
                    value={formData.torAuthor || ''}
                    onChange={val => setFormData({ ...formData, torAuthor: val })}
                    suggestions={suggestedPersonNames}
                    onRemoveSuggestion={handleHideSuggestion}
                    placeholder="พิมพ์ชื่อเพื่อค้นหา เช่น นายธวัชชัย..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    วันที่จัดทำ TOR
                  </label>
                  <input
                    type="date"
                    value={formData.torDate || ''}
                    onChange={e => setFormData({ ...formData, torDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    วันที่จัดทำราคากลาง
                  </label>
                  <input
                    type="date"
                    value={formData.refPriceDate || ''}
                    onChange={e => setFormData({ ...formData, refPriceDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ราคากลาง (บาท)
                  </label>
                  <input
                    type="number"
                    value={formData.refPrice || ''}
                    onChange={e => setFormData({ ...formData, refPrice: Number(e.target.value) })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {formatCurrency(formData.refPrice)} บาท
                  </div>
                </div>
              </div>

              {/* Committee Members List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    รายชื่อคณะกรรมการกำหนดราคากลาง ({formData.torCommittees.length} คน)
                  </span>
                  <button
                    type="button"
                    onClick={addTorCommittee}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> เพิ่มกรรมการ
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.torCommittees.map((c, idx) => (
                    <div
                      key={c.id}
                      className="flex flex-col sm:flex-row items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200"
                    >
                      <span className="text-xs font-bold text-slate-400 w-6 text-center">
                        {idx + 1}
                      </span>
                      <div className="flex-1 w-full">
                        <AutoSuggestInput
                          value={c.name || ''}
                          onChange={val => handleCommitteeNameChange('torCommittees', idx, val)}
                          suggestions={suggestedPersonNames}
                          getItemHint={getBoundPositionHint}
                          onRemoveSuggestion={handleHideSuggestion}
                          placeholder="ชื่อ-นามสกุลกรรมการ..."
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div className="flex-1 w-full">
                        <AutoSuggestInput
                          value={c.position || ''}
                          onChange={val => handleCommitteePositionChange('torCommittees', idx, val)}
                          suggestions={suggestedPositions}
                          onRemoveSuggestion={handleHideSuggestion}
                          placeholder="ตำแหน่งราชการ..."
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <select
                        value={c.role}
                        onChange={e => {
                          const updated = [...formData.torCommittees];
                          updated[idx].role = e.target.value as any;
                          setFormData({ ...formData, torCommittees: updated });
                        }}
                        className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      >
                        <option value="ประธานกรรมการ">ประธานกรรมการ</option>
                        <option value="กรรมการ">กรรมการ</option>
                        <option value="กรรมการและเลขานุการ">กรรมการและเลขานุการ</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeTorCommittee(c.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* หมายเหตุหมวด TOR และราคากลาง */}
              <div className="pt-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หมายเหตุหมวด TOR / ราคากลาง
                </label>
                <textarea
                  rows={2}
                  value={formData.torNotes || ''}
                  onChange={e => setFormData({ ...formData, torNotes: e.target.value })}
                  placeholder="บันทึกหมายเหตุเพิ่มเติมเกี่ยวกับการจัดทำ TOR หรือการกำหนดราคากลาง (ถ้ามี)..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Attachments Section */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ไฟล์แนบคำสั่งแต่งตั้ง TOR และเอกสารราคากลาง (PDF, Excel, Word)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium border border-slate-300 whitespace-nowrap shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>เลือกไฟล์แนบ...</span>
                    <input
                      type="file"
                      multiple
                      onChange={e => handleFileUpload(e, 'tor')}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => toggleDriveLinkForm('tor')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition whitespace-nowrap shrink-0 ${
                      openDriveLinkTarget === 'tor'
                        ? 'bg-sky-600 text-white border-sky-600 hover:bg-sky-700'
                        : 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-300'
                    }`}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>+ แนบลิงก์ Drive (URL)</span>
                  </button>
                  <span className="text-xs text-slate-400">
                    {formData.attachments.filter(a => a.category === 'tor').length} ไฟล์แนบในหมวดนี้
                  </span>
                </div>

                {renderDriveLinkInlineForm('tor', 'เช่น แบบรูปรายการและราคากลาง (ปร.4 ปร.5).pdf')}

                <div className="mt-2 space-y-1">
                  {formData.attachments
                    .filter(a => a.category === 'tor')
                    .map(att => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-2 bg-emerald-50/60 rounded-lg border border-emerald-200 text-xs text-emerald-900"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {att.size === 0 ? (
                            <Link2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                          ) : (
                            <Paperclip className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          )}
                          <span className="font-medium truncate">{att.name}</span>
                          <span className="text-[10px] text-emerald-700 shrink-0">
                            ({att.size > 0 ? `${(att.size / 1024).toFixed(1)} KB` : 'ลิงก์ Drive'})
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {att.url && (
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-0.5 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded-md transition inline-flex items-center gap-1 font-bold text-[10px]"
                              title="เปิดดูไฟล์ใน Google Drive"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Drive</span>
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => removeAttachment(att.id, att.name)}
                            className="px-2 py-0.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-md transition inline-flex items-center gap-1 text-[10px] font-semibold"
                            title="ลบไฟล์แนบ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>ลบ</span>
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              หมวดที่ 3: คำสั่งควบคุมงานและตรวจรับงาน
              ========================================================================= */}
          {activeTab === 3 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="border-b border-slate-200 pb-2">
                <h4 className="text-sm font-bold text-slate-800 font-heading">
                  หมวดที่ 3: คำสั่งควบคุมงานและตรวจรับงาน
                </h4>
                <p className="text-xs text-slate-500">
                  บันทึกคำสั่งแต่งตั้ง ผู้ควบคุมงาน และคณะกรรมการตรวจรับพัสดุในงานจ้างก่อสร้าง
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เลขที่คำสั่งแต่งตั้ง
                  </label>
                  <input
                    type="text"
                    value={formData.inspectOrderNo || ''}
                    onChange={e => setFormData({ ...formData, inspectOrderNo: e.target.value })}
                    placeholder="เช่น 185/2567"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    วันที่ออกคำสั่ง
                  </label>
                  <input
                    type="date"
                    value={formData.inspectOrderDate || ''}
                    onChange={e => setFormData({ ...formData, inspectOrderDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Supervisors List (supports 1 or more supervisors) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    รายชื่อผู้ควบคุมงาน ({(formData.supervisors || []).length} คน)
                  </span>
                  <button
                    type="button"
                    onClick={addSupervisor}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" /> ผู้ควบคุมงาน
                  </button>
                </div>

                <div className="space-y-2">
                  {(formData.supervisors || []).length === 0 ? (
                    <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 text-center">
                      ยังไม่มีรายชื่อผู้ควบคุมงาน กดปุ่ม &ldquo;+ ผู้ควบคุมงาน&rdquo; ด้านบนเพื่อเพิ่ม
                    </div>
                  ) : (
                    (formData.supervisors || []).map((sup, idx) => (
                      <div
                        key={sup.id}
                        className="flex flex-col sm:flex-row items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200"
                      >
                        <span className="text-xs font-bold text-slate-400 w-6 text-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="flex-1 w-full">
                          <AutoSuggestInput
                            value={sup.name || ''}
                            onChange={val => handleCommitteeNameChange('supervisors', idx, val)}
                            suggestions={suggestedPersonNames}
                            getItemHint={getBoundPositionHint}
                            onRemoveSuggestion={handleHideSuggestion}
                            placeholder="ชื่อ-นามสกุล ผู้ควบคุมงาน..."
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                          />
                        </div>
                        <div className="flex-1 w-full">
                          <AutoSuggestInput
                            value={sup.position || ''}
                            onChange={val => handleCommitteePositionChange('supervisors', idx, val)}
                            suggestions={suggestedPositions}
                            onRemoveSuggestion={handleHideSuggestion}
                            placeholder="ตำแหน่ง..."
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSupervisor(sup.id)}
                          title="ลบผู้ควบคุมงาน"
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Inspection Committee List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    รายชื่อคณะกรรมการตรวจรับงานจ้าง ({formData.inspectCommittees.length} คน)
                  </span>
                  <button
                    type="button"
                    onClick={addInspectCommittee}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> เพิ่มกรรมการตรวจรับ
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.inspectCommittees.map((c, idx) => (
                    <div
                      key={c.id}
                      className="flex flex-col sm:flex-row items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200"
                    >
                      <span className="text-xs font-bold text-slate-400 w-6 text-center">
                        {idx + 1}
                      </span>
                      <div className="flex-1 w-full">
                        <AutoSuggestInput
                          value={c.name || ''}
                          onChange={val => handleCommitteeNameChange('inspectCommittees', idx, val)}
                          suggestions={suggestedPersonNames}
                          getItemHint={getBoundPositionHint}
                          onRemoveSuggestion={handleHideSuggestion}
                          placeholder="ชื่อ-นามสกุล..."
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div className="flex-1 w-full">
                        <AutoSuggestInput
                          value={c.position || ''}
                          onChange={val => handleCommitteePositionChange('inspectCommittees', idx, val)}
                          suggestions={suggestedPositions}
                          onRemoveSuggestion={handleHideSuggestion}
                          placeholder="ตำแหน่ง..."
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <select
                        value={c.role}
                        onChange={e => {
                          const updated = [...formData.inspectCommittees];
                          updated[idx].role = e.target.value as any;
                          setFormData({ ...formData, inspectCommittees: updated });
                        }}
                        className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      >
                        <option value="ประธานกรรมการ">ประธานกรรมการ</option>
                        <option value="กรรมการ">กรรมการ</option>
                        <option value="กรรมการและเลขานุการ">กรรมการและเลขานุการ</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeInspectCommittee(c.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Attachments Section */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ไฟล์แนบคำสั่งแต่งตั้งผู้ควบคุมงานและกรรมการตรวจรับ
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium border border-slate-300 whitespace-nowrap shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>เลือกไฟล์แนบคำสั่ง...</span>
                    <input
                      type="file"
                      multiple
                      onChange={e => handleFileUpload(e, 'order')}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => toggleDriveLinkForm('order')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition whitespace-nowrap shrink-0 ${
                      openDriveLinkTarget === 'order'
                        ? 'bg-sky-600 text-white border-sky-600 hover:bg-sky-700'
                        : 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-300'
                    }`}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>+ แนบลิงก์ Drive (URL)</span>
                  </button>
                  <span className="text-xs text-slate-400">
                    {formData.attachments.filter(a => a.category === 'order').length} ไฟล์แนบในหมวดนี้
                  </span>
                </div>

                {renderDriveLinkInlineForm('order', 'เช่น คำสั่งแต่งตั้งผู้ควบคุมงานและกรรมการตรวจรับ.pdf')}

                <div className="mt-2 space-y-1">
                  {formData.attachments
                    .filter(a => a.category === 'order')
                    .map(att => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-2 bg-emerald-50/60 rounded-lg border border-emerald-200 text-xs text-emerald-900"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {att.size === 0 ? (
                            <Link2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                          ) : (
                            <Paperclip className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          )}
                          <span className="font-medium truncate">{att.name}</span>
                          {att.size === 0 && (
                            <span className="text-[10px] text-emerald-700 shrink-0">(ลิงก์ Drive)</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {att.url && (
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-0.5 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded-md transition inline-flex items-center gap-1 font-bold text-[10px]"
                              title="เปิดดูไฟล์ใน Google Drive"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Drive</span>
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => removeAttachment(att.id, att.name)}
                            className="px-2 py-0.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-md transition inline-flex items-center gap-1 text-[10px] font-semibold"
                            title="ลบไฟล์แนบ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>ลบ</span>
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              หมวดที่ 4: ข้อมูลสัญญาจ้าง
              ========================================================================= */}
          {activeTab === 4 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="border-b border-slate-200 pb-2">
                <h4 className="text-sm font-bold text-slate-800 font-heading">
                  หมวดที่ 4: ข้อมูลสัญญาจ้าง
                </h4>
                <p className="text-xs text-slate-500">
                  บันทึกข้อมูลสัญญา วงเงินสัญญา วันที่เริ่มต้น-สิ้นสุด และรายละเอียดผู้รับจ้าง
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เลขที่สัญญาจ้าง
                  </label>
                  <input
                    type="text"
                    value={formData.contractNo || ''}
                    onChange={e => setFormData({ ...formData, contractNo: e.target.value })}
                    placeholder="เช่น 18/2568"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    วันที่ลงนามในสัญญา
                  </label>
                  <input
                    type="date"
                    value={formData.contractDate || ''}
                    onChange={e => setFormData({ ...formData, contractDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    วงเงินตามสัญญา (บาท)
                  </label>
                  <input
                    type="number"
                    value={formData.contractAmount || ''}
                    onChange={e => setFormData({ ...formData, contractAmount: Number(e.target.value) })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-emerald-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {formatCurrency(formData.contractAmount)} บาท
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    วันที่เริ่มสัญญา
                  </label>
                  <input
                    type="date"
                    value={formData.startDate || ''}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    วันที่สิ้นสุดสัญญา
                  </label>
                  <input
                    type="date"
                    value={formData.endDate || ''}
                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อผู้รับจ้าง
                  </label>
                  <AutoSuggestInput
                    value={formData.contractorName || ''}
                    onChange={handleContractorNameChange}
                    suggestions={suggestedContractorNames}
                    getItemHint={getBoundContractorHint}
                    onRemoveSuggestion={handleHideSuggestion}
                    placeholder="เช่น หจก. บุญบันดาลการช่างและโยธา"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เลขประจำตัวผู้เสียภาษี (13 หลัก)
                  </label>
                  <input
                    type="text"
                    maxLength={13}
                    value={formData.contractorTaxId || ''}
                    onChange={e => handleContractorTaxIdChange(e.target.value)}
                    placeholder="0103541098231"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ที่อยู่และข้อมูลติดต่อผู้รับจ้าง
                </label>
                <input
                  type="text"
                  value={formData.contractorContact || ''}
                  onChange={e => handleContractorContactChange(e.target.value)}
                  placeholder="ที่อยู่ เบอร์โทรศัพท์ และอีเมลผู้รับจ้าง..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Attachments Section */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ไฟล์แนบสัญญาจ้างและแบบแปลนก่อสร้าง
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium border border-slate-300 whitespace-nowrap shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>เลือกไฟล์แนบสัญญา...</span>
                    <input
                      type="file"
                      multiple
                      onChange={e => handleFileUpload(e, 'contract')}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => toggleDriveLinkForm('contract')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition whitespace-nowrap shrink-0 ${
                      openDriveLinkTarget === 'contract'
                        ? 'bg-sky-600 text-white border-sky-600 hover:bg-sky-700'
                        : 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-300'
                    }`}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>+ แนบลิงก์ Drive (URL)</span>
                  </button>
                  <span className="text-xs text-slate-400">
                    {formData.attachments.filter(a => a.category === 'contract').length} ไฟล์แนบในหมวดนี้
                  </span>
                </div>

                {renderDriveLinkInlineForm('contract', 'เช่น สัญญาจ้างและแบบแปลนก่อสร้าง (ฉบับเต็ม).pdf')}

                <div className="mt-2 space-y-1">
                  {formData.attachments
                    .filter(a => a.category === 'contract')
                    .map(att => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-2 bg-emerald-50/60 rounded-lg border border-emerald-200 text-xs text-emerald-900"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {att.size === 0 ? (
                            <Link2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                          ) : (
                            <Paperclip className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          )}
                          <span className="font-medium truncate">{att.name}</span>
                          {att.size === 0 && (
                            <span className="text-[10px] text-emerald-700 shrink-0">(ลิงก์ Drive)</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {att.url && (
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-0.5 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded-md transition inline-flex items-center gap-1 font-bold text-[10px]"
                              title="เปิดดูไฟล์ใน Google Drive"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Drive</span>
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => removeAttachment(att.id, att.name)}
                            className="px-2 py-0.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-md transition inline-flex items-center gap-1 text-[10px] font-semibold"
                            title="ลบไฟล์แนบ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>ลบ</span>
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              หมวดที่ 5: การดำเนินงานและติดตามความคืบหน้า
              ========================================================================= */}
          {activeTab === 5 && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-slate-200 pb-2">
                <h4 className="text-sm font-bold text-slate-800 font-heading">
                  หมวดที่ 5: การดำเนินงานและติดตามความคืบหน้า
                </h4>
                <p className="text-xs text-slate-500">
                  บันทึกขั้นตอน: 1. แจ้งเข้าทำงาน | 2. ส่งมอบงาน | 3. ตรวจรับงาน | 4. จัดทำฎีกาเบิกจ่าย
                </p>
              </div>

              {/* Step 1: แจ้งเข้าทำงาน */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-700 text-white text-xs font-bold flex items-center justify-center">
                      1
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      หนังสือแจ้งเข้าทำงาน ({formData.workNotices.length} รายการ)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={addWorkNotice}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> เพิ่มการแจ้งเข้าทำงาน
                  </button>
                </div>

                {getWorkNoticeAlert(formData).hasAlert && (
                  <div
                    className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                      getWorkNoticeAlert(formData).isOver15Days
                        ? 'bg-rose-50 border-rose-300 text-rose-900'
                        : 'bg-amber-50 border-amber-300 text-amber-950'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <div className="font-semibold">
                      {getWorkNoticeAlert(formData).fullMessage}
                    </div>
                  </div>
                )}

                {formData.workNotices.map((wn, idx) => (
                  <div key={wn.id} className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-white rounded-xl border border-slate-200 text-xs">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">เลขที่หนังสือแจ้ง</label>
                      <input
                        type="text"
                        value={wn.bookNo}
                        onChange={e => {
                          const updated = [...formData.workNotices];
                          updated[idx].bookNo = e.target.value;
                          setFormData({ ...formData, workNotices: updated });
                        }}
                        placeholder="เช่น บข.001/2567"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">วันที่หนังสือ</label>
                      <input
                        type="date"
                        value={wn.bookDate}
                        onChange={e => {
                          const updated = [...formData.workNotices];
                          updated[idx].bookDate = e.target.value;
                          setFormData({ ...formData, workNotices: updated });
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">วันที่เข้าทำงานจริง</label>
                      <input
                        type="date"
                        value={wn.actualWorkDate}
                        onChange={e => {
                          const updated = [...formData.workNotices];
                          updated[idx].actualWorkDate = e.target.value;
                          setFormData({ ...formData, workNotices: updated });
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Step 2: ส่งมอบงาน */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-700 text-white text-xs font-bold flex items-center justify-center">
                      2
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      การส่งมอบงาน ({formData.deliveries.length} งวด)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={addDelivery}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> เพิ่มการส่งมอบงาน
                  </button>
                </div>

                {formData.deliveries.map((del, idx) => {
                  const delStatus = getDeliveryContractStatus(
                    del.actualDeliveryDate || del.bookDate,
                    formData.endDate
                  );
                  return (
                    <div key={del.id} className="space-y-2 p-3 bg-white rounded-xl border border-slate-200 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-0.5">งวดที่</label>
                          <input
                            type="number"
                            value={del.installment}
                            onChange={e => {
                              const updated = [...formData.deliveries];
                              updated[idx].installment = Number(e.target.value);
                              setFormData({ ...formData, deliveries: updated });
                            }}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-0.5">เลขที่หนังสือส่งมอบ</label>
                          <input
                            type="text"
                            value={del.bookNo}
                            onChange={e => {
                              const updated = [...formData.deliveries];
                              updated[idx].bookNo = e.target.value;
                              setFormData({ ...formData, deliveries: updated });
                            }}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-0.5">วันที่หนังสือ</label>
                          <input
                            type="date"
                            value={del.bookDate}
                            onChange={e => {
                              const nextBookDate = e.target.value;
                              const updated = [...formData.deliveries];
                              const prevBookDate = updated[idx].bookDate || '';
                              const prevActual = updated[idx].actualDeliveryDate || '';
                              const shouldSyncActual = !prevActual || prevActual === prevBookDate;
                              updated[idx] = {
                                ...updated[idx],
                                bookDate: nextBookDate,
                                ...(shouldSyncActual ? { actualDeliveryDate: nextBookDate } : {})
                              };
                              setFormData({ ...formData, deliveries: updated });
                            }}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <label className="block text-[11px] font-medium text-slate-600">วันที่ส่งมอบจริง</label>
                            {del.bookDate && del.actualDeliveryDate !== del.bookDate && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...formData.deliveries];
                                  updated[idx] = {
                                    ...updated[idx],
                                    actualDeliveryDate: del.bookDate
                                  };
                                  setFormData({ ...formData, deliveries: updated });
                                }}
                                className="text-[10px] font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
                              >
                                ตามวันที่หนังสือ
                              </button>
                            )}
                          </div>
                          <input
                            type="date"
                            value={del.actualDeliveryDate}
                            onChange={e => {
                              const updated = [...formData.deliveries];
                              updated[idx] = {
                                ...updated[idx],
                                actualDeliveryDate: e.target.value
                              };
                              setFormData({ ...formData, deliveries: updated });
                            }}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                          />
                        </div>
                      </div>
                      {delStatus.hasComparison && (
                        delStatus.isWithinContract ? (
                          <div className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>ภายในกำหนดเวลาตามสัญญา</span>
                          </div>
                        ) : (
                          <div className="px-3 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 bg-rose-50 border-rose-200 text-rose-800">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>{delStatus.detailMessage}</span>
                          </div>
                        )
                      )}
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                          รายละเอียดงานที่ส่งมอบ
                        </label>
                        <input
                          type="text"
                          value={del.details}
                          onChange={e => {
                            const updated = [...formData.deliveries];
                            updated[idx].details = e.target.value;
                            setFormData({ ...formData, deliveries: updated });
                          }}
                          placeholder={DEFAULT_DELIVERY_DETAILS}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Step 3: ตรวจรับงาน */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-700 text-white text-xs font-bold flex items-center justify-center">
                      3
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      ผลการตรวจรับงาน ({formData.inspections.length} ครั้ง)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={addInspection}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> เพิ่มการตรวจรับงาน
                  </button>
                </div>

                {formData.inspections.map((insp, idx) => (
                  <div key={insp.id} className="space-y-2 p-3 bg-white rounded-xl border border-slate-200 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">งวดที่</label>
                        <input
                          type="number"
                          value={insp.installment}
                          onChange={e => {
                            const updated = [...formData.inspections];
                            updated[idx].installment = Number(e.target.value);
                            setFormData({ ...formData, inspections: updated });
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">วันที่ตรวจรับงาน</label>
                        <input
                          type="date"
                          value={insp.inspectionDate}
                          onChange={e => {
                            const updated = [...formData.inspections];
                            updated[idx].inspectionDate = e.target.value;
                            setFormData({ ...formData, inspections: updated });
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">ผลการตรวจรับ</label>
                        <select
                          value={insp.result}
                          onChange={e => {
                            const updated = [...formData.inspections];
                            updated[idx].result = e.target.value as any;
                            setFormData({ ...formData, inspections: updated });
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-semibold"
                        >
                          <option value="pass">ตรวจรับถูกต้องครบถ้วน</option>
                          <option value="need_revision">ให้แก้ไขปรับปรุงงาน</option>
                          <option value="fail">ไม่ผ่านการตรวจรับ</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <input
                        type="text"
                        value={insp.details}
                        onChange={e => {
                          const updated = [...formData.inspections];
                          updated[idx].details = e.target.value;
                          setFormData({ ...formData, inspections: updated });
                        }}
                        placeholder="บันทึกรายละเอียดผลการตรวจรับ..."
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Step 4: จัดทำฎีกา */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-700 text-white text-xs font-bold flex items-center justify-center">
                      4
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      การจัดทำฎีกาและการเบิกจ่ายเงิน ({formData.disbursements.length} รายการ)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={addDisbursement}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> เพิ่มฎีกาเบิกจ่าย
                  </button>
                </div>

                {formData.disbursements.map((disb, idx) => (
                  <div key={disb.id} className="grid grid-cols-1 sm:grid-cols-4 gap-2 p-3 bg-white rounded-xl border border-slate-200 text-xs">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">เลขที่ฎีกา</label>
                      <input
                        type="text"
                        value={disb.petitionNo}
                        onChange={e => {
                          const updated = [...formData.disbursements];
                          updated[idx].petitionNo = e.target.value;
                          setFormData({ ...formData, disbursements: updated });
                        }}
                        placeholder="เช่น 45/2568"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">วันที่จัดทำฎีกา</label>
                      <input
                        type="date"
                        value={disb.disbursementDate}
                        onChange={e => {
                          const updated = [...formData.disbursements];
                          updated[idx].disbursementDate = e.target.value;
                          setFormData({ ...formData, disbursements: updated });
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">จำนวนเงิน (บาท)</label>
                      <input
                        type="number"
                        value={disb.amount}
                        onChange={e => {
                          const updated = [...formData.disbursements];
                          updated[idx].amount = Number(e.target.value);
                          setFormData({ ...formData, disbursements: updated });
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">สถานะการเบิกจ่าย</label>
                      <select
                        value={disb.status}
                        onChange={e => {
                          const updated = [...formData.disbursements];
                          updated[idx].status = e.target.value as any;
                          setFormData({ ...formData, disbursements: updated });
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-semibold"
                      >
                        <option value="pending">รอการเบิกจ่าย</option>
                        <option value="paid">เบิกจ่ายเรียบร้อยแล้ว</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              {/* Attachments Section for Category 5 */}
              <div className="pt-3 border-t border-slate-200">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ไฟล์แนบหนังสือแจ้งเข้าทำงาน ส่งมอบ ตรวจรับ และฎีกาเบิกจ่าย
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium border border-slate-300 whitespace-nowrap shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>เลือกไฟล์แนบ...</span>
                    <input
                      type="file"
                      multiple
                      onChange={e => handleFileUpload(e, 'delivery')}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => toggleDriveLinkForm('delivery')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition whitespace-nowrap shrink-0 ${
                      openDriveLinkTarget === 'delivery'
                        ? 'bg-sky-600 text-white border-sky-600 hover:bg-sky-700'
                        : 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-300'
                    }`}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>+ แนบลิงก์ Drive (URL)</span>
                  </button>
                  <span className="text-xs text-slate-400">
                    {formData.attachments.filter(a => ['notice', 'delivery', 'inspection', 'disbursement'].includes(a.category)).length} ไฟล์แนบในหมวดนี้
                  </span>
                </div>

                {renderDriveLinkInlineForm('delivery', 'เช่น หนังสือส่งมอบงานและเอกสารตรวจรับ/ฎีกา.pdf')}

                <div className="mt-2 space-y-1">
                  {formData.attachments
                    .filter(a => ['notice', 'delivery', 'inspection', 'disbursement'].includes(a.category))
                    .map(att => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-2 bg-emerald-50/60 rounded-lg border border-emerald-200 text-xs text-emerald-900"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {att.size === 0 ? (
                            <Link2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                          ) : (
                            <Paperclip className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          )}
                          <span className="font-medium truncate">{att.name}</span>
                          <span className="text-[10px] text-emerald-700 shrink-0">
                            ({ATTACHMENT_CATEGORY_LABELS[att.category] || att.category} •{' '}
                            {att.size > 0 ? `${(att.size / 1024).toFixed(1)} KB` : 'ลิงก์ Drive'})
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {att.url && (
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-0.5 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded-md transition inline-flex items-center gap-1 font-bold text-[10px]"
                              title="เปิดดูไฟล์ใน Google Drive"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Drive</span>
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => removeAttachment(att.id, att.name)}
                            className="px-2 py-0.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-md transition inline-flex items-center gap-1 text-[10px] font-semibold"
                            title="ลบไฟล์แนบ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>ลบ</span>
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              หมวดที่ 6: การเบิกค่าตอบแทนคณะกรรมการ
              ========================================================================= */}
          {activeTab === 6 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 font-heading">
                    หมวดที่ 6: การเบิกค่าตอบแทนคณะกรรมการ
                  </h4>
                  <p className="text-xs text-slate-500">
                    บันทึกค่าตอบแทน: ผู้จัดทำ TOR, คณะกรรมการราคากลาง, ผู้ควบคุมงาน และคณะกรรมการตรวจรับงานจ้าง
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">รวมค่าตอบแทนทั้งสิ้น</div>
                  <div className="text-base font-bold text-emerald-800 font-heading">
                    {formatCurrency(totalRemuneration)} บาท
                  </div>
                </div>
              </div>

              {/* Quick Add Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">เพิ่มรายการเบิก:</span>
                <button
                  type="button"
                  onClick={() => addRemuneration('tor_author')}
                  className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold border border-amber-300 transition shadow-2xs"
                >
                  + ผู้จัดทำ TOR
                </button>
                <button
                  type="button"
                  onClick={() => addRemuneration('tor')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200 transition"
                >
                  + กก. ราคากลาง
                </button>
                <button
                  type="button"
                  onClick={() => addRemuneration('supervisor')}
                  className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold border border-teal-200 transition"
                >
                  + ผู้ควบคุมงาน
                </button>
                <button
                  type="button"
                  onClick={() => addRemuneration('inspection')}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold border border-blue-200 transition"
                >
                  + กก. ตรวจรับงาน
                </button>
              </div>

              {/* Datalist of Standard Remuneration Titles */}
              <datalist id="remuneration-title-options">
                <option value={REMUNERATION_TITLES.tor_author} />
                <option value={REMUNERATION_TITLES.tor} />
                <option value={REMUNERATION_TITLES.supervisor} />
                <option value={REMUNERATION_TITLES.inspection} />
              </datalist>

              {/* Remuneration Records */}
              <div className="space-y-2">
                {formData.remunerations.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl text-xs">
                    ยังไม่มีรายการเบิกค่าตอบแทน คลิกปุ่มด้านบนเพื่อเพิ่มรายการ
                  </div>
                ) : (
                  formData.remunerations.map((rem, idx) => (
                    <div
                      key={rem.id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-medium text-slate-500">ประเภท/รายการ</label>
                          <input
                            type="text"
                            list="remuneration-title-options"
                            value={rem.title}
                            onChange={e => {
                              const newTitle = e.target.value;
                              const updated = [...formData.remunerations];
                              const prevType = updated[idx].type;
                              const nextType = inferRemunerationType(newTitle, prevType);
                              const prevAutoPayee = normalizeName(getDefaultPayeeByType(prevType, formData));
                              const nextAutoPayee = getDefaultPayeeByType(nextType, formData);
                              const currentPayee = normalizeName(updated[idx].payeeName);

                              updated[idx] = {
                                ...updated[idx],
                                title: newTitle,
                                type: nextType,
                                payeeName:
                                  !currentPayee || (nextType !== prevType && currentPayee === prevAutoPayee)
                                    ? nextAutoPayee || updated[idx].payeeName
                                    : updated[idx].payeeName
                              };
                              setFormData({ ...formData, remunerations: updated });
                            }}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded-md font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500">ผู้รับเงิน</label>
                          <AutoSuggestInput
                            value={rem.payeeName || ''}
                            onChange={val => {
                              const updated = [...formData.remunerations];
                              updated[idx].payeeName = val;
                              setFormData({ ...formData, remunerations: updated });
                            }}
                            suggestions={suggestedPersonNames}
                            onRemoveSuggestion={handleHideSuggestion}
                            placeholder="ชื่อผู้แทนรับเงิน..."
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500">จำนวนเงิน (บาท)</label>
                          <input
                            type="number"
                            value={rem.amount}
                            onChange={e => {
                              const updated = [...formData.remunerations];
                              updated[idx].amount = Number(e.target.value);
                              setFormData({ ...formData, remunerations: updated });
                            }}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded-md font-bold text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500">สถานะ</label>
                          <div className="flex items-center gap-1">
                            <select
                              value={rem.status}
                              onChange={e => {
                                const nextStatus = e.target.value as CommitteeRemuneration['status'];
                                const updated = [...formData.remunerations];
                                updated[idx] = {
                                  ...updated[idx],
                                  status: nextStatus,
                                  ...(nextStatus === 'not_eligible'
                                    ? { withdrawDate: '', petitionNo: '' }
                                    : {})
                                };
                                setFormData({ ...formData, remunerations: updated });
                              }}
                              className="flex-1 px-2 py-1 bg-white border border-slate-300 rounded-md font-semibold"
                            >
                              <option value="pending">ยังไม่เบิก</option>
                              <option value="paid">เบิกแล้ว</option>
                              <option value="not_eligible">ไม่สามารถเบิกได้</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  remunerations: formData.remunerations.filter(r => r.id !== rem.id)
                                });
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {rem.status === 'not_eligible' ? (
                        <div className="pt-1 border-t border-slate-200/60">
                          <label className="block text-[10px] font-medium text-slate-500 mb-1">
                            หมายเหตุ:
                          </label>
                          <input
                            type="text"
                            value={rem.remarks || ''}
                            onChange={e => {
                              const updated = [...formData.remunerations];
                              updated[idx] = { ...updated[idx], remarks: e.target.value };
                              setFormData({ ...formData, remunerations: updated });
                            }}
                            placeholder="ระบุเหตุผลที่ไม่สามารถเบิกได้ เช่น ไม่เข้าเกณฑ์เบิกค่าตอบแทน..."
                            className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded-md text-[11px]"
                          />
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                          <div>
                            <span className="text-[10px] text-slate-500">วันที่เบิก: </span>
                            <input
                              type="date"
                              value={rem.withdrawDate || ''}
                              onChange={e => {
                                const updated = [...formData.remunerations];
                                updated[idx] = { ...updated[idx], withdrawDate: e.target.value };
                                setFormData({ ...formData, remunerations: updated });
                              }}
                              className="px-2 py-0.5 bg-white border border-slate-300 rounded-md text-[11px]"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500">เลขที่ฎีกา: </span>
                            <input
                              type="text"
                              value={rem.petitionNo || ''}
                              onChange={e => {
                                const updated = [...formData.remunerations];
                                updated[idx] = { ...updated[idx], petitionNo: e.target.value };
                                setFormData({ ...formData, remunerations: updated });
                              }}
                              placeholder="เช่น 12/2568"
                              className="px-2 py-0.5 bg-white border border-slate-300 rounded-md text-[11px]"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              หมวดที่ 7: บันทึกข้อมูลโครงการ (พิกัดโครงการ, พิกัดป้าย, รูปภาพแนบ - ไม่เกี่ยวกับสถานะ/ไทม์ไลน์ 12 ขั้นตอน)
              ========================================================================= */}
          {activeTab === 7 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-900 to-emerald-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold font-heading flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-300" />
                    <span>แท็บบันทึกข้อมูลโครงการ (พิกัดโครงการ • พิกัดป้ายโครงการ • แนบไฟล์รูปภาพ)</span>
                  </h4>
                  <p className="text-xs text-emerald-100 mt-0.5">
                    ใช้สำหรับเก็บข้อมูลโครงการเพื่อเปิดดูย้อนหลังและเปิดแผนที่ผ่าน Google Maps โดยไม่มีผลกระทบต่อสถานะโครงการหรือไทม์ไลน์ 12 ขั้นตอน
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-white/15 text-emerald-200 text-[11px] font-bold border border-white/20 shrink-0 self-start sm:self-center">
                  แยกอิสระจากขั้นตอนระบบ
                </span>
              </div>

              {/* 1. พิกัดโครงการ: จุดเริ่มต้นโครงการ และ จุดสิ้นสุดโครงการ */}
              <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/80 pb-2.5">
                  <div>
                    <h5 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <Navigation className="w-4 h-4 text-emerald-600" />
                      <span>1. พิกัดโครงการ (แบ่งเป็น จุดเริ่มต้นโครงการ และ จุดสิ้นสุดโครงการ)</span>
                    </h5>
                    <p className="text-[11px] text-slate-500">
                      กรอกเป็น ละติจูด (Latitude) และ ลองจิจูด (Longitude) หรือวางพิกัดรวม เช่น 15.2448, 105.2215
                    </p>
                  </div>
                  {getGoogleMapsRouteUrl(
                    formData.projectRecord?.startPoint,
                    formData.projectRecord?.endPoint
                  ) && (
                    <a
                      href={getGoogleMapsRouteUrl(
                        formData.projectRecord?.startPoint,
                        formData.projectRecord?.endPoint
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition self-start"
                    >
                      <Compass className="w-3.5 h-3.5" />
                      <span>เปิดดูเส้นทางเริ่มต้น → สิ้นสุด บน Google Maps</span>
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* จุดเริ่มต้นโครงการ */}
                  <div className="bg-white p-4 rounded-xl border border-emerald-200 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span>จุดเริ่มต้นโครงการ</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          ละติจูด (Latitude)
                        </label>
                        <input
                          type="text"
                          value={formData.projectRecord?.startPoint?.lat || ''}
                          onChange={e => handleArchiveCoordChange('startPoint', 'lat', e.target.value)}
                          placeholder="เช่น 15.244812"
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          ลองจิจูด (Longitude)
                        </label>
                        <input
                          type="text"
                          value={formData.projectRecord?.startPoint?.lng || ''}
                          onChange={e => handleArchiveCoordChange('startPoint', 'lng', e.target.value)}
                          placeholder="เช่น 105.221540"
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        จุดสังเกตจุดเริ่มต้น (ถ้ามี)
                      </label>
                      <input
                        type="text"
                        value={formData.projectRecord?.startPoint?.note || ''}
                        onChange={e => handleArchiveCoordChange('startPoint', 'note', e.target.value)}
                        placeholder="เช่น หน้าศาลาหมู่บ้าน หมู่ที่ 1 กม.0+000"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  {/* จุดสิ้นสุดโครงการ */}
                  <div className="bg-white p-4 rounded-xl border border-rose-200 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        <span>จุดสิ้นสุดโครงการ</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          ละติจูด (Latitude)
                        </label>
                        <input
                          type="text"
                          value={formData.projectRecord?.endPoint?.lat || ''}
                          onChange={e => handleArchiveCoordChange('endPoint', 'lat', e.target.value)}
                          placeholder="เช่น 15.251240"
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          ลองจิจูด (Longitude)
                        </label>
                        <input
                          type="text"
                          value={formData.projectRecord?.endPoint?.lng || ''}
                          onChange={e => handleArchiveCoordChange('endPoint', 'lng', e.target.value)}
                          placeholder="เช่น 105.228910"
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        จุดสังเกตจุดสิ้นสุด (ถ้ามี)
                      </label>
                      <input
                        type="text"
                        value={formData.projectRecord?.endPoint?.note || ''}
                        onChange={e => handleArchiveCoordChange('endPoint', 'note', e.target.value)}
                        placeholder="เช่น เชื่อมต่อถนนสายหลัก หมู่ที่ 5 กม.0+950"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. พิกัดป้ายแสดงโครงการ */}
              <div className="p-4 rounded-2xl bg-purple-50/40 border border-purple-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-200/80 pb-2.5">
                  <div>
                    <h5 className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                      <Signpost className="w-4 h-4 text-purple-600" />
                      <span>2. พิกัดป้ายแสดงโครงการ</span>
                    </h5>
                    <p className="text-[11px] text-slate-500">
                      กรอกละติจูดและลองจิจูดของจุดติดตั้งป้ายแสดงรายละเอียดโครงการ
                    </p>
                  </div>
                  {getGoogleMapsPointUrl(formData.projectRecord?.signboardPoint) && (
                    <a
                      href={getGoogleMapsPointUrl(formData.projectRecord?.signboardPoint)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition self-start"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>เปิดดูพิกัดป้ายบน Google Maps</span>
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3.5 rounded-xl border border-purple-200 shadow-2xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      ละติจูด (Latitude)
                    </label>
                    <input
                      type="text"
                      value={formData.projectRecord?.signboardPoint?.lat || ''}
                      onChange={e => handleArchiveCoordChange('signboardPoint', 'lat', e.target.value)}
                      placeholder="เช่น 15.244850"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      ลองจิจูด (Longitude)
                    </label>
                    <input
                      type="text"
                      value={formData.projectRecord?.signboardPoint?.lng || ''}
                      onChange={e => handleArchiveCoordChange('signboardPoint', 'lng', e.target.value)}
                      placeholder="เช่น 105.221580"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      บริเวณจุดติดตั้งป้ายโครงการ
                    </label>
                    <input
                      type="text"
                      value={formData.projectRecord?.signboardPoint?.note || ''}
                      onChange={e => handleArchiveCoordChange('signboardPoint', 'note', e.target.value)}
                      placeholder="เช่น ปากทางเข้าโครงการ หมู่ที่ 1"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* 3. แนบไฟล์ เช่น รูปภาพโครงการ */}
              <div className="p-4 rounded-2xl bg-sky-50/40 border border-sky-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sky-200/80 pb-2.5">
                  <div>
                    <h5 className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-sky-600" />
                      <span>3. แนบไฟล์ เช่น รูปภาพโครงการ ({formData.projectRecord?.files?.length || 0} ไฟล์)</span>
                    </h5>
                    <p className="text-[11px] text-slate-500">
                      อัปโหลดรูปภาพโครงการ รูปป้ายโครงการ หรือไฟล์เอกสารสำหรับเปิดดูย้อนหลัง
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 self-start">
                    <button
                      type="button"
                      onClick={() => toggleDriveLinkForm('archive')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border transition shadow-2xs whitespace-nowrap shrink-0 ${
                        openDriveLinkTarget === 'archive'
                          ? 'bg-sky-700 text-white border-sky-700 hover:bg-sky-800'
                          : 'bg-white hover:bg-sky-50 text-sky-800 border-sky-300'
                      }`}
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>+ แนบลิงก์ Drive (URL)</span>
                    </button>
                    <label className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition whitespace-nowrap shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      <span>แนบรูปภาพ / ไฟล์โครงการ</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={e => handleArchiveFileUpload(e, 'during')}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {renderDriveLinkInlineForm('archive', 'เช่น รูปภาพ/แบบแปลน As-Built โครงการ.pdf')}

                {(!formData.projectRecord?.files || formData.projectRecord.files.length === 0) ? (
                  <div className="bg-white rounded-xl p-6 text-center border border-dashed border-sky-200 text-xs text-slate-400">
                    ยังไม่มีรูปภาพหรือไฟล์แนบในแท็บบันทึกข้อมูลโครงการ
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {formData.projectRecord.files.map((file, idx) => {
                      const imgSrc = getArchiveImageDisplayUrl(file);
                      const isImage =
                        file.type?.startsWith('image/') ||
                        Boolean(file.previewDataUrl) ||
                        /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);

                      return (
                        <div
                          key={file.id}
                          className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs flex flex-col justify-between"
                        >
                          {isImage && imgSrc ? (
                            <div className="relative h-32 bg-slate-100">
                              <img src={imgSrc} alt={file.name} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() =>
                                  setFormData(prev => ({
                                    ...prev,
                                    projectRecord: {
                                      ...(prev.projectRecord || {}),
                                      files: (prev.projectRecord?.files || []).filter(f => f.id !== file.id)
                                    }
                                  }))
                                }
                                className="absolute top-2 right-2 p-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="relative h-32 bg-slate-50 flex flex-col items-center justify-center p-3 text-center">
                              {file.size === 0 ? (
                                <Link2 className="w-7 h-7 text-sky-500 mb-1" />
                              ) : (
                                <FileText className="w-7 h-7 text-slate-400 mb-1" />
                              )}
                              <span className="text-xs font-semibold text-slate-700 line-clamp-2">
                                {file.name}
                              </span>
                              {file.url && (
                                <a
                                  href={file.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-100 hover:bg-sky-200 text-sky-800 text-[10px] font-bold transition"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>เปิดใน Drive</span>
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setFormData(prev => ({
                                    ...prev,
                                    projectRecord: {
                                      ...(prev.projectRecord || {}),
                                      files: (prev.projectRecord?.files || []).filter(f => f.id !== file.id)
                                    }
                                  }))
                                }
                                className="absolute top-2 right-2 p-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          <div className="p-2.5 space-y-1.5">
                            <select
                              value={file.photoStage || 'during'}
                              onChange={e => {
                                const filesCopy = [...(formData.projectRecord?.files || [])];
                                filesCopy[idx] = { ...filesCopy[idx], photoStage: e.target.value as any };
                                setFormData(prev => ({
                                  ...prev,
                                  projectRecord: { ...(prev.projectRecord || {}), files: filesCopy }
                                }));
                              }}
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded-md text-[11px] font-semibold"
                            >
                              <option value="before">ภาพก่อนดำเนินการ</option>
                              <option value="during">ภาพระหว่างดำเนินการ</option>
                              <option value="after">ภาพหลังดำเนินการเสร็จ</option>
                              <option value="signboard">ภาพป้ายแสดงโครงการ</option>
                              <option value="document">ไฟล์เอกสาร/แบบแปลน</option>
                            </select>
                            <input
                              type="text"
                              value={file.caption || ''}
                              onChange={e => {
                                const filesCopy = [...(formData.projectRecord?.files || [])];
                                filesCopy[idx] = { ...filesCopy[idx], caption: e.target.value };
                                setFormData(prev => ({
                                  ...prev,
                                  projectRecord: { ...(prev.projectRecord || {}), files: filesCopy }
                                }));
                              }}
                              placeholder="คำอธิบายรูปภาพ/ไฟล์..."
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded-md text-xs"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Modal Footer Controls */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>หมวดที่ {activeTab} จาก 7</span>
              {duplicateCodeProject && (
                <button
                  type="button"
                  onClick={() => setActiveTab(1)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-[11px] transition"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>รหัสโครงการ "{formData.projectCode.trim()}" ซ้ำ — คลิกเพื่อแก้ไข</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition"
              >
                ยกเลิก
              </button>

              {activeTab < 7 && (
                <button
                  type="button"
                  onClick={() => setActiveTab(prev => Math.min(7, prev + 1))}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition"
                >
                  ถัดไป (หมวดที่ {activeTab + 1})
                </button>
              )}

              <button
                type="submit"
                disabled={Boolean(duplicateCodeProject)}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed text-white text-xs font-bold shadow-md shadow-emerald-700/20 active:scale-95 transition"
              >
                <Save className="w-4 h-4" />
                <span>บันทึกข้อมูลโครงการ</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
