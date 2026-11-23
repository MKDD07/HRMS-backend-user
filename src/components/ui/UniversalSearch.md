# UniversalSearch

Reusable controlled search. The outlined design follows the reference: 42px tall, subtle surface, thin border, 5px corners, search icon, optional keyboard badge.

```jsx
<UniversalSearch id="employee-search" value={query} onChange={setQuery}
  label="Search employees" placeholder="Search employees..." shortcut="k" />
```

Edit UniversalSearch.scss to change the snippets. The header's Search styles button opens their showcase: searchable preview cards on the left and JSX/SCSS code on the right. Click View code to inspect a snippet. Share its ID and the intended location to request integration.

Use preview to bypass page assignments in showcase previews. Only add shortcut to one field per page; it binds Ctrl/Cmd plus the specified key. Parent callbacks retain the existing filtering behavior.
