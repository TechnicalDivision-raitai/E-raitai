---
name: engineering-project-management-core
description: หลักการทำงาน สถาปัตยกรรม และกฎทางธุรกิจพื้นฐานของระบบบริหารจัดการงานโครงการกองช่าง (อบต.ไร่ใต้)
---

# Core System Skill: ระบบบริหารจัดการงานโครงการกองช่าง

## 1. ภาพรวมเทคโนโลยีและสถาปัตยกรรม (Tech Stack & Architecture)
- **Frontend:** React 19 + TypeScript + Vite (Dev Port 3000) + Tailwind CSS (`@tailwindcss/vite`)
- **UI & Alerts:** `lucide-react` สำหรับไอคอน, `sweetalert2` สำหรับแจ้งเตือน/ยืนยัน (ห้ามใช้ `window.alert` หรือ `window.open`), Font หลัก `Kanit`
- **Excel/Export:** `xlsx` สำหรับนำเข้า (Upsert) และส่งออกทะเบียนโครงการ
- **Persistence & Cloud Sync:**
  - **Local Cache:** `localStorage` (`raitai_engineering_projects_v5`) + `sessionStorage` สำหรับสถานะการเข้าสู่ระบบ (`raitai_engineering_session_user`)
  - **Primary Cloud Backend:** Google Apps Script Web App (`DEFAULT_GOOGLE_SCRIPT_URL` ใน `src/services/googleSync.ts`) เชื่อมต่อ Google Sheet (`sheetName: 'ทะเบียนโครงการ'`) และคลังไฟล์ Google Drive (`DEFAULT_DRIVE_FOLDER_ID`)
  - **การทำงานแบบอัตโนมัติ (Zero-Config Background Sync):** เปิดแอป → ดึงข้อมูลจาก Google Sheet อัตโนมัติ (`fetchProjectsFromGoogleSheet`) / บันทึก-แก้ไข-ลบ → บันทึก Local และซิงค์ขึ้น Sheet อัตโนมัติ (`syncProjectsToGoogleSheet`) / แนบไฟล์ → อัปโหลดขึ้นโฟลเดอร์ Google Drive อัตโนมัติ (`uploadFileToGoogleDrive`)

---

## 2. โครงสร้างข้อมูลหลัก (`src/types/project.ts`)
ข้อมูล 1 โครงการ (`Project`) แบ่งออกเป็น **6 หมวดข้อมูล** และรองรับการติดตามงาน **12 ขั้นตอน**:
1. **หมวดที่ 1 ข้อมูลทั่วไป:** `projectCode`, `fiscalYear` (พ.ศ.), `name`, `budgetCategory` (รองรับพิมพ์เพิ่มหมวดใหม่ได้อิสระ), `meetingSession`, `approvalYear`, `approvedBudget`, `location`, `responsiblePerson` (ค่าเริ่มต้นว่าง ให้กรอกเอง), `description`, `notes`
2. **หมวดที่ 2 TOR และราคากลาง:** `torOrderNo`, `torOrderDate`, `torAuthor`, `torDate`, `refPriceDate`, `refPrice`, `torCommittees[]` (`name`, `position`, `role`)
3. **หมวดที่ 3 ควบคุมงานและตรวจรับ:** `inspectOrderNo`, `inspectOrderDate`, `supervisorName`, `inspectCommittees[]` (`name`, `position`, `role`)
4. **หมวดที่ 4 ข้อมูลสัญญาจ้าง:** `contractNo`, `contractDate`, `contractAmount`, `startDate`, `endDate`, `contractorName`, `contractorTaxId`, `contractorContact`
5. **หมวดที่ 5 การดำเนินงาน & ฎีกา:** `workNotices[]`, `deliveries[]`, `inspections[]`, `disbursements[]` (`petitionNo`, `disbursementDate`, `amount`, `status: 'pending' | 'paid'`)
6. **หมวดที่ 6 ค่าตอบแทนกรรมการ:** `remunerations[]` (`type: 'tor_author' | 'tor' | 'supervisor' | 'inspection'`, `title`, `payeeName`, `amount`, `withdrawDate`, `petitionNo`, `status`)
- **เอกสารแนบ:** `attachments[]` แยก `category` (`tor`, `order`, `contract`, `notice`, `delivery`, `inspection`, `disbursement`, `remuneration`, `other`) พร้อมลิงก์ Google Drive (`url`)

---

## 3. สิทธิ์ผู้ใช้งาน (Role-Based Access Control)
- บังคับเข้าสู่ระบบผ่าน `LoginModal` ก่อนเข้าใช้งาน
- **`admin` (ผู้ดูแลระบบ):** เพิ่ม แก้ไข ลบโครงการ, อัปเดตสถานะรับทราบใน My Inbox, นำเข้า Excel, ล้าง/คืนค่าข้อมูลได้ทั้งหมด
- **`staff` (เจ้าหน้าที่):** สิทธิ์ดูข้อมูลและพิมพ์เอกสารอย่างเดียว (Read-Only) ซ่อนปุ่มเพิ่ม/แก้ไข/ลบ/นำเข้าข้อมูล และซ่อนปุ่มสลับสิทธิ์

---

## 4. กฎทางธุรกิจหลัก (Core Business Logic)

### 4.1 ปีงบประมาณและวันที่ไทย (`src/utils/thaiDate.ts`)
- ปีงบประมาณไทยเริ่ม **1 ตุลาคม** (`month >= 10` → ปี ค.ศ. + 1 + 543)
- ตัวกรองปีงบประมาณแสดงปีที่มีข้อมูลจริง + ปีงบประมาณปัจจุบัน โดยเรียงปีปัจจุบันขึ้นก่อน (`availableYears` ใน `App.tsx`)
- หน้า **สรุปงานฎีกาและเบิกจ่าย (`VouchersSummaryView`)** ใช้ตัวกรองปีงบประมาณด้านบน (`Header`) เพียงชุดเดียว

### 4.2 การคำนวณความคืบหน้า 12 ขั้นตอน (`countCompletedSteps` / `calculateProjectProgress`)
- คิดจาก 12 ขั้นตอนมาตรฐาน (ขั้นละ ~8.33%) หรือ `100%` ทันทีเมื่อ `status === 'completed'`:
  1. บันทึกชื่อโครงการ → 2. คำสั่ง TOR/ราคากลาง → 3. จัดทำ TOR → 4. ราคากลาง → 5. คำสั่งควบคุม/ตรวจรับ → 6. สัญญาจ้าง → 7. แจ้งเข้าทำงาน → 8. ส่งมอบงาน → 9. ตรวจรับผ่าน (`pass`) → 10. จัดทำฎีกา → 11. ค่าตอบแทน → 12. แล้วเสร็จ

### 4.3 การแจ้งเตือนเกินกำหนดสัญญา (`isProjectCompletedOrDisbursed`)
- หยุดการแจ้งเตือนบน Header (`Bell`), Sidebar (`overdueCount`) และหน้า `overdue` ทันทีเมื่อ:
  - `project.status === 'completed'` **หรือ**
  - มีรายการฎีกาใน `disbursements` อย่างน้อย 1 รายการ และทุกรายการมี `status === 'paid'`

### 4.4 หมวดงบประมาณแบบไดนามิก (Dynamic Budget Categories)
- ช่อง `หมวดงบประมาณ` ใน `ProjectModal` พิมพ์ชื่อหมวดใหม่ได้อิสระ
- เมื่อบันทึกสำเร็จ หมวดใหม่จะไปปรากฏอัตโนมัติใน:
  - เมนูย่อย **ทะเบียนแยกตามหมวดงบ** ใน `Sidebar` (แสดงเฉพาะหมวดที่มีโครงการบันทึกอยู่จริง และหายไปอัตโนมัติหากลบโครงการในหมวดนั้นออกหมด)
  - ตัวกรองใน `Dashboard` / `ProjectTable` และรายการตัวเลือกในการเพิ่มโครงการครั้งถัดไป

---

## 5. ระบบช่วยกรอกข้อมูลและเชื่อมโยงอัตโนมัติ (`ProjectModal.tsx` & `AutoSuggestInput.tsx`)

### 5.1 ระบบเสนอชื่อแบบบรรทัดเดียว (`AutoSuggestInput`)
- ใช้กับช่อง: **ผู้รับผิดชอบโครงการ**, **ผู้จัดทำ TOR**, **ผู้ควบคุมงาน**, **ชื่อ-นามสกุลกรรมการ (TOR & ตรวจรับ)**, **ตำแหน่งกรรมการ (TOR & ตรวจรับ)**, **ผู้รับจ้าง**, และ **ผู้รับเงินค่าตอบแทน**
- **กฎการทำงาน:**
  1. **ไม่แสดงรายการก่อนพิมพ์** (`minCharsToSuggest = 1`) ต้องพิมพ์ข้อความก่อนจึงจะแสดงรายการที่ตรงกัน
  2. **ตัดช่องว่างซ้ำและจัดรูปแบบ** (`replace(/\s+/g, ' ').trim()`) ก่อนรวบรวมจาก `RAI_TAI_PERSONNEL` และทุกโครงการที่เคยบันทึก เพื่อไม่ให้แสดงชื่อซ้ำ 2 บรรทัด
  3. **แสดงผลบรรทัดเดียวสะอาดตา** (`whitespace-nowrap truncate`) สูงสุด 8 รายการ

### 5.2 การเชื่อมโยงชื่อผู้รับเงินค่าตอบแทนอัตโนมัติ (Tab 6)
- มาตรฐานชื่อรายการค่าตอบแทน (`REMUNERATION_TITLES`):
  - `tor_author`: `ค่าตอบแทนผู้จัดทำ TOR / กำหนดแบบรูปรายการ` → ดึงชื่อจาก `torAuthor` (แท็บ 2)
  - `tor`: `ค่าตอบแทนคณะกรรมการกำหนดราคากลาง` → ดึงจาก `torCommittees` (แท็บ 2)
  - `supervisor`: `ค่าตอบแทนผู้ควบคุมงาน` → ดึงจาก `supervisorName` (แท็บ 3, ตัดวงเล็บตำแหน่งออก)
  - `inspection`: `ค่าตอบแทนคณะกรรมการตรวจรับงานจ้าง` → ดึงจาก `inspectCommittees` (แท็บ 3)
- กรณีคณะกรรมการมี 1 คน ใช้ชื่อเต็มคนนั้น; หากมีมากกว่า 1 คน ใช้รูปแบบ **`ชื่อประธานกรรมการ (หรือคนแรก) และคณะ`**
- ทำงานอัตโนมัติทั้งตอนกดปุ่ม `+ เพิ่มรายการเบิก`, ตอนสลับมาที่แท็บ 6 และตอนแก้ไขข้อความในช่อง `ประเภท/รายการ` (โดยไม่เขียนทับชื่อที่ผู้ใช้แก้ไขเองแล้ว)

---

## 6. แผนผังโมดูลสำหรับพัฒนาต่อ (`src/`)
- `src/App.tsx`: ศูนย์รวม State, Auto-Pull / Auto-Push, การกรองปีงบประมาณและหมวดหมู่, Routing ระหว่างแท็บ
- `src/services/googleSync.ts` & `src/services/storage.ts`: เชื่อมต่อ Google Sheet / Google Drive และ LocalStorage
- `src/components/ProjectModal.tsx`: ฟอร์มเพิ่ม/แก้ไขโครงการ 6 แท็บ + `AutoSuggestInput.tsx`
- `src/components/ProjectDetailModal.tsx`: หน้าต่างรายละเอียดโครงการ 8 แท็บ + ระบบพิมพ์เอกสารราชการ
- `src/components/Dashboard.tsx`, `VouchersSummaryView.tsx`, `MyInboxView.tsx`, `ProjectTable.tsx`, `ProjectTimelineView.tsx`, `ReportsView.tsx`: มุมมองรายงานและติดตามผลทั้งหมด
- `src/components/ExcelImportModal.tsx` & `UserManualModal.tsx`: นำเข้า Excel แบบ Upsert และคู่มือ/ล้างข้อมูลระบบ

---

## 7. ข้อกำหนดในการพัฒนาและตรวจสอบคุณภาพ (Development Rules)
1. **ห้ามนำหน้าต่างตั้งค่าซับซ้อนที่ไม่จำเป็นกลับมา** ให้ระบบเชื่อมต่อ Google Sheet & Drive อัตโนมัติผ่านค่าที่กำหนดใน `googleSync.ts` เพื่อลดภาระการประมวลผล
2. **รักษาความเบาของระบบ** (ไม่สร้างฟังก์ชันส่งออกเป็น Single-file `.html`)
3. ทุกครั้งที่แก้ไขโค้ด ต้องรันตรวจสอบทั้ง `vite build` และ `tsc --noEmit` ให้ผ่านโดยไม่มีข้อผิดพลาด
