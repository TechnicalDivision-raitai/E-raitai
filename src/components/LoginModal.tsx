import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Lock,
  KeyRound,
  LogIn,
  HardHat,
  X
} from 'lucide-react';
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
  const [isAdminExpanded, setIsAdminExpanded] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setIsAdminExpanded(false);
      setPassword('');
      setShowPassword(false);
      setErrorMsg('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isAdminExpanded) {
      setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 50);
    }
  }, [isAdminExpanded]);

  if (!isOpen) return null;

  const handleLoginStaff = () => {
    setErrorMsg('');
    onLoginSuccess(STAFF_USER);
    onClose();
  };

  const handleToggleAdmin = () => {
    setIsAdminExpanded(prev => !prev);
    setErrorMsg('');
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setErrorMsg('');
      setPassword('');
      onLoginSuccess(CURRENT_USER);
      onClose();
    } else {
      setErrorMsg('รหัสผ่านผู้ดูแลระบบไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
      passwordInputRef.current?.focus();
      passwordInputRef.current?.select();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[460px] overflow-hidden border border-gray-100">
        {/* Top Emerald Header Banner */}
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 px-6 py-5 text-white relative flex items-center gap-4">
          {canCancel && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 text-white/80 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition"
              title="ปิดหน้าต่าง"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 backdrop-blur-md">
            <HardHat className="w-6 h-6 text-emerald-200" />
          </div>

          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold font-heading tracking-tight text-white">
              ระบบโครงการกองช่าง
            </h1>
            <p className="text-emerald-100 text-xs mt-0.5">
              องค์การบริหารส่วนตำบลไร่ใต้
            </p>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            เลือกสถานะเพื่อเข้าสู่ระบบ
          </div>

          {/* 1. Staff Role Card */}
          <button
            type="button"
            onClick={handleLoginStaff}
            className="w-full flex items-center justify-between p-4 rounded-2xl border border-gray-200 hover:border-emerald-300 bg-white hover:bg-emerald-50/30 transition group text-left"
          >
            <div className="flex items-center gap-3.5 min-w-0 pr-2">
              <div className="w-11 h-11 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Eye className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-800 text-sm">
                    เจ้าหน้าที่/บุคลากรทั่วไป (Staff)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
                    เข้าสู่ระบบได้เลย
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  สิทธิ์ดูรายงาน ติดตามงาน และเปิดดูเอกสารโครงการ
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-emerald-700 group-hover:translate-x-0.5 transition shrink-0" />
          </button>

          {/* 2. Admin Role Accordion Card */}
          <div
            className={`rounded-2xl overflow-hidden transition-all ${
              isAdminExpanded
                ? 'border-2 border-emerald-600 bg-white shadow-xs'
                : 'border border-gray-200 bg-white hover:border-emerald-300'
            }`}
          >
            <button
              type="button"
              onClick={handleToggleAdmin}
              className={`w-full flex items-center justify-between p-4 text-left transition ${
                isAdminExpanded
                  ? 'bg-emerald-50/70 border-b border-emerald-100'
                  : 'bg-white hover:bg-gray-50/70'
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0 pr-2">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    isAdminExpanded
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-emerald-950 text-sm">
                      ผู้ดูแลระบบ (Admin)
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
                      <Lock className="w-3 h-3" />
                      <span>ใช้รหัสผ่าน</span>
                    </span>
                  </div>
                  <div className="text-xs text-emerald-700 mt-1">
                    นส. นิศาชล คงดี — เพิ่ม แก้ไข ลบโครงการ และรับทราบงาน
                  </div>
                </div>
              </div>

              {isAdminExpanded ? (
                <ChevronUp className="w-4 h-4 text-emerald-700 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
              )}
            </button>

            {isAdminExpanded && (
              <form onSubmit={handleAdminSubmit} className="p-4 bg-white space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    รหัสผ่านผู้ดูแลระบบ
                  </label>
                  <div className="relative flex items-center">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                    <input
                      ref={passwordInputRef}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => {
                        setPassword(e.target.value);
                        if (errorMsg) setErrorMsg('');
                      }}
                      placeholder="กรอกรหัสผ่านเพื่อเข้าสู่ระบบ"
                      autoComplete="current-password"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-emerald-200 focus:border-emerald-600 focus:bg-white rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(prev => !prev)}
                      className="absolute right-3 text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
                      tabIndex={-1}
                      title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {errorMsg && (
                    <p className="text-xs font-semibold text-rose-600 mt-2">
                      {errorMsg}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition"
                >
                  <LogIn className="w-4 h-4" />
                  <span>เข้าสู่ระบบผู้ดูแล</span>
                </button>
              </form>
            )}
          </div>

          <div className="pt-2 border-t border-gray-100 text-center">
            <p className="text-[11px] text-gray-400">
              กองช่าง องค์การบริหารส่วนตำบลไร่ใต้ อ.พิบูลมังสาหาร จ.อุบลราชธานี
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
