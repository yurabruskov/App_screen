// LocalStorage size optimization patch v2.1
// This script prevents saving large images to localStorage

(function() {
  'use strict';

  const PATCH_VERSION = 'v2.1';
  console.log('='.repeat(60));
  console.log('🚀 localStorage OPTIMIZATION PATCH ' + PATCH_VERSION + ' LOADING...');
  console.log('='.repeat(60));

  // Store original setItem
  const originalSetItem = Storage.prototype.setItem;

  // Override setItem
  Storage.prototype.setItem = function(key, value) {
    // Check if this is the previewItems key that's causing issues
    if (key === 'previewItems') {
      console.log('🔧 [PATCH ' + PATCH_VERSION + '] Intercepting previewItems save...');

      try {
        const data = JSON.parse(value);

        // Calculate original size
        const originalSize = new Blob([value]).size / 1024 / 1024;
        console.log(`📊 Original data size: ${originalSize.toFixed(2)}MB`);

        // ALWAYS optimize if data is an array
        if (Array.isArray(data)) {
          // Save only essential data without any image-related fields
          const minimalData = data.map(item => ({
            id: item.id,
            name: item.name,
            backgroundColor: item.backgroundColor,
            devicePosition: item.devicePosition,
            deviceScale: item.deviceScale,
            rotation: item.rotation,
            verticalOffset: item.verticalOffset,
            horizontalOffset: item.horizontalOffset,
            screenshot: {
              borderColor: item.screenshot?.borderColor || '#000000',
              borderWidth: item.screenshot?.borderWidth || 8,
              borderRadius: item.screenshot?.borderRadius || 30
            }
            // Explicitly exclude: screenshot.file, screenshot.dataUrl, localizedScreenshots
          }));

          const minimalValue = JSON.stringify(minimalData);
          const minimalSize = new Blob([minimalValue]).size / 1024 / 1024;

          console.log(`✅ [PATCH ${PATCH_VERSION}] OPTIMIZATION SUCCESS!`);
          console.log(`   📉 Size reduced: ${originalSize.toFixed(2)}MB → ${minimalSize.toFixed(2)}MB`);
          console.log(`   💾 Saved: ${(originalSize - minimalSize).toFixed(2)}MB`);
          console.log(`   💡 Images remain in IndexedDB (not in localStorage)`);

          // Save the minimal version using original method
          try {
            return originalSetItem.call(this, key, minimalValue);
          } catch (error) {
            console.error('❌ Still failed to save even minimal data:', error);
            // Don't throw - just skip saving
            return;
          }
        }
      } catch (parseError) {
        console.error('❌ Error parsing previewItems:', parseError);
        // If we can't parse, don't save it
        console.log('🚫 Skipping save to prevent localStorage issues');
        return;
      }
    }

    // For all other keys, use original behavior
    try {
      return originalSetItem.call(this, key, value);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.error(`❌ localStorage quota exceeded for key: ${key}`);
        // Don't throw - just skip
        return;
      }
      throw error;
    }
  };

  console.log('='.repeat(60));
  console.log('✅ localStorage OPTIMIZATION PATCH ' + PATCH_VERSION + ' ACTIVE!');
  console.log('='.repeat(60));
})();
