import * as ImageManipulator from 'expo-image-manipulator';

export interface ProcessImageOptions {
    width?: number;
    compress?: number; // 0 to 1
    format?: ImageManipulator.SaveFormat;
}

/**
 * Processes the image: resizes and strips metadata (Exif).
 * ImageManipulator by default does not preserve Exif data when creating a new image,
 * which serves our purpose of "cleaning" the image.
 */
export const processImage = async (
    uri: string,
    options: ProcessImageOptions = {}
): Promise<ImageManipulator.ImageResult> => {
    const { width = 2048, compress = 0.8, format = ImageManipulator.SaveFormat.JPEG } = options;

    const actions: ImageManipulator.Action[] = [];

    // functionality to resize
    if (width) {
        actions.push({ resize: { width } });
    }

    // Execute manipulation
    const result = await ImageManipulator.manipulateAsync(
        uri,
        actions,
        { compress, format }
    );

    return result;
};

/**
 * Gets file size of an image.
 * This is a helper since ImageManipulator result usually doesn't give file size directly often enough.
 */
import * as FileSystem from 'expo-file-system/legacy';

export const getFileSize = async (uri: string): Promise<number | null> => {
    try {
        const info = await FileSystem.getInfoAsync(uri);
        if (info.exists) {
            return info.size;
        }
        return null;
    } catch (e) {
        console.error("Error getting file size", e);
        return null;
    }
};

/**
 * Attempts to resize the image to be under the target size in bytes.
 * Uses a simple iterative approach reducing dimensions.
 */
export const processImageToTargetSize = async (
    uri: string,
    targetSizeBytes: number,
    originalWidth: number
): Promise<ImageManipulator.ImageResult> => {
    let width = originalWidth;
    let minWidth = 100;
    let maxWidth = originalWidth;
    let result: ImageManipulator.ImageResult | null = null;

    // Need to measure original first if we don't have a starting point, 
    // but we assume originalWidth is passed.

    // Binary search-like or proportional reduction approach.
    // Since compression is non-linear, we'll try a few iterations.

    let attempts = 0;
    const maxAttempts = 6; // Limit to avoid infinite loops

    // First check if original already fits (just strip exif)
    const cleanOriginal = await processImage(uri, { width: originalWidth, compress: 0.9 });
    const cleanSize = await getFileSize(cleanOriginal.uri);

    if (cleanSize && cleanSize <= targetSizeBytes) {
        return cleanOriginal;
    }

    // If not, start reducing
    let high = originalWidth;
    let low = 100;
    let bestFit = cleanOriginal; // Fallback

    while (attempts < maxAttempts) {
        const mid = Math.floor((low + high) / 2);
        // Process at mid width
        const currentAttempt = await processImage(uri, { width: mid, compress: 0.9 });
        const size = await getFileSize(currentAttempt.uri);

        if (!size) break; // Error

        console.log(`Attempt ${attempts}: width=${mid}, size=${size}, target=${targetSizeBytes}`);

        if (size <= targetSizeBytes) {
            // It fits. Try to see if we can go bigger?
            // Or just accept it as a valid candidate and try to squeeze more quality?
            // For speed, let's update bestFit and try to go higher.
            bestFit = currentAttempt;
            low = mid + 1;
        } else {
            // Too big, need to reduce width
            high = mid - 1;
        }

        if (low > high) break;
        attempts++;
    }

    return bestFit;
};
