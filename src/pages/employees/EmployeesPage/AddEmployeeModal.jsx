import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';

export function AddEmployeeModal({
  isOpen,
  onClose,
  onSubmit
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('Engineering & Technology');
  const [designation, setDesignation] = useState('Software Engineer');
  const [location, setLocation] = useState('HQ Vashi Infotech Park');
  const [roleType, setRoleType] = useState('Employee');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!firstName || !email) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        first_name: firstName,
        last_name: lastName,
        email,
        phone_number: phone || '+91 98000 00000',
        department,
        designation,
        work_location: location,
        type: roleType,
        date_of_joining: new Date().toISOString().split('T')[0],
        status: 'Active'
      });
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Onboard New Employee"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
              First Name *
            </label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. Vikram"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
              Last Name
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Shinde"
              className="w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
              Official Corporate Email *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@hrtiva.com"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98..."
              className="w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
              Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full h-10"
            >
              <option value="Engineering & Technology">Engineering & Technology</option>
              <option value="Product & Design">Product & Design</option>
              <option value="Human Resources">Human Resources</option>
              <option value="Finance & Payroll">Finance & Payroll</option>
              <option value="Sales & Operations">Sales & Operations</option>
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
              Designation / Job Title
            </label>
            <input
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Senior Backend Engineer"
              className="w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
              Primary Work Location
            </label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full h-10"
            >
              <option value="HQ Vashi Infotech Park">HQ Vashi Infotech Park, Navi Mumbai</option>
              <option value="Bengaluru Tech Hub">Bengaluru Tech Hub</option>
              <option value="Remote / Home Office">Remote / Home Office</option>
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#27292C] mb-1">
              Access Level & Role
            </label>
            <select
              value={roleType}
              onChange={(e) => setRoleType(e.target.value)}
              className="w-full h-10"
            >
              <option value="Employee">Employee (Standard Access)</option>
              <option value="Department Manager">Department Manager</option>
              <option value="HR Admin">HR Admin</option>
              <option value="Super Admin">Super Admin</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Onboarding…' : 'Save & Generate ID'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
