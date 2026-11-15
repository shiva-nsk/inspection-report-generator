// Floating progress panel for long jobs ("Adding photos 5/40", "Creating PDF").

import { h } from './dom.js';

const jobs = new Set();
let panel = null;

function getPanel() {
  if (!panel) {
    panel = document.getElementById('progress') || h('div', { id: 'progress', class: 'progress-panel' });
    panel.setAttribute('role', 'status');
    if (!panel.isConnected) document.body.append(panel);
  }
  return panel;
}

function render() {
  const p = getPanel();
  p.hidden = jobs.size === 0;
  p.replaceChildren(...[...jobs].map((job) => {
    const pct = job.total > 0 ? Math.round((job.done / job.total) * 100) : 0;
    const count = job.total > 0 ? `${job.done}/${job.total}` : '';
    return h('div', { class: 'progress-job' },
      h('div', { class: 'progress-label' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('span', {}, job.label), h('span', { class: 'progress-count' }, count)),
      h('div', { class: `progress-bar${job.total > 0 ? '' : ' indeterminate'}` }, h('span', { style: `width:${job.total > 0 ? pct : 100}%` })));
  }));
}

/** Returns { update(done, total?), setLabel(text), end() }. total 0 = unknown (animated bar). */
export function startProgress(label, total = 0) {
  const job = { label, total, done: 0 };
  jobs.add(job);
  render();
  return {
    update(done, newTotal) {
      job.done = done;
      if (newTotal !== undefined) job.total = newTotal;
      render();
    },
    setLabel(text) { job.label = text; render(); },
    end() { jobs.delete(job); render(); },
  };
}
