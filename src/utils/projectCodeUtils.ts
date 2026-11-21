import { Project } from '../types/project';

export type ProjectCodePrefix = 'ถ.' | 'อ.';

export interface ProjectCodeRenumberItem {
  projectId: string;
  projectName: string;
  oldCode: string;
  newCode: string;
}

export interface ProjectCodeGapGroup {
  key: string;
  prefix: ProjectCodePrefix;
  prefixLabel: string;
  fiscalYear: number;
  missingCodes: string[];
  changes: ProjectCodeRenumberItem[];
  totalInGroup: number;
}

/**
 * Find vacant sequential project codes (gaps from 1 .. maxSeq - 1)
 * for a given prefix ('ถ.' or 'อ.') and Thai fiscal year.
 */
export function findMissingProjectCodes(
  projects: Project[],
  prefix: ProjectCodePrefix,
  fiscalYear: number,
  excludeProjectId?: string
): string[] {
  const yy = String(fiscalYear).slice(-2);
  const head = `${prefix}${yy}-`;
  const usedNums = new Set<number>();
  let maxSeq = 0;

  projects.forEach(p => {
    if (excludeProjectId && p.id === excludeProjectId) return;
    const code = (p.projectCode || '').trim();
    if (!code.startsWith(head)) return;
    const suffix = code.slice(head.length);
    if (/^\d+$/.test(suffix)) {
      const num = parseInt(suffix, 10);
      if (num > 0) {
        usedNums.add(num);
        if (num > maxSeq) maxSeq = num;
      }
    }
  });

  if (maxSeq <= 1) return [];

  const missing: string[] = [];
  for (let i = 1; i < maxSeq; i += 1) {
    if (!usedNums.has(i)) {
      missing.push(`${head}${String(i).padStart(3, '0')}`);
    }
  }
  return missing;
}

/**
 * Scan all projects across all (prefix, fiscalYear) groups to find groups
 * with vacant code gaps and compute exact sequential re-numbering plans.
 */
export function findAllCodeGapGroups(projects: Project[]): ProjectCodeGapGroup[] {
  const grouped = new Map<
    string,
    {
      prefix: ProjectCodePrefix;
      fiscalYear: number;
      head: string;
      items: { project: Project; seq: number }[];
    }
  >();

  projects.forEach(p => {
    const code = (p.projectCode || '').trim();
    const match = code.match(/^(ถ\.|อ\.)(\d{2})-(\d+)$/);
    if (!match) return;
    const prefix = match[1] as ProjectCodePrefix;
    const yy = match[2];
    const seq = parseInt(match[3], 10);
    if (!Number.isFinite(seq) || seq <= 0) return;

    const fiscalYear =
      p.fiscalYear && String(p.fiscalYear).slice(-2) === yy
        ? p.fiscalYear
        : 2500 + parseInt(yy, 10);
    const head = `${prefix}${yy}-`;
    const key = `${prefix}|${fiscalYear}`;

    const entry = grouped.get(key) || {
      prefix,
      fiscalYear,
      head,
      items: []
    };
    entry.items.push({ project: p, seq });
    grouped.set(key, entry);
  });

  const gapGroups: ProjectCodeGapGroup[] = [];

  grouped.forEach((group, key) => {
    // Sort ascending by current sequence number so relative order is strictly preserved
    const sorted = [...group.items].sort((a, b) => a.seq - b.seq);
    const usedNums = new Set(sorted.map(i => i.seq));
    const maxSeq = sorted[sorted.length - 1]?.seq || 0;

    const missingCodes: string[] = [];
    for (let n = 1; n < maxSeq; n += 1) {
      if (!usedNums.has(n)) {
        missingCodes.push(`${group.head}${String(n).padStart(3, '0')}`);
      }
    }

    if (missingCodes.length === 0) return;

    const changes: ProjectCodeRenumberItem[] = [];
    sorted.forEach((entry, idx) => {
      const targetSeq = idx + 1;
      const newCode = `${group.head}${String(targetSeq).padStart(3, '0')}`;
      const oldCode = (entry.project.projectCode || '').trim();
      if (oldCode !== newCode) {
        changes.push({
          projectId: entry.project.id,
          projectName: entry.project.name,
          oldCode,
          newCode
        });
      }
    });

    if (changes.length > 0) {
      gapGroups.push({
        key,
        prefix: group.prefix,
        prefixLabel: group.prefix === 'ถ.' ? 'งานถนน (ถ.)' : 'งานอาคาร (อ.)',
        fiscalYear: group.fiscalYear,
        missingCodes,
        changes,
        totalInGroup: sorted.length
      });
    }
  });

  return gapGroups.sort((a, b) => {
    if (b.fiscalYear !== a.fiscalYear) return b.fiscalYear - a.fiscalYear;
    return a.prefix.localeCompare(b.prefix, 'th');
  });
}
