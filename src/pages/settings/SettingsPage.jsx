import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Clock,
  MapPin,
  Shield,
  Save,
  Database,
  Building,
  CalendarDays,
  CheckCircle2,
  RefreshCw,
  Upload,
  Image,
  Sparkles,
  Trash2,
  Plus,
  Edit2,
  Copy,
  Check,
  Moon,
  Sun,
  Coffee,
  AlertCircle,
  Sliders,
  DollarSign
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Toggle } from '../../components/ui/Toggle';
import { Tabs } from '../../components/ui/Tabs';
import { FilterBar } from '../../components/ui/FilterBar';
import { Modal } from '../../components/ui/Modal';
import {
  getBrandLogo,
  setBrandLogo,
  removeBrandLogo,
  onBrandLogoChange
} from '../../lib/brandStore';
import {
  getShifts,
  saveShift,
  deleteShift,
  setDefaultShift,
  toggleShiftStatus,
  resetShiftsToDefault
} from '../../lib/shiftStore';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function SettingsPage({ api, onShowToast }) {
  const [activeTab, setActiveTab] = useState('shifts');

  // ==========================================
  // BRAND & LOGO STATE
  // ==========================================
  const [brandLogo, setBrandLogoState] = useState(getBrandLogo());
  const [logoFileName, setLogoFileName] = useState('');
  const [logoFileSize, setLogoFileSize] = useState('');
  const fileInputRef = useRef(null);

  // Organization Information
  const [companyName, setCompanyName] = useState('PulseHRMS Technologies Pvt Ltd');
  const [registrationNo, setRegistrationNo] = useState('U72900MH2023PTC398124');
  const [corporateEmail, setCorporateEmail] = useState('admin@hrtiva.com');
  const [hqAddress, setHqAddress] = useState('Infotech Park, Sector 30A, Vashi, Navi Mumbai 400703');

  useEffect(() => {
    return onBrandLogoChange((newLogo) => {
      setBrandLogoState(newLogo);
    });
  }, []);

  const handleLogoFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      if (onShowToast) {
        onShowToast({
          type: 'error',
          title: 'File Too Large',
          message: 'Logo image must be smaller than 5MB.'
        });
      }
      return;
    }

    setLogoFileName(file.name);
    setLogoFileSize(`${(file.size / 1024).toFixed(1)} KB`);

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (dataUrl) {
        setBrandLogo(dataUrl);
        setBrandLogoState(dataUrl);
        if (onShowToast) {
          onShowToast({
            type: 'success',
            title: 'Company Logo Updated',
            message: 'New brand logo saved to database and applied to sidebar.'
          });
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    removeBrandLogo();
    setBrandLogoState(null);
    setLogoFileName('');
    setLogoFileSize('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onShowToast) {
      onShowToast({
        type: 'info',
        title: 'Logo Reset',
        message: 'Reverted to default Sparkles system icon.'
      });
    }
  };

  // ==========================================
  // SHIFTS STATE & REWORK
  // ==========================================
  const [shifts, setShifts] = useState(getShifts());
  const [shiftSearch, setShiftSearch] = useState('');
  const [selectedShiftType, setSelectedShiftType] = useState('All');
  const [selectedShiftStatus, setSelectedShiftStatus] = useState('All');

  // Shift Modal State (Add / Edit)
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState(null);

  // Shift Form Fields
  const [shiftCode, setShiftCode] = useState('');
  const [shiftName, setShiftName] = useState('');
  const [shiftType, setShiftType] = useState('Regular');
  const [shiftStartTime, setShiftStartTime] = useState('09:30');
  const [shiftEndTime, setShiftEndTime] = useState('18:30');
  const [isOvernight, setIsOvernight] = useState(false);
  const [gracePeriodMins, setGracePeriodMins] = useState(15);
  const [earlyExitGraceMins, setEarlyExitGraceMins] = useState(10);
  const [breakDurationMins, setBreakDurationMins] = useState(60);
  const [halfDayHours, setHalfDayHours] = useState(4.5);
  const [fullDayHours, setFullDayHours] = useState(8.5);
  const [allowancePerShift, setAllowancePerShift] = useState(0);
  const [workingDays, setWorkingDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [isDefault, setIsDefault] = useState(false);
  const [shiftStatus, setShiftStatus] = useState('Active');
  const [shiftDescription, setShiftDescription] = useState('');

  const openAddShiftModal = () => {
    setEditingShiftId(null);
    setShiftCode(`SH-${Date.now().toString().slice(-4)}`);
    setShiftName('');
    setShiftType('Regular');
    setShiftStartTime('09:30');
    setShiftEndTime('18:30');
    setIsOvernight(false);
    setGracePeriodMins(15);
    setEarlyExitGraceMins(10);
    setBreakDurationMins(60);
    setHalfDayHours(4.5);
    setFullDayHours(8.5);
    setAllowancePerShift(0);
    setWorkingDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    setIsDefault(false);
    setShiftStatus('Active');
    setShiftDescription('');
    setIsShiftModalOpen(true);
  };

  const openEditShiftModal = (shift) => {
    setEditingShiftId(shift.id);
    setShiftCode(shift.id);
    setShiftName(shift.name);
    setShiftType(shift.type || 'Regular');
    setShiftStartTime(shift.startTime || '09:30');
    setShiftEndTime(shift.endTime || '18:30');
    setIsOvernight(Boolean(shift.isOvernight));
    setGracePeriodMins(shift.gracePeriodMins ?? 15);
    setEarlyExitGraceMins(shift.earlyExitGraceMins ?? 10);
    setBreakDurationMins(shift.breakDurationMins ?? 60);
    setHalfDayHours(shift.halfDayHours ?? 4.5);
    setFullDayHours(shift.fullDayHours ?? 8.5);
    setAllowancePerShift(shift.allowancePerShift ?? 0);
    setWorkingDays(shift.workingDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    setIsDefault(Boolean(shift.isDefault));
    setShiftStatus(shift.status || 'Active');
    setShiftDescription(shift.description || '');
    setIsShiftModalOpen(true);
  };

  const handleDuplicateShift = (shift) => {
    const newId = `SH-${Date.now().toString().slice(-4)}`;
    const duplicated = {
      ...shift,
      id: newId,
      name: `${shift.name} (Copy)`,
      isDefault: false
    };
    const updated = saveShift(duplicated);
    setShifts(updated);
    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Shift Duplicated',
        message: `Created copy: ${duplicated.name}`
      });
    }
  };

  const handleSaveShift = (e) => {
    e.preventDefault();
    if (!shiftName.trim()) return;

    const payload = {
      id: editingShiftId || shiftCode.trim().toUpperCase(),
      name: shiftName.trim(),
      type: shiftType,
      startTime: shiftStartTime,
      endTime: shiftEndTime,
      isOvernight,
      gracePeriodMins: Number(gracePeriodMins),
      earlyExitGraceMins: Number(earlyExitGraceMins),
      breakDurationMins: Number(breakDurationMins),
      halfDayHours: Number(halfDayHours),
      fullDayHours: Number(fullDayHours),
      allowancePerShift: Number(allowancePerShift),
      workingDays,
      isDefault,
      status: shiftStatus,
      description: shiftDescription.trim()
    };

    const updated = saveShift(payload);
    setShifts(updated);
    setIsShiftModalOpen(false);

    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: editingShiftId ? 'Shift Updated' : 'Shift Created',
        message: `Work shift "${payload.name}" configuration saved.`
      });
    }
  };

  const handleDeleteShift = (id, name) => {
    if (shifts.find((s) => s.id === id)?.isDefault) {
      if (onShowToast) {
        onShowToast({
          type: 'error',
          title: 'Cannot Delete Default',
          message: 'Assign another shift as default before deleting this shift.'
        });
      }
      return;
    }

    const updated = deleteShift(id);
    setShifts(updated);
    if (onShowToast) {
      onShowToast({
        type: 'info',
        title: 'Shift Deleted',
        message: `Removed shift ${name} (${id}).`
      });
    }
  };

  const handleSetDefault = (id) => {
    const updated = setDefaultShift(id);
    setShifts(updated);
    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Default Shift Updated',
        message: 'This shift is now the organization primary roster.'
      });
    }
  };

  const handleToggleStatus = (id) => {
    const updated = toggleShiftStatus(id);
    setShifts(updated);
  };

  const toggleDay = (day) => {
    if (workingDays.includes(day)) {
      if (workingDays.length > 1) {
        setWorkingDays(workingDays.filter((d) => d !== day));
      }
    } else {
      setWorkingDays([...workingDays, day]);
    }
  };

  // Filter shifts
  const filteredShifts = shifts.filter((s) => {
    const term = shiftSearch.toLowerCase();
    const matchesSearch =
      (s.name || '').toLowerCase().includes(term) ||
      (s.id || '').toLowerCase().includes(term) ||
      (s.description || '').toLowerCase().includes(term);
    const matchesType = selectedShiftType === 'All' || s.type === selectedShiftType;
    const matchesStatus = selectedShiftStatus === 'All' || s.status === selectedShiftStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  // Calculate shift duration
  const getShiftDurationHours = (start, end, overnight) => {
    const [sH, sM] = (start || '09:00').split(':').map(Number);
    const [eH, eM] = (end || '18:00').split(':').map(Number);
    let startMinutes = sH * 60 + sM;
    let endMinutes = eH * 60 + eM;
    if (overnight || endMinutes < startMinutes) {
      endMinutes += 24 * 60;
    }
    const total = (endMinutes - startMinutes) / 60;
    return total.toFixed(1);
  };

  // ==========================================
  // GEOFENCE STATE
  // ==========================================
  const [geofenceEnabled, setGeofenceEnabled] = useState(true);
  const [officeLat, setOfficeLat] = useState('19.0657');
  const [officeLng, setOfficeLng] = useState('72.9984');
  const [geofenceRadius, setGeofenceRadius] = useState('200');

  // ==========================================
  // COMPLIANCE & STATUTORY
  // ==========================================
  const [pfRate, setPfRate] = useState('12');
  const [ptRate, setPtRate] = useState('200');
  const [annualLeaves, setAnnualLeaves] = useState('18');
  const [maxCarryForward, setMaxCarryForward] = useState('12');

  const handleSaveGeneralSettings = (e) => {
    e.preventDefault();
    if (onShowToast) {
      onShowToast({
        type: 'success',
        title: 'Settings Saved',
        message: 'Organization preferences, geofence, and statutory parameters updated.'
      });
    }
  };

  const handleResetData = () => {
    localStorage.clear();
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Shifts"
        subtitle="Manage organization branding, multiple employee work shift rosters, campus geofencing, and statutory rules."
        breadcrumbs={['HRMS', 'Settings']}
        actions={
          activeTab === 'shifts' ? (
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={openAddShiftModal}
            >
              Create Shift Profile
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              icon={Save}
              onClick={handleSaveGeneralSettings}
            >
              Save All Settings
            </Button>
          )
        }
      />

      {/* Settings Navigation Tabs */}
      <Tabs
        tabs={[
          { id: 'shifts', label: `Work Shifts & Rosters (${shifts.length})` },
          { id: 'general', label: 'Company Brand & Logo' },
          { id: 'geofence', label: 'Campus Geofence & Terminals' },
          { id: 'statutory', label: 'Statutory & Payroll Rules' }
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* ==================================================================== */}
      {/* TAB 1: WORK SHIFTS & ROSTERS REWORK                                  */}
      {/* ==================================================================== */}
      {activeTab === 'shifts' && (
        <div className="space-y-5">
          {/* Shifts Summary Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4 bg-white border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-[11px] font-semibold text-[#5F6368] uppercase tracking-wider">
                  Configured Shifts
                </span>
                <h4 className="text-xl font-bold text-[#27292C] mt-0.5">{shifts.length} Profiles</h4>
                <p className="text-[11px] text-[#000000] font-medium mt-1">
                  {shifts.filter((s) => s.status === 'Active').length} Active for attendance
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="card p-4 bg-white border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-[11px] font-semibold text-[#5F6368] uppercase tracking-wider">
                  Default Organization Shift
                </span>
                <h4 className="text-base font-bold text-[#27292C] mt-0.5 truncate max-w-[150px]">
                  {shifts.find((s) => s.isDefault)?.name || 'General Day'}
                </h4>
                <p className="text-[11px] text-[#5F6368] mt-1">
                  {shifts.find((s) => s.isDefault)?.startTime} - {shifts.find((s) => s.isDefault)?.endTime}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] text-[#000000] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="card p-4 bg-white border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-[11px] font-semibold text-[#5F6368] uppercase tracking-wider">
                  24/7 Coverage
                </span>
                <h4 className="text-xl font-bold text-[#27292C] mt-0.5">Continuous</h4>
                <p className="text-[11px] text-[#4F46E5] font-medium mt-1">
                  Day, Evening & Night Graveyard
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#F5F3FF] text-[#7C3AED] flex items-center justify-center shrink-0">
                <Moon className="w-5 h-5" />
              </div>
            </div>

            <div className="card p-4 bg-white border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-[11px] font-semibold text-[#5F6368] uppercase tracking-wider">
                  Roster Differential
                </span>
                <h4 className="text-xl font-bold text-[#27292C] mt-0.5">Up to ₹750</h4>
                <p className="text-[11px] text-[#5F6368] mt-1">
                  Per shift night / weekend premium
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <FilterBar
            searchValue={shiftSearch}
            onSearchChange={setShiftSearch}
            searchPlaceholder="Filter shifts by name, code (e.g. SH-GEN), or description..."
          >
            <select
              value={selectedShiftType}
              onChange={(e) => setSelectedShiftType(e.target.value)}
              className="filter-bar__select text-[13px]"
            >
              <option value="All">All Shift Types</option>
              <option value="Regular">Regular Hours</option>
              <option value="Rotational">Rotational</option>
              <option value="Night">Night Shift</option>
              <option value="Flexible">Flexible Core</option>
              <option value="Weekend">Weekend Dedicated</option>
            </select>

            <select
              value={selectedShiftStatus}
              onChange={(e) => setSelectedShiftStatus(e.target.value)}
              className="filter-bar__select text-[13px]"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive</option>
            </select>
          </FilterBar>

          {/* Shift Profiles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredShifts.map((shift) => {
              const duration = getShiftDurationHours(shift.startTime, shift.endTime, shift.isOvernight);

              return (
                <div
                  key={shift.id}
                  className={`card p-5 space-y-4 bg-white border transition-all flex flex-col justify-between hover:shadow-xs ${shift.isDefault ? 'border-[#4F46E5] ring-1 ring-[#4F46E5]/20' : 'border-[#E5E7EB]'
                    }`}
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-[#27292C]">
                            {shift.name}
                          </h4>
                          {shift.isDefault && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-[#EEF2FF] text-[#4F46E5] font-semibold border border-[#C7D2FE]">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-bold text-[#4F46E5] bg-[#F3F4F6] px-2 py-0.5 rounded">
                            {shift.id}
                          </span>
                          <span className="text-[11px] font-medium text-[#5F6368]">
                            {shift.type}
                          </span>
                        </div>
                      </div>

                      <Badge variant={shift.status === 'Active' ? 'success' : 'neutral'}>
                        {shift.status}
                      </Badge>
                    </div>

                    {/* Timing Badge */}
                    <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-sm text-[#27292C]">
                          {shift.isOvernight ? (
                            <Moon className="w-4 h-4 text-[#7C3AED]" />
                          ) : (
                            <Sun className="w-4 h-4 text-[#F59E0B]" />
                          )}
                          <span>
                            {shift.startTime} – {shift.endTime}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#5F6368] font-semibold">
                          {duration} hrs
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#5F6368] pt-1 border-t border-[#E5E7EB]/60">
                        <span>Check-in Grace: <strong>{shift.gracePeriodMins} mins</strong></span>
                        <span>Meal Break: <strong>{shift.breakDurationMins} mins</strong></span>
                      </div>
                    </div>

                    {/* Rules & Requirements */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded-lg bg-[#FAFAFA] border border-[#F3F4F6]">
                        <span className="text-[#5F6368] block">Full Day Threshold</span>
                        <strong className="text-[#27292C] font-semibold">{shift.fullDayHours} Hours</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-[#FAFAFA] border border-[#F3F4F6]">
                        <span className="text-[#5F6368] block">Half Day Minimum</span>
                        <strong className="text-[#27292C] font-semibold">{shift.halfDayHours} Hours</strong>
                      </div>
                    </div>

                    {/* Working Days */}
                    <div>
                      <span className="text-[11px] font-semibold text-[#5F6368] block mb-1.5">
                        Operating Days
                      </span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {DAYS_OF_WEEK.map((day) => {
                          const isAssigned = (shift.workingDays || []).includes(day);
                          return (
                            <span
                              key={day}
                              className={`text-[10px] px-2 py-0.5 rounded font-semibold ${isAssigned
                                ? 'bg-[#EEF2FF] text-[#4F46E5] border border-[#C7D2FE]'
                                : 'bg-[#F9FAFB] text-[#9CA3AF] border border-[#E5E7EB]'
                                }`}
                            >
                              {day}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {shift.allowancePerShift > 0 && (
                      <div className="text-[11px] text-[#D97706] font-semibold bg-[#FEF3C7]/40 px-2.5 py-1 rounded-lg border border-[#FDE68A] flex items-center justify-between">
                        <span>Shift Allowance:</span>
                        <span>₹{shift.allowancePerShift} / shift</span>
                      </div>
                    )}

                    {shift.description && (
                      <p className="text-[11px] text-[#5F6368] line-clamp-2">
                        {shift.description}
                      </p>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Edit2}
                        onClick={() => openEditShiftModal(shift)}
                        title="Edit Shift Configuration"
                      >
                        Edit
                      </Button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateShift(shift)}
                        className="p-1.5 rounded-lg text-[#5F6368] hover:text-[#27292C] hover:bg-[#F3F4F6] transition-colors"
                        title="Duplicate shift profile"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {!shift.isDefault ? (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(shift.id)}
                          className="text-xs font-semibold text-[#4F46E5] hover:text-[#3730A3] transition-colors"
                        >
                          Make Default
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold text-[#000000] flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Active Default
                        </span>
                      )}

                      {!shift.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleDeleteShift(shift.id, shift.name)}
                          className="p-1 text-[#9CA3AF] hover:text-[#DC2626] transition-colors"
                          title="Delete shift"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: COMPANY BRAND & LOGO                                          */}
      {/* ==================================================================== */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveGeneralSettings} className="space-y-6">
          <div className="card p-5 space-y-5 bg-white border border-[#E5E7EB]">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
              <div className="flex items-center gap-2.5">
                <Image className="w-5 h-5 text-[#4F46E5]" />
                <div>
                  <h3 className="text-base font-bold text-[#27292C]">
                    Sidebar Brand Logo & Header Customization
                  </h3>
                  <p className="text-[13px] text-[#5F6368]">
                    Upload your organization's custom corporate logo to display in the main application sidebar.
                  </p>
                </div>
              </div>
              {brandLogo && (
                <Badge variant="success">Custom Logo Active</Badge>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Upload Area */}
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.png,.jpg,.jpeg,.svg,.webp,.gif,.ico,.bmp"
                  onChange={handleLogoFileChange}
                  className="hidden"
                  id="brand-logo-file-input"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file && fileInputRef.current) {
                      const dataTransfer = new DataTransfer();
                      dataTransfer.items.add(file);
                      fileInputRef.current.files = dataTransfer.files;
                      handleLogoFileChange({ target: { files: [file] } });
                    }
                  }}
                  className="border-2 border-dashed border-[#CBD5E1] hover:border-[#4F46E5] bg-[#F9FAFB] hover:bg-[#EEF2FF]/30 transition-all rounded-xl p-6 text-center cursor-pointer flex flex-col items-center justify-center gap-2.5 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-white border border-[#E5E7EB] text-[#4F46E5] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#27292C]">
                      Click to upload or drag & drop logo
                    </p>
                    <p className="text-[11px] text-[#5F6368] mt-0.5">
                      Supports all image formats: SVG, PNG, JPG, WebP, GIF (Max 5MB)
                    </p>
                  </div>
                  {logoFileName && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#EEF2FF] text-[#4F46E5] text-xs font-medium mt-1">
                      <span>{logoFileName}</span>
                      <span>({logoFileSize})</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    icon={Upload}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {brandLogo ? 'Change Logo Image' : 'Select Logo Image'}
                  </Button>

                  {brandLogo && (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      icon={Trash2}
                      onClick={handleRemoveLogo}
                    >
                      Reset to Default
                    </Button>
                  )}
                </div>
              </div>

              {/* Live Sidebar Preview */}
              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-[#5F6368]">
                  <span className="font-semibold uppercase tracking-wider text-[11px]">Sidebar Header Preview</span>
                  <span>{brandLogo ? 'Custom Logo (No text needed)' : 'Default (Icon + Text)'}</span>
                </div>

                <div className="bg-white border border-[#E5E7EB] rounded-lg p-3 h-16 flex items-center shadow-2xs">
                  {brandLogo ? (
                    <div className="flex items-center h-full max-w-[200px] overflow-hidden py-0.5">
                      <img
                        src={brandLogo}
                        alt="Preview Logo"
                        className="max-h-9 max-w-[190px] w-auto h-auto object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-auto h-auto flex items-center justify-center text-[#27292C]">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <strong className="text-sm font-bold text-[#27292C]">PulseHRMS</strong>
                        <span className="text-[11px] text-[#5F6368]">Enterprise Admin</span>
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-[#5F6368]">
                  When your corporate logo is uploaded, it is automatically displayed across the sidebar without any redundant title text.
                </p>
              </div>
            </div>
          </div>

          {/* Legal Entity & Headquarters */}
          <div className="card p-5 space-y-4 bg-white border border-[#E5E7EB]">
            <div className="flex items-center gap-2.5 border-b border-[#E5E7EB] pb-3">
              <Building className="w-5 h-5 text-[#4F46E5]" />
              <h3 className="text-base font-bold text-[#27292C]">
                Corporate Profile & Legal Entity
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
                  Company Legal Entity Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full text-[13px] h-10"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
                  Corporate Registration Number (CIN / UIN)
                </label>
                <input
                  type="text"
                  value={registrationNo}
                  onChange={(e) => setRegistrationNo(e.target.value)}
                  className="w-full text-[13px] h-10 font-mono"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
                  Official Communication Email
                </label>
                <input
                  type="email"
                  value={corporateEmail}
                  onChange={(e) => setCorporateEmail(e.target.value)}
                  className="w-full text-[13px] h-10"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
                  Headquarters Campus Address
                </label>
                <input
                  type="text"
                  value={hqAddress}
                  onChange={(e) => setHqAddress(e.target.value)}
                  className="w-full text-[13px] h-10"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" size="md" icon={Save}>
              Save Corporate Identity
            </Button>
          </div>
        </form>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: CAMPUS GEOFENCE & TERMINALS                                   */}
      {/* ==================================================================== */}
      {activeTab === 'geofence' && (
        <form onSubmit={handleSaveGeneralSettings} className="space-y-6">
          <div className="card p-5 space-y-4 bg-white border border-[#E5E7EB]">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
              <div className="flex items-center gap-2.5">
                <MapPin className="w-5 h-5 text-[#4F46E5]" />
                <div>
                  <h3 className="text-base font-bold text-[#27292C]">
                    Campus Geofencing & GPS Punch Terminal
                  </h3>
                  <p className="text-[13px] text-[#5F6368]">
                    Enforce strict mobile and web coordinate validation during biometric check-in.
                  </p>
                </div>
              </div>

              <Toggle
                checked={geofenceEnabled}
                onChange={setGeofenceEnabled}
                label={geofenceEnabled ? 'Enforced' : 'Disabled'}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
                  HQ Center Latitude
                </label>
                <input
                  type="text"
                  value={officeLat}
                  onChange={(e) => setOfficeLat(e.target.value)}
                  className="w-full text-[13px] h-10 font-mono"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
                  HQ Center Longitude
                </label>
                <input
                  type="text"
                  value={officeLng}
                  onChange={(e) => setOfficeLng(e.target.value)}
                  className="w-full text-[13px] h-10 font-mono"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
                  Allowed Radius (Meters)
                </label>
                <input
                  type="number"
                  value={geofenceRadius}
                  onChange={(e) => setGeofenceRadius(e.target.value)}
                  className="w-full text-[13px] h-10"
                />
              </div>
            </div>

            <div className="p-3.5 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] text-[13px] text-[#5F6368] flex items-center justify-between">
              <div>
                <span>Current Validated Perimeter: </span>
                <strong className="text-[#27292C]">
                  HQ Vashi Infotech Park, Navi Mumbai ({officeLat}, {officeLng})
                </strong>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#EEF2FF] text-[#4F46E5] border border-[#C7D2FE]">
                {geofenceRadius}m Boundary
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" size="md" icon={Save}>
              Save Geofence Settings
            </Button>
          </div>
        </form>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: STATUTORY & PAYROLL RULES                                     */}
      {/* ==================================================================== */}
      {activeTab === 'statutory' && (
        <form onSubmit={handleSaveGeneralSettings} className="space-y-6">
          <div className="card p-5 space-y-4 bg-white border border-[#E5E7EB]">
            <div className="flex items-center gap-2.5 border-b border-[#E5E7EB] pb-3">
              <Shield className="w-5 h-5 text-[#4F46E5]" />
              <h3 className="text-base font-bold text-[#27292C]">
                Statutory Payroll & Annual Quotas
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
                  Employee PF Deduction (%)
                </label>
                <input
                  type="number"
                  value={pfRate}
                  onChange={(e) => setPfRate(e.target.value)}
                  className="w-full text-[13px] h-10"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
                  Professional Tax (₹/mo)
                </label>
                <input
                  type="number"
                  value={ptRate}
                  onChange={(e) => setPtRate(e.target.value)}
                  className="w-full text-[13px] h-10"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
                  Annual Leave Quota (Days)
                </label>
                <input
                  type="number"
                  value={annualLeaves}
                  onChange={(e) => setAnnualLeaves(e.target.value)}
                  className="w-full text-[13px] h-10"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
                  Max Carry-Forward (Days)
                </label>
                <input
                  type="number"
                  value={maxCarryForward}
                  onChange={(e) => setMaxCarryForward(e.target.value)}
                  className="w-full text-[13px] h-10"
                />
              </div>
            </div>
          </div>

          {/* Database Diagnostics */}
          <div className="card p-5 space-y-3 bg-white border border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-[#4F46E5]" />
                <div>
                  <h4 className="text-sm font-bold text-[#27292C]">Database & Diagnostics</h4>
                  <p className="text-[13px] text-[#5F6368]">
                    Storage Engine: Cloudflare D1 SQL Cache & LocalStorage Resilient Synchronizer
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const defs = resetShiftsToDefault();
                    setShifts(defs);
                    if (onShowToast) {
                      onShowToast({
                        type: 'info',
                        title: 'Shifts Reset',
                        message: 'Restored default work shift profiles.'
                      });
                    }
                  }}
                >
                  Reset Shifts
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  icon={RefreshCw}
                  onClick={handleResetData}
                >
                  Clear All Cache
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" size="md" icon={Save}>
              Save Compliance Rules
            </Button>
          </div>
        </form>
      )}

      {/* ==================================================================== */}
      {/* MODAL: CREATE / EDIT WORK SHIFT PROFILE                              */}
      {/* ==================================================================== */}
      <Modal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        title={editingShiftId ? `Edit Work Shift: ${shiftName}` : 'Create New Work Shift Profile'}
        size="lg"
      >
        <form onSubmit={handleSaveShift} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
                Shift Name *
              </label>
              <input
                type="text"
                required
                value={shiftName}
                onChange={(e) => setShiftName(e.target.value)}
                placeholder="e.g. US Shift / European Support"
                className="w-full text-[13px] h-10"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
                Shift Code *
              </label>
              <input
                type="text"
                required
                disabled={Boolean(editingShiftId)}
                value={shiftCode}
                onChange={(e) => setShiftCode(e.target.value.toUpperCase())}
                placeholder="SH-XXX"
                className="w-full text-[13px] h-10 font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
                Shift Schedule Type
              </label>
              <select
                value={shiftType}
                onChange={(e) => setShiftType(e.target.value)}
                className="w-full text-[13px] h-10 filter-bar__select"
              >
                <option value="Regular">Regular Hours</option>
                <option value="Rotational">Rotational</option>
                <option value="Night">Night Graveyard</option>
                <option value="Flexible">Flexible Core Window</option>
                <option value="Weekend">Weekend Dedicated</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
                Shift Start Time
              </label>
              <input
                type="time"
                required
                value={shiftStartTime}
                onChange={(e) => setShiftStartTime(e.target.value)}
                className="w-full text-[13px] h-10"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
                Shift End Time
              </label>
              <input
                type="time"
                required
                value={shiftEndTime}
                onChange={(e) => setShiftEndTime(e.target.value)}
                className="w-full text-[13px] h-10"
              />
            </div>
          </div>

          <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4 text-[#7C3AED]" />
              <div>
                <span className="text-[13px] font-semibold text-[#27292C] block">
                  Overnight Shift (Spans Past Midnight)
                </span>
                <span className="text-[11px] text-[#5F6368]">
                  Check-in date belongs to previous day shift cycle.
                </span>
              </div>
            </div>
            <Toggle
              checked={isOvernight}
              onChange={setIsOvernight}
            />
          </div>

          {/* Grace & Break Windows */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
                Late Check-In Grace (Mins)
              </label>
              <input
                type="number"
                min="0"
                value={gracePeriodMins}
                onChange={(e) => setGracePeriodMins(e.target.value)}
                className="w-full text-[13px] h-10"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
                Early Departure Grace (Mins)
              </label>
              <input
                type="number"
                min="0"
                value={earlyExitGraceMins}
                onChange={(e) => setEarlyExitGraceMins(e.target.value)}
                className="w-full text-[13px] h-10"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
                Unpaid Meal Break (Mins)
              </label>
              <input
                type="number"
                min="0"
                value={breakDurationMins}
                onChange={(e) => setBreakDurationMins(e.target.value)}
                className="w-full text-[13px] h-10"
              />
            </div>
          </div>

          {/* Thresholds & Allowance */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
                Full-Day Required (Hours)
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                value={fullDayHours}
                onChange={(e) => setFullDayHours(e.target.value)}
                className="w-full text-[13px] h-10"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
                Half-Day Minimum (Hours)
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                value={halfDayHours}
                onChange={(e) => setHalfDayHours(e.target.value)}
                className="w-full text-[13px] h-10"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
                Shift Differential (₹ / Shift)
              </label>
              <input
                type="number"
                min="0"
                value={allowancePerShift}
                onChange={(e) => setAllowancePerShift(e.target.value)}
                className="w-full text-[13px] h-10"
              />
            </div>
          </div>

          {/* Applicable Working Days */}
          <div>
            <label className="block text-[13px] font-semibold text-[#27292C] mb-1.5">
              Operating Days for this Shift *
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = workingDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${isSelected
                      ? 'bg-[#4F46E5] text-white shadow-2xs'
                      : 'bg-[#F9FAFB] text-[#5F6368] border border-[#E5E7EB] hover:bg-[#F3F4F6]'
                      }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
              Shift Description / Notes
            </label>
            <input
              type="text"
              value={shiftDescription}
              onChange={(e) => setShiftDescription(e.target.value)}
              placeholder="e.g. Applicable for European handover teams with rotational off."
              className="w-full text-[13px] h-10"
            />
          </div>

          {/* Toggles */}
          <div className="flex items-center justify-between pt-2 border-t border-[#E5E7EB]">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="shift-is-default"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-[#CBD5E1] text-[#4F46E5] focus:ring-[#4F46E5]"
              />
              <label htmlFor="shift-is-default" className="text-[13px] font-semibold text-[#27292C] cursor-pointer">
                Set as Default Organization Shift
              </label>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[13px] text-[#5F6368]">Status:</span>
              <select
                value={shiftStatus}
                onChange={(e) => setShiftStatus(e.target.value)}
                className="filter-bar__select text-xs h-8 px-2"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsShiftModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" icon={Save}>
              {editingShiftId ? 'Save Shift Changes' : 'Create Shift'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
