import { TestIds } from 'react-native-google-mobile-ads';

// ⚠️ AdMob審査通過後に、以下のIDを本番用のものに書き換えてください (環境変数 .env で管理)
// App IDは app.config.ts で設定します

// 環境変数からIDを取得（未設定時は空文字）
const ENV_REWARDED_ID = process.env.EXPO_PUBLIC_AD_MOB_REWARDED_UNIT_ID ?? '';
const ENV_BANNER_TOP_ID = process.env.EXPO_PUBLIC_AD_MOB_BANNER_TOP_UNIT_ID ?? '';
const ENV_BANNER_BOTTOM_ID = process.env.EXPO_PUBLIC_AD_MOB_BANNER_BOTTOM_UNIT_ID ?? '';
const ENV_APP_OPEN_ID = process.env.EXPO_PUBLIC_AD_MOB_APP_OPEN_UNIT_ID ?? '';

export const AdConfig = {
    // 開発ビルド(__DEV__)ならテストID、製品ビルドなら環境変数の本番ID (環境変数がなければテストIDにフォールバック)
    rewardedAdUnitId: __DEV__ ? TestIds.REWARDED : (ENV_REWARDED_ID || TestIds.REWARDED),
    bannerTopAdUnitId: __DEV__ ? TestIds.BANNER : (ENV_BANNER_TOP_ID || TestIds.BANNER),
    bannerBottomAdUnitId: __DEV__ ? TestIds.BANNER : (ENV_BANNER_BOTTOM_ID || TestIds.BANNER),
    appOpenAdUnitId: __DEV__ ? TestIds.APP_OPEN : (ENV_APP_OPEN_ID || TestIds.APP_OPEN),
};
