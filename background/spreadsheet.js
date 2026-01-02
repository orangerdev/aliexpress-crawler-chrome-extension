// spreadsheet.js - Google Sheets functions

/**
 * Get Spreadsheet ID from storage
 * @returns {Promise<string|null>}
 */
async function getSpreadsheetId() {
  const stored = await chrome.storage.local.get(["googleSpreadsheetId"]);
  return stored.googleSpreadsheetId;
}

/**
 * Update Google Spreadsheet with product data
 * @param {string} sheetName - Name of the sheet (default: "PRODUCT")
 * @param {string} productId - Product ID
 * @param {string} productName - Product name
 * @param {Array} videoLinks - Array of video links
 * @param {Array} imageLinks - Array of image links
 * @returns {Promise<Object>}
 */
async function updateSpreadsheet(
  sheetName,
  productId,
  productName,
  videoLinks,
  imageLinks
) {
  const { checkDriveAuth, getAuthToken } = self.BackgroundAuth;

  try {
    let authToken = getAuthToken();

    if (!authToken) {
      const authCheck = await checkDriveAuth();
      if (!authCheck.connected) {
        throw new Error("Not authenticated with Google");
      }
      authToken = getAuthToken();
    }

    const spreadsheetId = await getSpreadsheetId();
    if (!spreadsheetId) {
      throw new Error("Spreadsheet ID belum dikonfigurasi");
    }

    // Use provided sheet name or default to "PRODUCT"
    const sheet = sheetName || "PRODUCT";

    // Format video links (single link or empty)
    const videoLink = videoLinks.length > 0 ? videoLinks[0] : "";

    // Format image links (multiple links separated by newline)
    const imageLinksText = imageLinks.join("\n");

    // Data row: [Product ID, Product Name, Affiliate Link (empty), Video Link, Image Links]
    const rowData = [
      productId || "",
      productName || "",
      "", // Affiliate link - kosongkan
      videoLink,
      imageLinksText,
    ];

    // Append row to spreadsheet with sheet name
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      sheet
    )}!A:E:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

    const appendResponse = await fetch(appendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [rowData],
      }),
    });

    if (!appendResponse.ok) {
      const error = await appendResponse.json();
      throw new Error(error.error?.message || "Failed to update spreadsheet");
    }

    const result = await appendResponse.json();
    console.log("Spreadsheet updated:", result);

    return { success: true };
  } catch (error) {
    console.error("Update spreadsheet error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Update Google Spreadsheet with review data
 * @param {string} sheetName - Name of the sheet (default: "REVIEW")
 * @param {string} productId - Product ID
 * @param {string} productName - Product name
 * @param {Array} reviews - Array of review objects
 * @returns {Promise<Object>}
 */
async function updateReviewSpreadsheet(
  sheetName,
  productId,
  productName,
  reviews
) {
  const { checkDriveAuth, getAuthToken } = self.BackgroundAuth;

  try {
    let authToken = getAuthToken();

    if (!authToken) {
      const authCheck = await checkDriveAuth();
      if (!authCheck.connected) {
        throw new Error("Not authenticated with Google");
      }
      authToken = getAuthToken();
    }

    const spreadsheetId = await getSpreadsheetId();
    if (!spreadsheetId) {
      throw new Error("Spreadsheet ID belum dikonfigurasi");
    }

    // Use provided sheet name or default to "REVIEW"
    const sheet = sheetName || "REVIEW";

    if (!reviews || reviews.length === 0) {
      return { success: true, message: "No reviews to update" };
    }

    // Create rows for each review
    // Format: [Product ID, Product Name, Rating, Review Text]
    const rows = reviews.map((review) => [
      productId || "",
      productName || "",
      review.rating || 0,
      review.reviewText || "",
    ]);

    // Append rows to spreadsheet with sheet name
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      sheet
    )}!A:D:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

    const appendResponse = await fetch(appendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: rows,
      }),
    });

    if (!appendResponse.ok) {
      const error = await appendResponse.json();
      throw new Error(
        error.error?.message || "Failed to update review spreadsheet"
      );
    }

    const result = await appendResponse.json();
    console.log("Review spreadsheet updated:", result);

    return { success: true, rowsAdded: reviews.length };
  } catch (error) {
    console.error("Update review spreadsheet error:", error);
    return { success: false, error: error.message };
  }
}

// Export functions
self.BackgroundSpreadsheet = {
  getSpreadsheetId,
  updateSpreadsheet,
  updateReviewSpreadsheet,
};
