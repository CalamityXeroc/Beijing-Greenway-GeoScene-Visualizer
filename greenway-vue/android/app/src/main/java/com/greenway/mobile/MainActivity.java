package com.greenway.mobile;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /**
     * 注册主 App 自定义插件（Capacitor 6 只自动加载 capacitor.plugins.json 中声明的
     * 官方插件，主 App 内的 @CapacitorPlugin 需在此手动注册）。
     * 注意：必须在 super.onCreate（其内部会 load() 构建 Bridge）之前调用。
     */
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GeoScenePlugin.class);
        super.onCreate(savedInstanceState);
    }
}