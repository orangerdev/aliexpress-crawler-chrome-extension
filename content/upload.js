// upload.js - Google Drive upload functions

/**
 * Upload media files to Google Drive
 * @param {string} type - Type of media: 'images', 'videos', or 'all'
 * @param {string} baseFolderPath - Base folder path in Google Drive
 * @returns {Promise<Object>}
 */
async function uploadMediaToDrive(type, baseFolderPath) {
  const { getProductName, getProductFolderName } = window.AliExpressProduct;
  const { fetchAsBlob, blobToBase64, getExtensionFromUrl, getMimeType } =
    window.AliExpressUtils;
  const mediaData = window.AliExpressMedia.getMediaData();

  let productName = getProductName();
  let errors = [];
  let uploaded = 0;
  let imageLinks = [];
  let videoLinks = [];

  // Auto-generate product folder path
  const productFolderName = getProductFolderName();
  const folderPath = baseFolderPath
    ? `${baseFolderPath.replace(/\/$/, "")}/${productFolderName}`
    : productFolderName;

  // Collect files to upload
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

  const totalFiles = filesToProcess.length;

  if (totalFiles === 0) {
    return {
      success: false,
      uploaded: 0,
      errors: ["No media found to upload"],
      imageLinks: [],
      videoLinks: [],
    };
  }

  console.log(`Starting upload of ${totalFiles} files to Google Drive...`);

  // Upload each file
  for (let i = 0; i < filesToProcess.length; i++) {
    const file = filesToProcess[i];
    try {
      console.log(`Uploading: ${file.filename}`);

      // Update progress
      const percent = Math.round(((i + 0.5) / totalFiles) * 100);
      chrome.runtime.sendMessage({
        action: "uploadProgress",
        percent: percent,
        message: `Mengupload ${file.filename}...`,
      });

      // Fetch file as blob
      const blob = await fetchAsBlob(file.url);
      if (!blob) {
        errors.push(file.filename);
        continue;
      }

      // Convert blob to base64
      const base64 = await blobToBase64(blob);

      // Send to background for upload
      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: "uploadFileToDrive",
            filename: file.filename,
            mimeType: blob.type || getMimeType(file.filename),
            base64Data: base64,
            folderPath: folderPath,
          },
          (response) => {
            if (response && response.success) {
              resolve(response);
            } else {
              reject(new Error(response?.error || "Upload failed"));
            }
          }
        );
      });

      if (result.success) {
        uploaded++;
        // Store the webViewLink based on file type
        if (result.webViewLink) {
          if (file.type === "image") {
            imageLinks.push(result.webViewLink);
          } else if (file.type === "video") {
            videoLinks.push(result.webViewLink);
          }
        }
      }

      // Update progress
      const completePercent = Math.round(((i + 1) / totalFiles) * 100);
      chrome.runtime.sendMessage({
        action: "uploadProgress",
        percent: completePercent,
        message: `Berhasil upload ${uploaded}/${totalFiles} file`,
      });
    } catch (error) {
      console.error(`Failed to upload ${file.filename}:`, error);
      errors.push(file.filename);
    }
  }

  return {
    success: true,
    uploaded: uploaded,
    total: totalFiles,
    errors: errors,
    imageLinks: imageLinks,
    videoLinks: videoLinks,
  };
}

/**
 * Upload reviews data and photos to Google Drive
 * @param {string} baseFolderPath - Base folder path in Google Drive
 * @param {boolean} includePhotos - Whether to include photos
 * @returns {Promise<Object>}
 */
async function uploadReviewsToDrive(baseFolderPath, includePhotos = true) {
  const {
    getProductId,
    getProductName,
    getRawProductName,
    getProductFolderName,
  } = window.AliExpressProduct;
  const {
    fetchAsBlob,
    blobToBase64,
    getExtensionFromUrl,
    getMimeType,
    sanitizeFilename,
  } = window.AliExpressUtils;
  const { getReviewData, getAllReviewPhotos, generateReviewsCsv } =
    window.AliExpressReviews;

  const productId = getProductId();
  const productName = getProductName();
  const rawProductName = getRawProductName();
  let errors = [];
  let uploaded = 0;
  let reviewPhotoLinks = [];
  const reviewData = getReviewData();

  // Auto-generate product folder path - review folder as subfolder of product folder
  const productFolderName = getProductFolderName();
  const productFolderPath = baseFolderPath
    ? `${baseFolderPath.replace(/\/$/, "")}/${productFolderName}`
    : productFolderName;
  const reviewFolderPath = `${productFolderPath}/review`;

  // Upload photos if requested (do this first to get links)
  if (includePhotos) {
    const allPhotos = getAllReviewPhotos();
    const totalPhotos = allPhotos.length;

    for (let i = 0; i < allPhotos.length; i++) {
      const photo = allPhotos[i];
      try {
        const ext = getExtensionFromUrl(photo.url, "jpg");
        // Format: [index]-[productID]-[namaProduct].ext
        // e.g., 01-9992929-Yolanda.jpg
        const index = String(i + 1).padStart(2, "0");
        const filename = `${index}-${productId}-${productName}.${ext}`;

        // Update progress
        const percent = Math.round(((i + 0.5) / totalPhotos) * 90);
        chrome.runtime.sendMessage({
          action: "uploadProgress",
          percent: percent,
          message: `Mengupload ${filename}...`,
        });

        const blob = await fetchAsBlob(photo.url);
        if (!blob) {
          errors.push(filename);
          continue;
        }

        const base64 = await blobToBase64(blob);

        const result = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            {
              action: "uploadFileToDrive",
              filename: filename,
              mimeType: blob.type || getMimeType(filename),
              base64Data: base64,
              folderPath: reviewFolderPath,
            },
            (response) => {
              if (response && response.success) {
                resolve(response);
              } else {
                reject(new Error(response?.error || "Upload failed"));
              }
            }
          );
        });

        if (result.success) {
          uploaded++;
          if (result.webViewLink) {
            reviewPhotoLinks.push(result.webViewLink);
          }
        }

        // Update progress
        const completePercent = Math.round(((i + 1) / totalPhotos) * 90);
        chrome.runtime.sendMessage({
          action: "uploadProgress",
          percent: completePercent,
          message: `Berhasil upload ${uploaded} file`,
        });
      } catch (error) {
        console.error(`Failed to upload review photo:`, error);
        const index = String(i + 1).padStart(2, "0");
        errors.push(`${index}-${productId}-${productName}`);
      }
    }
  }

  chrome.runtime.sendMessage({
    action: "uploadProgress",
    percent: 95,
    message: `Upload foto selesai, mempersiapkan data review...`,
  });

  // Return data needed for spreadsheet update
  return {
    success: true,
    uploaded: uploaded,
    errors: errors,
    reviewPhotoLinks: reviewPhotoLinks,
    // Data for spreadsheet
    productId: productId,
    productName: rawProductName,
    reviews: reviewData.reviews,
  };
}

// Export for use in other modules
window.AliExpressUpload = {
  uploadMediaToDrive,
  uploadReviewsToDrive,
};
