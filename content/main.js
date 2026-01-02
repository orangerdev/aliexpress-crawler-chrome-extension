// content.js - Main entry point & message handlers for AliExpress extension
// This file coordinates all modules and handles communication with popup/sidebar

(function () {
  "use strict";

  // Wait for all modules to load
  function waitForModules() {
    return new Promise((resolve) => {
      const checkModules = () => {
        if (
          window.AliExpressUtils &&
          window.AliExpressProduct &&
          window.AliExpressMedia &&
          window.AliExpressReviews &&
          window.AliExpressUpload
        ) {
          resolve();
        } else {
          setTimeout(checkModules, 50);
        }
      };
      checkModules();
    });
  }

  // Initialize the extension
  async function initialize() {
    await waitForModules();

    const { extractMedia } = window.AliExpressMedia;
    const { downloadMedia, getMediaData } = window.AliExpressMedia;
    const {
      getProductId,
      getProductName,
      getRawProductName,
      getProductFolderName,
    } = window.AliExpressProduct;
    const {
      extractAllReviews,
      getAllReviewPhotos,
      getReviewData,
      openReviewPopup,
      closeReviewPopup,
      downloadReviewPhotos,
    } = window.AliExpressReviews;
    const { uploadMediaToDrive, uploadReviewsToDrive } =
      window.AliExpressUpload;

    // Listen for messages from popup/sidebar
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      // Media handlers
      if (request.action === "getMediaData") {
        extractMedia();
        const mediaData = getMediaData();
        sendResponse({
          success: true,
          images: mediaData.images,
          videos: mediaData.videos,
          productName: getProductName(),
          productId: getProductId(),
          rawProductName: getRawProductName(),
          productFolderName: getProductFolderName(),
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
        return true;
      }

      if (request.action === "uploadToDrive") {
        uploadMediaToDrive(request.type, request.folderPath)
          .then((result) => {
            sendResponse(result);
          })
          .catch((error) => {
            sendResponse({
              success: false,
              error: error.message,
            });
          });
        return true;
      }

      // Review extraction handlers
      if (request.action === "extractReviews") {
        const options = {
          openPopup: request.openPopup !== false,
          maxScrolls: request.maxScrolls || 20,
          autoClose: request.autoClose || false,
          minWords: request.minWords ?? 20,
          maxReviews: request.maxReviews ?? 20,
        };

        extractAllReviews(options)
          .then((result) => {
            sendResponse({
              success: true,
              reviews: result.reviews,
              totalCount: result.totalCount,
              averageRating: result.averageRating,
              reviewPhotos: getAllReviewPhotos(),
            });
          })
          .catch((error) => {
            sendResponse({
              success: false,
              error: error.message,
            });
          });
        return true;
      }

      if (request.action === "getReviewData") {
        const reviewData = getReviewData();
        sendResponse({
          success: true,
          reviews: reviewData.reviews,
          totalCount: reviewData.totalCount,
          averageRating: reviewData.averageRating,
          reviewPhotos: getAllReviewPhotos(),
        });
        return true;
      }

      if (request.action === "openReviewPopup") {
        openReviewPopup()
          .then((result) => {
            sendResponse({ success: result });
          })
          .catch((error) => {
            sendResponse({ success: false, error: error.message });
          });
        return true;
      }

      if (request.action === "closeReviewPopup") {
        closeReviewPopup();
        sendResponse({ success: true });
        return true;
      }

      if (request.action === "downloadReviewPhotos") {
        downloadReviewPhotos()
          .then((result) => {
            sendResponse(result);
          })
          .catch((error) => {
            sendResponse({
              success: false,
              error: error.message,
            });
          });
        return true;
      }

      if (request.action === "uploadReviewsToDrive") {
        uploadReviewsToDrive(request.folderPath, request.includePhotos)
          .then(async (result) => {
            if (result.success && result.reviews && result.reviews.length > 0) {
              // Update review spreadsheet
              try {
                const sheetResult = await new Promise((resolve) => {
                  chrome.runtime.sendMessage(
                    {
                      action: "updateReviewSpreadsheet",
                      sheetName: request.reviewSheetName || "REVIEW",
                      productId: result.productId,
                      productName: result.productName,
                      reviews: result.reviews,
                    },
                    (response) => resolve(response)
                  );
                });

                if (sheetResult && sheetResult.success) {
                  console.log(
                    `Review spreadsheet updated: ${sheetResult.rowsAdded} rows`
                  );
                } else {
                  console.error(
                    "Failed to update review spreadsheet:",
                    sheetResult?.error
                  );
                }
              } catch (sheetError) {
                console.error("Error updating review spreadsheet:", sheetError);
              }
            }
            sendResponse(result);
          })
          .catch((error) => {
            sendResponse({
              success: false,
              error: error.message,
            });
          });
        return true;
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

    console.log("AliExpress Media Downloader initialized");
  }

  // Start initialization
  initialize();
})();
