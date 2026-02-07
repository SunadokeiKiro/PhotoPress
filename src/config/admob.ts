import { TestIds } from 'react-native-google-mobile-ads';

// ⚠️ AdMob審査通過後に、以下のIDを本番用のものに書き換えてください
// App IDは app.json (または app.config.ts) で設定します
const PRODUCTION_REWARDED_UNIT_ID = 'ca-app-pub-9278680005368587/2929384111';
const PRODUCTION_BANNER_TOP_UNIT_ID = 'ca-app-pub-9278680005368587/1461116125';
const PRODUCTION_BANNER_BOTTOM_UNIT_ID = 'ca-app-pub-9278680005368587/5168534648';
const PRODUCTION_APP_OPEN_UNIT_ID = 'ca-app-pub-9278680005368587/6258255032';
// Actually they provided App ID and 2 Banner IDs. They did NOT provide App Open ID in this specific message.
// I will keep the previous APP_OPEN_ID placeholder or whatever was there if not provided.
// Wait, the previous file had PRODUCTION_APP_OPEN_UNIT_ID placeholder.
// I'll leave App Open ID as placeholder for now since user didn't explicitly give it in this turn (or maybe I missed it? No, just App ID and 2 Banners).

export const AdConfig = {
    // 開発ビルド(__DEV__)ならテストID、製品ビルドなら本番IDを自動選択
    rewardedAdUnitId: __DEV__ ? TestIds.REWARDED : PRODUCTION_REWARDED_UNIT_ID,
    bannerTopAdUnitId: __DEV__ ? TestIds.BANNER : PRODUCTION_BANNER_TOP_UNIT_ID,
    bannerBottomAdUnitId: __DEV__ ? TestIds.BANNER : PRODUCTION_BANNER_BOTTOM_UNIT_ID,
    appOpenAdUnitId: __DEV__ ? TestIds.APP_OPEN : PRODUCTION_APP_OPEN_UNIT_ID,
};
