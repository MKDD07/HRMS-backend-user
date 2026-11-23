# Universal bordered card

Use `TenantPanel` for a full card, or `TenantPanelHeader` inside an existing
container. Both use the same `tenant-panel-head` snippet and stylesheet.

```jsx
import { TenantPanel } from '../../components/ui/TenantPanel';
import { Download, RefreshCw } from 'lucide-react';

<TenantPanel
  title="Attendance trend"
  subtitle="Recorded attendance in the selected period"
  actions={[
    { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: refresh, loading },
    { id: 'export', label: 'Export', icon: Download, onClick: exportCsv, disabled: loading },
  ]}
>
  {chart}
</TenantPanel>
```

Actions use universal `Button` props with `id`, `label`, and optional
`visible: false`. Only the first two visible actions render. Buttons always use
`size="sm"`; the default variant is `outline`. Keep filters and tabs in the
card body. Use `headingLevel={3}` for nested sections and `icon={Mail}` for an
optional heading icon. No page-specific heading or button CSS is needed.
