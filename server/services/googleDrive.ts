import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-drive',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Drive not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
export async function getUncachableGoogleDriveClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
  webContentLink?: string;
  createdTime?: string;
  modifiedTime?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  path?: string;
}

/**
 * List folders in Google Drive
 */
export async function listFolders(parentId?: string): Promise<DriveFolder[]> {
  const drive = await getUncachableGoogleDriveClient();
  
  const query = parentId 
    ? `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    : `mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    orderBy: 'name',
    pageSize: 100,
  });

  return (response.data.files || []).map(f => ({
    id: f.id!,
    name: f.name!,
  }));
}

/**
 * List all files in a folder (including subfolders recursively)
 */
export async function listFilesInFolder(folderId: string): Promise<DriveFile[]> {
  const drive = await getUncachableGoogleDriveClient();
  
  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  // Supported file types for legal discovery
  const supportedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'video/mp4',
    'video/quicktime',
    'audio/mpeg',
    'audio/mp3',
    'text/plain',
    'text/xml',
    'application/xml',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'message/rfc822',
  ];

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, size, webViewLink, webContentLink, createdTime, modifiedTime)',
      orderBy: 'name',
      pageSize: 100,
      pageToken,
    });

    const driveFiles = response.data.files || [];
    
    for (const file of driveFiles) {
      // If it's a folder, recursively get its contents
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        const subFiles = await listFilesInFolder(file.id!);
        files.push(...subFiles);
      } else if (supportedMimeTypes.includes(file.mimeType!)) {
        files.push({
          id: file.id!,
          name: file.name!,
          mimeType: file.mimeType!,
          size: file.size,
          webViewLink: file.webViewLink,
          webContentLink: file.webContentLink,
          createdTime: file.createdTime,
          modifiedTime: file.modifiedTime,
        });
      }
    }

    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  return files;
}

/**
 * Download a file's content as a buffer
 */
export async function downloadFile(fileId: string): Promise<Buffer> {
  const drive = await getUncachableGoogleDriveClient();
  
  const response = await drive.files.get({
    fileId,
    alt: 'media',
  }, { responseType: 'arraybuffer' });

  return Buffer.from(response.data as ArrayBuffer);
}

/**
 * Get file metadata
 */
export async function getFileMetadata(fileId: string): Promise<DriveFile> {
  const drive = await getUncachableGoogleDriveClient();
  
  const response = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size, webViewLink, webContentLink, createdTime, modifiedTime',
  });

  return {
    id: response.data.id!,
    name: response.data.name!,
    mimeType: response.data.mimeType!,
    size: response.data.size,
    webViewLink: response.data.webViewLink,
    webContentLink: response.data.webContentLink,
    createdTime: response.data.createdTime,
    modifiedTime: response.data.modifiedTime,
  };
}
