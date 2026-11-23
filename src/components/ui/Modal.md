# Universal modal

Use `Modal` for new dialogs. Use `ModalFrame` when an existing editor controls a native dialog ref with `showModal()` and `close()`.

Both use the same theme, border, shadow, backdrop, spacing, focus styles, and size scale. Native dialogs trap focus and keep nested confirmations above their parent. Background scrolling remains locked until the last dialog closes.

```jsx
<Modal
  isOpen={open}
  onClose={() => setOpen(false)}
  title="Create announcement"
  size="lg"
  busy={saving}
>
  <form onSubmit={save}>...</form>
</Modal>
```

- Sizes: `sm`, `md`, `lg`, `xl`, `full`, and `drawer`.
- `busy` disables the close button, Escape dismissal, and backdrop dismissal.
- `closeOnBackdrop` and `closeOnEscape` default to `true`.
- `subtitle` supplies an accessible description; `footer` accepts shared `Button` actions.
- Keep unsaved-change confirmation in the editor's `onClose` callback.
- Give `ModalFrame` an `aria-label` or `aria-labelledby`. Prevent its `onCancel` default and call your guarded close callback to protect pending work.
- Keep page-specific content layouts; put modal shell styling in `Modal.scss`.
