/**
 * Filename generation utilities for Skelly Audio Tools
 * Provides consistent, metadata-based filename generation across the application
 */

/**
 * Sanitizes a string for use as a filename by:
 * - Replacing invalid filesystem characters with underscores
 * - Replacing spaces with underscores
 * - Collapsing multiple underscores
 * - Limiting length to prevent filesystem issues
 */
export function sanitizeFilename(title: string, maxLength = 200): string {
  return title
    .replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid characters
    .replace(/\s+/g, '_')            // Replace spaces with underscores
    .replace(/_+/g, '_')             // Collapse multiple underscores
    .trim()
    .substring(0, maxLength);
}

/**
 * Extracts a usable source title from available metadata
 * Priority: YouTube title > Uploaded filename > Fallback
 */
export function getSourceTitle(youtubeTitle?: string, uploadedFilename?: string): string {
  if (youtubeTitle) {
    return sanitizeFilename(youtubeTitle);
  }
  if (uploadedFilename) {
    // Strip extension from uploaded filename
    return sanitizeFilename(uploadedFilename.replace(/\.[^.]+$/, ''));
  }
  return 'audio_file';  // Last resort fallback
}

/**
 * Generates a standardized filename based on file type and metadata
 *
 * @param type - Type of audio file
 * @param sourceTitle - Title from YouTube or uploaded filename (should already be sanitized)
 * @param segmentId - Optional segment number (0-indexed)
 * @returns Properly formatted filename with extension
 */
export function generateFilename(
  type: 'master' | 'segment' | 'vocals' | 'instrumental' | 'yolo' | 'recombined' | 'segments_zip' | 'separated_zip' | 'original',
  sourceTitle: string,
  segmentId?: number
): string {
  const baseName = sanitizeFilename(sourceTitle);

  switch (type) {
    case 'master':
      return `${baseName}_full_processed.wav`;

    case 'segment':
      if (segmentId === undefined) throw new Error('segmentId required for segment type');
      return `${baseName}_segment_${String(segmentId + 1).padStart(2, '0')}.wav`;

    case 'recombined':
      if (segmentId === undefined) throw new Error('segmentId required for recombined type');
      return `${baseName}_segment_${String(segmentId + 1).padStart(2, '0')}_recombined.wav`;

    case 'vocals':
      return `${baseName}_vocals.wav`;

    case 'instrumental':
      return `${baseName}_instrumental.wav`;

    case 'yolo':
      return `${baseName}_yolo_mix.wav`;

    case 'segments_zip':
      return `${baseName}_segments.zip`;

    case 'separated_zip':
      return `${baseName}_separated.zip`;

    case 'original':
      return `${baseName}_original.wav`;

    default:
      return `${baseName}.wav`;
  }
}

/**
 * Removes file extension from a filename
 */
export function removeExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}

/**
 * Gets the extension from a filename (including the dot)
 */
export function getExtension(filename: string): string {
  const match = filename.match(/\.([^.]+)$/);
  return match ? match[0] : '';
}

/**
 * Preserves original extension or defaults to WAV for processed files
 */
export function getProperExtension(
  type: 'original' | 'processed',
  originalFilename?: string
): string {
  if (type === 'original' && originalFilename) {
    const ext = getExtension(originalFilename);
    return ext || '.mp3';  // Default to MP3 if no extension found
  }
  return '.wav';  // All processed files are WAV
}
