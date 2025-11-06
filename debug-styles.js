// Debug script for custom styles - VERSION 2.0
// This script logs version info and forces yellow button styling

(function() {
  console.log('%c🎨 Custom Styles VERSION 2.0 loaded', 'background: #FFD700; color: #000; padding: 5px; font-weight: bold;');

  // Wait for DOM to be ready
  function applyStyles() {
    console.log('🔍 Searching for Export All Images button...');

    // Find all buttons in the top bar
    const topBar = document.querySelector('body > main > div > div:first-child');
    if (!topBar) {
      console.warn('⚠️ Top bar not found');
      return;
    }

    const buttons = topBar.querySelectorAll('button');
    console.log(`📊 Found ${buttons.length} buttons in top bar`);

    // Find the Export All Images button by text content
    buttons.forEach((button, index) => {
      const text = button.textContent || '';
      console.log(`Button ${index}: "${text.trim().substring(0, 30)}..."`);

      if (text.includes('Export All Images') || text.includes('Exporting')) {
        console.log('✅ Found Export All Images button!');

        // Force yellow styling
        button.style.setProperty('background-color', '#FFD700', 'important');
        button.style.setProperty('color', '#000000', 'important');
        button.style.setProperty('font-weight', '600', 'important');
        button.style.setProperty('border', 'none', 'important');

        // Move button's parent to the right
        const parent = button.closest('div[class*="items-center"]') || button.parentElement;
        if (parent) {
          parent.style.setProperty('order', '999', 'important');
          parent.style.setProperty('margin-left', 'auto', 'important');
          console.log('✅ Applied yellow color and positioning to Export button');
        }
      }
    });

    // Log all button classes for debugging
    console.group('🔧 Button classes for debugging:');
    buttons.forEach((btn, i) => {
      if (btn.textContent.trim()) {
        console.log(`Button ${i}: ${btn.className}`);
      }
    });
    console.groupEnd();
  }

  // Try to apply immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyStyles);
  } else {
    applyStyles();
  }

  // Also try after a delay (for dynamic content)
  setTimeout(applyStyles, 1000);
  setTimeout(applyStyles, 3000);
})();
