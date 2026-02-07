# Google Play ストアへの公開手順 (Expo)

PhotoPressアプリをGoogle Playで公開するための手順です。
Expoを使用しているため、複雑なAndroid Studioの操作を最小限に抑えられます。

## 1. 前提条件
-   **Google Play Developer Account**: ($25, 一回払い) が必要です。
-   **EAS CLI**: Expo Application Servicesのコマンドラインツール。
    ```bash
    npm install -g eas-cli
    eas login
    ```

## 2. プロジェクトの設定 (app.json)
`app.json` にAndroid用のパッケージ名を設定する必要があります。
**ユニークな名前**である必要があります（例: `com.yourname.photopress`）。

```json
"android": {
  "package": "com.yourname.photopress",
  "adaptiveIcon": { ... }
}
```

## 3. ビルドの作成 (AABファイル)
Google Playには `.aab` (Android App Bundle)形式でアップロードします。

1.  **EAS Buildの構成**:
    ```bash
    eas build:configure
    ```
    - プラットフォームで `Android` を選択。

2.  **ビルドの実行**:
    ```bash
    eas build --platform android
    ```
    - 鍵ストア（Keystore）の作成を聞かれたら、Expoに任せる（「Generate new keystore」）のが一番簡単です。
    - ビルドが完了すると、AABファイルのダウンロードリンクが表示されます。

## 4. Google Play Consoleへのアップロード

1.  [Google Play Console](https://play.google.com/console/) にログイン。
2.  **アプリの作成**: アプリ名、言語などを入力。
3.  **初期設定**: プライバシーポリシー、対象年齢、広告の有無などを回答。
    - ※このアプリは広告を含むため「広告あり」を選択。
    - ※画像処理はローカルで行うため、プライバシーポリシーにはその旨（データを収集しない等）を記載。
4.  **リリースの作成**:
    - 「製品版」または「内部テスト」を選択。
    - 手順3でダウンロードした `.aab` ファイルをアップロード。
5.  **ストアの掲載情報**:
    - スクリーンショット、アイコン(512x512)、フィーチャーグラフィック(1024x500)をアップロード。
6.  **審査への提出**: すべて入力したら「審査に送信」をクリック。

## 注意点
- **初回審査**: 数日〜1週間程度かかる場合があります。
- **権限**: `READ_MEDIA_IMAGES` などの権限を使用しているため、なぜ必要なのかをPlay Consoleで聞かれる場合があります（「ユーザーが選択した画像を処理するため」と回答）。
