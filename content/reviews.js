// reviews.js - Review extraction and processing functions

// Storage for extracted reviews
let reviewData = {
  reviews: [],
  totalCount: 0,
  averageRating: 0,
};

// Default filter settings
const DEFAULT_MIN_WORDS = 20;
const DEFAULT_MAX_REVIEWS = 20;

/**
 * Count words in a text string
 * @param {string} text - Text to count words
 * @returns {number}
 */
function countWords(text) {
  if (!text) return 0;
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

/**
 * Click "View more" button to open review popup
 * @returns {Promise<boolean>}
 */
async function openReviewPopup() {
  // Find the "View more" button for reviews
  const viewMoreButtons = document.querySelectorAll(
    "button.comet-v2-btn-important"
  );
  let reviewButton = null;

  for (const btn of viewMoreButtons) {
    const spanText =
      btn.querySelector("span")?.textContent?.toLowerCase() || "";
    if (spanText.includes("view more") || spanText.includes("lihat lebih")) {
      reviewButton = btn;
      break;
    }
  }

  if (!reviewButton) {
    console.log('Review "View more" button not found');
    return false;
  }

  // Click the button to open the popup
  reviewButton.click();

  // Wait for the modal to appear
  await new Promise((resolve) => setTimeout(resolve, 1500));

  return true;
}

/**
 * Close the review popup
 */
function closeReviewPopup() {
  const closeBtn = document.querySelector(".comet-v2-modal-close");
  if (closeBtn) {
    closeBtn.click();
  }
}

/**
 * Extract data from a single review item
 * @param {Element} item - Review item element
 * @param {number} index - Review index
 * @returns {Object|null}
 */
function extractSingleReview(item, index) {
  const { cleanReviewImageUrl } = window.AliExpressUtils;

  try {
    // Extract star rating (count filled stars)
    const starIcons = item.querySelectorAll(".comet-icon-starreviewfilled");
    const rating = starIcons.length;

    // Extract SKU/variant info
    const skuEl = item.querySelector(".list--itemSku--idEQSGC");
    const sku = skuEl ? skuEl.textContent.trim() : "";

    // Extract main review text
    const reviewTextEl = item.querySelector(".list--itemReview--d9Z9Z5Z");
    const reviewText = reviewTextEl ? reviewTextEl.textContent.trim() : "";

    // Extract additional review if exists
    let additionalReview = "";
    const additionalReviewContainer = item.querySelector(
      '.list--itemContentTopLeft--jv7Zzf1 > div[style*="margin-top"]'
    );
    if (additionalReviewContainer) {
      const additionalSpan = additionalReviewContainer.querySelector(
        'span[style*="font-weight"]'
      );
      if (additionalSpan) {
        additionalReview = additionalSpan.textContent.trim();
      }
    }

    // Extract date and username
    const infoEl = item.querySelector(".list--itemInfo--VEcgSFh span");
    let username = "";
    let date = "";
    if (infoEl) {
      const infoText = infoEl.textContent.trim();
      const parts = infoText.split("|").map((p) => p.trim());
      if (parts.length >= 2) {
        username = parts[0];
        date = parts[1];
      } else {
        username = infoText;
      }
    }

    // Extract helpful count
    const helpfulEl = item.querySelector(".list--itemHelpText--BfmXmgh");
    let helpfulCount = 0;
    if (helpfulEl) {
      const match = helpfulEl.textContent.match(/\((\d+)\)/);
      helpfulCount = match ? parseInt(match[1]) : 0;
    }

    // Extract photos
    const photos = [];
    const thumbnailContainer = item.querySelector(
      ".list--itemThumbnails--TtUDHhl"
    );
    if (thumbnailContainer) {
      const thumbnailImages = thumbnailContainer.querySelectorAll("img");
      thumbnailImages.forEach((img) => {
        let src = img.src || img.dataset.src;
        if (src) {
          // Clean and get full-size image URL
          src = cleanReviewImageUrl(src);
          photos.push(src);
        }
      });
    }

    // Extract user avatar
    const avatarEl = item.querySelector(".list--itemPhoto--SQWM7vp img");
    const avatar = avatarEl ? avatarEl.src : "";

    return {
      index: index + 1,
      username,
      date,
      rating,
      sku,
      reviewText,
      additionalReview,
      helpfulCount,
      photos,
      avatar,
    };
  } catch (error) {
    console.error("Error extracting review:", error);
    return null;
  }
}

/**
 * Extract reviews from the review popup/modal
 * @returns {Array}
 */
function extractReviewsFromPopup() {
  const reviews = [];

  // Find the modal content
  const modalContent = document.querySelector(".comet-v2-modal-content");
  if (!modalContent) {
    console.log("Modal content not found, trying page reviews");
    return extractReviewsFromPage();
  }

  // Get overall rating info
  const ratingEl = modalContent.querySelector(
    ".title--title--MFuMdl3 span:nth-child(3)"
  );
  const ratingCountEl = modalContent.querySelector(".title--rating--wzOw1ph");

  if (ratingEl) {
    reviewData.averageRating = parseFloat(ratingEl.textContent) || 0;
  }
  if (ratingCountEl) {
    const match = ratingCountEl.textContent.match(/(\d+)/);
    reviewData.totalCount = match ? parseInt(match[1]) : 0;
  }

  // Find all review items
  const reviewItems = modalContent.querySelectorAll(".list--itemBox--je_KNzb");

  reviewItems.forEach((item, index) => {
    const review = extractSingleReview(item, index);
    if (review) {
      reviews.push(review);
    }
  });

  return reviews;
}

/**
 * Extract reviews from the main page (if not in popup)
 * @returns {Array}
 */
function extractReviewsFromPage() {
  const reviews = [];

  // Find review items on the page
  const reviewItems = document.querySelectorAll(".list--itemBox--je_KNzb");

  reviewItems.forEach((item, index) => {
    const review = extractSingleReview(item, index);
    if (review) {
      reviews.push(review);
    }
  });

  return reviews;
}

/**
 * Scroll within the modal to load more reviews
 * @param {number} maxScrolls - Maximum number of scroll attempts
 * @param {number} minWords - Minimum words filter to check qualified reviews
 * @param {number} maxReviews - Stop scrolling when we have enough qualified reviews
 */
async function scrollToLoadMoreReviews(
  maxScrolls = 10,
  minWords = 0,
  maxReviews = 0
) {
  const modalBody = document.querySelector(".comet-v2-modal-body");
  if (!modalBody) return;

  let previousReviewCount = 0;
  let scrollCount = 0;
  let noNewReviewsCount = 0;

  while (scrollCount < maxScrolls && noNewReviewsCount < 3) {
    // Get current review count
    const currentReviewCount = document.querySelectorAll(
      ".list--itemBox--je_KNzb"
    ).length;

    // Check how many qualified reviews we have (meeting minWords requirement)
    if (maxReviews > 0) {
      const currentReviews = extractReviewsFromPopup();
      let qualifiedCount = currentReviews.length;

      if (minWords > 0) {
        qualifiedCount = currentReviews.filter(
          (review) => countWords(review.reviewText) >= minWords
        ).length;
      }

      // Stop scrolling if we have enough qualified reviews
      if (qualifiedCount >= maxReviews) {
        console.log(
          `Reached ${qualifiedCount} qualified reviews, stopping scroll`
        );
        chrome.runtime.sendMessage({
          action: "reviewScrollProgress",
          message: `Sudah cukup ${qualifiedCount} review yang memenuhi syarat`,
          count: qualifiedCount,
        });
        break;
      }
    }

    // Check if new reviews were loaded
    if (currentReviewCount === previousReviewCount) {
      noNewReviewsCount++;
    } else {
      noNewReviewsCount = 0;
    }

    previousReviewCount = currentReviewCount;

    // Scroll down
    modalBody.scrollTop = modalBody.scrollHeight;

    // Wait for content to load
    await new Promise((resolve) => setTimeout(resolve, 1000));

    scrollCount++;

    // Send progress update
    chrome.runtime.sendMessage({
      action: "reviewScrollProgress",
      message: `Memuat review... (${currentReviewCount} reviews loaded)`,
      count: currentReviewCount,
    });
  }
}

/**
 * Main function to extract all reviews
 * @param {Object} options - Extraction options
 * @param {boolean} options.openPopup - Whether to open the review popup
 * @param {number} options.maxScrolls - Maximum scroll attempts to load more reviews
 * @param {boolean} options.autoClose - Whether to auto close popup after extraction
 * @param {number} options.minWords - Minimum words in review content (default: 20)
 * @param {number} options.maxReviews - Maximum number of reviews to extract (default: 20)
 * @returns {Promise<Object>}
 */
async function extractAllReviews(options = {}) {
  const {
    openPopup = true,
    maxScrolls = 20,
    autoClose = false,
    minWords = DEFAULT_MIN_WORDS,
    maxReviews = DEFAULT_MAX_REVIEWS,
  } = options;
  const { waitForElement } = window.AliExpressUtils;

  try {
    // Reset review data
    reviewData.reviews = [];

    if (openPopup) {
      // Open the review popup
      const popupOpened = await openReviewPopup();
      if (!popupOpened) {
        // Try extracting from page if popup can't be opened
        let pageReviews = extractReviewsFromPage();

        // Apply filters
        if (minWords > 0) {
          pageReviews = pageReviews.filter(
            (review) => countWords(review.reviewText) >= minWords
          );
        }
        if (maxReviews > 0 && pageReviews.length > maxReviews) {
          pageReviews = pageReviews.slice(0, maxReviews);
        }
        pageReviews = pageReviews.map((review, index) => ({
          ...review,
          index: index + 1,
        }));

        reviewData.reviews = pageReviews;
        return reviewData;
      }

      // Wait for modal content to fully load
      await waitForElement(".list--itemBox--je_KNzb", 5000).catch(() => null);
    }

    // Scroll to load more reviews (pass minWords and maxReviews to stop early if enough)
    await scrollToLoadMoreReviews(maxScrolls, minWords, maxReviews);

    // Extract all reviews
    let allReviews = extractReviewsFromPopup();

    // Filter reviews by minimum word count
    if (minWords > 0) {
      allReviews = allReviews.filter((review) => {
        const wordCount = countWords(review.reviewText);
        return wordCount >= minWords;
      });
      console.log(
        `Filtered to ${allReviews.length} reviews with ${minWords}+ words`
      );
    }

    // Limit to maximum number of reviews
    if (maxReviews > 0 && allReviews.length > maxReviews) {
      allReviews = allReviews.slice(0, maxReviews);
      console.log(`Limited to ${maxReviews} reviews`);
    }

    // Re-index reviews after filtering
    allReviews = allReviews.map((review, index) => ({
      ...review,
      index: index + 1,
    }));

    reviewData.reviews = allReviews;

    console.log(`Final extracted ${reviewData.reviews.length} reviews`);

    if (autoClose) {
      closeReviewPopup();
    }

    return reviewData;
  } catch (error) {
    console.error("Error extracting reviews:", error);
    return reviewData;
  }
}

/**
 * Get all review photos as a flat array
 * @returns {Array}
 */
function getAllReviewPhotos() {
  const allPhotos = [];
  reviewData.reviews.forEach((review, reviewIndex) => {
    review.photos.forEach((photo, photoIndex) => {
      allPhotos.push({
        url: photo,
        reviewIndex: reviewIndex + 1,
        photoIndex: photoIndex + 1,
        reviewDate: review.date,
        reviewUsername: review.username,
      });
    });
  });
  return allPhotos;
}

/**
 * Get current review data
 * @returns {Object}
 */
function getReviewData() {
  return reviewData;
}

/**
 * Generate CSV from review data
 * @returns {string}
 */
function generateReviewsCsv() {
  const { escapeCsvField } = window.AliExpressUtils;

  const headers = [
    "No",
    "Username",
    "Date",
    "Rating",
    "SKU",
    "Review",
    "Additional Review",
    "Helpful Count",
    "Photo Count",
    "Photo URLs",
  ];

  const rows = reviewData.reviews.map((review, index) => {
    return [
      index + 1,
      escapeCsvField(review.username),
      escapeCsvField(review.date),
      review.rating,
      escapeCsvField(review.sku),
      escapeCsvField(review.reviewText),
      escapeCsvField(review.additionalReview),
      review.helpfulCount,
      review.photos.length,
      escapeCsvField(review.photos.join(" | ")),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

/**
 * Download review photos as ZIP
 * @returns {Promise<Object>}
 */
async function downloadReviewPhotos() {
  const zip = new JSZip();
  const { getProductName } = window.AliExpressProduct;
  const { fetchAsBlob, getExtensionFromUrl } = window.AliExpressUtils;

  let productName = getProductName();
  let errors = [];
  const allPhotos = getAllReviewPhotos();

  if (allPhotos.length === 0) {
    return {
      success: false,
      downloaded: 0,
      errors: ["No review photos found. Please extract reviews first."],
    };
  }

  console.log(`Starting download of ${allPhotos.length} review photos...`);

  // Create reviews folder in zip
  const reviewsFolder = zip.folder("reviews");

  for (let i = 0; i < allPhotos.length; i++) {
    const photo = allPhotos[i];
    try {
      const ext = getExtensionFromUrl(photo.url, "jpg");
      const filename = `review_${photo.reviewIndex}_photo_${photo.photoIndex}.${ext}`;

      console.log(`Fetching: ${filename}`);
      const blob = await fetchAsBlob(photo.url);

      if (blob) {
        reviewsFolder.file(filename, blob);
      } else {
        errors.push(filename);
      }
    } catch (error) {
      console.error(`Failed to process review photo:`, error);
      errors.push(`review_${photo.reviewIndex}_photo_${photo.photoIndex}`);
    }
  }

  // Generate and download ZIP
  try {
    console.log("Generating review photos ZIP file...");
    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const zipFilename = `${productName}_review_photos.zip`;
    const downloadUrl = URL.createObjectURL(zipBlob);

    chrome.runtime.sendMessage(
      { action: "downloadZip", url: downloadUrl, filename: zipFilename },
      (response) => {
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);
      }
    );

    console.log(`ZIP created: ${zipFilename}`);

    return {
      success: true,
      downloaded: allPhotos.length - errors.length,
      total: allPhotos.length,
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

// Export for use in other modules
window.AliExpressReviews = {
  openReviewPopup,
  closeReviewPopup,
  extractSingleReview,
  extractReviewsFromPopup,
  extractReviewsFromPage,
  scrollToLoadMoreReviews,
  extractAllReviews,
  getAllReviewPhotos,
  getReviewData,
  generateReviewsCsv,
  downloadReviewPhotos,
};
