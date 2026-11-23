# Universal tenant header

Uses the existing `Button` component and global button styles. Header styles are
imported by the component; importing dashboard styles is not required.

```jsx
import { Plus, Download, Settings } from 'lucide-react';
import { TenantHeader } from '../../components/ui/TenantHeader';

const headerSettings = {
  subheading: 'WORKSPACE / PEOPLE',
  heading: 'Employees',
  paragraph: 'Manage your employee directory.',
  refresh: { label: 'Refresh employees' },
  buttons: [
    { id: 'export', label: 'Export', variant: 'outline' },
    { id: 'settings', label: 'Settings', variant: 'fadeout' },
    { id: 'create', label: 'Add employee', variant: 'colored' },
  ],
};

// Inside your page component:
<TenantHeader
  settings={headerSettings}
  actions={{
    refresh: { onClick: reload, loading },
    export: { onClick: exportEmployees, icon: Download },
    settings: { onClick: openSettings, icon: Settings },
    create: { onClick: addEmployee, icon: Plus, disabled: loading },
  }}
/>
```

`TenantHeader.schema.json` describes the serializable settings for editors or
configuration validation. All fields are optional. Omit empty text fields,
set `refresh: false`, or omit `buttons` for a text-only header. No decorative
period or role badge is added automatically.

Use unique button IDs (reserve `refresh` for the refresh action). There are at
most three ordinary buttons plus the optional refresh icon. The schema limits
the array to three; the component also caps visible buttons at three. Buttons
support every existing universal Button variant. Set `visible: false` in a
button's settings or action state to hide it. Refresh visibility and label can
be configured in its settings object.

Callbacks, Lucide icon components, loading, disabled, and permission-based
visibility belong in `actions`, keyed by ID. Buttons without a callback are
disabled. Loading uses the shared Button loading and disabled behavior. Actions
sit on the right on desktop and wrap below the text on narrower screens.

For toggle actions, pass `aria-expanded`, `aria-pressed`, or `aria-controls` in
the action state. `id`, `title`, and `active` are also supported. Convert
permission expressions to booleans, for example `visible: !!currentUser?.admin`.
The header uses the same typography across page containers; keep filters,
upload inputs, profile cards, and section headings outside it.
