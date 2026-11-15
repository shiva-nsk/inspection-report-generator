// In-page dialogs (never window.alert / confirm / prompt).

import { h } from './dom.js';

/**
 * openDialog({ title, body: string | Node | Node[], buttons: [{ label, value, kind: 'primary'|'danger'|'', autofocus }], wide })
 * -> Promise<value> ('' when dismissed with Escape).
 */
export function openDialog({ title, body, buttons = [{ label: 'OK', value: 'ok', kind: 'primary' }], className = '' }) {
  return new Promise((resolve) => {
    const titleId = `dlg-title-${Math.random().toString(36).slice(2, 8)}`;
    const form = h('form', { method: 'dialog', class: 'dialog-form' });
    const dlg = h('dialog', { class: `dialog ${className}`.trim(), 'aria-labelledby': titleId });
    const bodyEl = h('div', { class: 'dialog-body' });
    (Array.isArray(body) ? body : [body]).forEach((b) => {
      if (b === null || b === undefined) return;
      bodyEl.append(typeof b === 'string' ? h('p', {}, b) : b);
    });
    const actions = h('div', { class: 'dialog-actions' },
      buttons.map((b) => h('button', {
        type: 'submit',
        value: b.value,
        class: `btn ${b.kind ? `btn-${b.kind}` : ''}`.trim(),
        autofocus: b.autofocus ? true : null,
      }, b.label)));
    form.append(h('h2', { id: titleId, class: 'dialog-title' }, title), bodyEl, actions);
    dlg.append(form);
    dlg.addEventListener('close', () => {
      resolve(dlg.returnValue || '');
      dlg.remove();
    });
    // click on the backdrop closes
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) dlg.close('');
    });
    document.body.append(dlg);
    dlg.returnValue = '';
    dlg.showModal();
  });
}

/** Resolves true when the user confirms. */
export async function confirmDialog({ title, message, confirmLabel = 'OK', cancelLabel = 'Cancel', danger = false }) {
  const value = await openDialog({
    title,
    body: message,
    buttons: [
      { label: cancelLabel, value: 'cancel', kind: '', autofocus: danger },
      { label: confirmLabel, value: 'ok', kind: danger ? 'danger' : 'primary', autofocus: !danger },
    ],
  });
  return value === 'ok';
}

export function messageDialog(title, message) {
  return openDialog({ title, body: message, buttons: [{ label: 'OK', value: 'ok', kind: 'primary', autofocus: true }] });
}
