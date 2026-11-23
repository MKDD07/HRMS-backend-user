import React from 'react';
import { PayslipStudio } from '../../components/payroll/PayslipStudio';

export function SalaryStructurePage(props) {
  return <PayslipStudio api={props.api}/>;
}
