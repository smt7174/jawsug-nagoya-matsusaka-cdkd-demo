# デプロイ時間の計測

## 事前準備(1回だけ)
    npx cdk bootstrap aws://<アカウントID>/ap-northeast-1   # CloudFormation 側
    npx cdkd bootstrap                                      # cdkd 側(別途必要)

## 単発計測
    npm run deploy:cfn
    npm run destroy:cfn
    npm run deploy:cdkd
    npm run deploy:cdkd:nowait            # 最速(--no-wait)
    npm run destroy:cdkd

(中身は `scripts/bench.sh <cfn|cdkd> <deploy|destroy>`。直接実行も可)

結果は `bench-results.csv` に追記される(時刻,ツール,操作,秒,終了コード)。

## 2ターミナル並列(ライブデモ)
左右に2つターミナルを並べ、同時に Enter を押す。スタック名が違うので衝突しない。

    # 左: CloudFormation          # 右: cdkd
    npm run deploy:cfn            npm run deploy:cdkd

終わったら両方 destroy。`bc` が必要(`sudo apt install bc`)。
