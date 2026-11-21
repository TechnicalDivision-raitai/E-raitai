import { CommitteeMember, Project, RAI_TAI_PERSONNEL } from '../types/project';

export interface ContractorDirectoryEntry {
  taxId?: string;
  contact?: string;
}

export interface KnownDirectory {
  /** Lookup latest recorded official position by person name */
  findPosition: (rawName?: string | null) => string | undefined;
  /** Lookup latest recorded contractor tax ID & contact by contractor name */
  findContractor: (rawContractorName?: string | null) => ContractorDirectoryEntry | undefined;
}

export interface EnrichmentStats {
  updatedProjectsCount: number;
  filledPositionsCount: number;
  filledContractorTaxIdCount: number;
  filledContractorContactCount: number;
  filledContractorProjectsCount: number;
}

export interface EnrichmentResult {
  projects: Project[];
  stats: EnrichmentStats;
}

const BLANK_VALUES = new Set(['', '-', '–', '—', 'ไม่มี', 'ไม่ระบุ', 'n/a', 'na']);

function normalizeText(raw?: string | null): string {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isEmptyField(raw?: string | null): boolean {
  const clean = normalizeText(raw);
  return !clean || BLANK_VALUES.has(clean.toLowerCase());
}

/**
 * Strip common Thai honorific prefixes for fallback person matching
 * (e.g. "นางสาวนิศาชล คงดี" / "น.ส.นิศาชล คงดี" <-> "นิศาชล คงดี")
 */
function stripThaiPersonPrefix(name: string): string {
  return normalizeText(name)
    .replace(/^(ว่าที่\s*ร\.?ต\.?|จ\.ส\.อ\.|ส\.อ\.|ร\.ต\.|ดร\.|นางสาว|น\.ส\.|นาย|นาง)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Canonical key for contractor name comparison
 * Handles minor spacing & abbreviation differences (หจก. <-> ห้างหุ้นส่วนจำกัด, บจก. <-> บริษัท)
 */
function canonicalizeContractorName(raw?: string | null): string {
  const clean = normalizeText(raw).toLowerCase();
  if (!clean) return '';
  return clean
    .replace(/^ห\.?จ\.?ก\.?\s*/i, 'ห้างหุ้นส่วนจำกัด ')
    .replace(/^บ\.?จ\.?ก\.?\s*/i, 'บริษัท ')
    .replace(/^ร้าน\s*/i, 'ร้าน ')
    .replace(/\s*\.\s*/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build a directory of previously recorded personnel positions and contractor info
 * across RAI_TAI_PERSONNEL and all recorded projects (prioritizing latest timestamps).
 */
export function buildKnownDirectory(referenceProjects: Project[]): KnownDirectory {
  const exactPosMap = new Map<string, { position: string; timestamp: number }>();
  const strippedPosMap = new Map<string, { position: string; timestamp: number; sourceNames: Set<string> }>();

  const recordPersonPosition = (rawName?: string | null, rawPosition?: string | null, timestamp = 0) => {
    const cleanName = normalizeText(rawName);
    const cleanPos = normalizeText(rawPosition);
    if (!cleanName || isEmptyField(cleanPos)) return;

    const existingExact = exactPosMap.get(cleanName);
    if (!existingExact || timestamp >= existingExact.timestamp) {
      exactPosMap.set(cleanName, { position: cleanPos, timestamp });
    }

    const stripped = stripThaiPersonPrefix(cleanName);
    if (stripped) {
      const existingStripped = strippedPosMap.get(stripped);
      if (!existingStripped) {
        strippedPosMap.set(stripped, {
          position: cleanPos,
          timestamp,
          sourceNames: new Set([cleanName])
        });
      } else {
        existingStripped.sourceNames.add(cleanName);
        if (timestamp >= existingStripped.timestamp) {
          existingStripped.position = cleanPos;
          existingStripped.timestamp = timestamp;
        }
      }
    }
  };

  // 1. Seed baseline personnel positions (timestamp = 0 so newer recorded project edits override them)
  RAI_TAI_PERSONNEL.forEach(person => {
    recordPersonPosition(person.name, person.position, 0);
  });

  // 2. Build contractor directory maps (taxId & contact tracked independently by latest timestamp)
  const contractorTaxMap = new Map<string, { value: string; timestamp: number }>();
  const contractorContactMap = new Map<string, { value: string; timestamp: number }>();
  const contractorTaxCanonicalMap = new Map<string, { value: string; timestamp: number }>();
  const contractorContactCanonicalMap = new Map<string, { value: string; timestamp: number }>();

  const recordContractorTax = (rawName?: string | null, rawTax?: string | null, timestamp = 0) => {
    const cleanName = normalizeText(rawName);
    const cleanTax = normalizeText(rawTax);
    if (!cleanName || isEmptyField(cleanTax)) return;

    const existing = contractorTaxMap.get(cleanName);
    if (!existing || timestamp >= existing.timestamp) {
      contractorTaxMap.set(cleanName, { value: cleanTax, timestamp });
    }

    const canonical = canonicalizeContractorName(cleanName);
    if (canonical) {
      const existingCanon = contractorTaxCanonicalMap.get(canonical);
      if (!existingCanon || timestamp >= existingCanon.timestamp) {
        contractorTaxCanonicalMap.set(canonical, { value: cleanTax, timestamp });
      }
    }
  };

  const recordContractorContact = (rawName?: string | null, rawContact?: string | null, timestamp = 0) => {
    const cleanName = normalizeText(rawName);
    const cleanContact = normalizeText(rawContact);
    if (!cleanName || isEmptyField(cleanContact)) return;

    const existing = contractorContactMap.get(cleanName);
    if (!existing || timestamp >= existing.timestamp) {
      contractorContactMap.set(cleanName, { value: cleanContact, timestamp });
    }

    const canonical = canonicalizeContractorName(cleanName);
    if (canonical) {
      const existingCanon = contractorContactCanonicalMap.get(canonical);
      if (!existingCanon || timestamp >= existingCanon.timestamp) {
        contractorContactCanonicalMap.set(canonical, { value: cleanContact, timestamp });
      }
    }
  };

  // Scan projects oldest -> newest so latest records win on ties
  const orderedProjects = [...referenceProjects].sort((a, b) => {
    const ta = Date.parse(a.updatedAt || a.createdAt || '') || 0;
    const tb = Date.parse(b.updatedAt || b.createdAt || '') || 0;
    return ta - tb;
  });

  orderedProjects.forEach((p, idx) => {
    const baseTs = Date.parse(p.updatedAt || p.createdAt || '') || idx + 1;

    // Extract inline "(ตำแหน่ง)" from legacy supervisorName strings if present
    if (p.supervisorName) {
      p.supervisorName.split(/[\n,;]+/).forEach(part => {
        const match = part.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
        if (match && match[1] && match[2]) {
          recordPersonPosition(match[1], match[2], baseTs);
        }
      });
    }

    const scanMembers = (members?: CommitteeMember[]) => {
      (members || []).forEach(m => {
        if (!m?.name) return;
        const ts = m.positionUpdatedAt ? Date.parse(m.positionUpdatedAt) || baseTs : baseTs;
        recordPersonPosition(m.name, m.position, ts);
      });
    };

    scanMembers(p.supervisors);
    scanMembers(p.torCommittees);
    scanMembers(p.inspectCommittees);

    const taxTs = p.contractorTaxIdUpdatedAt
      ? Date.parse(p.contractorTaxIdUpdatedAt) || baseTs
      : baseTs;
    const contactTs = p.contractorContactUpdatedAt
      ? Date.parse(p.contractorContactUpdatedAt) || baseTs
      : baseTs;

    recordContractorTax(p.contractorName, p.contractorTaxId, taxTs);
    recordContractorContact(p.contractorName, p.contractorContact, contactTs);
  });

  return {
    findPosition(rawName?: string | null): string | undefined {
      const cleanName = normalizeText(rawName);
      if (!cleanName) return undefined;

      const exact = exactPosMap.get(cleanName);
      if (exact) return exact.position;

      const stripped = stripThaiPersonPrefix(cleanName);
      if (stripped) {
        const fallback = strippedPosMap.get(stripped);
        if (fallback) return fallback.position;
      }

      return undefined;
    },

    findContractor(rawContractorName?: string | null): ContractorDirectoryEntry | undefined {
      const cleanName = normalizeText(rawContractorName);
      if (!cleanName) return undefined;

      const canonical = canonicalizeContractorName(cleanName);
      const taxId =
        contractorTaxMap.get(cleanName)?.value ||
        (canonical ? contractorTaxCanonicalMap.get(canonical)?.value : undefined);
      const contact =
        contractorContactMap.get(cleanName)?.value ||
        (canonical ? contractorContactCanonicalMap.get(canonical)?.value : undefined);

      if (!taxId && !contact) return undefined;
      return { taxId, contact };
    }
  };
}

/**
 * Fill ONLY missing (blank) committee/supervisor positions and contractor tax ID / contact
 * using previously recorded entries from `directory`. Never overwrites existing values and
 * leaves unrecorded people/contractors blank.
 */
export function enrichSingleProjectWithDirectory(
  project: Project,
  directory: KnownDirectory
): {
  project: Project;
  changed: boolean;
  filledPositions: number;
  filledTaxId: boolean;
  filledContact: boolean;
} {
  let changed = false;
  let filledPositions = 0;
  let filledTaxId = false;
  let filledContact = false;

  const fillMembers = (members?: CommitteeMember[]): CommitteeMember[] | undefined => {
    if (!members || members.length === 0) return members;
    let listChanged = false;
    const nextList = members.map(m => {
      if (!m?.name || !isEmptyField(m.position)) return m;
      const knownPos = directory.findPosition(m.name);
      if (!knownPos) return m;
      listChanged = true;
      filledPositions += 1;
      return {
        ...m,
        position: knownPos
      };
    });
    if (listChanged) {
      changed = true;
      return nextList;
    }
    return members;
  };

  const nextTorCommittees = fillMembers(project.torCommittees) || [];
  const nextInspectCommittees = fillMembers(project.inspectCommittees) || [];

  // Handle supervisors (also hydrate supervisors[] if only supervisorName string exists and has known positions)
  let nextSupervisors = project.supervisors;
  if (project.supervisors && project.supervisors.length > 0) {
    nextSupervisors = fillMembers(project.supervisors);
  } else if (project.supervisorName && !isEmptyField(project.supervisorName)) {
    const names = project.supervisorName
      .split(/[\n,;]+/)
      .map(s => s.replace(/\s*\([^)]*\)\s*/g, '').trim())
      .filter(s => s && !BLANK_VALUES.has(s.toLowerCase()));
    if (names.length > 0) {
      let foundAnyPosition = false;
      const hydrated: CommitteeMember[] = names.map((name, idx) => {
        const knownPos = directory.findPosition(name) || '';
        if (knownPos) {
          foundAnyPosition = true;
          filledPositions += 1;
        }
        return {
          id: `sup-auto-${project.id}-${idx + 1}`,
          name,
          position: knownPos,
          role: 'ผู้ควบคุมงาน'
        };
      });
      if (foundAnyPosition) {
        nextSupervisors = hydrated;
        changed = true;
      }
    }
  }

  let nextContractorTaxId = project.contractorTaxId;
  let nextContractorContact = project.contractorContact;

  if (project.contractorName && !isEmptyField(project.contractorName)) {
    const knownContractor = directory.findContractor(project.contractorName);
    if (knownContractor) {
      if (isEmptyField(project.contractorTaxId) && knownContractor.taxId) {
        nextContractorTaxId = knownContractor.taxId;
        filledTaxId = true;
        changed = true;
      }
      if (isEmptyField(project.contractorContact) && knownContractor.contact) {
        nextContractorContact = knownContractor.contact;
        filledContact = true;
        changed = true;
      }
    }
  }

  if (!changed) {
    return {
      project,
      changed: false,
      filledPositions: 0,
      filledTaxId: false,
      filledContact: false
    };
  }

  return {
    project: {
      ...project,
      torCommittees: nextTorCommittees,
      inspectCommittees: nextInspectCommittees,
      supervisors: nextSupervisors,
      contractorTaxId: nextContractorTaxId,
      contractorContact: nextContractorContact
    },
    changed: true,
    filledPositions,
    filledTaxId,
    filledContact
  };
}

/**
 * Scan all projects to build the known directory of positions & contractors,
 * then fill blank positions and blank contractor tax ID / contact fields across all projects.
 * Unrecorded people/contractors remain untouched (blank).
 */
export function enrichProjectsWithKnownDirectory(projects: Project[]): EnrichmentResult {
  const directory = buildKnownDirectory(projects);

  let updatedProjectsCount = 0;
  let filledPositionsCount = 0;
  let filledContractorTaxIdCount = 0;
  let filledContractorContactCount = 0;
  let filledContractorProjectsCount = 0;

  const enrichedProjects = projects.map(p => {
    const res = enrichSingleProjectWithDirectory(p, directory);
    if (res.changed) {
      updatedProjectsCount += 1;
      filledPositionsCount += res.filledPositions;
      if (res.filledTaxId) filledContractorTaxIdCount += 1;
      if (res.filledContact) filledContractorContactCount += 1;
      if (res.filledTaxId || res.filledContact) filledContractorProjectsCount += 1;
    }
    return res.project;
  });

  return {
    projects: enrichedProjects,
    stats: {
      updatedProjectsCount,
      filledPositionsCount,
      filledContractorTaxIdCount,
      filledContractorContactCount,
      filledContractorProjectsCount
    }
  };
}
