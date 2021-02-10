---
title: サイトにAtomフィードを付けてみた
---

タイトル通り。
まあほとんど読まれていないと思うので単なる自己満足かもしれないが。

JavaScriptの[feed](https://github.com/jpmonette/feed)というパッケージを使ってフィードのXMLを作っている。
このライブラリは割と使いやすくて、`Feed`オブジェクトに適当に情報を追加するだけで、AtomなりRSS1/2なり好きなフォーマットで出力できる。

ライブラリがやってくれるので特に必須ではないけど、Atomフィードがどんなものか知るために、[Introduction to Atom](https://validator.w3.org/feed/docs/atom.html) というW3Cのドキュメントを覗いてみたりした。
これは[W3C Feed Validation Service](https://validator.w3.org/feed/)に付属するもので、自分でXMLを作る場合はこれで確認しながらやると良いかもしれない。

このサイトは、[以前にも書いた](/2021-01-04_starting)ように、Next.jsで書いてVercelでホストしている。
最初は1つのページとしてフィードを吐こうと思ったが、Next.jsでXMLをサーブする方法がよく分からなかったので、ビルド時に静的ファイルとして出力してみた。

最近使っているInoreaderでフィードを購読してみたら、日付が全部同じになってしまった。
これはInoreaderの問題なのか、フィード自体に問題があるのかよく分からない。