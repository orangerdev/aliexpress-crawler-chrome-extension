// content.js - Extracts media from AliExpress product pages and handles downloads

(function () {
  "use strict";

  // Storage for extracted media
  let mediaData = {
    images: [],
    videos: [],
  };

  // Extract media from the page
  function extractMedia() {
    const images = new Set();
    const videos = new Set();

    // Extract product images ONLY from the main product slider
    // AliExpress uses class pattern: slider--slider--[randomId]
    const sliderContainer = document.querySelector(
      '[class*="slider--slider--"]'
    );
    if (sliderContainer) {
      sliderContainer.querySelectorAll("img").forEach((img) => {
        let src = img.src || img.dataset.src || img.getAttribute("data-src");

        if (
          src &&
          src.startsWith("http") &&
          !src.includes("pixel") &&
          !src.includes("transparent")
        ) {
          // Clean URL: remove size parameters like _220x220q75 from the URL
          // Example: .jpg_220x220q75.jpg_.avif -> .jpg_.avif
          const cleanUrl = src.replace(
            /_([\d]+x[\d]+q?[\d]*)(\.[^_.]+)?(_\.[^.]+)$/i,
            "$3"
          );
          images.add(cleanUrl);
        }
      });
    }

    // Extract videos from the slider container as well
    if (sliderContainer) {
      sliderContainer
        .querySelectorAll("video source, video")
        .forEach((video) => {
          let src = video.src || video.currentSrc;
          if (src && src.startsWith("http")) {
            videos.add(src);
          }
        });
    }

    mediaData.images = Array.from(images);

    mediaData.videos = Array.from(videos);

    console.log("Extracted media:", mediaData);
    return mediaData;
  }

  // Download a file as blob
  async function fetchAsBlob(url) {
    try {
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      return await response.blob();
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error);
      return null;
    }
  }

  // Get file extension from URL
  function getExtensionFromUrl(url, defaultExt) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      // Handle .avif and other extensions
      const match = pathname.match(/\.([a-z0-9]+)$/i);
      if (match) {
        return match[1].toLowerCase();
      }
    } catch (e) {
      console.warn("Failed to parse URL:", url);
    }
    return defaultExt;
  }

  // Download media files as ZIP
  async function downloadMedia(type) {
    const zip = new JSZip();
    let productName = getProductName();
    let errors = [];
    let totalFiles = 0;

    // Collect files to download
    const filesToProcess = [];

    if (type === "images" || type === "all") {
      mediaData.images.forEach((url, index) => {
        const ext = getExtensionFromUrl(url, "jpg");
        const filename = `${productName}_image_${index + 1}.${ext}`;
        filesToProcess.push({ url, filename, type: "image" });
      });
    }

    if (type === "videos" || type === "all") {
      mediaData.videos.forEach((url, index) => {
        const ext = getExtensionFromUrl(url, "mp4");
        const filename = `${productName}_video_${index + 1}.${ext}`;
        filesToProcess.push({ url, filename, type: "video" });
      });
    }

    totalFiles = filesToProcess.length;

    if (totalFiles === 0) {
      return {
        success: false,
        downloaded: 0,
        errors: ["No media found to download"],
      };
    }

    console.log(`Starting download of ${totalFiles} files...`);

    // Fetch all files and add to zip
    for (const file of filesToProcess) {
      try {
        console.log(`Fetching: ${file.filename}`);
        const blob = await fetchAsBlob(file.url);
        if (blob) {
          zip.file(file.filename, blob);
        } else {
          errors.push(file.filename);
        }
      } catch (error) {
        console.error(`Failed to process ${file.filename}:`, error);
        errors.push(file.filename);
      }
    }

    // Generate and download ZIP
    try {
      console.log("Generating ZIP file...");
      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      // Create download link
      const zipFilename = `${productName}_media.zip`;
      const downloadUrl = URL.createObjectURL(zipBlob);

      // Send to background script for download
      chrome.runtime.sendMessage(
        { action: "downloadZip", url: downloadUrl, filename: zipFilename },
        (response) => {
          // Revoke the object URL after a delay to allow download to start
          setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);
        }
      );

      console.log(`ZIP created: ${zipFilename}`);

      return {
        success: true,
        downloaded: totalFiles - errors.length,
        errors: errors,
      };
    } catch (error) {
      console.error("Failed to generate ZIP:", error);
      return {
        success: false,
        downloaded: 0,
        errors: ["Failed to generate ZIP file"],
      };
    }
  }

  // Get product name for filename
  function getProductName() {
    // Try to get product name from various selectors
    const titleSelectors = [
      "h1",
      '[class*="title"]',
      '[class*="Title"]',
      '[data-pl="product-title"]',
      ".product-title",
      ".title",
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return sanitizeFilename(element.textContent.trim());
      }
    }

    // Fallback to page title
    return sanitizeFilename(document.title.split("-")[0].trim());
  }

  // Sanitize filename
  function sanitizeFilename(name) {
    return (
      name
        .replace(/[^a-z0-9\s\-\_]/gi, "")
        .replace(/\s+/g, "_")
        .replace(/_{2,}/g, "_")
        .substring(0, 50) || "aliexpress_product"
    );
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getMediaData") {
      extractMedia();
      sendResponse({
        success: true,
        images: mediaData.images,
        videos: mediaData.videos,
      });
      return true;
    }

    if (request.action === "downloadMedia") {
      downloadMedia(request.type)
        .then((result) => {
          sendResponse(result);
        })
        .catch((error) => {
          sendResponse({
            success: false,
            error: error.message,
          });
        });
      return true; // Keep the message channel open for async response
    }
  });

  // Extract media on page load
  if (document.readyState === "complete") {
    setTimeout(extractMedia, 1000);
  } else {
    window.addEventListener("load", () => {
      setTimeout(extractMedia, 1000);
    });
  }
})();
