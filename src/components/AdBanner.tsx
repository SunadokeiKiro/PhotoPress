import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { AdConfig } from '../config/admob';

export default function AdBanner({ unitId }: { unitId?: string }) {
    // TODO: Add error handling visually if needed, for now just log
    return (
        <View style={styles.container}>
            <BannerAd
                unitId={unitId || AdConfig.bannerTopAdUnitId} // Fallback? Or better to require it. Let's fallback to Top for safety.
                size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
                requestOptions={{
                    requestNonPersonalizedAdsOnly: true,
                }}
                onAdFailedToLoad={(error) => {
                    console.warn('BannerAd failed to load', error);
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 10,
    },
});
