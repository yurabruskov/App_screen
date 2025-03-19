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
  // Create a zip file if we have multiple languages
  const languages = Object.keys(localizedContent)
  const useZip = languages.length > 1
  const zip = useZip ? new JSZip() : null

  // Process each language
  for (const lang of languages) {
    // Update the canvas with the current language content
    const titleElement = canvasElement.querySelector("h2")
    const descriptionElement = canvasElement.querySelector("p")

    if (titleElement && localizedContent[lang]?.title) {
      titleElement.textContent = localizedContent[lang].title
    }

    if (descriptionElement && localizedContent[lang]?.description) {
      descriptionElement.textContent = localizedContent[lang].description
    }

    try {
      // Capture the canvas as an image
      const canvas = await html2canvas(canvasElement, {
        scale: 2, // Higher scale for better quality
        useCORS: true,
        allowTaint: true,
        backgroundColor: settings.backgroundColor,
      })

      // Convert to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), "image/png", 1.0)
      })

      if (useZip && zip) {
        // Add to zip file
        zip.file(`${lang}_banner.png`, blob)
      } else {
        // Download directly
        saveBlob(blob, `${lang}_banner.png`)
      }
    } catch (error) {
      console.error("Error capturing screenshot:", error)
    }
  }

  // Download the zip file if needed
  if (useZip && zip) {
    try {
      const content = await zip.generateAsync({ type: "blob" })
      saveBlob(content, "app_store_banners.zip")
    } catch (error) {
      console.error("Error generating zip file:", error)
    }
  }
}

