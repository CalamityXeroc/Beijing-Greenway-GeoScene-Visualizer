#!/usr/bin/env bash
# 前端同步到安卓工程 + 自动保留自定义插件注册
# cap sync 会覆盖 capacitor.plugins.json，此脚本在 sync 后重新注入自定义插件
set -e
cd "$(dirname "$0")/.."

npx cap sync android

PLUGIN_FILE="android/app/src/main/assets/capacitor.plugins.json"
CUSTOM_ENTRY='{
		"pkg": "geoscene-native",
		"classpath": "com.greenway.mobile.GeoScenePlugin"
	}'

if ! grep -q "com.greenway.mobile.GeoScenePlugin" "$PLUGIN_FILE"; then
  # 去掉末尾的 ]，追加自定义条目后闭合
  python - "$PLUGIN_FILE" <<'EOF'
import sys, json, io
path = sys.argv[1]
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)
data.append({
    "pkg": "geoscene-native",
    "classpath": "com.greenway.mobile.GeoScenePlugin"
})
with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent='\t')
    f.write('\n')
print("已注入 GeoScene 插件注册")
EOF
else
  echo "GeoScene 插件已存在，跳过"
fi
