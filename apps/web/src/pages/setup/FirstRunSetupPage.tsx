import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Shield, Clock, MapPin, CheckCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { Button } from '../../components/ui/Button';

export const FirstRunSetupPage: React.FC = () => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('Saylani Tech Solutions');
  const [city, setCity] = useState('Karachi');
  const [adminEmail, setAdminEmail] = useState('admin@vektor.local');
  const [adminPassword, setAdminPassword] = useState('AdminPassword123!');
  const [showPassword, setShowPassword] = useState(false);
  const [officeStart, setOfficeStart] = useState('09:00');
  const [graceMinutes, setGraceMinutes] = useState(15);
  const [halfDayHours, setHalfDayHours] = useState(5.0);
  const [latitude, setLatitude] = useState<number | ''>(24.8607);
  const [longitude, setLongitude] = useState<number | ''>(67.0011);
  const [radiusMeters, setRadiusMeters] = useState(150);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleCompleteSetup = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const data = await api.post('/company/setup', {
        name,
        city,
        admin_email: adminEmail,
        admin_password: adminPassword,
        office_start: officeStart,
        grace_minutes: Number(graceMinutes),
        half_day_hours: Number(halfDayHours),
        weekend_days: [0, 6], // Sun, Sat
        office_latitude: latitude !== '' ? Number(latitude) : undefined,
        office_longitude: longitude !== '' ? Number(longitude) : undefined,
        office_radius_meters: Number(radiusMeters),
      });

      setAuth(data.token, data.user, data.company);
      navigate('/admin/dashboard');
    } catch (err: any) {
      setError(err.message || 'Setup initialization failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center items-center px-4 py-12">
      <div className="max-w-xl w-full bg-white rounded-2xl border border-gray-200/90 shadow-sm p-8">
        {/* Stepper Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
              First-Run Setup Wizard
            </span>
            <span className="text-xs text-gray-400">Step {step} of 3</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {step === 1 && 'Company Profile & Admin Account'}
            {step === 2 && 'Workplace Attendance Rules'}
            {step === 3 && 'Office Geofence & Location'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {step === 1 && 'Set up your company identity and root administrative login.'}
            {step === 2 && 'Set standard office hours, late grace duration, and half-day limits.'}
            {step === 3 && 'Set office coordinates for geofenced camera attendance validation.'}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}

        {/* Step 1: Company & Admin */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Admin Email</label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Admin Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg pl-3 pr-10 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors p-0.5 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button onClick={() => setStep(2)} className="w-full mt-4">
              Next: Workplace Rules <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Step 2: Work Rules */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Office Start Time
                </label>
                <input
                  type="time"
                  value={officeStart}
                  onChange={(e) => setOfficeStart(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <span className="text-[10px] text-gray-400">Default: 09:00 AM</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Grace Period (Minutes)
                </label>
                <input
                  type="number"
                  value={graceMinutes}
                  onChange={(e) => setGraceMinutes(Number(e.target.value))}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <span className="text-[10px] text-gray-400">Late after 09:15</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Half-Day Threshold (Hours)
              </label>
              <input
                type="number"
                step="0.5"
                value={halfDayHours}
                onChange={(e) => setHalfDayHours(Number(e.target.value))}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <span className="text-[10px] text-gray-400">
                Rule M4: Working under 5.0h counts as half day
              </span>
            </div>

            <div className="flex gap-3 mt-4">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1">
                Next: Location Geofence <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Location */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700">Office Coordinates</span>
              <button
                type="button"
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        setLatitude(pos.coords.latitude);
                        setLongitude(pos.coords.longitude);
                      },
                      () => alert('Could not access current location')
                    );
                  }
                }}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
              >
                📍 Use My Current Location
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Office Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Office Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Geofence Radius (Meters)
              </label>
              <input
                type="number"
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(Number(e.target.value))}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <span className="text-[10px] text-gray-400">
                Camera check-in allowed within 150m of office coordinates
              </span>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleCompleteSetup}
                isLoading={isLoading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Complete Setup & Launch <CheckCircle className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
