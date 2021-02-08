---
title: TypeScriptでMapとSetを書いてみた
---

## TL;DR

- [[TypeScript]]で、ハッシュ関数と等値性を指定できる[[Map]]と[[Set]]を書いた。
- APIは[[ECMAScript]]のそれらとほぼ同じになるようにした。
- 最初は[[Java]]のLinkedHashMapを移植しかけたけど、ライセンス的に問題があるかもしれないので少し違うものに置き換えた。
- <https://github.com/odiak/map-and-set>で公開した。

---

先日、[[JavaScriptのSetはオブジェクトを入れづらい]]という話を書いたんだけど、その勢いでMapとSetを自分で実装してみることにした。

改めて書くと、やりたいことは、等値性とハッシュ関数を指定できるMapとSetを作ること。
APIはできるだけ[[ECMAScript]]のものと同じにしたい。

クラスの定義はこんな感じ。(コンストラクターの型定義だけ。それ以外のメソッドの型はESと同じ。)

```typescript
class Map<Key, Value> {
  constructor(
    iterable: Iterable<[Key, Value]>,
    {
      hash: (key: Key) => number,
      equal: (key1: Key, key2: Key) => boolean)
    }
  )
}

class Set<Value> {
  constructor(
    iterable: Iterable<Value>,
    {
      hash: (val: Value) => number,
      equal: (val1: Value, val2: Value) => boolean)
    }
  )
}
```

なお、ECMAScriptのと同じく、MapもSetも挿入順が維持されるようにしたい。

## JavaのHashMap, LinkedHashMapを移植してみる→断念

僕が知っている範囲だと、オープンソースの実装を参考にするならJavaのHashMapやLinkedHashMapがいいんじゃないか、と思って探してみた。

- [jdk7u\-jdk/HashMap\.java at master · openjdk\-mirror/jdk7u\-jdk](https://github.com/openjdk-mirror/jdk7u-jdk/blob/master/src/share/classes/java/util/HashMap.java)
- [jdk7u\-jdk/LinkedHashMap\.java at master · openjdk\-mirror/jdk7u\-jdk](https://github.com/openjdk-mirror/jdk7u-jdk/blob/master/src/share/classes/java/util/LinkedHashMap.java)

最初にHashMapを見て大まかに理解したあと、LinkedHashMapを見ると理解がスムーズだった。

APIは多少違うけど、これを移植すればいいんじゃね〜と思ってTypeScriptで同じようなものを書いてみた。
その時の実装が[これ](https://github.com/odiak/map-and-set/blob/7fe53da455e7a31552785f8a74e49368b100bc3c/src/map.ts)。

そのことをTwitterに書いた。

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">とりあえず、JavaのLinkedHashMapを移植してMapを作った</p>&mdash; かいどう🐵 (@odiak_) <a href="https://twitter.com/odiak_/status/1357293417689088001?ref_src=twsrc%5Etfw">February 4, 2021</a></blockquote>

すると、JavaのソースはGPLなので別ライセンスのプロジェクトに移植するのはまずそう、というのを指摘してもらった。

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">JavaのGPLコードの移植だとGPLにしないといけない気がする</p>&mdash; きしだൠ(K8S(Kishidades)) (@kis) <a href="https://twitter.com/kis/status/1357296380289552389?ref_src=twsrc%5Etfw">February 4, 2021</a></blockquote>

## V8の実装を参考にしてみる

APIをかなり変えて移植する場合、ライセンス的にどうなのかな？というのは気になったけど、念のため違う実装で置き換えることにした。
そこで見つけてきたのがこの記事。

[\[V8 Deep Dives\] Understanding Map Internals \| by Andrey Pechkurov \| ITNEXT](https://itnext.io/v8-deep-dives-understanding-map-internals-45eb94a183df)

V8のMapがどう実装されているかという話で、JavaのLinkedHashMapにも近いけど、Entryの順番を保持するための方法が若干違っている。
これを参考にして実装してみることにした。

C++の実装だと、効率化のために予め長さを決めた配列の上にEntryを並べているようだけど、TSではArrayの後ろにpushで追加していくようにした。
もう少し改善の余地はある気がするけど、まあいいや。

出来上がったのがこれ。 <https://github.com/odiak/map-and-set>

npmでも公開した。 <https://www.npmjs.com/package/map-and-set>

標準のMap/Setで満足できない人は、よかったら使ってみてください。

---

## 脱線コーナー

### Jestのはなし

今回は、[[Jest]]というテストのツールを初めて使ってみた。以前にChai+Mochaを使った気がするけど、Jestの方が設定が楽かなぁ？
いや、TypeScriptを使わないなら楽だと思うけど、TSを使うとトータルの手間はあまり変わらないかも。
ツール自体はよくできていると思う。

### JavaのLinkedHashMapと、V8のMapの違い

どちらも、挿入順が維持されるマップの実装。
[[ハッシュテーブル]]にEntryオブジェクトを連ねていく点は共通だけど、挿入順を維持するための仕組みが少し違う。

イメージ:  
![](https://i.kakeru.app/7681efcb1643e2d8c86613caf3f9feb1.svg)

#### JavaのLinkedHashMap

LinkedHashMapは、名前の通り、双方向リストを使っている。
Entryオブジェクト自体がリストのノードにもなっていて、前後への参照を持っている。

LinkedHashMapはheadという特殊なEntryを保持していて、そこを起点にしてそのほかのEntryが連なり、最後のEntryの後ろがheadに繋がる。

Entryを追加するときは、まずハッシュ表から出ている単方向リストの先頭にEntryを追加し、次にheadから始まる双方向リストの最後にEntryを追加する。

削除するときは、まずハッシュ表から出ている単方向リストからEntryを削除し、次に双方向リストからEntryを削除する。

双方向リストを、headを使って頭とお尻をつなげて持っておくことで扱いやすくしているのがなるほど〜と思った。(よくある実装なのかもしれないけど。)

TypeScriptで書くときは、headの扱いが型的に面倒なので、循環させずにheadとtailを持つことになるかな。

#### V8 Map

こちらは、dataTableというEntryの配列を持っており、長さはハッシュテーブルのサイズの2倍。
つまり、それより多くのEntryを入れたい場合はリハッシュせざるを得ない。

また、dataTableに実際に詰まっているEntryの数をnextSlotという変数に入れている。
ここまで聞くとArrayListっぽいなという気もするけど、Entryを削除する時の挙動が面白い。

Entryを追加するときは、まずハッシュテーブルから出ている単方向リストの先頭にEntryを追加して、dataTableのnextSlot番目にEntryを入れてnextSlotをインクリメントする。

Entryを削除するときは、単にEntryのkey,valueをnullで埋めてしまうだけ。
空になったEntryは、ハッシュテーブルを見るときやEntryを列挙するときには無視すればいいだけ。

挿入や削除を何回か行うと、dataTableがいっぱいになってしまう。
削除が行われた場合は、空のEntryもできる。
いっぱいになってしまった場合は、前述したようにリハッシュする。

この実装もなかなか面白いな〜と思った。

TypeScriptでこれを実装するにあたって、キーにnullも入れられるようにしたかったので、ひと工夫が必要だった。
といっても、EntryとEntryContainerという2つのオブジェクトを作り、EntryContainerがEntryを持ち、dataTableはEntryContainerの配列にする。
削除の時には、EntryContainerからEntryを取り除く(nullを入れる)というふうにした。
