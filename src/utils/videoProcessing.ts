import { Video } from 'react-native-compressor';
import * as FileSystem from 'expo-file-system/legacy';

export const processVideo = async (
    uri: string,
    onProgress?: (progress: number) => void
): Promise<string> => {
    try {
        const result = await Video.compress(
            uri,
            {
                compressionMethod: 'auto',
                minimumFileSizeForCompress: 0, // Always compress to remove metadata
            },
            (progress) => {
                if (onProgress) {
                    onProgress(progress);
                }
            }
        );
        // result is the path to the compressed video
        // Ensure it has a file extension (sometimes it might be missing or tmp)
        // But react-native-compressor usually returns a valid path with extension.
        return result;
    } catch (error) {
        console.error("Video compression error:", error);
        throw error;
    }
};

export const getVideoSize = async (uri: string): Promise<number> => {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
        return info.size;
    }
    return 0;
};
