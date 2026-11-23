import { jsPDF } from 'jspdf';
import { formatMinutes } from './attendanceLedger';
import { getBrandLogo } from '../../lib/brandStore';

/** Helper to generate a clean short employee code */
function getEmpCode(person) {
  return String(person.employee_code || person.emp_code || person.emp_id || person.code || person.userid || 'EMP').trim();
}

/** Helper to generate short clean department code (e.g. "ENG", "HR", "SALES", "FIN") */
function getDeptCode(department) {
  if (!department) return 'GEN';
  const clean = department.trim().toUpperCase();
  const known = {
    'ENGINEERING': 'ENG',
    'SOFTWARE ENGINEERING': 'ENG',
    'DEVELOPMENT': 'DEV',
    'HUMAN RESOURCES': 'HR',
    'OPERATIONS': 'OPS',
    'SALES': 'SALES',
    'MARKETING': 'MKTG',
    'FINANCE': 'FIN',
    'ACCOUNTING': 'ACC',
    'ADMINISTRATION': 'ADMIN',
    'CUSTOMER SUPPORT': 'SUPP',
    'QUALITY ASSURANCE': 'QA',
    'PRODUCT': 'PROD',
    'DESIGN': 'UI/UX'
  };
  if (known[clean]) return known[clean];
  if (clean.length <= 5) return clean;
  // Fallback: take first letter of each word or first 4 chars
  const words = clean.split(/[\s_-]+/);
  if (words.length > 1) return words.map(w => w[0]).join('').slice(0, 5);
  return clean.slice(0, 4);
}

/** Helper to resolve logo base64 and aspect ratio from topbar branding or brandStore */
async function resolveLogoImage(brandLogoProp) {
  try {
    let source = brandLogoProp || getBrandLogo();

    if (!source && typeof document !== 'undefined') {
      const img = document.querySelector('.tenant-topbar__brand img');
      if (img && img.src) source = img.src;
    }

    if (source && typeof source === 'string') {
      // If base64 or valid URL, load into an Image to get true aspect ratio
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          let dataUrl = source;
          if (!source.startsWith('data:image')) {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth || 120;
              canvas.height = img.naturalHeight || 40;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              dataUrl = canvas.toDataURL('image/png');
            } catch {
              dataUrl = source;
            }
          }
          const aspect = (img.naturalWidth && img.naturalHeight)
            ? (img.naturalWidth / img.naturalHeight)
            : 2.5;
          resolve({ dataUrl, aspect });
        };
        img.onerror = () => resolve(null);
        img.src = source;
      });
    }
  } catch (err) {
    console.warn('Could not load logo for PDF:', err);
  }
  return null;
}

export async function exportAttendancePdf({
  people = [],
  dates = [],
  ledger = {},
  month = new Date(),
  department = '',
  tenantName = 'Pulse HRMS',
  logoUrl = null
}) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 841.89 pt
  const pageHeight = doc.internal.pageSize.getHeight(); // 595.28 pt
  const margin = 28;
  const contentWidth = pageWidth - margin * 2; // 785.89 pt
  const monthName = month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const logoInfo = await resolveLogoImage(logoUrl);

  // Aggregate stats per employee
  let totalP = 0;
  let totalL = 0;
  let totalA = 0;
  let totalCL = 0;
  let totalSL = 0;
  let totalEL = 0;
  let totalLWP = 0;
  let totalOtherLeaves = 0;

  const employeeSummaries = people.map(person => {
    const cells = dates.map(day => ledger[person.userid]?.[day]).filter(Boolean);
    let p = 0, l = 0, a = 0, cl = 0, sl = 0, el = 0, lwp = 0, other = 0, mins = 0;
    
    cells.forEach(cell => {
      if (cell.code === 'P') p++;
      else if (cell.code === 'L') l++;
      else if (cell.code === 'A') a++;
      else if (cell.code === 'CL') cl++;
      else if (cell.code === 'SL') sl++;
      else if (cell.code === 'EL') el++;
      else if (cell.code === 'LWP') lwp++;
      else if (['PL', 'LV', 'HD'].includes(cell.code)) other++;

      if (cell.minutes) mins += cell.minutes;
    });

    totalP += p;
    totalL += l;
    totalA += a;
    totalCL += cl;
    totalSL += sl;
    totalEL += el;
    totalLWP += lwp;
    totalOtherLeaves += other;

    return {
      person,
      empCode: getEmpCode(person),
      deptCode: getDeptCode(person.department),
      p, l, a, cl, sl, el, lwp, other,
      totalLeaves: cl + sl + el + lwp + other,
      hours: mins ? formatMinutes(mins) : '-'
    };
  });

  const totalLeavesAll = totalCL + totalSL + totalEL + totalLWP + totalOtherLeaves;

  // Table Columns Setup - Balanced column widths with comfortable Employee Name spacing
  // Total Width = 785 pt
  const cols = [
    { title: 'Emp Code', width: 95, align: 'left' },
    { title: 'Employee Name', width: 175, align: 'left' },
    { title: 'Dept', width: 60, align: 'center' },
    { title: 'P', width: 48, align: 'center', isPresent: true },
    { title: 'L', width: 44, align: 'center' },
    { title: 'A', width: 44, align: 'center' },
    { title: 'CL', width: 44, align: 'center' },
    { title: 'SL', width: 44, align: 'center' },
    { title: 'EL', width: 44, align: 'center' },
    { title: 'LWP', width: 46, align: 'center' },
    { title: 'Total Leaves', width: 68, align: 'center', isLeaves: true },
    { title: 'Logged Hours', width: 73, align: 'center' }
  ];

  function drawCleanHeader(isFirstPage = true) {
    let currentX = margin;
    const headerTop = 20;

    // 1. Render Logo with proper aspect ratio and no background
    if (logoInfo?.dataUrl) {
      try {
        const logoHeight = 28;
        const logoWidth = Math.min(110, Math.max(28, logoHeight * (logoInfo.aspect || 1)));
        doc.addImage(logoInfo.dataUrl, 'PNG', currentX, headerTop, logoWidth, logoHeight);
        currentX += logoWidth + 14;
      } catch {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(20, 20, 20);
        doc.text(tenantName || 'Pulse HRMS', currentX, headerTop + 18);
        currentX += 110;
      }
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(20, 20, 20);
      doc.text(tenantName || 'Pulse HRMS', currentX, headerTop + 18);
      currentX += 110;
    }

    // 2. Report Title & Period Details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text('HRMS ATTENDANCE & LEAVE SUMMARY REPORT', currentX, headerTop + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 100, 100);
    doc.text(`Organization: ${tenantName}   |   Period: ${monthName} ${department ? `   |   Dept: ${department}` : ''}`, currentX, headerTop + 25);

    // 3. Right: Staff count
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(110, 110, 110);
    doc.text(`Total Staff: ${people.length}`, pageWidth - margin - 65, headerTop + 16);

    // 4. Subtle bottom separator line
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.75);
    doc.line(margin, headerTop + 34, pageWidth - margin, headerTop + 34);
  }

  function drawKpiBar(startY) {
    const kpis = [
      { label: 'Active Employees', value: String(people.length), isPresent: false },
      { label: 'Present Count (P)', value: String(totalP), isPresent: true }, // Only Present has color
      { label: 'Late Punches (L)', value: String(totalL), isPresent: false },
      { label: 'Absences (A)', value: String(totalA), isPresent: false },
      { label: 'Leaves (CL/SL/EL/LWP)', value: String(totalLeavesAll), isPresent: false },
    ];

    const boxGap = 10;
    const totalGap = (kpis.length - 1) * boxGap;
    const boxWidth = (contentWidth - totalGap) / kpis.length;
    const boxHeight = 34;

    kpis.forEach((kpi, idx) => {
      const x = margin + idx * (boxWidth + boxGap);
      // Clean B&W box styling
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.75);
      doc.rect(x, startY, boxWidth, boxHeight, 'FD');

      // Left bar: Green for Present, neutral dark for rest
      if (kpi.isPresent) {
        doc.setFillColor(22, 163, 74); // Vibrant Green for P
      } else {
        doc.setFillColor(60, 60, 60);
      }
      doc.rect(x, startY, 3, boxHeight, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(115, 115, 115);
      doc.text(kpi.label, x + 8, startY + 12);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      if (kpi.isPresent) {
        doc.setTextColor(22, 163, 74); // Green for P
      } else {
        doc.setTextColor(20, 20, 20); // Monochrome black
      }
      doc.text(kpi.value, x + 8, startY + 28);
    });

    return startY + boxHeight + 14;
  }

  function renderTableHeader(currentY) {
    // Clean Minimal Table Header
    doc.setFillColor(246, 246, 246);
    doc.rect(margin, currentY, contentWidth, 20, 'F');
    doc.setDrawColor(190, 190, 190);
    doc.setLineWidth(0.75);
    doc.line(margin, currentY, margin + contentWidth, currentY);
    doc.line(margin, currentY + 20, margin + contentWidth, currentY + 20);

    let curX = margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 30);

    cols.forEach(col => {
      if (col.align === 'center') {
        doc.text(col.title, curX + col.width / 2, currentY + 13, { align: 'center' });
      } else {
        doc.text(col.title, curX + 6, currentY + 13);
      }
      curX += col.width;
    });
  }

  function drawFooterAndLegends(pageNum, totalPages) {
    const footerY = pageHeight - 38;

    // Hairline divider
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

    // Left: Attendance & Leave Code Legends
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(40, 40, 40);
    doc.text('LEGENDS:', margin, footerY + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(95, 95, 95);
    const legendText = 'P: Present  ·  L: Late  ·  A: Absent  ·  CL: Casual Leave  ·  SL: Sick Leave  ·  EL: Earned Leave  ·  LWP: Leave Without Pay  ·  HD: Half Day  ·  WFH: Work From Home  ·  WO: Weekly Off';
    doc.text(legendText, margin + 48, footerY + 8);

    // Bottom bar: Timestamp & pagination
    const bottomBarY = pageHeight - 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.text(`Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} IST · HR Confidential`, margin, bottomBarY);
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin - 45, bottomBarY);
  }

  // FIRST PAGE RENDERING
  drawCleanHeader(true);
  let y = drawKpiBar(62);

  renderTableHeader(y);
  y += 20;

  const rowHeight = 17;
  const maxTableY = pageHeight - 44;

  employeeSummaries.forEach((emp, index) => {
    // Check if next row overflows the page
    if (y + rowHeight > maxTableY) {
      doc.addPage();
      drawCleanHeader(false);
      y = 62;
      renderTableHeader(y);
      y += 20;
    }

    const isEven = index % 2 === 0;
    if (isEven) {
      doc.setFillColor(252, 252, 252);
      doc.rect(margin, y, contentWidth, rowHeight, 'F');
    }

    doc.setDrawColor(235, 235, 235);
    doc.setLineWidth(0.5);
    doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

    let curX = margin;
    const name = [emp.person.first_name, emp.person.last_name].filter(Boolean).join(' ') || emp.person.name || emp.empCode;

    // 1. Employee Code (Distinct column, left aligned with left margin)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 30, 30);
    doc.text(emp.empCode, curX + 6, y + 11.5);
    curX += cols[0].width;

    // 2. Employee Name (Clean separation from Emp Code)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(20, 20, 20);
    doc.text(String(name).slice(0, 30), curX + 6, y + 11.5);
    curX += cols[1].width;

    // 3. Dept Code
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    doc.text(emp.deptCode, curX + cols[2].width / 2, y + 11.5, { align: 'center' });
    curX += cols[2].width;

    // 4. P (Present) - COLORED GREEN ONLY
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(22, 163, 74); // Vibrant Green
    doc.text(String(emp.p), curX + cols[3].width / 2, y + 11.5, { align: 'center' });
    curX += cols[3].width;

    // 5. L (Late) - Monochrome
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(40, 40, 40);
    doc.text(String(emp.l), curX + cols[4].width / 2, y + 11.5, { align: 'center' });
    curX += cols[4].width;

    // 6. A (Absent) - Monochrome
    doc.text(String(emp.a), curX + cols[5].width / 2, y + 11.5, { align: 'center' });
    curX += cols[5].width;

    // 7. CL
    doc.text(String(emp.cl), curX + cols[6].width / 2, y + 11.5, { align: 'center' });
    curX += cols[6].width;

    // 8. SL
    doc.text(String(emp.sl), curX + cols[7].width / 2, y + 11.5, { align: 'center' });
    curX += cols[7].width;

    // 9. EL
    doc.text(String(emp.el), curX + cols[8].width / 2, y + 11.5, { align: 'center' });
    curX += cols[8].width;

    // 10. LWP
    doc.text(String(emp.lwp), curX + cols[9].width / 2, y + 11.5, { align: 'center' });
    curX += cols[9].width;

    // 11. Total Leaves - Monochrome Bold
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(String(emp.totalLeaves), curX + cols[10].width / 2, y + 11.5, { align: 'center' });
    curX += cols[10].width;

    // 12. Logged Hours - Monochrome
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70, 70, 70);
    doc.text(String(emp.hours), curX + cols[11].width / 2, y + 11.5, { align: 'center' });

    y += rowHeight;
  });

  // Stamp Footers & Legends on all pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooterAndLegends(i, totalPages);
  }

  // Save PDF
  const periodSlug = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const filename = `HRMS-Attendance-Leave-Report-${periodSlug}.pdf`;
  doc.save(filename);
}
