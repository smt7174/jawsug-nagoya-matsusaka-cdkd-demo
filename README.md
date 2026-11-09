# jawsug-nagoya-matsusaka-cdkd-demo

JAWS-UG 名古屋 松阪出張 Demo-1グランプリ用。cdkd と CloudFormation(`cdk deploy`)のデプロイ時間を比較するデモ。

## 構成

API Gateway → Lambda(NodejsFunction) → S3 バケット 2 つ / DynamoDB テーブル 2 つ

- Lambda は 4 リソースに対し読み取りのみ可能(S3 一覧取得、DynamoDB Scan)。レスポンスは各リソースの件数。
- 全リソースの RemovalPolicy は `DESTROY`。リージョンは東京(`ap-northeast-1`)。
- スタック定義は共通。context `deployer`(`cdkd` / `cfn`)で、スタック名・construct ID・タグを区別する。

| deployer | スタック名 |
|---|---|
| `cfn`(デフォルト) | `DemoStack-cfn` |
| `cdkd` | `DemoStack-cdkd` |

## ディレクトリ

- `bin/app.ts` … エントリ(deployer の解決、スタック生成)
- `lib/demo-stack.ts` … スタック定義
- `lambda/index.ts` … Lambda ハンドラー
- `scripts/` … デプロイ時間の計測スクリプトと手順([scripts/README.md](scripts/README.md))
- `test/` … スタックのユニットテスト

## コマンド

```bash
npm install
npm run build      # 型チェック
npm test           # ユニットテスト
npx cdk synth -c deployer=cdkd

# デプロイ時間の計測(中身は scripts/bench.sh)
npm run deploy:cfn
npm run deploy:cdkd
npm run deploy:cdkd:nowait
npm run destroy:cfn
npm run destroy:cdkd
```

`cdk bootstrap` と `cdkd bootstrap` は事前に 1 回ずつ必要。結果は `bench-results.csv` に追記される。
