# odiak.net

React Router framework app running on Cloudflare Workers.

## Commands

- `npm run dev`: start React Router development server
- `npm run build`: download contents, generate the Atom feed, and build for Workers
- `npm run start`: run the built Worker locally with Wrangler
- `npm run deploy`: build and deploy with Wrangler

## 記事の取得

ビルド時に Kuro の `public/` 配下の Markdown を取得する（サブフォルダを含む）。
Kuro の Settings → API トークンで「ノートの読み取り専用」、許可フォルダ `public/` を選んで発行する。

取得先は `https://usekuro.app` に固定。ビルド環境に次の変数を設定する:

- `KURO_API_TOKEN`: 発行したトークン（ビルド用の secret として保存）

トークンはビルド時に使うため、Cloudflare の Worker runtime secrets ではなく **Build variables / secrets** に設定する。
従来の `GOOGLE_CREDENTIALS` と `FOLDER_ID` は不要。トークンはブラウザへ渡さない。
ローカルでは環境変数を設定して `npm run build` を実行する（`.env.local` はこのスクリプトでは自動読込しない）。

先に Kuro の migration `0019_api_token_scopes.sql` とノート API をデプロイし、トークンを発行してからサイトのビルドを切り替える。

- 記事のファイル名・`slug`・frontmatter を維持する。サブフォルダをまたぐ同名ファイルや重複 slug はビルドエラーにする。
- `[[public/subfolder/Note]]` は取得した記事名へ変換し、既存の関連記事生成を続ける。取得した記事に解決できないパス付きリンクは本文に残し、関連記事には含めない。
- 更新日は Kuro の `mtime` を使う。更新日時がない「その他」の記事は一覧の末尾に並べる。作成日は従来どおり frontmatter の `created`、日付入り slug、`fileCreated` の順。Kuro はファイル作成日時を返さないため、日付のない記事は source の frontmatter に追記する。
- 認証失敗、欠損した本文、取得件数ゼロではビルドを止める。ダウンロード失敗時は前回の `contents/` を残す。
- `npm test`: 取得処理とリンク変換の回帰テスト。
