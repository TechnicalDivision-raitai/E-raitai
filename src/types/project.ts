export type ProjectStatus =
  | 'not_started'       // ยังไม่เริ่มดำเนินการ
  | 'procurement_tor'   // อยู่ระหว่างจัดทำ TOR/ราคากลาง
  | 'contracted'        // ลงนามสัญญาแล้ว/รอเข้าทำงาน
  | 'in_progress'       // อยู่ระหว่างดำเนินงาน
  | 'delivered'         // ส่งมอบงานแล้ว รอตรวจรับ
  | 'inspected'         // ตรวจรับงานแล้ว รอเบิกจ่าย
  | 'completed'         // ดำเนินการแล้วเสร็จ (เบิกจ่ายเรียบร้อย)
  | 'overdue'           // เกินกำหนดสัญญา
  | 'cancelled';        // ยกเลิกโครงการ

export type BudgetCategory = string;

export interface CommitteeMember {
  id: string;
  name: string;
  position: string;
  positionUpdatedAt?: string;
  role: 'ประธานกรรมการ' | 'กรรมการ' | 'กรรมการและเลขานุการ' | 'ผู้ควบคุมงาน';
  department?: string;
  phone?: string;
}

export interface AttachmentFile {
  id: string;
  name: string;
  size: number; // in bytes
  type: string;
  category: 'approval_request' | 'tor' | 'order' | 'contract' | 'notice' | 'delivery' | 'inspection' | 'disbursement' | 'remuneration' | 'project_record' | 'other';
  uploadDate: string;
  url?: string;
}

export interface ProjectCoordinatePoint {
  lat: string;
  lng: string;
  note?: string;
}

export interface ProjectArchiveAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  photoStage?: 'before' | 'during' | 'after' | 'signboard' | 'document';
  caption?: string;
  uploadDate: string;
  url?: string;
  previewDataUrl?: string;
}

export interface ProjectArchiveRecord {
  startPoint?: ProjectCoordinatePoint;
  endPoint?: ProjectCoordinatePoint;
  signboardPoint?: ProjectCoordinatePoint;
  files?: ProjectArchiveAttachment[];
  remark?: string;
  updatedAt?: string;
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
  type: 'tor_author' | 'tor' | 'supervisor' | 'inspection';
  title: string; // e.g. ค่าตอบแทนผู้จัดทำ TOR / ค่าตอบแทนคณะกรรมการตรวจรับงาน งวดที่ 1
  payeeName: string;
  amount: number;
  withdrawDate: string;
  petitionNo: string;
  status: 'pending' | 'paid' | 'not_eligible';
  remarks?: string;
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
  approvalRequestNo?: string;   // เลขที่หนังสือขออนุมัติโครงการ (ขั้นตอนที่ 1)
  approvalRequestDate?: string; // วันที่หนังสือขออนุมัติโครงการ (YYYY-MM-DD)

  // หมวด 2: ข้อมูล TOR และราคากลาง
  torOrderNo?: string;
  torOrderDate?: string;
  torAuthor?: string;
  torDate?: string;
  refPriceDate?: string;
  refPrice?: number;
  torCommittees: CommitteeMember[];
  torNotes?: string;               // หมายเหตุหมวด TOR และราคากลาง
  torRemunerationPayee?: string;   // ผู้รับเงินค่าตอบแทนผู้จัดทำ TOR
  torRemunerationAmount?: number;  // ยอดเงินค่าตอบแทนผู้จัดทำ TOR (บาท)

  // หมวด 3: คำสั่งควบคุมงานและตรวจรับ
  inspectOrderNo?: string;
  inspectOrderDate?: string;
  supervisorName?: string;
  supervisors?: CommitteeMember[];
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
  contractorTaxIdUpdatedAt?: string;
  contractorContactUpdatedAt?: string;

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

  // บันทึกข้อมูลโครงการย้อนหลัง (พิกัดโครงการ, พิกัดป้ายโครงการ, รูปภาพ/ไฟล์แนบ - ไม่เกี่ยวข้องกับสถานะหรือไทม์ไลน์ 12 ขั้นตอน)
  projectRecord?: ProjectArchiveRecord;

  // สถานะและ metadata
  status: ProjectStatus;
  statusUpdatedAt?: string;
  progressPercent: number; // 0 - 100
  createdAt: string;
  updatedAt: string;
}

export const FISCAL_YEARS = [2569, 2570, 2571, 2572, 2573, 2574, 2575] as const;
export type FiscalYear = typeof FISCAL_YEARS[number];

export const RAI_TAI_PERSONNEL = [
  { name: 'นิศาชล คงดี', position: 'ผู้ช่วยเจ้าพนักงานธุรการ', role: 'admin' },
  { name: 'นายจิรพงษ์ พัฒนพันธ์', position: 'ผู้อำนวยการกองช่าง', role: 'staff' },
  { name: 'นายศรายุทธ สงวนรัษฎ์', position: 'นายช่างโยธาชำนาญงาน', role: 'staff' },
  { name: 'นายพิทักษ์ โพธิ์ขาว', position: 'นายช่างไฟฟ้าชำนาญงาน', role: 'staff' },
  { name: 'นายยิ่งอนันต์ สัทธรรม', position: 'ผู้ช่วยนายช่างประปา', role: 'staff' }
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

export type SarabanDocCategory =
  | 'project_approval'
  | 'tor_order'
  | 'tor_approval'
  | 'ref_price'
  | 'inspect_order'
  | 'contract'
  | 'work_notice'
  | 'delivery'
  | 'inspection'
  | 'disbursement'
  | 'remuneration'
  | 'other';

export type SarabanQueueStatus = 'pending' | 'approved' | 'rejected';

export interface SarabanQueueItem {
  queueId: string;
  idempotencyKey?: string;
  createdAt: string;
  projectId: string;
  projectCode: string;
  fiscalYear: number;
  docCategory: SarabanDocCategory;
  bookNo: string;
  bookDate: string; // YYYY-MM-DD (Gregorian)
  subject: string;
  payload: Record<string, any>;
  fileName?: string;
  fileUrl?: string;
  fileSize?: number;
  mimeType?: string;
  submittedBy: string;
  queueStatus: SarabanQueueStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectReason?: string;
}

// =========================================================================
// คำร้อง / งานซ่อมแซมถนน (รับเรื่องร้องทุกข์และการแก้ไขปัญหา กองช่าง อบต.ไร่ใต้)
// =========================================================================
export type RepairRequestStatus =
  | 'received'       // รับคำร้องแล้ว / รอตรวจสอบ
  | 'inspecting'     // ลงพื้นที่สำรวจ
  | 'in_progress'    // กำลังดำเนินการซ่อมแซม
  | 'completed'      // แก้ไข/ซ่อมแซมแล้วเสร็จ
  | 'budget_planned'; // เสนอตั้งงบประมาณ / จัดทำโครงการ

export type RepairUrgency = 'normal' | 'urgent' | 'emergency';

export type RepairChannel = 'walk_in' | 'council_member' | 'phone' | 'letter' | 'online';

export type RepairRoadType = 'gravel' | 'concrete' | 'asphalt' | 'drainage' | 'bridge' | 'other';

export interface RepairAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  stage: 'petition' | 'before' | 'during' | 'after';
  caption?: string;
  url?: string;
  previewDataUrl?: string;
  uploadDate: string;
}

export interface RepairRequest {
  id: string;
  requestCode: string;            // รหัสคำร้องอัตโนมัติ เช่น ซ.69-001
  fiscalYear: number;             // ปีงบประมาณ พ.ศ. เช่น 2569

  // ส่วนรับเรื่อง อบต. และ กองช่าง
  obtReceiveNo?: string;          // เลขรับ อบต. เช่น 2686
  obtReceiveDate?: string;        // วันที่รับ อบต. (YYYY-MM-DD)
  engReceiveNo?: string;          // เลขที่รับกองช่าง เช่น 288
  engReceiveDate?: string;        // วันที่รับกองช่าง (YYYY-MM-DD)
  channel: RepairChannel;

  // ส่วนข้อมูลใบคำร้องทุกข์/ร้องเรียน
  petitionDate: string;           // วันที่ยื่นคำร้อง (YYYY-MM-DD)
  subject: string;                // เรื่อง เช่น ขอความอนุเคราะห์ ซ่อมแซม ถนนลูกรัง สายโคกสูง - เสี่ยวนา
  roadName: string;               // สายถนน / จุดเกิดเหตุ
  villageNo?: string;             // หมู่ที่
  roadType: RepairRoadType;
  requesterName: string;          // ชื่อ-สกุล ผู้ร้องทุกข์/ร้องเรียน
  requesterAge?: string;          // อายุ (ปี)
  requesterPosition?: string;     // ตำแหน่ง/อาชีพ เช่น สมาชิกสภา อบต.
  requesterAddress?: string;      // ที่อยู่ผู้ร้อง
  requesterPhone?: string;        // เบอร์โทรศัพท์
  problemDetails: string;         // รายละเอียดความเดือดร้อน/สภาพการชำรุด
  submittedEvidenceNote?: string; // เอกสารหลักฐานประกอบคำร้อง เช่น รูปถ่าย จำนวน 1 ชุด
  officerNote?: string;           // บันทึกเจ้าหน้าที่เสนอ ผอ.กองช่าง
  urgency: RepairUrgency;

  // พิกัดจุดชำรุด (สำหรับเปิด Google Maps ลงพื้นที่)
  locationLat?: string;
  locationLng?: string;

  // ส่วนการตรวจสอบและการแก้ไขปัญหา
  status: RepairRequestStatus;
  assignedStaff?: string;         // ผู้รับผิดชอบ / ชุดช่างผู้ดำเนินการ
  inspectionDate?: string;        // วันที่ลงพื้นที่ตรวจสอบ
  inspectionSummary?: string;     // ผลการตรวจสอบหน้างาน
  repairMethod?: string;          // วิธีการซ่อมแซม
  repairDetails?: string;         // รายละเอียดการแก้ไข/วัสดุ/เครื่องจักรที่ใช้
  repairStartDate?: string;       // วันที่เริ่มดำเนินการซ่อมแซม
  repairCompletedDate?: string;   // วันที่แก้ไข/ซ่อมแซมแล้วเสร็จ
  repairCost?: number;            // ค่าใช้จ่ายซ่อมบำรุง (บาท) ถ้ามี
  resolutionNote?: string;        // สรุปผลการแก้ไข / หมายเหตุปิดงาน

  // เอกสารใบคำร้องและภาพถ่าย ก่อน-ระหว่าง-หลังซ่อม
  attachments: RepairAttachment[];

  createdAt: string;
  updatedAt: string;
}


