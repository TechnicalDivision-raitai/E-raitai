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
  ExternalLink
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
  RAI_TAI_PERSONNEL
} from '../types/project';
import {
  formatCurrency,
  formatThaiDate,
  formatThaiDateTime,
  calculateProjectProgress,
  countCompletedSteps,
  deriveProjectStatusFromData
} from '../utils/thaiDate';
import { uploadFileToDrive } from '../services/storage';
import { AutoSuggestInput } from './AutoSuggestInput';

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
  const baselineDerivedRef = React.useRef<ProjectStatus>('not_started');

  // Helper to normalize Thai names (collapse multiple spaces into a single space and trim)
  const normalizeName = (name?: string | null): string => {
    if (!name) return '';
    return name.replace(/\s+/g, ' ').trim();
  };

  // Extract recorded person names across all existing projects and personnel directory
  const suggestedPersonNames = React.useMemo(() => {
    const names = new Set<string>();

    const addClean = (raw?: string | null) => {
      const clean = normalizeName(raw);
      if (clean && clean.length >= 2) {
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
        // Strip position inside parentheses e.g. "นายอนันต์ ศรีสุข (นายช่างโยธา)" -> "นายอนันต์ ศรีสุข"
        const cleanNameOnly = p.supervisorName.replace(/\s*\(.*?\)\s*/g, '');
        addClean(cleanNameOnly);
        addClean(p.supervisorName);
      }
      (p.torCommittees || []).forEach(c => addClean(c.name));
      (p.inspectCommittees || []).forEach(c => addClean(c.name));
      (p.remunerations || []).forEach(r => addClean(r.payeeName));
    });

    return Array.from(names).sort((a, b) => a.localeCompare(b, 'th'));
  }, [existingProjects]);

  // Extract recorded contractor names across all existing projects
  const suggestedContractorNames = React.useMemo(() => {
    const names = new Set<string>();
    existingProjects.forEach(p => {
      const clean = normalizeName(p.contractorName);
      if (clean && clean.length >= 2) names.add(clean);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'th'));
  }, [existingProjects]);

  // Extract recorded official positions across personnel directory and all existing projects
  const suggestedPositions = React.useMemo(() => {
    const positions = new Set<string>();

    const addCleanPos = (raw?: string | null) => {
      const clean = normalizeName(raw);
      if (clean && clean.length >= 2) {
        positions.add(clean);
      }
    };

    // 1. Personnel directory positions
    RAI_TAI_PERSONNEL.forEach(p => addCleanPos(p.position));

    // 2. Scan all existing projects
    existingProjects.forEach(p => {
      if (p.supervisorName) {
        const match = p.supervisorName.match(/\(([^)]+)\)/);
        if (match && match[1]) {
          addCleanPos(match[1]);
        }
      }
      (p.torCommittees || []).forEach(c => addCleanPos(c.position));
      (p.inspectCommittees || []).forEach(c => addCleanPos(c.position));
    });

    return Array.from(positions).sort((a, b) => a.localeCompare(b, 'th'));
  }, [existingProjects]);

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
      case 'supervisor':
        return normalizeName((projectData.supervisorName || '').replace(/\s*\(.*?\)\s*/g, ''));
      case 'inspection':
        return formatCommitteePayee(projectData.inspectCommittees);
      default:
        return '';
    }
  };

  // Normalize legacy TOR title and auto-fill empty payee names from Tab 2 / Tab 3
  const syncRemunerationsWithTabs = (projectData: Project): Project => {
    const updatedRemunerations = (projectData.remunerations || []).map(r => {
      const normalizedTitle =
        r.title === 'ค่าตอบแทนคณะกรรมการจัดทำแบบรูปและราคากลาง'
          ? REMUNERATION_TITLES.tor
          : r.title;
      const inferredType = inferRemunerationType(normalizedTitle, r.type);
      const currentPayee = normalizeName(r.payeeName);
      const autoPayee = getDefaultPayeeByType(inferredType, projectData);
      return {
        ...r,
        type: inferredType,
        title: normalizedTitle,
        payeeName: currentPayee || autoPayee
      };
    });
    return {
      ...projectData,
      remunerations: updatedRemunerations
    };
  };

  // Form State
  const [formData, setFormData] = useState<Project>(() => {
    if (initialProject) return syncRemunerationsWithTabs(JSON.parse(JSON.stringify(initialProject)));
    const nextYear = 2569;
    return {
      id: `prj-${Date.now()}`,
      projectCode: `ช.${String(nextYear).slice(-2)}-${Math.floor(Math.random() * 900 + 100)}`,
      fiscalYear: nextYear,
      name: '',
      budgetCategory: 'งบประมาณรายจ่าย',
      meetingSession: '',
      approvalYear: nextYear - 1,
      approvedBudget: 0,
      description: '',
      location: 'ต.ไร่ใต้ อ.พิบูลมังสาหาร จ.อุบลราชธานี',
      responsiblePerson: '',
      notes: '',

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
        setFormData(syncRemunerationsWithTabs(JSON.parse(JSON.stringify(initialProject))));
      } else {
        const nextYear = 2569;
        setFormData({
          id: `prj-${Date.now()}`,
          projectCode: `ช.${String(nextYear).slice(-2)}-${Math.floor(Math.random() * 900 + 100)}`,
          fiscalYear: nextYear,
          name: '',
          budgetCategory: 'งบประมาณรายจ่าย',
          meetingSession: '',
          approvalYear: nextYear - 1,
          approvedBudget: 0,
          description: '',
          location: 'ต.ไร่ใต้ อ.พิบูลมังสาหาร จ.อุบลราชธานี',
          responsiblePerson: '',
          notes: '',

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
    formData.torOrderNo,
    formData.torOrderDate,
    formData.torAuthor,
    formData.torDate,
    formData.refPrice,
    formData.inspectOrderNo,
    formData.inspectOrderDate,
    formData.supervisorName,
    formData.contractNo,
    formData.contractDate,
    formData.contractAmount,
    formData.contractorName,
    formData.workNotices,
    formData.deliveries,
    formData.inspections,
    formData.disbursements
  ]);

  // Keep empty remuneration payees synchronized with Tab 2 & Tab 3 when opening Tab 6
  React.useEffect(() => {
    if (activeTab === 6) {
      setFormData(prev => syncRemunerationsWithTabs(prev));
    }
  }, [activeTab]);

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
            details: ''
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

  // Total remuneration calculation
  const totalRemuneration = (formData.remunerations || []).reduce((sum, r) => sum + (r.amount || 0), 0);
  const paidRemuneration = (formData.remunerations || [])
    .filter(r => r.status === 'paid')
    .reduce((sum, r) => sum + (r.amount || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('กรุณากรอกชื่อโครงการ');
      setActiveTab(1);
      return;
    }
    if (!formData.fiscalYear) {
      alert('กรุณาระบุปีงบประมาณ');
      setActiveTab(1);
      return;
    }

    const finalProgress = calculateProjectProgress(formData);
    const previousStatus = initialProject?.status;
    const didStatusChange = initialProject
      ? formData.status !== previousStatus
      : formData.status !== 'not_started';

    onSave({
      ...formData,
      progressPercent: finalProgress,
      statusUpdatedAt: didStatusChange ? formatThaiDateTime() : formData.statusUpdatedAt,
      updatedAt: new Date().toISOString()
    });
  };

  const tabs = [
    { num: 1, title: '1. ข้อมูลทั่วไป', icon: FileText },
    { num: 2, title: '2. TOR & ราคากลาง', icon: Coins },
    { num: 3, title: '3. ควบคุม & ตรวจรับ', icon: Users },
    { num: 4, title: '4. สัญญาจ้าง', icon: FileCheck },
    { num: 5, title: '5. ดำเนินงาน & ฎีกา', icon: Clock },
    { num: 6, title: '6. ค่าตอบแทนกรรมการ', icon: HardHat }
  ];

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
                onClick={() => setActiveTab(tab.num)}
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
                      const prefix = `ช.${String(yr).slice(-2)}-`;
                      const oldCode = formData.projectCode;
                      const newCode = oldCode.startsWith('ช.') ? `${prefix}${oldCode.slice(5) || Math.floor(Math.random() * 900 + 100)}` : oldCode;
                      setFormData({ ...formData, fiscalYear: yr, projectCode: newCode });
                    }}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold text-slate-800"
                  >
                    {[2569, 2570, 2571, 2572, 2573, 2574, 2575].map(yr => (
                      <option key={yr} value={yr}>
                        ปีงบประมาณ พ.ศ. {yr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    รหัสโครงการ
                  </label>
                  <input
                    type="text"
                    value={formData.projectCode}
                    onChange={e => setFormData({ ...formData, projectCode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
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
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="เช่น โครงการก่อสร้างถนน คสล. สายบ้านหนองผักชี หมู่ที่ 3"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    หมวดงบประมาณ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    list="budget-categories-list"
                    value={formData.budgetCategory || ''}
                    onChange={e => setFormData({ ...formData, budgetCategory: e.target.value })}
                    placeholder="พิมพ์ชื่อหมวด เช่น กันเงินงบประมาณ..."
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <datalist id="budget-categories-list">
                    {Array.from(
                      new Set([
                        'เงินสะสม',
                        'งบประมาณรายจ่าย',
                        'เงินอุดหนุนเฉพาะกิจ',
                        'เงินอุดหนุนทั่วไป',
                        'เงินกู้/งบกลาง',
                        'กันเงินงบประมาณ',
                        ...existingCategories
                      ])
                    ).map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </datalist>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ปี พ.ศ. ของมติหรือการอนุมัติ
                  </label>
                  <input
                    type="number"
                    value={formData.approvalYear || ''}
                    onChange={e => setFormData({ ...formData, approvalYear: Number(e.target.value) })}
                    placeholder="เช่น 2569"
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
                      <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
                        <span>ผ่านแล้ว {countCompletedSteps(formData)}/12 ขั้นตอน</span>
                        <span className="font-semibold text-slate-700">ขั้นละ ~8.33%</span>
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
                    placeholder="พิมพ์ชื่อเพื่อค้นหา เช่น นายศรายุทธ..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  สถานที่ดำเนินโครงการ
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  placeholder="เช่น หมู่ที่ 3 ถึง หมู่ที่ 4 ตำบลดอนหวาย"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
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

              {/* รายการไฟล์แนบในระบบทั้งหมด (Google Drive) */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-emerald-700" />
                    <h5 className="text-xs font-bold text-slate-800">
                      รายการไฟล์แนบและคลังเอกสารในระบบ ({formData.attachments?.length || 0} ไฟล์)
                    </h5>
                  </div>
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-300 transition shadow-2xs">
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

                {formData.attachments && formData.attachments.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {formData.attachments.map(att => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 hover:bg-emerald-50/40 rounded-xl border border-slate-200 text-xs transition"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Paperclip className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div className="overflow-hidden">
                            <div className="font-semibold text-slate-800 truncate" title={att.name}>
                              {att.name}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              หมวด: <span className="font-semibold text-emerald-800">{att.category}</span> • {(att.size / 1024).toFixed(1)} KB
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
                    ยังไม่มีไฟล์แนบในโครงการนี้ (สามารถอัปโหลดไฟล์แนบเพิ่มเติมได้ที่นี่หรือตามหมวดงาน)
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
                          onChange={val => {
                            const updated = [...formData.torCommittees];
                            updated[idx].name = val;
                            setFormData({ ...formData, torCommittees: updated });
                          }}
                          suggestions={suggestedPersonNames}
                          placeholder="ชื่อ-นามสกุลกรรมการ..."
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div className="flex-1 w-full">
                        <AutoSuggestInput
                          value={c.position || ''}
                          onChange={val => {
                            const updated = [...formData.torCommittees];
                            updated[idx].position = val;
                            setFormData({ ...formData, torCommittees: updated });
                          }}
                          suggestions={suggestedPositions}
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

              {/* Attachments Section */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ไฟล์แนบคำสั่งแต่งตั้ง TOR และเอกสารราคากลาง (PDF, Excel, Word)
                </label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium border border-slate-300">
                    <Upload className="w-3.5 h-3.5" />
                    <span>เลือกไฟล์แนบ...</span>
                    <input
                      type="file"
                      multiple
                      onChange={e => handleFileUpload(e, 'tor')}
                      className="hidden"
                    />
                  </label>
                  <span className="text-xs text-slate-400">
                    {formData.attachments.filter(a => a.category === 'tor').length} ไฟล์แนบในหมวดนี้
                  </span>
                </div>

                <div className="mt-2 space-y-1">
                  {formData.attachments
                    .filter(a => a.category === 'tor')
                    .map(att => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-2 bg-emerald-50/60 rounded-lg border border-emerald-200 text-xs text-emerald-900"
                      >
                        <div className="flex items-center gap-2">
                          <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="font-medium">{att.name}</span>
                          <span className="text-[10px] text-emerald-700">
                            ({(att.size / 1024).toFixed(1)} KB)
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ผู้ควบคุมงาน
                  </label>
                  <AutoSuggestInput
                    value={formData.supervisorName || ''}
                    onChange={val => setFormData({ ...formData, supervisorName: val })}
                    suggestions={suggestedPersonNames}
                    placeholder="พิมพ์ชื่อเพื่อค้นหา เช่น นายอนันต์ ศรีสุข..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
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
                          onChange={val => {
                            const updated = [...formData.inspectCommittees];
                            updated[idx].name = val;
                            setFormData({ ...formData, inspectCommittees: updated });
                          }}
                          suggestions={suggestedPersonNames}
                          placeholder="ชื่อ-นามสกุล..."
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div className="flex-1 w-full">
                        <AutoSuggestInput
                          value={c.position || ''}
                          onChange={val => {
                            const updated = [...formData.inspectCommittees];
                            updated[idx].position = val;
                            setFormData({ ...formData, inspectCommittees: updated });
                          }}
                          suggestions={suggestedPositions}
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
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium border border-slate-300">
                    <Upload className="w-3.5 h-3.5" />
                    <span>เลือกไฟล์แนบคำสั่ง...</span>
                    <input
                      type="file"
                      multiple
                      onChange={e => handleFileUpload(e, 'order')}
                      className="hidden"
                    />
                  </label>
                  <span className="text-xs text-slate-400">
                    {formData.attachments.filter(a => a.category === 'order').length} ไฟล์แนบในหมวดนี้
                  </span>
                </div>

                <div className="mt-2 space-y-1">
                  {formData.attachments
                    .filter(a => a.category === 'order')
                    .map(att => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-2 bg-emerald-50/60 rounded-lg border border-emerald-200 text-xs text-emerald-900"
                      >
                        <div className="flex items-center gap-2">
                          <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="font-medium">{att.name}</span>
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
                    onChange={val => setFormData({ ...formData, contractorName: val })}
                    suggestions={suggestedContractorNames}
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
                    onChange={e => setFormData({ ...formData, contractorTaxId: e.target.value })}
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
                  onChange={e => setFormData({ ...formData, contractorContact: e.target.value })}
                  placeholder="ที่อยู่ เบอร์โทรศัพท์ และอีเมลผู้รับจ้าง..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Attachments Section */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ไฟล์แนบสัญญาจ้างและแบบแปลนก่อสร้าง
                </label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium border border-slate-300">
                    <Upload className="w-3.5 h-3.5" />
                    <span>เลือกไฟล์แนบสัญญา...</span>
                    <input
                      type="file"
                      multiple
                      onChange={e => handleFileUpload(e, 'contract')}
                      className="hidden"
                    />
                  </label>
                  <span className="text-xs text-slate-400">
                    {formData.attachments.filter(a => a.category === 'contract').length} ไฟล์แนบในหมวดนี้
                  </span>
                </div>

                <div className="mt-2 space-y-1">
                  {formData.attachments
                    .filter(a => a.category === 'contract')
                    .map(att => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-2 bg-emerald-50/60 rounded-lg border border-emerald-200 text-xs text-emerald-900"
                      >
                        <div className="flex items-center gap-2">
                          <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="font-medium">{att.name}</span>
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

                {formData.deliveries.map((del, idx) => (
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
                            const updated = [...formData.deliveries];
                            updated[idx].bookDate = e.target.value;
                            setFormData({ ...formData, deliveries: updated });
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">วันที่ส่งมอบจริง</label>
                        <input
                          type="date"
                          value={del.actualDeliveryDate}
                          onChange={e => {
                            const updated = [...formData.deliveries];
                            updated[idx].actualDeliveryDate = e.target.value;
                            setFormData({ ...formData, deliveries: updated });
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                    <div>
                      <input
                        type="text"
                        value={del.details}
                        onChange={e => {
                          const updated = [...formData.deliveries];
                          updated[idx].details = e.target.value;
                          setFormData({ ...formData, deliveries: updated });
                        }}
                        placeholder="รายละเอียดผลงานที่ส่งมอบ..."
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                ))}
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
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium border border-slate-300">
                    <Upload className="w-3.5 h-3.5" />
                    <span>เลือกไฟล์แนบ...</span>
                    <input
                      type="file"
                      multiple
                      onChange={e => handleFileUpload(e, 'delivery')}
                      className="hidden"
                    />
                  </label>
                  <span className="text-xs text-slate-400">
                    {formData.attachments.filter(a => ['notice', 'delivery', 'inspection', 'disbursement'].includes(a.category)).length} ไฟล์แนบในหมวดนี้
                  </span>
                </div>

                <div className="mt-2 space-y-1">
                  {formData.attachments
                    .filter(a => ['notice', 'delivery', 'inspection', 'disbursement'].includes(a.category))
                    .map(att => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-2 bg-emerald-50/60 rounded-lg border border-emerald-200 text-xs text-emerald-900"
                      >
                        <div className="flex items-center gap-2">
                          <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="font-medium">{att.name}</span>
                          <span className="text-[10px] text-emerald-700">
                            ({att.category} • {(att.size / 1024).toFixed(1)} KB)
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
                                const updated = [...formData.remunerations];
                                updated[idx].status = e.target.value as any;
                                setFormData({ ...formData, remunerations: updated });
                              }}
                              className="flex-1 px-2 py-1 bg-white border border-slate-300 rounded-md font-semibold"
                            >
                              <option value="pending">ยังไม่เบิก</option>
                              <option value="paid">เบิกแล้ว</option>
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                        <div>
                          <span className="text-[10px] text-slate-500">วันที่เบิก: </span>
                          <input
                            type="date"
                            value={rem.withdrawDate || ''}
                            onChange={e => {
                              const updated = [...formData.remunerations];
                              updated[idx].withdrawDate = e.target.value;
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
                              updated[idx].petitionNo = e.target.value;
                              setFormData({ ...formData, remunerations: updated });
                            }}
                            placeholder="เช่น 12/2568"
                            className="px-2 py-0.5 bg-white border border-slate-300 rounded-md text-[11px]"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Modal Footer Controls */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              หมวดที่ {activeTab} จาก 6
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition"
              >
                ยกเลิก
              </button>

              {activeTab < 6 && (
                <button
                  type="button"
                  onClick={() => setActiveTab(prev => Math.min(6, prev + 1))}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition"
                >
                  ถัดไป (หมวดที่ {activeTab + 1})
                </button>
              )}

              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-700/20 active:scale-95 transition"
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
