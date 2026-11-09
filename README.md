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

## 手動で deploy / destroy する場合

`npm run` 経由（上記）を使わず、コマンドを直接実行する手順。時間の計測や `bench-results.csv` への記録は行われない。

### 前提
- AWS 認証情報が有効であること（`CDK_DEFAULT_ACCOUNT` は CDK CLI が認証情報から自動設定するため、指定不要）
- `npm install` 済みであること
- `cdk bootstrap` / `cdkd bootstrap` 済みであること（アカウント・リージョンごとに 1 回）

### 必ず指定するもの
- `-c deployer=<cfn|cdkd>` … 省略すると `cfn` 扱いになる
- スタック名 `DemoStack-<deployer>` … 省略すると、synth されたスタックすべてが対象になる

### CloudFormation

```bash
npx cdk deploy  -c deployer=cfn DemoStack-cfn --require-approval never
npx cdk destroy -c deployer=cfn DemoStack-cfn --force
```

### cdkd

```bash
npx cdkd deploy  -c deployer=cdkd DemoStack-cdkd
npx cdkd deploy  -c deployer=cdkd DemoStack-cdkd --no-wait   # 安定待ちを省略（最速）
npx cdkd destroy -c deployer=cdkd DemoStack-cdkd --force
```

> cdkd のオプション（`-c`、`--force` など）が cdk と同じように通るかは、実機での確認が必要。

### 時間を測る・動作確認する
- 時間: `time npx cdk deploy …` のように `time` を付ける。`cdk deploy` が出す「Deployment time」はアセットのアップロード等を含まない
- 動作確認: デプロイ終了時の `Outputs` に出る `ApiUrl` を `curl` で呼ぶ。S3 2 つ・DynamoDB 2 つの `count: 0` が返れば正常

### 削除の確認
```bash
aws cloudformation list-stacks --region ap-northeast-1 \
  --query "StackSummaries[?starts_with(StackName,'DemoStack') && StackStatus!='DELETE_COMPLETE'].StackName" --output text
```
何も表示されなければ、スタックは残っていない（cdkd の場合は `cdkd list` などで確認）。
