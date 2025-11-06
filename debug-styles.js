// Debug script for custom styles - VERSION 3.2
// This script logs version info and forces correct button order + yellow styling
// Now searches for buttons DEEPER in DOM tree, not just direct children

(function() {
  console.log('%c🎨 Custom Styles VERSION 3.2 loaded', 'background: #FFD700; color: #000; padding: 5px; font-weight: bold;');

  let appliedCount = 0;
  const MAX_APPLIES = 5;

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
      if (topBar) {
        console.log(`✅ Found top bar using selector: ${selector}`);
        break;
      }
    }

    if (!topBar) {
      console.warn('⚠️ Top bar not found, will retry...');
      return;
    }

    // Apply flexbox to parent
    topBar.style.setProperty('display', 'flex', 'important');
    topBar.style.setProperty('flex-wrap', 'wrap', 'important');
    topBar.style.setProperty('align-items', 'center', 'important');
    topBar.style.setProperty('gap', '0.5rem', 'important');

    // Find ALL buttons and selectors INSIDE the top bar (search deep)
    const allButtons = topBar.querySelectorAll('button');
    console.log(`🔘 Found ${allButtons.length} buttons in top bar`);

    let foundElements = {
      device: null,
      language: null,
      importExport: [],
      exportAll: null,
      project: null
    };

    // Find each button and its parent wrapper
    allButtons.forEach(button => {
      const text = button.textContent || '';
      const shortText = text.trim().substring(0, 30);

      // Find the wrapper element (usually a div that's a direct child of topBar)
      let wrapper = button.parentElement;
      let depth = 0;
      while (wrapper && wrapper !== topBar && wrapper.parentElement !== topBar && depth < 5) {
        wrapper = wrapper.parentElement;
        depth++;
      }

      // If we found a valid wrapper that's a child of topBar
      if (wrapper && wrapper.parentElement === topBar) {

        if (text.includes('Export All Images') || text.includes('Exporting')) {
          wrapper.style.setProperty('order', '999', 'important');
          wrapper.style.setProperty('margin-left', 'auto', 'important');

          button.style.setProperty('background-color', '#FFD700', 'important');
          button.style.setProperty('color', '#000000', 'important');
          button.style.setProperty('font-weight', '600', 'important');
          button.style.setProperty('border', 'none', 'important');

          foundElements.exportAll = wrapper;
          console.log(`✅ [999] 🟡 Export All Images: "${shortText}"`);
        }
        else if (text.includes('iPhone') || text.includes('iPad')) {
          wrapper.style.setProperty('order', '1', 'important');
          foundElements.device = wrapper;
          console.log(`✅ [1] Device Selector (${shortText})`);
        }
        else if (text.includes('Import JSON')) {
          wrapper.style.setProperty('order', '3', 'important');
          foundElements.importExport.push(wrapper);
          console.log(`✅ [3] Import JSON: "${shortText}"`);
        }
        else if (text.includes('Export JSON')) {
          wrapper.style.setProperty('order', '3', 'important');
          foundElements.importExport.push(wrapper);
          console.log(`✅ [3] Export JSON: "${shortText}"`);
        }
      }
    });

    // Find language selector (might be a combobox, not a button)
    const languageSelector = topBar.querySelector('button[role="combobox"]');
    if (languageSelector) {
      let wrapper = languageSelector.parentElement;
      let depth = 0;
      while (wrapper && wrapper !== topBar && wrapper.parentElement !== topBar && depth < 5) {
        wrapper = wrapper.parentElement;
        depth++;
      }

      if (wrapper && wrapper.parentElement === topBar) {
        wrapper.style.setProperty('order', '2', 'important');
        foundElements.language = wrapper;
        const text = languageSelector.textContent?.trim().substring(0, 20) || 'Language';
        console.log(`✅ [2] Language Selector: "${text}"`);
      }
    }

    // Find project selector area (might not be a button)
    const topBarChildren = Array.from(topBar.children);
    topBarChildren.forEach(child => {
      const text = child.textContent || '';
      if ((text.includes('Project') || text.includes('New')) && !text.includes('Export')) {
        // Only set order if it's not already set
        if (!foundElements.device || child !== foundElements.device) {
          if (!foundElements.language || child !== foundElements.language) {
            if (!foundElements.importExport.includes(child)) {
              if (child !== foundElements.exportAll) {
                child.style.setProperty('order', '0', 'important');
                foundElements.project = child;
                const shortText = text.trim().substring(0, 30);
                console.log(`✅ [0] Project Area: "${shortText}"`);
              }
            }
          }
        }
      }
    });

    const hasRequired = foundElements.device && foundElements.exportAll;
    if (hasRequired) {
      console.log('🎯 Expected order: [0] Project → [1] iPhone/iPad → [2] Language → [3] Import/Export → [999] 🟡 Export All Images');
      console.log('✅ Core elements found and styled!');
      appliedCount = MAX_APPLIES; // Stop retrying
    } else {
      console.warn('⚠️ Not all core elements found:', {
        device: !!foundElements.device,
        language: !!foundElements.language,
        importExport: foundElements.importExport.length,
        exportAll: !!foundElements.exportAll,
        project: !!foundElements.project
      });
    }
  }

  // MutationObserver to watch for React renders
  const observer = new MutationObserver((mutations) => {
    const hasNewNodes = mutations.some(mutation => mutation.addedNodes.length > 0);
    if (hasNewNodes) {
      applyStyles();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Initial attempts
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyStyles);
  } else {
    applyStyles();
  }

  setTimeout(applyStyles, 500);
  setTimeout(applyStyles, 1000);
  setTimeout(applyStyles, 2000);
  setTimeout(applyStyles, 3000);
})();
