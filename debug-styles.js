// Debug script for custom styles - VERSION 3.0
// This script logs version info and forces correct button order + yellow styling

(function() {
  console.log('%c🎨 Custom Styles VERSION 3.0 loaded', 'background: #FFD700; color: #000; padding: 5px; font-weight: bold;');

  // Wait for DOM to be ready
  function applyStyles() {
    console.log('🔍 Applying custom styles and order...');

    // Find all buttons in the top bar
    const topBar = document.querySelector('body > main > div > div:first-child');
    if (!topBar) {
      console.warn('⚠️ Top bar not found');
      return;
    }

    // Get all direct children of top bar
    const topBarChildren = Array.from(topBar.children);
    console.log(`📦 Found ${topBarChildren.length} top bar elements`);

    topBarChildren.forEach((element, index) => {
      const text = element.textContent || '';
      const shortText = text.trim().substring(0, 50);

      // 1. iPhone/iPad device selector - ORDER 1
      if (text.includes('iPhone') || text.includes('iPad')) {
        element.style.setProperty('order', '1', 'important');
        console.log(`✅ [1] Device Selector: "${shortText}"`);
      }

      // 2. Language selector (Russian, English, etc.) - ORDER 2
      else if (element.querySelector('button[role="combobox"]') ||
               text.match(/Russian|English|Spanish|French|German|Chinese/)) {
        element.style.setProperty('order', '2', 'important');
        console.log(`✅ [2] Language Selector: "${shortText}"`);
      }

      // 3. Import/Export JSON buttons - ORDER 3
      else if (text.includes('Import JSON') || text.includes('Export JSON')) {
        element.style.setProperty('order', '3', 'important');
        console.log(`✅ [3] Import/Export JSON: "${shortText}"`);
      }

      // 4. Export All Images - ORDER 999 (rightmost)
      else if (text.includes('Export All Images') || text.includes('Exporting')) {
        element.style.setProperty('order', '999', 'important');
        element.style.setProperty('margin-left', 'auto', 'important');

        // Also force yellow color on the button itself
        const button = element.querySelector('button');
        if (button) {
          button.style.setProperty('background-color', '#FFD700', 'important');
          button.style.setProperty('color', '#000000', 'important');
          button.style.setProperty('font-weight', '600', 'important');
          button.style.setProperty('border', 'none', 'important');
        }
        console.log(`✅ [999] Export All Images (YELLOW): "${shortText}"`);
      }

      // 5. Project selector - ORDER 0 (first, before device selector)
      else if (text.includes('Project') || text.includes('New')) {
        element.style.setProperty('order', '0', 'important');
        console.log(`✅ [0] Project Selector: "${shortText}"`);
      }

      else {
        console.log(`ℹ️ [?] Other element: "${shortText}"`);
      }
    });

    // Log summary
    console.log('🎯 Expected order: Project → iPhone/iPad → Language → Import/Export → 🟡 Export All Images');
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
