// Mobile Interactivity Helper for EMS Portal

window.toggleMobileSidebar = function(e) {
  if (e) {
    if (e.stopPropagation) e.stopPropagation();
    if (e.preventDefault) e.preventDefault();
  }
  const sidebar = document.getElementById('sidebar');
  const hamburger = document.getElementById('mobile-hamburger');
  const overlay = document.getElementById('sidebar-overlay');

  if (sidebar && sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
    if (hamburger) hamburger.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  } else {
    if (sidebar) sidebar.classList.add('open');
    if (hamburger) hamburger.classList.add('open');
    if (overlay) overlay.classList.add('open');
  }
};

window.closeMobileSidebar = function() {
  const sidebar = document.getElementById('sidebar');
  const hamburger = document.getElementById('mobile-hamburger');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (hamburger) hamburger.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
};

const initMobileUI = () => {
  console.log("EMS Mobile Interactivity Initialized.");
  
  // --- Sidebar Mobile Navigation ---
  const mobileHamburger = document.getElementById('mobile-hamburger');
  const sidebarOverlay = document.getElementById('sidebar-overlay');

  if (mobileHamburger) {
    mobileHamburger.addEventListener('click', window.toggleMobileSidebar);
    mobileHamburger.addEventListener('touchstart', window.toggleMobileSidebar, { passive: false });
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', window.closeMobileSidebar);
    sidebarOverlay.addEventListener('touchstart', window.closeMobileSidebar, { passive: false });
  }

  // Auto-close sidebar on mobile when a menu item is clicked
  document.addEventListener('click', (e) => {
    const menuItem = e.target.closest('.menu-item');
    if (menuItem) {
      window.closeMobileSidebar();
    }
  });

  // --- Table Cell Labels for Responsive Card Layout ---
  function updateTableLabels() {
    document.querySelectorAll('table').forEach(table => {
      // Bypasses session logs table or special compact tables
      if (table.classList.contains('session-logs-table')) {
        table.querySelectorAll('td').forEach(td => td.removeAttribute('data-label'));
        return;
      }

      // Find headers
      const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
      if (headers.length === 0) return;

      // Map headers to cells
      table.querySelectorAll('tbody tr').forEach(tr => {
        // Skip section header / month summary rows or full-width colspan cells
        if (tr.classList.contains('month-header-row') || tr.classList.contains('month-group-header-row') || tr.querySelector('td[colspan]')) {
          tr.querySelectorAll('td').forEach(td => td.removeAttribute('data-label'));
          return;
        }

        tr.querySelectorAll('td').forEach((td, idx) => {
          if (headers[idx] && !td.getAttribute('data-label')) {
            td.setAttribute('data-label', headers[idx]);
          }
        });
      });
    });
  }

  // Run on initial load
  updateTableLabels();

  // Watch for DOM changes (tables are dynamically re-rendered in app.js)
  const tableObserver = new MutationObserver(() => {
    updateTableLabels();
  });
  tableObserver.observe(document.body, { childList: true, subtree: true });

  // --- Communications Hub List-Detail View Toggle ---
  const commLayout = document.querySelector('.comm-layout');
  const commSidebar = document.querySelector('.comm-sidebar');

  if (commSidebar && commLayout) {
    commSidebar.addEventListener('click', (e) => {
      // Clicked on a tab button that switches to full-feed view directly
      const tabBtn = e.target.closest('.comm-tab-btn');
      if (tabBtn) {
        const id = tabBtn.id;
        if (id === 'comm-tab-announcements' || id === 'comm-tab-notices' || id === 'comm-tab-sms') {
          commLayout.classList.add('show-chat');
        }
      }

      // Clicked on a direct chat or notices list item
      const itemLink = e.target.closest('.comm-item-link');
      if (itemLink) {
        commLayout.classList.add('show-chat');
      }
    });
  }

  // Handle all mobile back button clicks via event delegation
  document.addEventListener('click', (e) => {
    const backBtn = e.target.closest('.comm-back-btn');
    if (backBtn && commLayout) {
      commLayout.classList.remove('show-chat');
    }
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMobileUI);
} else {
  initMobileUI();
}

