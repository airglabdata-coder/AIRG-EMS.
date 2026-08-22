// Mobile Interactivity Helper for EMS Portal

const initMobileUI = () => {
  console.log("EMS Mobile Interactivity Initialized.");
  
  // --- Sidebar Mobile Navigation ---
  const mobileHamburger = document.getElementById('mobile-hamburger');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');

  function closeSidebar() {
    if (sidebar) sidebar.classList.remove('open');
    if (mobileHamburger) mobileHamburger.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('open');
  }

  function openSidebar() {
    if (sidebar) sidebar.classList.add('open');
    if (mobileHamburger) mobileHamburger.classList.add('open');
    if (sidebarOverlay) sidebarOverlay.classList.add('open');
  }

  if (mobileHamburger) {
    mobileHamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (sidebar && sidebar.classList.contains('open')) {
        closeSidebar();
      } else {   
        openSidebar();
      }
    });
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeSidebar);
  }

  // Auto-close sidebar on mobile when a menu item is clicked
  document.addEventListener('click', (e) => {
    const menuItem = e.target.closest('.menu-item');
    if (menuItem) {
      closeSidebar();
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

