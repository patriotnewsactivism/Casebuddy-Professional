import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { randomBytes } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { logSecurityAlert } from "../services/auditLog";

/**
 * Secure File Upload Middleware for CaseBuddy Professional
 *
 * Implements security best practices for handling legal documents:
 * - File type validation (whitelist approach)
 * - File size limits
 * - Secure file naming (prevents path traversal)
 * - Magic number validation
 * - Antivirus scanning hooks (placeholder for future implementation)
 */

// Allowed file types for legal document management
const ALLOWED_MIME_TYPES = new Set([
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/rtf",

  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/tiff",
  "image/webp",
  "image/heic",

  // Audio (for depositions, recordings)
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
  "audio/ogg",
  "audio/webm",
  "audio/m4a",
  "audio/x-m4a",

  // Video (for depositions, evidence)
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-ms-wmv",
]);

// File extension to MIME type mapping for validation
const EXTENSION_MIME_MAP: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".doc": ["application/msword"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".xls": ["application/vnd.ms-excel"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ".ppt": ["application/vnd.ms-powerpoint"],
  ".pptx": ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  ".txt": ["text/plain"],
  ".csv": ["text/csv", "text/plain"],
  ".rtf": ["application/rtf", "text/rtf"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".gif": ["image/gif"],
  ".tiff": ["image/tiff"],
  ".tif": ["image/tiff"],
  ".webp": ["image/webp"],
  ".heic": ["image/heic"],
  ".mp3": ["audio/mpeg"],
  ".wav": ["audio/wav"],
  ".m4a": ["audio/mp4", "audio/m4a", "audio/x-m4a"],
  ".ogg": ["audio/ogg"],
  ".mp4": ["video/mp4", "audio/mp4"],
  ".webm": ["video/webm", "audio/webm"],
  ".mov": ["video/quicktime"],
  ".avi": ["video/x-msvideo"],
  ".wmv": ["video/x-ms-wmv"],
};

// Magic numbers for common file types (first few bytes)
const MAGIC_NUMBERS: Record<string, Buffer[]> = {
  "application/pdf": [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF
  "image/jpeg": [Buffer.from([0xFF, 0xD8, 0xFF])],
  "image/png": [Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
  "image/gif": [Buffer.from([0x47, 0x49, 0x46, 0x38])], // GIF8
  "application/zip": [Buffer.from([0x50, 0x4B, 0x03, 0x04])], // For Office documents (docx, xlsx, pptx)
};

// Maximum file sizes by type (in bytes)
const MAX_FILE_SIZES: Record<string, number> = {
  document: 50 * 1024 * 1024,  // 50MB for documents
  image: 25 * 1024 * 1024,     // 25MB for images
  audio: 100 * 1024 * 1024,    // 100MB for audio
  video: 500 * 1024 * 1024,    // 500MB for video
  default: 100 * 1024 * 1024,  // 100MB default
};

/**
 * Determine file category for size limits
 */
function getFileCategory(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "document";
}

/**
 * Generate a secure filename that prevents path traversal
 */
function generateSecureFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const timestamp = Date.now();
  const random = randomBytes(8).toString("hex");
  return `${timestamp}-${random}${ext}`;
}

/**
 * Validate file extension matches declared MIME type
 */
function validateExtension(filename: string, mimeType: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  const allowedMimes = EXTENSION_MIME_MAP[ext];

  if (!allowedMimes) {
    return false;
  }

  return allowedMimes.includes(mimeType);
}

/**
 * Check if file content matches expected magic number
 */
async function validateMagicNumber(filePath: string, mimeType: string): Promise<boolean> {
  // For Office documents (docx, xlsx, pptx), check for ZIP signature
  if (mimeType.includes("openxmlformats")) {
    const expected = MAGIC_NUMBERS["application/zip"];
    if (expected) {
      const buffer = Buffer.alloc(4);
      const handle = await fs.open(filePath, "r");
      await handle.read(buffer, 0, 4, 0);
      await handle.close();
      return expected.some(magic => buffer.slice(0, magic.length).equals(magic));
    }
  }

  const expected = MAGIC_NUMBERS[mimeType];
  if (!expected) {
    // No magic number check for this type, allow through
    return true;
  }

  const maxLength = Math.max(...expected.map(m => m.length));
  const buffer = Buffer.alloc(maxLength);

  const handle = await fs.open(filePath, "r");
  await handle.read(buffer, 0, maxLength, 0);
  await handle.close();

  return expected.some(magic => buffer.slice(0, magic.length).equals(magic));
}

/**
 * Scan for potentially dangerous content
 */
async function scanForDangerousContent(filePath: string): Promise<{ safe: boolean; reason?: string }> {
  // For text-based files, check for suspicious patterns
  const stat = await fs.stat(filePath);
  if (stat.size > 10 * 1024 * 1024) {
    // Skip content scanning for large files
    return { safe: true };
  }

  try {
    const content = await fs.readFile(filePath, "utf-8");

    // Check for script injection in text files
    const dangerousPatterns = [
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi, // onclick, onerror, etc.
      /data:text\/html/gi,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        return { safe: false, reason: "Potentially malicious content detected" };
      }
    }
  } catch {
    // Binary file, skip text scanning
  }

  return { safe: true };
}

// Create upload directory if it doesn't exist
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
fs.mkdir(UPLOAD_DIR, { recursive: true }).catch(() => {});

// Configure multer storage with secure settings
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, generateSecureFilename(file.originalname));
  },
});

// File filter function
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Check MIME type against whitelist
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(new Error(`File type ${file.mimetype} is not allowed`));
    return;
  }

  // Validate extension matches MIME type
  if (!validateExtension(file.originalname, file.mimetype)) {
    cb(new Error("File extension does not match content type"));
    return;
  }

  cb(null, true);
};

// Create multer instance with security configuration
export const secureUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZES.video, // Use max as initial limit
    files: 10, // Maximum 10 files per request
    fieldSize: 10 * 1024 * 1024, // 10MB max field size
  },
});

/**
 * Post-upload validation middleware
 * Performs additional security checks after file is saved
 */
export async function validateUploadedFile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.file) {
    next();
    return;
  }

  const file = req.file;

  try {
    // Check file size against category-specific limits
    const category = getFileCategory(file.mimetype);
    const maxSize = MAX_FILE_SIZES[category] || MAX_FILE_SIZES.default;

    if (file.size > maxSize) {
      await fs.unlink(file.path);
      res.status(400).json({
        error: `File too large. Maximum size for ${category} files is ${Math.round(maxSize / 1024 / 1024)}MB`
      });
      return;
    }

    // Validate magic number
    const magicValid = await validateMagicNumber(file.path, file.mimetype);
    if (!magicValid) {
      await fs.unlink(file.path);

      // Log security alert
      await logSecurityAlert(
        "File magic number mismatch",
        (req as any).ip || "unknown",
        req.headers["user-agent"] || "unknown",
        {
          filename: file.originalname,
          declaredMime: file.mimetype,
        }
      );

      res.status(400).json({ error: "File content does not match declared type" });
      return;
    }

    // Scan for dangerous content
    const scanResult = await scanForDangerousContent(file.path);
    if (!scanResult.safe) {
      await fs.unlink(file.path);

      await logSecurityAlert(
        "Dangerous content detected in upload",
        (req as any).ip || "unknown",
        req.headers["user-agent"] || "unknown",
        {
          filename: file.originalname,
          reason: scanResult.reason,
        }
      );

      res.status(400).json({ error: "File contains potentially dangerous content" });
      return;
    }

    next();
  } catch (error) {
    console.error("File validation error:", error);

    // Clean up file on error
    try {
      await fs.unlink(file.path);
    } catch {}

    res.status(500).json({ error: "Failed to validate uploaded file" });
  }
}

/**
 * Handle multer errors with user-friendly messages
 */
export function handleUploadError(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        res.status(400).json({ error: "File is too large" });
        break;
      case "LIMIT_FILE_COUNT":
        res.status(400).json({ error: "Too many files uploaded" });
        break;
      case "LIMIT_UNEXPECTED_FILE":
        res.status(400).json({ error: "Unexpected file field" });
        break;
      default:
        res.status(400).json({ error: "File upload error" });
    }
  } else if (error.message.includes("not allowed") || error.message.includes("does not match")) {
    res.status(400).json({ error: error.message });
  } else {
    next(error);
  }
}
