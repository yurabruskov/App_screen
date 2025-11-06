// Debug script for custom styles - VERSION 3.1
// This script logs version info and forces correct button order + yellow styling
// Now with MutationObserver to wait for React content

(function() {
  console.log('%c🎨 Custom Styles VERSION 3.1 loaded', 'background: #FFD700; color: #000; padding: 5px; font-weight: bold;');

  let appliedCount = 0;
  const MAX_APPLIES = 5;

  // Wait for DOM to be ready
  function applyStyles() {
    if (appliedCount >= MAX_APPLIES) {
      console.log('⏹️ Stopped after', MAX_APPLIES, 'attempts');
      return;
    }
    appliedCount++;

    console.log(`🔍 Applying custom styles and order... (attempt ${appliedCount}/${MAX_APPLIES})`);

    // Try multiple selectors to find the top bar
    const topBarSelectors = [
      'body > main > div > div:first-child',
      'main > div > div:first-child',
      'main div[class*="flex"]:first-child',
      'body > main > div:first-child > div:first-child'
    ];

    let topBar = null;
    for (const selector of topBarSelectors) {
      topBar = document.querySelector(selector);
      if (topBar && topBar.children.length > 0) {
        console.log(`✅ Found top bar using selector: ${selector}`);
        break;
      }
    }

    if (!topBar || topBar.children.length === 0) {
      console.warn('⚠️ Top bar not found or empty, will retry...');
      return;
    }

    // Get all direct children of top bar
    const topBarChildren = Array.from(topBar.children);
    console.log(`📦 Found ${topBarChildren.length} top bar elements`);

    if (topBarChildren.length === 0) {
      console.warn('⚠️ No children in top bar, will retry...');
      return;
    }

    // Apply flexbox to parent
    topBar.style.setProperty('display', 'flex', 'important');
    topBar.style.setProperty('flex-wrap', 'wrap', 'important');
    topBar.style.setProperty('align-items', 'center', 'important');
    topBar.style.setProperty('gap', '0.5rem', 'important');

    let foundElements = {
      project: false,
      device: false,
      language: false,
      importExport: false,
      exportAll: false
    };

    topBarChildren.forEach((element, index) => {
      const text = element.textContent || '';
      const shortText = text.trim().substring(0, 50);

      // 1. iPhone/iPad device selector - ORDER 1
      if (text.includes('iPhone') || text.includes('iPad')) {
        element.style.setProperty('order', '1', 'important');
        console.log(`✅ [1] Device Selector: "${shortText}"`);
        foundElements.device = true;
      }

      // 2. Language selector (Russian, English, etc.) - ORDER 2
      else if (element.querySelector('button[role="combobox"]') ||
               text.match(/Russian|English|Spanish|French|German|Chinese|Czech|Korean|Japanese|Italian/)) {
        element.style.setProperty('order', '2', 'important');
        console.log(`✅ [2] Language Selector: "${shortText}"`);
        foundElements.language = true;
      }

      // 3. Import/Export JSON buttons - ORDER 3
      else if (text.includes('Import JSON') || text.includes('Export JSON')) {
        element.style.setProperty('order', '3', 'important');
        console.log(`✅ [3] Import/Export JSON: "${shortText}"`);
        foundElements.importExport = true;
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
        foundElements.exportAll = true;
      }

      // 5. Project selector - ORDER 0 (first, before device selector)
      else if (text.includes('Project') || text.includes('New')) {
        element.style.setProperty('order', '0', 'important');
        console.log(`✅ [0] Project Selector: "${shortText}"`);
        foundElements.project = true;
      }

      else {
        console.log(`ℹ️ [?] Other element: "${shortText}"`);
      }
    });

    // Check if we found all important elements
    const allFound = foundElements.device && foundElements.language && foundElements.exportAll;
    if (allFound) {
      console.log('🎯 Expected order: Project → iPhone/iPad → Language → Import/Export → 🟡 Export All Images');
      console.log('✅ All elements found and styled!');
      appliedCount = MAX_APPLIES; // Stop retrying
    } else {
      console.warn('⚠️ Not all elements found:', foundElements);
    }
  }

  // Observer to watch for DOM changes (React renders)
  const observer = new MutationObserver((mutations) => {
    // Check if new nodes were added
    const hasNewNodes = mutations.some(mutation => mutation.addedNodes.length > 0);
    if (hasNewNodes) {
      applyStyles();
    }
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Try to apply immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyStyles);
  } else {
    applyStyles();
  }

  // Also try after delays (for dynamic content)
  setTimeout(applyStyles, 500);
  setTimeout(applyStyles, 1000);
  setTimeout(applyStyles, 2000);
  setTimeout(applyStyles, 3000);
})();
