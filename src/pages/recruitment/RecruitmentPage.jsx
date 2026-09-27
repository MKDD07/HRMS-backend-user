import React from 'react';
import { TalentWorkspace } from '../talent/TalentWorkspace';

export function RecruitmentPage(props) {
  return <TalentWorkspace key="recruitment" module="recruitment" onShowToast={props.onShowToast} />;
}
