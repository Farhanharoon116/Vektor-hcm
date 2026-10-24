import React, { useState, useEffect, useRef } from 'react';
import { User, Phone, MapPin, Building, Award, Check, Camera, Upload, ShieldCheck, AlertCircle, RefreshCw, Mail, CheckCircle2, Sparkles, ShieldAlert } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ProfileSkeleton } from '../../components/ui/Skeleton';
import { FaceEnrollmentModal } from '../../components/biometrics/FaceEnrollmentModal';

export const MyProfilePage: React.FC = () => {
  const { user, employee: storeEmployee, updateEmployee } = useAuthStore();
  const [profile, setProfile] = useState<any | null>(storeEmployee || null);
  const [phone, setPhone] = useState(storeEmployee?.phone || '');
  const [address, setAddress] = useState(storeEmployee?.address || '');
  const [isLoading, setIsLoading] = useState(!storeEmployee);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Biometric 5-frame live enrollment modal state
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);

  // Photo upload & capture state
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Email OTP verification state
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [devOtpPreview, setDevOtpPreview] = useState<string | null>(null);

  const empId = user?.employee_id || storeEmployee?.id;

  useEffect(() => {
    if (storeEmployee && !profile) {
      setProfile(storeEmployee);
      setPhone(storeEmployee.phone || '');
      setAddress(storeEmployee.address || '');
      setIsLoading(false);
    }
    loadProfile();
    return () => {
      stopCamera();
    };
  }, [empId]);

  // Cooldown timer for OTP resend
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const interval = setInterval(() => {
      setOtpCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [otpCooldown]);

  const handleSendEmailOtp = async () => {
    const targetEmail = profile?.email || user?.email;
    if (!targetEmail) return;
    setOtpError(null);
    setOtpLoading(true);

    try {
      const res = await api.post('/auth/otp/send', {
        email: targetEmail,
        purpose: 'email_verification',
      });
      if (res.testOtp) {
        setDevOtpPreview(res.testOtp);
      }
      setOtpCooldown(60);
      setIsOtpModalOpen(true);
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch verification OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = profile?.email || user?.email;
    if (!targetEmail || !otpCode || otpCode.trim().length !== 6) {
      setOtpError('Please enter the complete 6-digit code');
      return;
    }
    setOtpError(null);
    setOtpLoading(true);

    try {
      await api.post('/auth/otp/verify', {
        email: targetEmail,
        otp: otpCode.trim(),
        purpose: 'email_verification',
      });
      setIsEmailVerified(true);
      setIsOtpModalOpen(false);
      setOtpCode('');
      setSuccessMsg('Email verified successfully via Resend OTP!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setOtpError(err.message || 'Invalid or expired OTP code');
    } finally {
      setOtpLoading(false);
    }
  };

  const loadProfile = async () => {
    if (!empId) {
      setIsLoading(false);
      return;
    }
    try {
      if (!profile) setIsLoading(true);
      const res = await api.get(`/employees/${empId}`);
      if (res.employee) {
        setProfile(res.employee);
        setPhone(res.employee.phone || '');
        setAddress(res.employee.address || '');
        updateEmployee(res.employee);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.employee_id) return;
    setIsSaving(true);
    setSuccessMsg(null);
    try {
      await api.patch(`/employees/${user.employee_id}`, {
        phone,
        address,
      });
      setSuccessMsg('Contact information updated successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (JPG, PNG)');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      await saveFacePhoto(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const startCameraCapture = async () => {
    setIsCapturing(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 400, height: 400 },
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      alert('Camera access failed: ' + err.message);
      setIsCapturing(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCapturing(false);
  };

  const takeSnapshot = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, 400, 400);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    stopCamera();
    await saveFacePhoto(dataUrl);
  };

  const saveFacePhoto = async (dataUrl: string) => {
    if (!empId) return;
    setIsUploadingPhoto(true);
    try {
      const res = await api.post(`/employees/${empId}/face-photo`, {
        image_data: dataUrl,
      });

      setSuccessMsg('Biometric face photo uploaded to Supabase Storage & enrolled successfully!');
      if (res.employee) {
        setProfile(res.employee);
        updateEmployee(res.employee);
      }
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to save biometric photo');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  const enrolledPhoto = profile?.face_descriptor?.photo_url;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">My Profile</h1>
        <p className="text-xs text-gray-500">
          View your employment details, biometric face verification record, and maintain personal contact information
        </p>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 rounded-lg flex items-center gap-1.5">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" /> {successMsg}
        </div>
      )}

      {/* Profile Overview Card */}
      <Card className="p-6">
        <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
          {enrolledPhoto ? (
            <img
              src={enrolledPhoto}
              alt="Enrolled Face"
              className="w-16 h-16 rounded-2xl object-cover border-2 border-brand-500 shadow-sm"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-brand-600 text-white flex items-center justify-center font-extrabold text-2xl shadow-sm">
              {profile?.first_name?.[0]}
              {profile?.last_name?.[0]}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">
                {profile?.first_name} {profile?.last_name}
              </h2>
              {profile?.face_enrolled ? (
                <Badge variant="success" className="text-[10px]">
                  <ShieldCheck className="w-3 h-3 mr-1 inline" /> Face Enrolled
                </Badge>
              ) : (
                <Badge variant="warning" className="text-[10px]">
                  Face Not Enrolled
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs text-gray-500 font-mono">
                Employee Code: {profile?.employee_code} · {profile?.email}
              </span>
              {isEmailVerified ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" /> Email Verified
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendEmailOtp}
                  disabled={otpLoading}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 px-2 py-0.5 rounded-full border border-brand-200 cursor-pointer transition-colors"
                >
                  <Mail className="w-3 h-3" /> {otpLoading ? 'Sending OTP...' : 'Verify Email (Send OTP)'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-600">
              <span className="flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-gray-400" />{' '}
                {profile?.department?.name || 'General Department'}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-gray-400" />{' '}
                {profile?.designation?.title || 'Team Member'}
              </span>
            </div>
          </div>
        </div>

        {/* Biometric Face Photo Enrollment Card */}
        <div className="py-6 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-brand-600" /> Biometric Face Photo for Attendance
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Upload or capture an official front-facing portrait. This photo is matched in real time during camera check-ins.
              </p>
            </div>
            {profile?.face_enrolled && (
              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Active ID Match Photo
              </span>
            )}
          </div>

          <div className="bg-gray-50/80 rounded-xl p-4 border border-gray-200/80 flex flex-col sm:flex-row items-center gap-6">
            <div className="relative">
              {enrolledPhoto ? (
                <div className="relative">
                  <img
                    src={enrolledPhoto}
                    alt="Biometric Reference"
                    className="w-24 h-24 rounded-xl object-cover border-2 border-emerald-500 shadow-xs"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white rounded-full p-1 shadow-xs">
                    <Check className="w-3 h-3" />
                  </div>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-xl bg-gray-200 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 text-center p-2">
                  <User className="w-8 h-8 mb-1" />
                  <span className="text-[9px] font-medium leading-tight">No Photo Uploaded</span>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-3">
              <p className="text-xs text-gray-600 leading-relaxed">
                {enrolledPhoto
                  ? 'Your biometric template is active. When you check in using the camera, our AI continuously validates your live feed against this reference portrait.'
                  : 'You have not enrolled an attendance photo yet. Upload a clear portrait or capture one directly using your camera.'}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-brand-600 hover:bg-brand-700 text-white"
                    onClick={() => setIsEnrollModalOpen(true)}
                  >
                    <Camera className="w-3.5 h-3.5 mr-1.5" />
                    {enrolledPhoto ? 'Re-Enroll Face (5 Live Frames)' : 'Enroll Live Camera (5 Frames)'}
                  </Button>

                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <span className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 shadow-xs transition-colors">
                      <Upload className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
                      Upload Portrait ID
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>


        {/* Read-Only Employment & Salary Details */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-b border-gray-100 text-xs">
          <div>
            <span className="text-gray-400">Joining Date</span>
            <p className="font-semibold text-gray-900 mt-0.5">{profile?.joining_date}</p>
          </div>
          <div>
            <span className="text-gray-400">Employment Status</span>
            <p className="font-semibold text-emerald-600 capitalize mt-0.5">{profile?.status}</p>
          </div>
          <div>
            <span className="text-gray-400">Basic Salary</span>
            <p className="font-semibold text-gray-900 mt-0.5">
              PKR {Number(profile?.basic_salary).toLocaleString()}
            </p>
          </div>
          <div>
            <span className="text-gray-400">Gross Salary (150%)</span>
            <p className="font-bold text-brand-600 mt-0.5">
              PKR {Number(profile?.gross_salary).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Editable Contact Information (Phone and Address ONLY) */}
        <div className="pt-6">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Update Personal Contact Details</h3>
          <p className="text-xs text-gray-400 mb-4">
            Under company access control policies, you may update your phone number and residential address.
          </p>

          <form onSubmit={handleUpdateContact} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Phone Number</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+92 300 1234567"
                  className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">Residential Address</label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <textarea
                  rows={3}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, Area, City"
                  className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900"
                />
              </div>
            </div>

            <Button type="submit" isLoading={isSaving} size="sm">
              Save Contact Information
            </Button>
          </form>
        </div>
      </Card>

      {/* Email Verification OTP Modal */}
      <Modal
        isOpen={isOtpModalOpen}
        onClose={() => {
          setIsOtpModalOpen(false);
          setOtpError(null);
        }}
        title="Email Verification with Resend OTP"
      >
        <div className="space-y-4">
          <div className="p-3 bg-brand-50 border border-brand-100 rounded-xl flex items-start gap-3">
            <Mail className="w-5 h-5 text-brand-600 mt-0.5 shrink-0" />
            <div className="text-xs text-brand-900 leading-relaxed">
              <p className="font-semibold">Resend Email OTP Dispatch</p>
              <p className="text-brand-700 mt-0.5">
                A 6-digit verification code was dispatched to <strong>{profile?.email || user?.email}</strong>.
              </p>
            </div>
          </div>

          {devOtpPreview && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-amber-800 font-medium">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Dev Preview Code: <strong className="font-mono text-amber-950 font-bold">{devOtpPreview}</strong></span>
              </div>
              <button
                type="button"
                onClick={() => setOtpCode(devOtpPreview)}
                className="text-[11px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
              >
                Auto-fill
              </button>
            </div>
          )}

          {otpError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 rounded-lg flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{otpError}</span>
            </div>
          )}

          <form onSubmit={handleVerifyEmailOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Enter 6-Digit Verification Code
              </label>
              <input
                type="text"
                maxLength={6}
                required
                autoFocus
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 font-bold"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                disabled={otpCooldown > 0 || otpLoading}
                onClick={handleSendEmailOtp}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${otpLoading ? 'animate-spin' : ''}`} />
                {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : 'Resend Code'}
              </button>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsOtpModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" isLoading={otpLoading}>
                  Verify Code
                </Button>
              </div>
            </div>
          </form>
        </div>
      </Modal>

      {/* 5-Frame Live Biometric Enrollment Modal */}
      {empId && (
        <FaceEnrollmentModal
          isOpen={isEnrollModalOpen}
          onClose={() => setIsEnrollModalOpen(false)}
          employeeId={empId}
          employeeName={`${profile?.first_name || ''} ${profile?.last_name || ''}`}
          onSuccess={(updated) => {
            setProfile(updated);
            updateEmployee(updated);
            setSuccessMsg('Biometric face successfully enrolled with 5 multi-angle descriptors!');
            setTimeout(() => setSuccessMsg(null), 4000);
          }}
        />
      )}
    </div>
  );
};

