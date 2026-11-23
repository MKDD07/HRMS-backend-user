import React from 'react';
import { Download } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
export function DownloadIconButton({onClick,title='Download payslip PDF',size='sm',disabled=false}) {
 return <Button size={size} variant="outline" iconOnly icon={Download} onClick={onClick} disabled={disabled} title={title} aria-label={title}/>;
}
