import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { processImage, getFileSize, processImageToTargetSize } from '../utils/imageProcessing';
import { processVideo, getVideoSize } from '../utils/videoProcessing';
import AdBanner from '../components/AdBanner';
import { RewardedAd, RewardedAdEventType, TestIds, AdEventType, BannerAd, BannerAdSize, AppOpenAd } from 'react-native-google-mobile-ads';
import { AdConfig } from '../config/admob';
import { useIAP } from '../hooks/useIAP';

const TARGET_SIZES = [
    { label: 'オリジナル', value: 0 },
    { label: '1 MB', value: 1024 * 1024 },
    { label: '500 KB', value: 500 * 1024 },
    { label: '200 KB', value: 200 * 1024 },
];

export default function PhotoPressScreen() {
    const [selectedImages, setSelectedImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [processedImage, setProcessedImage] = useState<any | null>(null);
    const [processedSize, setProcessedSize] = useState<number | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingProgress, setProcessingProgress] = useState(0);
    const [targetSize, setTargetSize] = useState<number>(1024 * 1024);
    const [fileName, setFileName] = useState<string>('');
    const [customFileNames, setCustomFileNames] = useState<{ [key: string]: string }>({});

    // IAP Integration
    const { isPremium, requestPurchase, restorePurchases, processing: iapProcessing } = useIAP();

    const [loaded, setLoaded] = useState(false);
    const [rewardedAd, setRewardedAd] = useState<RewardedAd | null>(null);
    const [appOpenAd, setAppOpenAd] = useState<AppOpenAd | null>(null);
    const [isAdRewardEarned, setIsAdRewardEarned] = useState(false);

    // State to track which action triggered the ad (single save or batch save)
    const [pendingAction, setPendingAction] = useState<'SINGLE_SAVE_VIDEO' | 'BATCH_SAVE' | null>(null);

    useEffect(() => {
        if (selectedImages.length > 0) {
            handleProcessAsset(selectedImages[selectedIndex]);

            const currentAsset = selectedImages[selectedIndex];
            const key = currentAsset.uri;

            if (customFileNames[key]) {
                setFileName(customFileNames[key]);
            } else {
                setFileName(generateDefaultFileName(selectedIndex));
            }
        }
    }, [selectedImages, selectedIndex, targetSize]);

    // ... (AdMob logic remains largely the same, just dependent on isPremium from hook)
    useEffect(() => {
        if (isPremium) {
            // Remove ads if premium matches
            setRewardedAd(null);
            setAppOpenAd(null);
            return;
        }

        // Rewarded Ad
        const ad = RewardedAd.createForAdRequest(AdConfig.rewardedAdUnitId, {
            keywords: ['photo', 'camera'],
        });

        const unsubscribeLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
            setLoaded(true);
        });

        const unsubscribeEarned = ad.addAdEventListener(
            RewardedAdEventType.EARNED_REWARD,
            reward => {
                setIsAdRewardEarned(true);
            },
        );

        const unsubscribeClosed = ad.addAdEventListener(
            AdEventType.CLOSED,
            () => {
                setLoaded(false);
                ad.load();
            }
        );

        ad.load();
        setRewardedAd(ad);

        // App Open Ad Logic
        const openAd = AppOpenAd.createForAdRequest(AdConfig.appOpenAdUnitId, {
            requestNonPersonalizedAdsOnly: true,
        });

        const unsubscribeOpenLoaded = openAd.addAdEventListener(AdEventType.LOADED, () => {
            if (!isPremium) {
                openAd.show();
            }
        });

        if (!isPremium) {
            openAd.load();
            setAppOpenAd(openAd);
        }

        return () => {
            unsubscribeLoaded();
            unsubscribeEarned();
            unsubscribeClosed();
            unsubscribeOpenLoaded();
        };
    }, [isPremium]);

    useEffect(() => {
        if (isAdRewardEarned) {
            if (pendingAction === 'BATCH_SAVE') {
                performBatchSave();
            } else if (pendingAction === 'SINGLE_SAVE_VIDEO') {
                performSingleSave();
            }
            setIsAdRewardEarned(false);
            setPendingAction(null);
        }
    }, [isAdRewardEarned, pendingAction]);

    const generateDefaultFileName = (index: number) => {
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        return `PhotoPress_${timestamp}_${index + 1}`;
    };

    const pickImage = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
            Alert.alert("権限が必要です", "このアプリを使用するには写真へのアクセス許可が必要です。");
            return;
        }

        const limit = isPremium ? 30 : 10;

        if (selectedImages.length >= limit) {
            Alert.alert("制限到達", `一度に選択できる画像は${limit}枚までです。\nPremiumにアップグレードすると30枚まで選択できます。`, [
                { text: "閉じる" },
                { text: "Premiumにアップグレード", onPress: handlePurchase }
            ]);
            return;
        }

        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.All,
                allowsEditing: false,
                allowsMultipleSelection: true,
                selectionLimit: limit - selectedImages.length,
                quality: 1,
                exif: true,
            });

            if (!result.canceled) {
                // ... (existing logic)
                setSelectedImages(prevImages => {
                    const newImages = result.assets.filter(newAsset =>
                        !prevImages.some(existing => existing.uri === newAsset.uri || (existing.assetId && existing.assetId === newAsset.assetId))
                    );
                    const totalImages = [...prevImages, ...newImages];

                    if (totalImages.length > limit) {
                        Alert.alert("制限超過", `${limit}枚を超えた分は除外されました。`);
                        return totalImages.slice(0, limit);
                    }
                    return totalImages;
                });

                if (selectedImages.length === 0) {
                    setSelectedIndex(0);
                }
                setProcessedImage(null);
            }
        } catch (error) {
            console.log("Error handling image picker:", error);
            Alert.alert("エラー", "画像選択中にエラーが発生しました。");
        }
    };

    // ... handleProcessAsset, handleShare (unchanged)

    // ... handleProcessAsset (omitted for brevity, assume unchanged logic but using isPremium)
    const handleProcessAsset = async (asset: ImagePicker.ImagePickerAsset) => {
        if (!asset) return;
        setIsProcessing(true);
        setProcessingProgress(0);

        try {
            if (asset.type === 'video') {
                const resultUri = await processVideo(asset.uri, (progress) => {
                    setProcessingProgress(progress);
                });
                const size = await getVideoSize(resultUri);
                setProcessedImage({ uri: resultUri, width: asset.width, height: asset.height, type: 'video' });
                setProcessedSize(size);
            } else {
                let result;
                if (targetSize === 0) {
                    result = await processImage(asset.uri, { width: asset.width, compress: 0.9 });
                } else {
                    result = await processImageToTargetSize(asset.uri, targetSize, asset.width);
                }
                setProcessedImage({ ...result, type: 'image' });
                const size = await getFileSize(result.uri);
                setProcessedSize(size);
            }
        } catch (error) {
            Alert.alert("エラー", "メディアの処理に失敗しました。");
            console.error(error);
        } finally {
            setIsProcessing(false);
            setProcessingProgress(0);
        }
    };

    const handleShare = async () => {
        if (!processedImage) return;
        try {
            const available = await Sharing.isAvailableAsync();
            if (available) {
                const extension = processedImage.uri.split('.').pop();
                const newUri = FileSystem.cacheDirectory + fileName + '.' + extension;
                await FileSystem.copyAsync({ from: processedImage.uri, to: newUri });
                await Sharing.shareAsync(newUri);
            } else {
                Alert.alert("共有できません", "このデバイスでは共有機能が利用できません");
            }
        } catch (error) {
            console.error("Share error:", error);
            Alert.alert("エラー", "共有中にエラーが発生しました。");
        }
    };


    const handleSave = async () => {
        if (!processedImage) return;

        // Video Save - Check Premium/Ad
        if (processedImage.type === 'video' && !isPremium) {
            if (loaded && rewardedAd) {
                Alert.alert(
                    "Premium機能",
                    "動画を保存するには広告を視聴してください。",
                    [
                        { text: "キャンセル", style: "cancel" },
                        {
                            text: "広告を消す (¥370)",
                            onPress: handlePurchase
                        },
                        {
                            text: "広告を見る",
                            onPress: () => {
                                setPendingAction('SINGLE_SAVE_VIDEO');
                                setLoaded(false);
                                rewardedAd.show();
                            }
                        }
                    ]
                );
            } else {
                Alert.alert("広告読み込み中", "広告を準備しています。少々お待ちください。");
            }
            return;
        }

        performSingleSave();
    };

    const performSingleSave = async () => {
        if (!processedImage) return;

        try {
            const permission = await MediaLibrary.requestPermissionsAsync();
            if (permission.granted) {
                await MediaLibrary.saveToLibraryAsync(processedImage.uri);
                Alert.alert("保存完了", "写真アプリに保存しました！");
            } else {
                Alert.alert("エラー", "写真へのアクセス権限がありません。");
            }
        } catch (error) {
            console.error(error);
            Alert.alert("エラー", "保存に失敗しました。");
        }
    };

    const handleSaveAll = async () => {
        if (selectedImages.length === 0) return;

        // Premium Check
        if (!isPremium) {
            if (loaded && rewardedAd) {
                Alert.alert(
                    "Premium機能",
                    "一括保存するには動画広告を視聴してください。",
                    [
                        { text: "キャンセル", style: "cancel" },
                        {
                            text: "広告を消す (¥370)",
                            onPress: handlePurchase
                        },
                        {
                            text: "広告を見る",
                            onPress: () => {
                                setPendingAction('BATCH_SAVE');
                                setLoaded(false);
                                rewardedAd.show();
                            }
                        }
                    ]
                );
            } else {
                Alert.alert("広告読み込み中", "広告を準備しています。少々お待ちください。");
            }
            return;
        }

        performBatchSave();
    };

    const handlePurchase = async () => {
        if (iapProcessing) return;

        try {
            await requestPurchase();
        } catch (e) {
            Alert.alert("エラー", "購入処理を開始できませんでした。");
        }
    };

    const handleRestore = async () => {
        const restored = await restorePurchases();
        if (restored) {
            Alert.alert("復元完了", "購入情報を復元しました。");
        } else {
            Alert.alert("通知", "復元できる購入情報は見つかりませんでした。");
        }
    };

    const performBatchSave = async () => {
        setIsProcessing(true);
        let savedCount = 0;
        let errors = 0;

        try {
            const { status, canAskAgain } = await MediaLibrary.requestPermissionsAsync();

            if (status !== 'granted') {
                // ... (permission handling unchanged)
                if (!canAskAgain) {
                    Alert.alert("権限が必要です", "設定から許可してください。", [{ text: "設定を開く", onPress: () => Linking.openSettings() }, { text: "キャンセル" }]);
                } else {
                    Alert.alert("権限が必要です", "画像保存には権限が必要です。");
                }
                setIsProcessing(false);
                return;
            }

            for (let i = 0; i < selectedImages.length; i++) {
                const img = selectedImages[i];
                try {
                    let result;
                    if (targetSize === 0) {
                        result = await processImage(img.uri, { width: img.width, compress: 0.9 });
                    } else {
                        result = await processImageToTargetSize(img.uri, targetSize, img.width);
                    }
                    const extension = result.uri.split('.').pop();
                    let saveFileName = customFileNames[img.uri];
                    if (!saveFileName || saveFileName.trim() === '') {
                        saveFileName = generateDefaultFileName(i);
                    }
                    const newUri = FileSystem.cacheDirectory + saveFileName + '.' + extension;
                    await FileSystem.copyAsync({ from: result.uri, to: newUri });
                    await MediaLibrary.saveToLibraryAsync(newUri);
                    savedCount++;
                } catch (e) {
                    console.error("Error saving image index " + i, e);
                    errors++;
                }
            }

            let message = `${savedCount}枚の画像を保存しました。`;
            if (errors > 0) message += `\n(${errors}枚の保存に失敗しました)`;
            Alert.alert("完了", message);

        } catch (error) {
            console.error(error);
            Alert.alert("エラー", "一括保存中にエラーが発生しました。");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar style="auto" />
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>PhotoPress</Text>
                    <Text style={styles.subtitle}>Exif削除 & 自動リサイズ</Text>
                </View>
                {!isPremium && (
                    <TouchableOpacity style={styles.premiumButton} onPress={handlePurchase}>
                        {iapProcessing ? <ActivityIndicator size="small" color="#8E44AD" /> : <Text style={styles.premiumButtonText}>🚫 広告削除 (¥370)</Text>}
                    </TouchableOpacity>
                )}
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView contentContainerStyle={styles.content}>
                    {!isPremium && <AdBanner unitId={AdConfig.bannerTopAdUnitId} />}

                    {/* ... (Main Content: Selected Images Check or Upload Button) ... */}
                    {selectedImages.length === 0 ? (
                        <>
                            <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                                <Text style={styles.uploadText}>写真を選択</Text>
                                <Text style={styles.uploadSubtext}>タップして安全に処理</Text>
                            </TouchableOpacity>
                            {!isPremium && (
                                <TouchableOpacity style={{ marginTop: 20 }} onPress={handleRestore}>
                                    <Text style={{ color: '#666', textDecorationLine: 'underline' }}>購入を復元する</Text>
                                </TouchableOpacity>
                            )}
                        </>
                    ) : (
                        // ... (Preview Container) ...
                        <View style={styles.previewContainer}>
                            <ScrollView horizontal style={styles.thumbnailContainer} showsHorizontalScrollIndicator={false}>
                                {selectedImages.map((img, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        onPress={() => setSelectedIndex(index)}
                                        style={[styles.thumbnailWrapper, selectedIndex === index && styles.thumbnailSelected]}
                                    >
                                        <Image source={{ uri: img.uri }} style={styles.thumbnail} />
                                        {img.type === 'video' && (
                                            <View style={styles.videoIndicator}>
                                                <Text style={styles.videoIndicatorText}>▶</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                ))}
                                <TouchableOpacity style={styles.addMoreButton} onPress={pickImage}>
                                    <Text style={styles.addMoreText}>+</Text>
                                </TouchableOpacity>
                            </ScrollView>

                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>
                                    オリジナル ({selectedIndex + 1}/{selectedImages.length})
                                    {selectedImages[selectedIndex].type === 'video' ? ' [動画]' : ''}
                                </Text>
                                <Image source={{ uri: selectedImages[selectedIndex].uri }} style={styles.previewImage} resizeMode="contain" />
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>解像度:</Text>
                                    <Text style={styles.infoValue}>{selectedImages[selectedIndex].width} x {selectedImages[selectedIndex].height}</Text>
                                </View>
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>サイズ:</Text>
                                    <Text style={styles.infoValue}>{selectedImages[selectedIndex].fileSize ? (selectedImages[selectedIndex].fileSize / 1024).toFixed(0) + ' KB' : '不明'}</Text>
                                </View>
                            </View>

                            {selectedImages[selectedIndex].type !== 'video' && (
                                <View style={styles.targetSizeContainer}>
                                    <Text style={styles.sectionLabel}>目標ファイルサイズ:</Text>
                                    <View style={styles.chipContainer}>
                                        {TARGET_SIZES.map((size) => (
                                            <TouchableOpacity
                                                key={size.label}
                                                style={[styles.chip, targetSize === size.value && styles.chipSelected]}
                                                onPress={() => setTargetSize(size.value)}
                                            >
                                                <Text style={[styles.chipText, targetSize === size.value && styles.chipTextSelected]}>
                                                    {size.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {selectedImages[selectedIndex].type === 'video' && (
                                <View style={{ marginVertical: 10, padding: 10, backgroundColor: '#f0f0f0', borderRadius: 8 }}>
                                    <Text style={{ textAlign: 'center', color: '#666' }}>動画は自動的に圧縮・メタデータ削除されます</Text>
                                </View>
                            )}

                            <View style={styles.arrowContainer}>
                                <Text style={styles.arrow}>⬇️ クリーンアップ & {selectedImages[selectedIndex].type === 'video' ? '圧縮' : 'リサイズ'} ⬇️</Text>
                            </View>

                            {isProcessing ? (
                                <View style={{ alignItems: 'center', margin: 20 }}>
                                    <ActivityIndicator size="large" color="#007AFF" />
                                    <Text style={{ marginTop: 10, color: '#666' }}>
                                        処理中... {processingProgress > 0 ? `${(processingProgress * 100).toFixed(0)}%` : ''}
                                    </Text>
                                </View>
                            ) : processedImage && (
                                <View style={[styles.card, styles.processedCard]}>
                                    <Text style={styles.cardTitle}>投稿準備完了</Text>
                                    <Image source={{ uri: processedImage.uri }} style={styles.previewImage} resizeMode="contain" />
                                    <View style={styles.infoRow}>
                                        <Text style={styles.infoLabel}>タイプ:</Text>
                                        <Text style={styles.infoValue}>{processedImage.type === 'video' ? '動画' : '画像'}</Text>
                                    </View>
                                    <View style={styles.infoRow}>
                                        <Text style={styles.infoLabel}>サイズ:</Text>
                                        <Text style={styles.infoValue}>{processedSize ? (processedSize / 1024).toFixed(0) + ' KB' : '不明'}</Text>
                                    </View>
                                    {selectedImages[selectedIndex].fileSize && processedSize && (
                                        <Text style={styles.reductionText}>
                                            {((selectedImages[selectedIndex].fileSize - processedSize) / 1024).toFixed(0)} KB 削減しました ({((1 - processedSize / selectedImages[selectedIndex].fileSize) * 100).toFixed(0)}%)
                                        </Text>
                                    )}

                                    <View style={styles.inputContainer}>
                                        <Text style={styles.infoLabel}>ファイル名:</Text>
                                        <TextInput
                                            style={styles.filenameInput}
                                            value={fileName}
                                            onChangeText={(text) => {
                                                setFileName(text);
                                                if (selectedImages[selectedIndex]) {
                                                    setCustomFileNames(prev => ({
                                                        ...prev,
                                                        [selectedImages[selectedIndex].uri]: text
                                                    }));
                                                }
                                            }}
                                            placeholder="ファイル名を入力"
                                        />
                                    </View>

                                    <View style={styles.actionButtonsContainer}>
                                        <TouchableOpacity style={[styles.actionButton, styles.shareButton]} onPress={handleShare}>
                                            <Text style={styles.actionButtonText}>シェア</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.actionButton, styles.saveButton]} onPress={handleSave}>
                                            <Text style={styles.actionButtonText}>保存</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {selectedImages.length > 1 && !isProcessing && (
                                <TouchableOpacity style={styles.saveAllButton} onPress={handleSaveAll}>
                                    <Text style={styles.saveAllButtonText}>
                                        {isPremium ? "📸 まとめて保存" : "📸 まとめて保存 (広告あり)"}
                                    </Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity style={styles.resetButton} onPress={() => {
                                setSelectedImages([]);
                                setSelectedIndex(0);
                            }}>
                                <Text style={styles.resetButtonText}>全てクリア</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
            {!isPremium && <AdBanner unitId={AdConfig.bannerBottomAdUnitId} />}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f7',
    },
    header: {
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e1e1e1',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    premiumButton: {
        backgroundColor: '#fff',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#8E44AD',
    },
    premiumButtonText: {
        color: '#8E44AD',
        fontSize: 12,
        fontWeight: 'bold',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
    content: {
        padding: 20,
        alignItems: 'center',
        paddingBottom: 50,
    },
    uploadButton: {
        width: '100%',
        height: 200,
        backgroundColor: '#fff',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#ddd',
        borderStyle: 'dashed',
        marginTop: 40,
    },
    uploadText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#007AFF',
    },
    uploadSubtext: {
        fontSize: 14,
        color: '#999',
        marginTop: 8,
    },
    previewContainer: {
        width: '100%',
        alignItems: 'center',
    },
    card: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    processedCard: {
        borderColor: '#007AFF',
        borderWidth: 2,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
        color: '#333',
    },
    previewImage: {
        width: '100%',
        height: 200,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        marginBottom: 12,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    infoLabel: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    infoValue: {
        fontSize: 14,
        color: '#333',
        fontWeight: 'bold',
        fontFamily: 'Menlo',
    },
    arrowContainer: {
        marginVertical: 15,
    },
    arrow: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#666',
    },
    reductionText: {
        marginTop: 10,
        fontSize: 14,
        color: '#34C759',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    actionButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
        gap: 10,
    },
    actionButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    shareButton: {
        backgroundColor: '#007AFF',
    },
    saveButton: {
        backgroundColor: '#34C759',
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    resetButton: {
        marginTop: 30,
        padding: 10,
    },
    resetButtonText: {
        color: '#999',
        fontSize: 14,
        textDecorationLine: 'underline',
    },
    targetSizeContainer: {
        width: '100%',
        marginTop: 20,
        marginBottom: 5,
    },
    sectionLabel: {
        fontSize: 14,
        color: '#666',
        marginBottom: 10,
        fontWeight: '600',
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#eee',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    chipSelected: {
        backgroundColor: '#e3f2fd',
        borderColor: '#007AFF',
    },
    chipText: {
        fontSize: 14,
        color: '#333',
    },
    chipTextSelected: {
        color: '#007AFF',
        fontWeight: 'bold',
    },
    inputContainer: {
        marginTop: 15,
        marginBottom: 10,
    },
    filenameInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 10,
        marginTop: 5,
        fontSize: 14,
        backgroundColor: '#f9f9f9',
    },
    thumbnailContainer: {
        flexDirection: 'row',
        marginBottom: 15,
        maxHeight: 80,
    },
    thumbnailWrapper: {
        marginRight: 10,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: 'transparent',
        padding: 2,
    },
    thumbnailSelected: {
        borderColor: '#007AFF',
    },
    thumbnail: {
        width: 70,
        height: 70,
        borderRadius: 6,
    },
    addMoreButton: {
        width: 70,
        height: 70,
        borderRadius: 8,
        backgroundColor: '#eee',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    addMoreText: {
        fontSize: 24,
        color: '#666',
        fontWeight: 'bold',
    },
    saveAllButton: {
        marginTop: 20,
        backgroundColor: '#8E44AD', // Purple for Premium
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: 'center',
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    saveAllButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    videoIndicator: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoIndicatorText: {
        color: '#fff',
        fontSize: 10,
    },
});
