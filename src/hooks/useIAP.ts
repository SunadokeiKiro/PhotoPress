import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as RNIap from 'react-native-iap';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ITEM_SKUS = Platform.select({
    ios: ['remove_ads'],
    android: ['remove_ads'],
}) as string[];

const STORAGE_KEY_IS_PREMIUM = 'is_premium_user';

export const useIAP = () => {
    const [isPremium, setIsPremium] = useState(false);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        // 初期化時にローカル保存されたステータスを読み込む
        loadPremiumStatus();

        // IAPの初期化とリスナー設定
        initIAP();

        return () => {
            RNIap.endConnection();
        };
    }, []);

    const loadPremiumStatus = async () => {
        try {
            const value = await AsyncStorage.getItem(STORAGE_KEY_IS_PREMIUM);
            if (value === 'true') {
                setIsPremium(true);
            }
        } catch (e) {
            console.error('Failed to load premium status', e);
        }
    };

    const savePremiumStatus = async (status: boolean) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY_IS_PREMIUM, status ? 'true' : 'false');
            setIsPremium(status);
        } catch (e) {
            console.error('Failed to save premium status', e);
        }
    };

    const initIAP = async () => {
        try {
            await RNIap.initConnection();
            if (Platform.OS === 'android') {
                await RNIap.flushFailedPurchasesCachedAsPendingAndroid();
            }

            // 購入の復元（過去に購入済みかチェック）
            checkPriorPurchase();
        } catch (err) {
            console.warn('IAP init error', err);
        }
    };

    const checkPriorPurchase = async () => {
        try {
            const purchases = await RNIap.getAvailablePurchases();
            let restored = false;
            purchases.forEach(purchase => {
                if (ITEM_SKUS.includes(purchase.productId)) {
                    restored = true;
                    // 消費型でなければここでfinishTransactionは不要な場合もあるが、念のため
                    // 非消費型(Non-consumable)はfinishTransactionしないと再度購入できないことがある？
                    // react-native-iapの仕様ではfinishTransactionが必要
                    // ただしgetAvailablePurchasesは未消費のものだけでなく履歴も取る？
                    // ここではシンプルに「持っているか」だけ判定
                }
            });

            if (restored) {
                savePremiumStatus(true);
            }
        } catch (err) {
            console.warn('Check prior purchase error', err);
        }
    };

    const requestPurchase = async () => {
        if (processing) return;
        setProcessing(true);

        try {
            const products = await RNIap.getProducts({ skus: ITEM_SKUS });
            if (products.length === 0) {
                throw new Error('No products found');
            }

            const sku = products[0].productId;
            await RNIap.requestPurchase({ sku });
            // 実際の購入完了処理は purchaseUpdateListener で拾う必要があるが、
            // 簡易実装としてここでawaitが返ってきたら成功とみなすのは危険（キャンセル等の場合もある）
            // 厳密にはListenersを設定すべき
        } catch (err: any) {
            // キャンセルされた場合など
            console.log('Purchase handling', err);
        } finally {
            setProcessing(false);
        }
    };

    const restorePurchases = async () => {
        setProcessing(true);
        try {
            const purchases = await RNIap.getAvailablePurchases();
            const hasPremium = purchases.some(p => ITEM_SKUS.includes(p.productId));
            if (hasPremium) {
                await savePremiumStatus(true);
                return true;
            }
            return false;
        } catch (e) {
            console.warn(e);
            return false;
        } finally {
            setProcessing(false);
        }
    };

    // リスナーの設定（useEffect内でやるべきだが、簡略化のためここには実装骨子のみ記述）
    // 本格実装では purchaseUpdatedListener, purchaseErrorListener が必要

    useEffect(() => {
        const purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(async (purchase: RNIap.Purchase) => {
            const receipt = purchase.transactionReceipt;
            if (receipt) {
                try {
                    if (Platform.OS === 'ios') {
                        await RNIap.finishTransaction({ purchase, isConsumable: false });
                    } else {
                        await RNIap.finishTransaction({ purchase, isConsumable: false });
                    }

                    if (ITEM_SKUS.includes(purchase.productId)) {
                        await savePremiumStatus(true);
                    }
                } catch (ackErr) {
                    console.warn('ackErr', ackErr);
                }
            }
        });

        const purchaseErrorSubscription = RNIap.purchaseErrorListener((error: RNIap.PurchaseError) => {
            console.warn('purchaseErrorListener', error);
            setProcessing(false);
        });

        return () => {
            if (purchaseUpdateSubscription) {
                purchaseUpdateSubscription.remove();
            }
            if (purchaseErrorSubscription) {
                purchaseErrorSubscription.remove();
            }
        };
    }, []);


    return {
        isPremium,
        requestPurchase,
        restorePurchases,
        processing
    };
};
