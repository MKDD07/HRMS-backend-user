import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { TenantHeader } from '../../components/ui/TenantHeader';
import { LiveEmployeeDossier } from './EmployeesPage/LiveEmployeeDossier';
import './EmployeesPage.scss';

// Use the same live employee workspace in directory and full-page routes.
export function EmployeeDetailPage({ userid, api, onBack, onShowToast }) {
  return <div className="employee-dossier-page">
    <TenantHeader settings={{ subheading: 'WORKSPACE / PEOPLE / EMPLOYEE DOSSIER', heading: 'Employee dossier', paragraph: 'Profile, employment, attendance and employee records in one workspace.', buttons: [{ id: 'back', label: 'Back to directory', variant: 'outline' }] }} actions={{ back: { icon: ArrowLeft, onClick: onBack } }}/>
    <LiveEmployeeDossier person={{ userid }} api={api} onShowToast={onShowToast}/>
  </div>;
}
