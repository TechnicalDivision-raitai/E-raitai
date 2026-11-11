import { Project, UserProfile } from '../types/project';

export const CURRENT_USER: UserProfile = {
  id: 'usr-001',
  username: 'admin',
  displayName: 'นิศาชล คงดี',
  role: 'admin',
  position: 'ผู้ช่วยเจ้าพนักงานธุรการ (ผู้ดูแลระบบ)',
  department: 'กองช่าง องค์การบริหารส่วนตำบลไร่ใต้',
  email: 'nisachol.kd@raitai.local'
};

export const STAFF_USER: UserProfile = {
  id: 'usr-002',
  username: 'staff',
  displayName: 'เจ้าหน้าที่/บุคลากรทั่วไป',
  role: 'staff',
  position: 'เจ้าหน้าที่/บุคลากรทั่วไป (กองช่าง)',
  department: 'องค์การบริหารส่วนตำบลไร่ใต้',
  email: 'staff.eng@raitai.local'
};

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'prj-2569-001',
    projectCode: 'ช.69-001',
    fiscalYear: 2569,
    name: 'โครงการก่อสร้างถนนคอนกรีตเสริมเหล็ก (คสล.) สายบ้านไร่ใต้ หมู่ที่ 1 เชื่อมต่อ หมู่ที่ 5',
    budgetCategory: 'เงินสะสม',
    meetingSession: 'สมัยสามัญ สมัยที่ 2 ครั้งที่ 1/2568',
    approvalYear: 2568,
    approvedBudget: 2450000,
    description: 'ก่อสร้างถนน คสล. ผิวจราจรกว้าง 5.00 เมตร หนา 0.15 เมตร ระยะทาง 950 เมตร หรือมีพื้นที่คอนกรีตรวมไม่น้อยกว่า 4,750 ตร.ม. พร้อมลงหินคลุกไหล่ทางข้างละ 0.50 เมตร',
    location: 'หมู่ที่ 1 ถึง หมู่ที่ 5 ต.ไร่ใต้ อ.พิบูลมังสาหาร จ.อุบลราชธานี',
    responsiblePerson: 'นายศรายุทธ  สงวนรัษฐ์',
    ackStatus: 'รอรับทราบ',
    ackTime: '-',
    notes: 'อนุมัติจ่ายขาดเงินสะสม ตามมติสภาฯ เมื่อวันที่ 15 สิงหาคม 2568',

    torOrderNo: '142/2567',
    torOrderDate: '2024-09-02',
    torAuthor: 'นายธวัชชัย มีทรัพย์',
    torDate: '2024-09-12',
    refPriceDate: '2024-09-18',
    refPrice: 2415000,
    torCommittees: [
      { id: 'cm-101', name: 'นายธวัชชัย มีทรัพย์', position: 'วิศวกรโยธาปฏิบัติการ', role: 'ประธานกรรมการ', phone: '081-234-5678' },
      { id: 'cm-102', name: 'นายอนันต์ ศรีสุข', position: 'นายช่างโยธาชำนาญงาน', role: 'กรรมการ', phone: '082-345-6789' },
      { id: 'cm-103', name: 'นางสาวกานดา วิมลสวัสดิ์', position: 'เจ้าพนักงานพัสดุชำนาญงาน', role: 'กรรมการและเลขานุการ', phone: '083-456-7890' }
    ],

    inspectOrderNo: '185/2567',
    inspectOrderDate: '2024-10-15',
    supervisorName: 'นายอนันต์ ศรีสุข (นายช่างโยธาชำนาญงาน)',
    inspectCommittees: [
      { id: 'cm-201', name: 'นายสมเกียรติ ยิ่งเจริญ', position: 'หัวหน้าฝ่ายแบบแผนและก่อสร้าง', role: 'ประธานกรรมการ', phone: '089-111-2233' },
      { id: 'cm-202', name: 'นายเกรียงไกร มั่นคง', position: 'นายช่างสำรวจปฏิบัติงาน', role: 'กรรมการ', phone: '089-222-3344' },
      { id: 'cm-203', name: 'นายประวิทย์ นาคดี', position: 'ผู้แทนชุมชนหมู่ที่ 3', role: 'กรรมการ', phone: '089-333-4455' }
    ],

    contractNo: '18/2568',
    contractDate: '2024-11-05',
    contractAmount: 2380000,
    startDate: '2024-11-10',
    endDate: '2025-03-10',
    contractorName: 'ห้างหุ้นส่วนจำกัด บุญบันดาลการช่างและโยธา',
    contractorTaxId: '0743542001928',
    contractorContact: '142 หมู่ 2 ต.เมืองเก่า อ.เมือง จ.นครปฐม โทร. 034-251145',

    workNotices: [
      {
        id: 'wn-1',
        bookNo: 'บข.001/2567',
        bookDate: '2024-11-08',
        actualWorkDate: '2024-11-10',
        notes: 'ผู้รับจ้างได้นำเครื่องจักรหนักและวัสดุลงพื้นที่ก่อสร้างตามกำหนด'
      }
    ],
    deliveries: [
      {
        id: 'del-1',
        installment: 1,
        bookNo: 'บข.015/2567',
        bookDate: '2024-12-20',
        actualDeliveryDate: '2024-12-20',
        details: 'ส่งมอบงานงวดที่ 1 งานปรับเกลี่ยดินเดิม ถมคันทาง และบดอัดแน่นชั้นหินคลุกรองพื้นทาง'
      }
    ],
    inspections: [
      {
        id: 'insp-1',
        installment: 1,
        inspectionDate: '2024-12-24',
        result: 'pass',
        details: 'คณะกรรมการได้ตรวจรับงานงวดที่ 1 ถูกต้องครบถ้วนตามแบบรูปรายการละเอียด'
      }
    ],
    disbursements: [
      {
        id: 'disb-1',
        installment: 1,
        disbursementDate: '2025-01-05',
        petitionNo: 'ฎีกาเลขที่ 45/2568',
        amount: 714000,
        status: 'paid',
        checkNo: 'KTB-8839210',
        transferDate: '2025-01-08'
      }
    ],
    remunerations: [
      {
        id: 'rem-1',
        type: 'tor',
        title: 'ค่าตอบแทนคณะกรรมการจัดทำแบบรูปและราคากลาง',
        payeeName: 'นายธวัชชัย มีทรัพย์ และคณะ',
        amount: 4500,
        withdrawDate: '2024-10-20',
        petitionNo: 'ฎีกาเลขที่ 12/2568',
        status: 'paid'
      },
      {
        id: 'rem-2',
        type: 'supervisor',
        title: 'ค่าตอบแทนผู้ควบคุมงาน งวดที่ 1',
        payeeName: 'นายอนันต์ ศรีสุข',
        amount: 3000,
        withdrawDate: '2025-01-05',
        petitionNo: 'ฎีกาเลขที่ 46/2568',
        status: 'paid'
      },
      {
        id: 'rem-3',
        type: 'inspection',
        title: 'ค่าตอบแทนคณะกรรมการตรวจรับงานจ้าง งวดที่ 1',
        payeeName: 'นายสมเกียรติ ยิ่งเจริญ และคณะ',
        amount: 4500,
        withdrawDate: '2025-01-05',
        petitionNo: 'ฎีกาเลขที่ 47/2568',
        status: 'paid'
      }
    ],
    attachments: [
      {
        id: 'att-1',
        name: 'คำสั่งแต่งตั้งคณะกรรมการจัดทำTOR_142-2567.pdf',
        size: 1420500,
        type: 'application/pdf',
        category: 'tor',
        uploadDate: '2024-09-03'
      },
      {
        id: 'att-2',
        name: 'เอกสารราคากลาง บก.01_งานถนนคสล.pdf',
        size: 2840000,
        type: 'application/pdf',
        category: 'tor',
        uploadDate: '2024-09-18'
      },
      {
        id: 'att-3',
        name: 'สัญญาจ้างเลขที่ 18-2568 พร้อมแบบแปลน.pdf',
        size: 5620000,
        type: 'application/pdf',
        category: 'contract',
        uploadDate: '2024-11-05'
      }
    ],
    status: 'in_progress',
    progressPercent: 65,
    createdAt: '2024-09-01T08:30:00Z',
    updatedAt: '2025-01-10T14:20:00Z'
  },
  {
    id: 'prj-2570-001',
    projectCode: 'ช.70-001',
    fiscalYear: 2570,
    name: 'โครงการติดตั้งโคมไฟส่องสว่างสาธารณะพลังงานแสงอาทิตย์ (โซลาร์เซลล์) สายเลียบคลองตาอิน',
    budgetCategory: 'งบประมาณรายจ่าย',
    approvalYear: 2567,
    approvedBudget: 980000,
    description: 'จัดซื้อพร้อมติดตั้งโคมไฟถนน LED พลังงานแสงอาทิตย์ ขนาดไม่น้อยกว่า 120W เสาสูง 6 เมตร พร้อมแบตเตอรี่และแผงเซลล์แสงอาทิตย์ จำนวน 65 ชุด',
    location: 'ถนนสายเลียบคลองตาอิน หมู่ที่ 1 และ หมู่ที่ 2 ต.ไร่ใต้ อ.พิบูลมังสาหาร',
    responsiblePerson: 'นายพิทักษ์  โพธิ์ขาว',
    ackStatus: 'รับทราบแล้ว',
    ackTime: '20 ม.ค. 68 09:15 น.',
    notes: 'แผนพัฒนาท้องถิ่น พ.ศ. 2566-2570 ยุทธศาสตร์ด้านโครงสร้างพื้นฐาน',

    torOrderNo: '160/2567',
    torOrderDate: '2024-10-01',
    torAuthor: 'นายพิทักษ์  โพธิ์ขาว',
    torDate: '2024-10-10',
    refPriceDate: '2024-10-15',
    refPrice: 975000,
    torCommittees: [
      { id: 'cm-104', name: 'นายพิทักษ์  โพธิ์ขาว', position: 'นายช่างไฟฟ้าชำนาญงาน', role: 'ประธานกรรมการ' },
      { id: 'cm-105', name: 'นายยิ่งอนันต์  สัทธรรม', position: 'ผู้ช่วยนายช่างประปา', role: 'กรรมการ' }
    ],

    inspectOrderNo: '198/2567',
    inspectOrderDate: '2024-11-12',
    supervisorName: 'นายพิทักษ์  โพธิ์ขาว',
    inspectCommittees: [
      { id: 'cm-204', name: 'นายจิรพงษ์ พัฒนพันธ์', position: 'ผู้อำนวยการกองช่าง', role: 'ประธานกรรมการ' },
      { id: 'cm-205', name: 'นายศรายุทธ  สงวนรัษฐ์', position: 'นายช่างโยธาชำนาญงาน', role: 'กรรมการ' },
      { id: 'cm-206', name: 'นายนิคม แซ่ตั้ง', position: 'ผู้ใหญ่บ้านหมู่ที่ 1', role: 'กรรมการ' }
    ],

    contractNo: '24/2568',
    contractDate: '2024-11-20',
    contractAmount: 960000,
    startDate: '2024-11-25',
    endDate: '2025-01-24',
    contractorName: 'บริษัท กรีนเทค โซลาร์ ซิสเต็มส์ จำกัด',
    contractorTaxId: '0105562019481',
    contractorContact: '88/4 อาคารนวัตกรรม ถ.ชยางกูร อ.เมือง จ.อุบลราชธานี โทร. 045-998112',

    workNotices: [
      {
        id: 'wn-2',
        bookNo: 'GT.01/2567',
        bookDate: '2024-11-22',
        actualWorkDate: '2024-11-25',
        notes: 'เข้าทำการขุดหลุมหล่อฐานรากเสาไฟฟ้า'
      }
    ],
    deliveries: [
      {
        id: 'del-2',
        installment: 1,
        bookNo: 'GT.09/2568',
        bookDate: '2025-01-20',
        actualDeliveryDate: '2025-01-20',
        details: 'ส่งมอบงานจ้างตามสัญญาทั้งหมด ครบถ้วน 65 ชุด พร้อมผลทดสอบการส่องสว่าง'
      }
    ],
    inspections: [
      {
        id: 'insp-2',
        installment: 1,
        inspectionDate: '2025-01-23',
        result: 'pass',
        details: 'คณะกรรมการตรวจรับงานจ้างครบ 65 ต้น ทดสอบการทำงานระบบเปิด-ปิดอัตโนมัติถูกต้อง'
      }
    ],
    disbursements: [
      {
        id: 'disb-2',
        installment: 1,
        disbursementDate: '2025-02-04',
        petitionNo: 'ฎีกาเลขที่ 88/2568',
        amount: 960000,
        status: 'paid',
        checkNo: 'KTB-9912019',
        transferDate: '2025-02-07'
      }
    ],
    remunerations: [
      {
        id: 'rem-4',
        type: 'supervisor',
        title: 'ค่าตอบแทนผู้ควบคุมงานติดตั้งไฟฟ้าโซลาร์เซลล์',
        payeeName: 'นายพิทักษ์  โพธิ์ขาว',
        amount: 3000,
        withdrawDate: '2025-02-04',
        petitionNo: 'ฎีกาเลขที่ 89/2568',
        status: 'paid'
      },
      {
        id: 'rem-5',
        type: 'inspection',
        title: 'ค่าตอบแทนคณะกรรมการตรวจรับงานจ้าง',
        payeeName: 'นายจิรพงษ์ พัฒนพันธ์ และคณะ',
        amount: 4500,
        withdrawDate: '2025-02-04',
        petitionNo: 'ฎีกาเลขที่ 90/2568',
        status: 'paid'
      }
    ],
    attachments: [
      {
        id: 'att-4',
        name: 'สัญญาจ้างเลขที่ 24-2568 โคมไฟโซลาร์เซลล์.pdf',
        size: 3410000,
        type: 'application/pdf',
        category: 'contract',
        uploadDate: '2024-11-20'
      },
      {
        id: 'att-5',
        name: 'รายงานผลการตรวจรับงานจ้าง_ฉบับสมบูรณ์.pdf',
        size: 1980000,
        type: 'application/pdf',
        category: 'inspection',
        uploadDate: '2025-01-23'
      }
    ],
    status: 'completed',
    progressPercent: 100,
    createdAt: '2024-10-01T09:00:00Z',
    updatedAt: '2025-02-08T11:00:00Z'
  },
  {
    id: 'prj-2570-002',
    projectCode: 'ช.70-002',
    fiscalYear: 2570,
    name: 'โครงการขุดลอกคลองส่งน้ำเพื่อการเกษตร ห้วยไร่ใต้ หมู่ที่ 6',
    budgetCategory: 'เงินอุดหนุนเฉพาะกิจ',
    approvalYear: 2567,
    approvedBudget: 1650000,
    description: 'ขุดลอกคลองกำจัดวัชพืช ดินเลนตกตะกอน ก้นคลองกว้าง 4.00 เมตร ลึกเฉลี่ย 2.50 เมตร ความยาว 2,400 เมตร พร้อมปรับแต่งคันคลองทั้งสองฝั่ง',
    location: 'ห้วยไร่ใต้ หมู่ที่ 6 ต.ไร่ใต้ อ.พิบูลมังสาหาร',
    responsiblePerson: 'นายศรายุทธ  สงวนรัษฐ์',
    ackStatus: 'รอรับทราบ',
    ackTime: '-',
    notes: 'โครงการแก้ปัญหาภัยแล้งและน้ำท่วมขังในฤดูฝน (เลยกำหนดส่งมอบตามสัญญา)',

    torOrderNo: '172/2567',
    torOrderDate: '2024-10-25',
    torAuthor: 'นายศรายุทธ  สงวนรัษฐ์',
    torDate: '2024-11-05',
    refPriceDate: '2024-11-10',
    refPrice: 1640000,
    torCommittees: [
      { id: 'cm-106', name: 'นายศรายุทธ  สงวนรัษฐ์', position: 'นายช่างโยธาชำนาญงาน', role: 'ประธานกรรมการ' },
      { id: 'cm-107', name: 'นายยิ่งอนันต์  สัทธรรม', position: 'ผู้ช่วยนายช่างประปา', role: 'กรรมการ' }
    ],

    inspectOrderNo: '205/2567',
    inspectOrderDate: '2024-11-28',
    supervisorName: 'นายยิ่งอนันต์  สัทธรรม',
    inspectCommittees: [
      { id: 'cm-207', name: 'นายจิรพงษ์ พัฒนพันธ์', position: 'ผู้อำนวยการกองช่าง', role: 'ประธานกรรมการ' },
      { id: 'cm-208', name: 'นายพิทักษ์  โพธิ์ขาว', position: 'นายช่างไฟฟ้าชำนาญงาน', role: 'กรรมการ' },
      { id: 'cm-209', name: 'นายทองดี บุญมาก', position: 'ตัวแทนกลุ่มผู้ใช้น้ำ หมู่ที่ 6', role: 'กรรมการ' }
    ],

    contractNo: '29/2568',
    contractDate: '2024-12-05',
    contractAmount: 1590000,
    startDate: '2024-12-10',
    endDate: '2025-01-25', // Overdue date to test alert!
    contractorName: 'ห้างหุ้นส่วนจำกัด วารีเจริญการเกษตรและโยธา',
    contractorTaxId: '0103541098231',
    contractorContact: '44 หมู่ 5 ต.ไร่ใต้ อ.พิบูลมังสาหาร โทร. 081-987-6543',

    workNotices: [
      {
        id: 'wn-3',
        bookNo: 'วร.04/2567',
        bookDate: '2024-12-08',
        actualWorkDate: '2024-12-10',
        notes: 'นำรถแบ็คโฮ 2 คันเข้าพื้นที่ขุดลอก'
      }
    ],
    deliveries: [],
    inspections: [],
    disbursements: [],
    remunerations: [],
    attachments: [
      {
        id: 'att-6',
        name: 'สัญญาจ้างเลขที่ 29-2568 งานขุดลอกคลอง.pdf',
        size: 4120000,
        type: 'application/pdf',
        category: 'contract',
        uploadDate: '2024-12-05'
      }
    ],
    status: 'overdue',
    progressPercent: 80,
    createdAt: '2024-10-25T10:00:00Z',
    updatedAt: '2025-01-26T09:30:00Z'
  },
  {
    id: 'prj-2571-001',
    projectCode: 'ช.71-001',
    fiscalYear: 2571,
    name: 'โครงการปรับปรุงซ่อมแซมระบบประปาหมู่บ้านและศูนย์พัฒนาเด็กเล็กตำบลไร่ใต้',
    budgetCategory: 'เงินสะสม',
    meetingSession: 'สมัยวิสามัญ ครั้งที่ 1/2567',
    approvalYear: 2567,
    approvedBudget: 620000,
    description: 'เปลี่ยนถังกรองสนิมเหล็ก เปลี่ยนท่อเมนจ่ายน้ำ และทาสีปรับปรุงอาคารศูนย์พัฒนาเด็กเล็ก',
    location: 'ศูนย์พัฒนาเด็กเล็กบ้านไร่ใต้ หมู่ที่ 2 ต.ไร่ใต้',
    responsiblePerson: 'นายยิ่งอนันต์  สัทธรรม',
    ackStatus: 'รับทราบแล้ว',
    ackTime: '15 ธ.ค. 67 10:30 น.',
    notes: 'เตรียมความพร้อมก่อนเปิดภาคเรียนและแก้ปัญหาน้ำประปาขุ่นแดง',

    torOrderNo: '189/2567',
    torOrderDate: '2024-11-15',
    torAuthor: 'นายยิ่งอนันต์  สัทธรรม',
    torDate: '2024-11-22',
    refPriceDate: '2024-11-25',
    refPrice: 618000,
    torCommittees: [
      { id: 'cm-108', name: 'นายยิ่งอนันต์  สัทธรรม', position: 'ผู้ช่วยนายช่างประปา', role: 'ประธานกรรมการ' },
      { id: 'cm-109', name: 'นายศรายุทธ  สงวนรัษฐ์', position: 'นายช่างโยธาชำนาญงาน', role: 'กรรมการ' }
    ],

    inspectOrderNo: '218/2567',
    inspectOrderDate: '2024-12-15',
    supervisorName: 'นายพิทักษ์  โพธิ์ขาว',
    inspectCommittees: [
      { id: 'cm-210', name: 'นายจิรพงษ์ พัฒนพันธ์', position: 'ผู้อำนวยการกองช่าง', role: 'ประธานกรรมการ' },
      { id: 'cm-211', name: 'นางสาวรัชนี ดวงดี', position: 'หัวหน้าศูนย์พัฒนาเด็กเล็ก', role: 'กรรมการ' },
      { id: 'cm-212', name: 'นายยิ่งอนันต์  สัทธรรม', position: 'ผู้ช่วยนายช่างประปา', role: 'กรรมการ' }
    ],

    contractNo: '35/2568',
    contractDate: '2024-12-22',
    contractAmount: 595000,
    startDate: '2024-12-28',
    endDate: '2025-02-26',
    contractorName: 'ห้างหุ้นส่วนจำกัด อุบลวารีการช่าง',
    contractorTaxId: '0733558004112',
    contractorContact: '19/1 ถ.สถิตย์นิมานการ ต.พิบูล อ.พิบูลมังสาหาร โทร. 086-455-1290',

    workNotices: [
      {
        id: 'wn-4',
        bookNo: 'อม.02/2567',
        bookDate: '2024-12-26',
        actualWorkDate: '2024-12-28',
        notes: 'เริ่มรื้อถอนถังกรองเดิมและระบบท่อชำรุด'
      }
    ],
    deliveries: [
      {
        id: 'del-3',
        installment: 1,
        bookNo: 'อม.08/2568',
        bookDate: '2025-02-15',
        actualDeliveryDate: '2025-02-15',
        details: 'ส่งมอบงานทั้งหมดตามสัญญาจ้าง'
      }
    ],
    inspections: [
      {
        id: 'insp-3',
        installment: 1,
        inspectionDate: '2025-02-18',
        result: 'pass',
        details: 'ตรวจรับงานเรียบร้อยถูกต้องตามแบบแปลนและรายการก่อสร้าง'
      }
    ],
    disbursements: [
      {
        id: 'disb-3',
        installment: 1,
        disbursementDate: '2025-02-25',
        petitionNo: 'ฎีกาเลขที่ 112/2568',
        amount: 595000,
        status: 'pending' // อยู่ระหว่างจัดทำฎีกาเบิกจ่าย
      }
    ],
    remunerations: [
      {
        id: 'rem-6',
        type: 'inspection',
        title: 'ค่าตอบแทนคณะกรรมการตรวจรับงานจ้างซ่อมแซมระบบประปา',
        payeeName: 'นายจิรพงษ์ พัฒนพันธ์ และคณะ',
        amount: 4500,
        withdrawDate: '2025-02-25',
        petitionNo: 'ฎีกาเลขที่ 113/2568',
        status: 'pending'
      }
    ],
    attachments: [
      {
        id: 'att-7',
        name: 'สัญญาจ้างเลขที่ 35-2568 ปรับปรุงระบบประปาและศพด.pdf',
        size: 2750000,
        type: 'application/pdf',
        category: 'contract',
        uploadDate: '2024-12-22'
      }
    ],
    status: 'inspected',
    progressPercent: 100,
    createdAt: '2024-11-15T09:15:00Z',
    updatedAt: '2025-02-25T16:00:00Z'
  },
  {
    id: 'prj-2571-002',
    projectCode: 'ช.71-002',
    fiscalYear: 2571,
    name: 'โครงการก่อสร้างระบบระบายน้ำคอนกรีตเสริมเหล็กรูปตัวยู (U-Ditch) พร้อมฝาปิด หมู่ที่ 3',
    budgetCategory: 'งบประมาณรายจ่าย',
    approvalYear: 2567,
    approvedBudget: 1200000,
    description: 'ก่อสร้างรางระบายน้ำ คสล. ขนาดกว้าง 0.60 เมตร ลึกเฉลี่ย 0.80 เมตร ยาว 420 เมตร พร้อมฝาตะแกรงเหล็กและฝา คสล. พาดผ่านจุดเชื่อมต่อทางแยก',
    location: 'ซอยร่วมใจพัฒนา หมู่ที่ 3 ต.ไร่ใต้ อ.พิบูลมังสาหาร',
    responsiblePerson: 'นายศรายุทธ  สงวนรัษฐ์',
    ackStatus: 'รับทราบแล้ว',
    ackTime: '05 ม.ค. 68 11:00 น.',
    notes: 'แก้ไขปัญหาน้ำท่วมขังหน้าโรงเรียนบ้านไร่ใต้และชุมชน',

    torOrderNo: '201/2567',
    torOrderDate: '2024-12-02',
    torAuthor: 'นายศรายุทธ  สงวนรัษฐ์',
    torDate: '2024-12-12',
    refPriceDate: '2024-12-18',
    refPrice: 1190000,
    torCommittees: [
      { id: 'cm-110', name: 'นายศรายุทธ  สงวนรัษฐ์', position: 'นายช่างโยธาชำนาญงาน', role: 'ประธานกรรมการ' },
      { id: 'cm-111', name: 'นายยิ่งอนันต์  สัทธรรม', position: 'ผู้ช่วยนายช่างประปา', role: 'กรรมการ' }
    ],

    inspectOrderNo: '230/2567',
    inspectOrderDate: '2025-01-08',
    supervisorName: 'นายศรายุทธ  สงวนรัษฐ์',
    inspectCommittees: [
      { id: 'cm-213', name: 'นายจิรพงษ์ พัฒนพันธ์', position: 'ผู้อำนวยการกองช่าง', role: 'ประธานกรรมการ' },
      { id: 'cm-214', name: 'นายพิทักษ์  โพธิ์ขาว', position: 'นายช่างไฟฟ้าชำนาญงาน', role: 'กรรมการ' },
      { id: 'cm-215', name: 'นายสนอง จิตแจ่มใส', position: 'สมาชิกสภาฯ หมู่ที่ 3', role: 'กรรมการ' }
    ],

    contractNo: '42/2568',
    contractDate: '2025-01-15',
    contractAmount: 1150000,
    startDate: '2025-01-20',
    endDate: '2025-04-19',
    contractorName: 'บริษัท สหกิจวิศวกรรมโยธา จำกัด',
    contractorTaxId: '0105553012984',
    contractorContact: '112/5 ถ.สถิตย์นิมานการ ต.วารินชำราบ จ.อุบลราชธานี โทร. 045-311890',

    workNotices: [
      {
        id: 'wn-5',
        bookNo: 'สก.01/2568',
        bookDate: '2025-01-18',
        actualWorkDate: '2025-01-20',
        notes: 'เริ่มวางแนวยกระดับและขุดร่องดิน'
      }
    ],
    deliveries: [],
    inspections: [],
    disbursements: [],
    remunerations: [],
    attachments: [
      {
        id: 'att-8',
        name: 'คำสั่งแต่งตั้งผู้ควบคุมงานและกรรมการตรวจรับ_230-2567.pdf',
        size: 1820000,
        type: 'application/pdf',
        category: 'order',
        uploadDate: '2025-01-08'
      }
    ],
    status: 'in_progress',
    progressPercent: 35,
    createdAt: '2024-12-02T10:00:00Z',
    updatedAt: '2025-01-25T15:30:00Z'
  },
  {
    id: 'prj-2572-001',
    projectCode: 'ช.72-001',
    fiscalYear: 2572,
    name: 'โครงการก่อสร้างซุ้มประตูเฉลิมพระเกียรติและป้ายบอกเขตตำบลไร่ใต้',
    budgetCategory: 'งบประมาณรายจ่าย',
    approvalYear: 2567,
    approvedBudget: 750000,
    description: 'ก่อสร้างซุ้มประตูคอนกรีตลวดลายประยุกต์พร้อมตราสัญลักษณ์และป้ายอิเล็กทรอนิกส์ LED ยินดีต้อนรับสู่ อบต.ไร่ใต้',
    location: 'ทางหลวงชนบท อบ.4012 ทางเข้าตำบลไร่ใต้',
    responsiblePerson: 'นายจิรพงษ์ พัฒนพันธ์',
    ackStatus: 'รับทราบแล้ว',
    ackTime: '02 ม.ค. 68 09:00 น.',
    notes: 'อยู่ระหว่างรอประกาศผล e-bidding',

    torOrderNo: '215/2567',
    torOrderDate: '2024-12-20',
    torAuthor: 'นายจิรพงษ์ พัฒนพันธ์',
    torDate: '2025-01-10',
    refPriceDate: '2025-01-15',
    refPrice: 745000,
    torCommittees: [
      { id: 'cm-112', name: 'นายจิรพงษ์ พัฒนพันธ์', position: 'ผู้อำนวยการกองช่าง', role: 'ประธานกรรมการ' },
      { id: 'cm-113', name: 'นิศาชล คงดี', position: 'ผู้ช่วยเจ้าพนักงานธุรการ', role: 'กรรมการและเลขานุการ' }
    ],

    inspectCommittees: [],
    workNotices: [],
    deliveries: [],
    inspections: [],
    disbursements: [],
    remunerations: [],
    attachments: [
      {
        id: 'att-9',
        name: 'แบบแปลนสถาปัตยกรรมซุ้มประตูตำบล.pdf',
        size: 7890000,
        type: 'application/pdf',
        category: 'tor',
        uploadDate: '2025-01-12'
      }
    ],
    status: 'procurement_tor',
    progressPercent: 10,
    createdAt: '2024-12-20T11:00:00Z',
    updatedAt: '2025-01-16T10:00:00Z'
  },
  {
    id: 'prj-2573-001',
    projectCode: 'ช.73-001',
    fiscalYear: 2573,
    name: 'โครงการก่อสร้างอาคารเอนกประสงค์และศูนย์กีฬาในร่มประจำตำบลไร่ใต้',
    budgetCategory: 'เงินอุดหนุนเฉพาะกิจ',
    approvalYear: 2566,
    approvedBudget: 4800000,
    description: 'ก่อสร้างอาคาร คสล. ชั้นเดียว โครงสร้างเหล็กไร้เสากลาง ขนาด 25 x 40 เมตร ปูพื้นสนามด้วยยางสังเคราะห์ PU พร้อมระบบไฟฟ้า แสงสว่าง และห้องน้ำมาตรฐาน',
    location: 'ที่ดินสาธารณประโยชน์ หมู่ที่ 2 ต.ไร่ใต้ อ.พิบูลมังสาหาร',
    responsiblePerson: 'นายจิรพงษ์ พัฒนพันธ์',
    ackStatus: 'รับทราบแล้ว',
    ackTime: '15 ม.ค. 67 08:30 น.',
    notes: 'เบิกจ่ายงบประมาณและส่งมอบงานงวดสุดท้ายเรียบร้อยแล้ว',

    torOrderNo: '105/2566',
    torOrderDate: '2023-11-10',
    torAuthor: 'นายศรายุทธ  สงวนรัษฐ์',
    torDate: '2023-11-25',
    refPriceDate: '2023-12-01',
    refPrice: 4790000,
    torCommittees: [
      { id: 'cm-114', name: 'นายศรายุทธ  สงวนรัษฐ์', position: 'นายช่างโยธาชำนาญงาน', role: 'ประธานกรรมการ' }
    ],

    inspectOrderNo: '135/2566',
    inspectOrderDate: '2023-12-28',
    supervisorName: 'นายยิ่งอนันต์  สัทธรรม',
    inspectCommittees: [
      { id: 'cm-216', name: 'นายจิรพงษ์ พัฒนพันธ์', position: 'ผู้อำนวยการกองช่าง', role: 'ประธานกรรมการ' },
      { id: 'cm-217', name: 'นายพิทักษ์  โพธิ์ขาว', position: 'นายช่างไฟฟ้าชำนาญงาน', role: 'กรรมการ' }
    ],

    contractNo: '12/2567',
    contractDate: '2024-01-15',
    contractAmount: 4720000,
    startDate: '2024-01-20',
    endDate: '2024-07-18',
    contractorName: 'บริษัท พรสวัสดิ์การก่อสร้างและวิศวกรรม จำกัด',
    contractorTaxId: '0105549021345',
    contractorContact: '55/9 ถ.ชยางกูร ต.ในเมือง อ.เมือง จ.อุบลราชธานี โทร. 045-441-900',

    workNotices: [
      {
        id: 'wn-6',
        bookNo: 'พส.01/2567',
        bookDate: '2024-01-18',
        actualWorkDate: '2024-01-20',
        notes: 'ลงเสาเข็มและวางผังอาคาร'
      }
    ],
    deliveries: [
      {
        id: 'del-4',
        installment: 1,
        bookNo: 'พส.05/2567',
        bookDate: '2024-03-20',
        actualDeliveryDate: '2024-03-20',
        details: 'ส่งมอบงานฐานราก เสา คาน และโครงสร้างหลังคาเหล็ก'
      },
      {
        id: 'del-5',
        installment: 2,
        bookNo: 'พส.11/2567',
        bookDate: '2024-07-10',
        actualDeliveryDate: '2024-07-10',
        details: 'ส่งมอบงานงวดสุดท้าย ผิวสนาม ประตู หน้าต่าง ทาสี สุขาภิบาล และไฟฟ้า'
      }
    ],
    inspections: [
      {
        id: 'insp-4',
        installment: 1,
        inspectionDate: '2024-03-25',
        result: 'pass',
        details: 'ตรวจรับงานงวดที่ 1 ถูกต้องเรียบร้อย'
      },
      {
        id: 'insp-5',
        installment: 2,
        inspectionDate: '2024-07-15',
        result: 'pass',
        details: 'ตรวจรับงานงวดสุดท้าย ครบถ้วนตามแบบแปลน'
      }
    ],
    disbursements: [
      {
        id: 'disb-4',
        installment: 1,
        disbursementDate: '2024-04-05',
        petitionNo: 'ฎีกาเลขที่ 215/2567',
        amount: 1888000,
        status: 'paid',
        checkNo: 'KTB-440192',
        transferDate: '2024-04-09'
      },
      {
        id: 'disb-5',
        installment: 2,
        disbursementDate: '2024-07-28',
        petitionNo: 'ฎีกาเลขที่ 389/2567',
        amount: 2832000,
        status: 'paid',
        checkNo: 'KTB-449811',
        transferDate: '2024-08-01'
      }
    ],
    remunerations: [
      {
        id: 'rem-7',
        type: 'supervisor',
        title: 'ค่าตอบแทนผู้ควบคุมงาน งวดที่ 1-2',
        payeeName: 'นายยิ่งอนันต์  สัทธรรม',
        amount: 8000,
        withdrawDate: '2024-07-28',
        petitionNo: 'ฎีกาเลขที่ 390/2567',
        status: 'paid'
      },
      {
        id: 'rem-8',
        type: 'inspection',
        title: 'ค่าตอบแทนกรรมการตรวจรับงานจ้าง',
        payeeName: 'นายจิรพงษ์ พัฒนพันธ์ และคณะ',
        amount: 9000,
        withdrawDate: '2024-07-28',
        petitionNo: 'ฎีกาเลขที่ 391/2567',
        status: 'paid'
      }
    ],
    attachments: [
      {
        id: 'att-10',
        name: 'สัญญาจ้าง 12-2567 อาคารเอนกประสงค์.pdf',
        size: 8900000,
        type: 'application/pdf',
        category: 'contract',
        uploadDate: '2024-01-15'
      },
      {
        id: 'att-11',
        name: 'ใบตรวจรับงานงวดสุดท้ายและหนังสือส่งมอบ.pdf',
        size: 3250000,
        type: 'application/pdf',
        category: 'inspection',
        uploadDate: '2024-07-15'
      }
    ],
    status: 'completed',
    progressPercent: 100,
    createdAt: '2023-11-10T09:00:00Z',
    updatedAt: '2024-08-05T14:00:00Z'
  },
  {
    id: 'prj-2575-001',
    projectCode: 'ช.75-001',
    fiscalYear: 2575,
    name: 'โครงการก่อสร้างสะพานคอนกรีตเสริมเหล็กข้ามลำห้วยไร่ใต้ (โครงการเสนอขอตั้งงบประมาณล่วงหน้า)',
    budgetCategory: 'เงินอุดหนุนเฉพาะกิจ',
    approvalYear: 2568,
    approvedBudget: 5500000,
    description: 'ก่อสร้างสะพาน คสล. กว้าง 8.00 เมตร ความยาว 30 เมตร พร้อมเชิงลาดคอสะพานและราวสะพานมาตรฐานกรมทางหลวงชนบท',
    location: 'จุดเชื่อมต่อ หมู่ที่ 5 ต.ไร่ใต้ และ ต.ดอนจิก อ.พิบูลมังสาหาร',
    responsiblePerson: 'นายจิรพงษ์ พัฒนพันธ์',
    ackStatus: 'รอรับทราบ',
    ackTime: '-',
    notes: 'บรรจุในแผนพัฒนาท้องถิ่นเพื่อขอรับงบเงินอุดหนุนจากกรมส่งเสริมการปกครองท้องถิ่น',
    torCommittees: [],
    inspectCommittees: [],
    workNotices: [],
    deliveries: [],
    inspections: [],
    disbursements: [],
    remunerations: [],
    attachments: [],
    status: 'not_started',
    progressPercent: 0,
    createdAt: '2025-01-15T08:00:00Z',
    updatedAt: '2025-01-15T08:00:00Z'
  }
];
