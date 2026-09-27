import React from 'react';
import { TalentWorkspace } from '../talent/TalentWorkspace';

export function PerformancePage(props) {
  return <TalentWorkspace key="performance" module="performance" onShowToast={props.onShowToast} />;
}
