"use client"

import JSZip from "jszip"
import html2canvas from "html2canvas"

// Helper function to save a blob as a file
function saveBlob(blob: Blob, fileName: string) {
  // Create a URL for the blob
  const url = URL.createObjectURL(blob)

  // Create a temporary link element
  const link = document.createElement("a")
  link.href = url
  link.download = fileName

  // Append to the document, click it, and remove it
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Clean up the URL
  URL.revokeObjectURL(url)
}

export async function exportBanners(
  canvasElement: HTMLElement,
  localizedContent: Record<string, { title: string; description: string }>,
  screenshots: any[],
  settings: any,
) {
  console.log('exportBanners called with languages:', Object.keys(localizedContent));
  
  // Create a zip file if we have multiple languages
  const languages = Object.keys(localizedContent)
  // Используем ZIP, даже если всего один язык для согласованности
  const zip = new JSZip();
  const bannerName = settings.name || 'banner'

  // Process each language
  for (const lang of languages) {
    console.log(`Processing language: ${lang}`);
    
    // Update the canvas with the current language content
    const titleElement = canvasElement.querySelector("h2")
    const descriptionElement = canvasElement.querySelector("p")

    if (titleElement && localizedContent[lang]?.title) {
      titleElement.textContent = localizedContent[lang].title
      console.log(`Set title for ${lang}: ${localizedContent[lang].title}`);
    } else {
      console.warn(`Title element or content not found for ${lang}`);
    }

    if (descriptionElement && localizedContent[lang]?.description) {
      descriptionElement.textContent = localizedContent[lang].description
      console.log(`Set description for ${lang}: ${localizedContent[lang].description}`);
    } else {
      console.warn(`Description element or content not found for ${lang}`);
    }

    try {
      console.log(`Capturing canvas for ${lang}`);
      
      // Capture the canvas as an image
      const canvas = await html2canvas(canvasElement, {
        scale: 2, // Higher scale for better quality
        useCORS: true,
        allowTaint: true,
        backgroundColor: settings.backgroundColor,
        logging: true, // Включаем логирование html2canvas
      })

      console.log(`Canvas captured for ${lang}, converting to blob`);
      
      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        try {
          canvas.toBlob((blob) => {
            if (blob) {
              console.log(`Blob created for ${lang} with size: ${blob.size} bytes`);
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob from canvas'));
            }
          }, "image/png", 1.0);
        } catch (error) {
          console.error('Error in canvas.toBlob:', error);
          reject(error);
        }
      })

      // Add to zip file with banner name included in filename
      const filename = `${bannerName}_${lang}.png`;
      console.log(`Adding ${filename} to ZIP`);
      zip.file(filename, blob);
    } catch (error) {
      console.error(`Error capturing screenshot for ${lang}:`, error)
    }
  }

  // Download the zip file
  try {
    console.log('Generating ZIP file from all banners');
    const content = await zip.generateAsync({ 
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: {
        level: 6
      } 
    })
    console.log(`ZIP file created with size: ${content.size} bytes, downloading...`);
    saveBlob(content, "app_store_banners.zip")
  } catch (error) {
    console.error("Error generating zip file:", error)
  }
}

