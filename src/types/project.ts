export type ProjectStatus =
  | 'not_started'       // ยังไม่เริ่มดำเนินการ
  | 'procurement_tor'   // อยู่ระหว่างจัดทำ TOR/ราคากลาง
  | 'contracted'        // ลงนามสัญญาแล้ว/รอเข้าทำงาน
  | 'in_progress'       // อยู่ระหว่างดำเนินงาน
  | 'delivered'         // ส่งมอบงานแล้ว รอตรวจรับ
  | 'inspected'         // ตรวจรับงานแล้ว รอเบิกจ่าย
  | 'completed'         // ดำเนินการแล้วเสร็จ (เบิกจ่ายเรียบร้อย)
  | 'overdue';          // เกินกำหนดสัญญา

export type BudgetCategory =
  | 'เงินสะสม'
  | 'งบประมาณรายจ่าย'
  | 'เงินอุดหนุนเฉพาะกิจ'
  | 'เงินอุดหนุนทั่วไป'
  | 'เงินกู้/งบกลาง'
  | 'เงินบริจาค/อื่นๆ';

export interface CommitteeMember {
  id: string;
  name: string;
  position: string;
  role: 'ประธานกรรมการ' | 'กรรมการ' | 'กรรมการและเลขานุการ' | 'ผู้ควบคุมงาน';
  department?: string;
  phone?: string;
}

export interface AttachmentFile {
  id: string;
  name: string;
  size: number; // in bytes
  type: string;
  category: 'tor' | 'order' | 'contract' | 'notice' | 'delivery' | 'inspection' | 'disbursement' | 'remuneration' | 'other';
  uploadDate: string;
  url?: string;
}

export interface WorkNotice {
  id: string;
  bookNo: string;
  bookDate: string;
  actualWorkDate: string;
  notes?: string;
  attachments?: AttachmentFile[];
}

export interface DeliveryRecord {
  id: string;
  installment: number; // งวดที่
  bookNo: string;
  bookDate: string;
  actualDeliveryDate: string;
  details: string;
  attachments?: AttachmentFile[];
}

export interface InspectionRecord {
  id: string;
  installment: number;
  inspectionDate: string;
  result: 'pass' | 'fail' | 'need_revision';
  details: string;
  inspectorRemarks?: string;
  attachments?: AttachmentFile[];
}

export interface DisbursementRecord {
  id: string;
  installment: number;
  disbursementDate: string;
  petitionNo: string; // เลขที่ฎีกา
  amount: number;
  status: 'pending' | 'paid';
  checkNo?: string;
  transferDate?: string;
  attachments?: AttachmentFile[];
}

export interface CommitteeRemuneration {
  id: string;
  type: 'tor' | 'supervisor' | 'inspection';
  title: string; // e.g. ค่าตอบแทนคณะกรรมการตรวจรับงาน งวดที่ 1
  payeeName: string;
  amount: number;
  withdrawDate: string;
  petitionNo: string;
  status: 'pending' | 'paid';
  attachments?: AttachmentFile[];
}

export interface Project {
  id: string;
  projectCode: string;
  fiscalYear: number; // e.g. 2568, 2569
  name: string;
  budgetCategory: BudgetCategory;
  meetingSession?: string; // สมัยประชุม/ครั้งที่ (กรณีเงินสะสม)
  approvalYear?: number;   // ปี พ.ศ. มติอนุมัติ
  approvedBudget: number;  // งบประมาณที่ได้รับอนุมัติ (บาท)
  description?: string;
  location: string;
  responsiblePerson: string;
  notes?: string;

  // หมวด 2: ข้อมูล TOR และราคากลาง
  torOrderNo?: string;
  torOrderDate?: string;
  torAuthor?: string;
  torDate?: string;
  refPriceDate?: string;
  refPrice?: number;
  torCommittees: CommitteeMember[];

  // หมวด 3: คำสั่งควบคุมงานและตรวจรับ
  inspectOrderNo?: string;
  inspectOrderDate?: string;
  supervisorName?: string;
  inspectCommittees: CommitteeMember[];

  // หมวด 4: ข้อมูลสัญญาจ้าง
  contractNo?: string;
  contractDate?: string;
  contractAmount?: number;
  startDate?: string;
  endDate?: string;
  contractorName?: string;
  contractorTaxId?: string;
  contractorContact?: string;

  // หมวด 5: การดำเนินงานและติดตาม
  workNotices: WorkNotice[];
  deliveries: DeliveryRecord[];
  inspections: InspectionRecord[];
  disbursements: DisbursementRecord[];

  // หมวด 6: การเบิกค่าตอบแทนกรรมการ
  remunerations: CommitteeRemuneration[];

  // เอกสารแนบทั้งหมด
  attachments: AttachmentFile[];

  // การรับทราบงานและกล่องงาน (My Inbox) เหมือนระบบสารบรรณ
  ackStatus?: 'รอรับทราบ' | 'รับทราบแล้ว';
  ackTime?: string;
  fileUrl?: string;
  fileName?: string;

  // สถานะและ metadata
  status: ProjectStatus;
  progressPercent: number; // 0 - 100
  createdAt: string;
  updatedAt: string;
}

export const FISCAL_YEARS = [2569, 2570, 2571, 2572, 2573, 2574, 2575] as const;
export type FiscalYear = typeof FISCAL_YEARS[number];

export const RAI_TAI_PERSONNEL = [
  { name: 'นิศาชล คงดี', position: 'ผู้ช่วยเจ้าพนักงานธุรการ', role: 'admin' },
  { name: 'นายจิรพงษ์  พัฒนพันธ์', position: 'ผู้อำนวยการกองช่าง', role: 'staff' },
  { name: 'นายศรายุทธ  สงวนรัษฐ์', position: 'นายช่างโยธาชำนาญงาน', role: 'staff' },
  { name: 'นายพิทักษ์  โพธิ์ขาว', position: 'นายช่างไฟฟ้าชำนาญงาน', role: 'staff' },
  { name: 'นายยิ่งอนันต์  สัทธรรม', position: 'ผู้ช่วยนายช่างประปา', role: 'staff' }
];

export type UserRole = 'admin' | 'staff';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  position: string;
  department: string;
  email: string;
}

export interface ProjectFilter {
  fiscalYear: string | number; // 'all' or year e.g. 2568
  category: string;           // 'all' or specific category
  status: string;             // 'all' or specific status
  searchQuery: string;        // search in name, contractNo, contractor, projectCode
}
