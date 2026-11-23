export const isAppraisalRow = row => /^Appraisal (increment|bonus) \[/.test(row.name || '');
export function appraisalPayrollRows(changes,year,monthIndex) {
  if(!Number.isInteger(Number(year))||Number(year)<1900||Number(year)>2200||!Number.isInteger(monthIndex)||monthIndex<0||monthIndex>11)throw new Error('Choose a valid payroll period.');
  const first=new Date(Date.UTC(Number(year),monthIndex,1)),last=new Date(Date.UTC(Number(year),monthIndex+1,0)),days=last.getUTCDate();
  const start=first.toISOString().slice(0,10),end=last.toISOString().slice(0,10),rows=[];
  for(const change of changes) {
    if(change.effective_date>end)continue;
    const activeDays=change.effective_date<start?days:days-Number(change.effective_date.slice(8))+1;
    const increase=Number(change.revised_ctc)-Number(change.base_ctc);
    if(increase>0)rows.push({name:`Appraisal increment [${change.review_id}]`,amount:Math.round(increase/12*activeDays/days*100)/100});
    if(change.effective_date>=start&&Number(change.bonus)>0)rows.push({name:`Appraisal bonus [${change.review_id}]`,amount:Number(change.bonus)});
  }
  return rows;
}
export function withAppraisalRows(salary,rows) {
  return {...salary,custom_earnings:[...(salary.custom_earnings||[]).filter(row=>!isAppraisalRow(row)),...rows]};
}
