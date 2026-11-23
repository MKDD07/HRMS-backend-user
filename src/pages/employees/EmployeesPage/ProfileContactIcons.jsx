import React, { useId } from 'react';
import { Mail, Phone, MapPin, CalendarDays } from 'lucide-react';

function ContactIcon({ icon: Icon, label, value, href }) {
  const id = useId();
  const Trigger = href ? 'a' : 'button';
  return <span className="profile-contact-icon"><Trigger {...(href ? { href } : { type: 'button' })} aria-label={`${label}: ${value}`} aria-describedby={id}><Icon size={15} aria-hidden="true" /></Trigger><span id={id} role="tooltip" className="profile-contact-icon__tooltip"><small>{label}</small><strong>{value}</strong></span></span>;
}

export function ProfileContactIcons({ employee }) {
  const phone = employee.phone_number || employee.phone;
  const joined = employee.joining_date || employee.date_of_joining;
  return <div className="profile-contact-icons" aria-label="Employee contact details">
    {employee.email && <ContactIcon icon={Mail} label="Work email" value={employee.email} href={'mailto:' + employee.email} />}
    {phone && <ContactIcon icon={Phone} label="Phone" value={phone} href={'tel:' + phone} />}
    <ContactIcon icon={MapPin} label="Work location" value={employee.work_location || employee.location || 'Not provided'} />
    <ContactIcon icon={CalendarDays} label="Joined" value={joined || 'Not provided'} />
  </div>;
}
