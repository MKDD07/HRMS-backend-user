import { issueEmployeePayslip } from './payslipApi';

// Legacy entry point now uses the employee's saved template and private R2 workflow.
// Callers must await this function so upload failures cannot look like successful downloads.
export function generatePayslipPDF({ employee, salaryRecord, month, year }) {
  return issueEmployeePayslip(employee, salaryRecord, month, year, true);
}
