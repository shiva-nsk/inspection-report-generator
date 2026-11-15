// Small non-blocking messages at the bottom of the screen.

import { h, icon } from './dom.js';

function container() {
  let c = document.getElementById('toasts');
  if (!c) {
    c = h('div', { id: 'toasts', class: 'toasts', 'aria-live': 'polite' });
    document.body.append(c);
  }
  return c;
}

/**
 * toast('Saved', { type: 'info' | 'success' | 'error', timeout: ms,
 *                  action: { label: 'Undo', run: fn }, onExpire: fn })
 * onExpire runs when the toast closes without the action being used.
 */
export function toast(message, { type = 'info', timeout, action = null, onExpire = null } = {}) {
  const ms = timeout ?? (type === 'error' ? 9000 : action ? 7000 : 4000);
  let done = false;
  const el = h('div', { class: `toast toast-${type}`, role: type === 'error' ? 'alert' : 'status' });
  const close = (usedAction) => {
    if (done) return;
    done = true;
    clearTimeout(t);
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), 200);
    if (!usedAction && onExpire) onExpire();
  };
  el.append(
    icon(type === 'error' ? 'alert' : type === 'success' ? 'check' : 'file', 'toast-icon'),
    h('span', { class: 'toast-msg' }, message),
  );
  if (action) {
    el.append(h('button', {
      type: 'button',
      class: 'toast-action',
      onclick: () => { close(true); action.run(); },
    }, action.label));
  }
  el.append(h('button', { type: 'button', class: 'toast-close', 'aria-label': 'Dismiss message', onclick: () => close(false) }, icon('x')));
  container().append(el);
  const t = setTimeout(() => close(false), ms);
  return { close: () => close(false) };
}
