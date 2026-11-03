(function () {
  'use strict';
  const sidebar = document.getElementById('adminSidebar');
  const toggle = document.getElementById('navToggle');
  const close = document.getElementById('navClose');
  const backdrop = document.getElementById('navBackdrop');
  const main = document.querySelector('.main');
  const mobile = window.matchMedia('(max-width: 900px)');
  let opener;

  function setNavigation(open) {
    open = open && mobile.matches;
    document.body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    backdrop.hidden = !open;
    sidebar.inert = mobile.matches && !open;
    main.inert = open;
    if (open) {
      opener = document.activeElement;
      sidebar.setAttribute('role', 'dialog');
      sidebar.setAttribute('aria-modal', 'true');
      close.focus();
      const active = sidebar.querySelector('.side-link.active');
      if (active) active.scrollIntoView({ block: 'nearest' });
    } else {
      sidebar.removeAttribute('role');
      sidebar.removeAttribute('aria-modal');
      if (opener && opener.isConnected) opener.focus();
      opener = null;
    }
  }
  if (sidebar && toggle && close && backdrop && main) {
    toggle.onclick = () => setNavigation(true);
    close.onclick = backdrop.onclick = () => setNavigation(false);
    mobile.addEventListener('change', () => setNavigation(false));
    document.addEventListener('keydown', event => {
      if (!document.body.classList.contains('nav-open')) return;
      if (event.key === 'Escape') { event.preventDefault(); setNavigation(false); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(sidebar.querySelectorAll('a[href],button:not(:disabled)')).filter(el => el.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    setNavigation(false);
  }

  const viewport = window.visualViewport;
  if (viewport) {
    const updateViewport = () => {
      document.documentElement.style.setProperty('--admin-viewport-height', viewport.height + 'px');
      document.documentElement.style.setProperty('--admin-viewport-top', viewport.offsetTop + 'px');
    };
    viewport.addEventListener('resize', updateViewport);
    viewport.addEventListener('scroll', updateViewport);
    updateViewport();
  }

  function labelTables() {
    document.querySelectorAll('table.tbl').forEach(table => {
      const headers = Array.from(table.querySelectorAll('tr')).find(row => row.querySelector('th'));
      if (!headers) return;
      headers.classList.add('mobile-table-head');
      const labels = Array.from(headers.children, cell => cell.textContent.trim());
      table.classList.add('mobile-records');
      table.querySelectorAll('tr').forEach(row => {
        if (row === headers) return;
        Array.from(row.children).forEach((cell, index) => {
          const label = labels[index] || '';
          if (cell.dataset.label !== label) cell.dataset.label = label;
          cell.classList.toggle('record-actions', label === '操作');
          if (label !== '操作' && cell.colSpan <= 1 && !cell.querySelector(':scope > .record-value')) {
            const value = document.createElement('div');
            value.className = 'record-value';
            while (cell.firstChild) value.appendChild(cell.firstChild);
            cell.appendChild(value);
          }
        });
      });
    });
  }
  labelTables();
  const content = document.querySelector('.content');
  if (content) new MutationObserver(labelTables).observe(content, { childList: true, subtree: true });
})();
