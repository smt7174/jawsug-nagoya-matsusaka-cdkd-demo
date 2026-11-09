#!/usr/bin/env bash
# 使い方: scripts/bench.sh <cfn|cdkd> <deploy|destroy>
#   cfn  -> npx cdk  / スタック DemoStack-cfn
#   cdkd -> npx cdkd / スタック DemoStack-cdkd
# 環境変数 EXTRA で追加フラグを渡せる (例: EXTRA=--no-wait scripts/bench.sh cdkd deploy)
set -euo pipefail
cd "$(dirname "$0")/.."

deployer="${1:?cfn か cdkd を指定}"
action="${2:?deploy か destroy を指定}"
stack="DemoStack-${deployer}"

case "$deployer" in
  cfn)  tool=cdk ;;
  cdkd) tool=cdkd ;;
  *) echo "deployer は cfn / cdkd のみ" >&2; exit 2 ;;
esac

case "$action" in
  deploy)  args=(deploy --require-approval never) ;;
  destroy) args=(destroy --force) ;;
  *) echo "action は deploy / destroy のみ" >&2; exit 2 ;;
esac

start=$(date +%s.%N)
set +e
# shellcheck disable=SC2086
npx "$tool" "${args[@]}" -c "deployer=${deployer}" ${EXTRA:-} "$stack"
rc=$?
set -e
end=$(date +%s.%N)

elapsed=$(echo "$end - $start" | bc -l)
secs=$(printf '%.0f' "$elapsed")
label="デプロイ時間"
[ "$action" = destroy ] && label="削除時間"

printf '\n==== %s %s (exit=%d) ====\n' "$tool" "$action" "$rc"
printf '開始：%s\n' "$(date -d "@${start}" +%H:%M:%S)"
printf '終了：%s\n' "$(date -d "@${end}" +%H:%M:%S)"
printf '%s：%02d:%02d\n' "$label" "$((secs / 60))" "$((secs % 60))" # 1分未満は 00:ss
printf '%s,%s,%s,%.1f,%d\n' "$(date -Iseconds)" "$tool" "$action" "$elapsed" "$rc" >> bench-results.csv
exit "$rc"
