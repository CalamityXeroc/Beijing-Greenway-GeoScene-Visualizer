package com.greenway.mobile;

import android.content.Context;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.arcgismaps.ArcGISEnvironment;
import com.arcgismaps.License;

@CapacitorPlugin(name = "GeoScene")
public class GeoScenePlugin extends Plugin {

    private static final String TAG = "GeoScenePlugin";
    private boolean initialized = false;

    /**
     * 初始化 GeoScene 运行环境（设置 applicationContext）。
     * 无 license key 时运行于 Developer 许可等级，功能完整仅地图带水印。
     */
    @PluginMethod
    public void init(PluginCall call) {
        try {
            if (!initialized) {
                Context ctx = getContext().getApplicationContext();
                ArcGISEnvironment.INSTANCE.setApplicationContext(ctx);
                initialized = true;
            }
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("initialized", true);
            call.resolve(ret);
        } catch (Throwable t) {
            Log.e(TAG, "init failed", t);
            call.reject("init failed: " + t.getMessage());
        }
    }

    /**
     * 返回 GeoScene SDK 版本
     */
    @PluginMethod
    public void getSdkVersion(PluginCall call) {
        try {
            String v = ArcGISEnvironment.INSTANCE.getApiVersion();
            JSObject ret = new JSObject();
            ret.put("version", v);
            call.resolve(ret);
        } catch (Throwable t) {
            Log.e(TAG, "getSdkVersion failed", t);
            call.reject("getSdkVersion failed: " + t.getMessage());
        }
    }

    /**
     * 返回当前许可信息（未授权时为 Developer 等级）
     */
    @PluginMethod
    public void getLicenseLevel(PluginCall call) {
        try {
            License lic = ArcGISEnvironment.INSTANCE.getLicense();
            String level = lic != null && lic.getLevel() != null
                    ? lic.getLevel().getClass().getSimpleName() : "UNKNOWN";
            String status = lic != null && lic.getStatus() != null
                    ? lic.getStatus().getClass().getSimpleName() : "UNKNOWN";
            JSObject ret = new JSObject();
            ret.put("licenseLevel", level);
            ret.put("licenseStatus", status);
            call.resolve(ret);
        } catch (Throwable t) {
            Log.e(TAG, "getLicenseLevel failed", t);
            JSObject ret = new JSObject();
            ret.put("licenseLevel", "Developer");
            ret.put("error", t.getMessage());
            call.resolve(ret);
        }
    }
}
