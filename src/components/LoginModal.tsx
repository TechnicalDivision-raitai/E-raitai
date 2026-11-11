import React from 'react';
import Swal from 'sweetalert2';
import { ShieldCheck, User, ChevronRight, HardHat, X } from 'lucide-react';
import { UserProfile } from '../types/project';
import { CURRENT_USER, STAFF_USER } from '../data/mockData';
import { ADMIN_PASSWORD } from '../services/storage';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserProfile) => void;
  canCancel?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  canCancel = true
}) => {
  if (!isOpen) return null;

  const handleLoginAdmin = async () => {
    const { value: password } = await Swal.fire({
      title: 'ยืนยันตัวตนผู้ดูแลระบบ',
      text: 'กรุณากรอกรหัสผ่านเพื่อเข้าสู่ระบบ Admin',
      input: 'password',
      inputPlaceholder: 'กรอกรหัสผ่านที่นี่...',
      inputAttributes: {
        autocapitalize: 'off',
        autocorrect: 'off'
      },
      showCancelButton: true,
      confirmButtonText: 'เข้าสู่ระบบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#059669', // Emerald/green government color
      cancelButtonColor: '#64748b'
    });

    if (password === ADMIN_PASSWORD) {
      Swal.fire({
        icon: 'success',
        title: 'ยินดีต้อนรับ นส. นิศาชล คงดี',
        text: 'กำลังเข้าสู่ระบบในฐานะผู้ดูแลระบบ (Admin)',
        timer: 1300,
        showConfirmButton: false
      });
      onLoginSuccess(CURRENT_USER);
      onClose();
    } else if (password !== undefined) {
      Swal.fire({
        icon: 'error',
        title: 'รหัสผ่านไม่ถูกต้อง',
        text: 'คุณไม่มีสิทธิ์เข้าใช้งานในฐานะผู้ดูแลระบบ',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#ef4444'
      });
    }
  };

  const handleLoginStaff = () => {
    Swal.fire({
      icon: 'success',
      title: 'เข้าสู่ระบบสำเร็จ',
      text: 'เข้าใช้งานในฐานะบุคลากร / เจ้าหน้าที่กองช่าง',
      timer: 1200,
      showConfirmButton: false
    });
    onLoginSuccess(STAFF_USER);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">
        {/* Banner */}
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 p-6 text-white text-center relative">
          {canCancel && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 mb-3 backdrop-blur-md">
            <HardHat className="w-8 h-8 text-emerald-200" />
          </div>
          <h1 className="text-2xl font-bold font-heading">ระบบโครงการกองช่าง</h1>
          <p className="text-emerald-100 text-sm mt-1">องค์การบริหารส่วนตำบลไร่ใต้</p>
        </div>

        {/* Roles Selection */}
        <div className="p-6 space-y-5">
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
              เลือกสถานะเพื่อเข้าสู่ระบบ
            </label>

            {/* Admin Option */}
            <button
              onClick={handleLoginAdmin}
              className="w-full flex items-center justify-between p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/70 transition group text-left shadow-2xs"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold shadow-xs">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-emerald-950 text-sm">ผู้ดูแลระบบ (Admin)</div>
                  <div className="text-xs text-emerald-700">นส. นิศาชล คงดี</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-emerald-500 group-hover:translate-x-1 transition" />
            </button>

            {/* Staff Option */}
            <button
              onClick={handleLoginStaff}
              className="w-full flex items-center justify-between p-3.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition group text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-slate-700 text-white flex items-center justify-center font-bold shadow-xs">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-gray-800 text-sm">เจ้าหน้าที่/บุคลากรทั่วไป</div>
                  <div className="text-xs text-gray-500">สถานะ: เจ้าหน้าที่ (Staff) — สิทธิ์ดูรายงาน ติดตามงาน และเปิดดูเอกสาร</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition" />
            </button>
          </div>

          <div className="pt-3 border-t border-gray-100 text-center">
            <p className="text-[11px] text-gray-400">
              กองช่าง องค์การบริหารส่วนตำบลไร่ใต้ อ.พิบูลมังสาหาร จ.อุบลราชธานี
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
