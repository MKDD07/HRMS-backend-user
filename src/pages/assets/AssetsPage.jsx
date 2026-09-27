import React from 'react';
import { TalentWorkspace } from '../talent/TalentWorkspace';

export function AssetsPage(props) {
  return <TalentWorkspace key="assets" module="assets" onShowToast={props.onShowToast} currentUser={props.currentUser} />;
}
