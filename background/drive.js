// drive.js - Google Drive upload and folder functions

/**
 * Create folder in Google Drive (returns folder ID)
 * @param {string} folderPath - Path like "folder1/folder2/folder3"
 * @returns {Promise<string>} - Folder ID
 */
async function getOrCreateFolder(folderPath) {
  const authToken = self.BackgroundAuth.getAuthToken();

  if (!folderPath) return "root";

  const folders = folderPath.split("/").filter((f) => f.trim());
  let parentId = "root";

  for (const folderName of folders) {
    // Search for existing folder
    const searchQuery = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      searchQuery
    )}&fields=files(id,name)`;

    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (!searchResponse.ok) {
      throw new Error("Failed to search for folder");
    }

    const searchResult = await searchResponse.json();

    if (searchResult.files && searchResult.files.length > 0) {
      // Folder exists
      parentId = searchResult.files[0].id;
    } else {
      // Create folder
      const createResponse = await fetch(
        "https://www.googleapis.com/drive/v3/files",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: folderName,
            mimeType: "application/vnd.google-apps.folder",
            parents: [parentId],
          }),
        }
      );

      if (!createResponse.ok) {
        throw new Error("Failed to create folder");
      }

      const newFolder = await createResponse.json();
      parentId = newFolder.id;
    }
  }

  return parentId;
}

/**
 * Upload file to Google Drive
 * @param {string} filename - Name of the file
 * @param {string} mimeType - MIME type of the file
 * @param {string} base64Data - Base64 encoded file data
 * @param {string} folderPath - Path to upload to
 * @returns {Promise<Object>}
 */
async function uploadFileToDrive(filename, mimeType, base64Data, folderPath) {
  const { checkDriveAuth, getAuthToken } = self.BackgroundAuth;

  try {
    let authToken = getAuthToken();

    if (!authToken) {
      const authCheck = await checkDriveAuth();
      if (!authCheck.connected) {
        throw new Error("Not authenticated with Google Drive");
      }
      authToken = getAuthToken();
    }

    // Get or create target folder
    const folderId = await getOrCreateFolder(folderPath);

    // Convert base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });

    // Create multipart upload
    const metadata = {
      name: filename,
      mimeType: mimeType,
      parents: [folderId],
    };

    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", blob);

    const uploadResponse = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: form,
      }
    );

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      throw new Error(error.error?.message || "Upload failed");
    }

    const result = await uploadResponse.json();
    console.log("File uploaded:", result.name, result.id);

    return {
      success: true,
      fileId: result.id,
      fileName: result.name,
      webViewLink: result.webViewLink,
    };
  } catch (error) {
    console.error("Upload to Drive error:", error);
    return { success: false, error: error.message };
  }
}

// Export functions
self.BackgroundDrive = {
  getOrCreateFolder,
  uploadFileToDrive,
};
