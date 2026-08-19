package com.greenway.mobile;

import android.content.Context;
import android.util.Log;
import android.location.Location;
import android.location.LocationManager;
import android.location.Criteria;
import android.os.Looper;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.arcgismaps.ArcGISEnvironment;
import com.arcgismaps.License;

import java.util.List;

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

    /**
     * 获取设备当前位置（原生 Android LocationManager，不依赖 Google Play Services）
     * 国内手机无 GMS 时 Capacitor Geolocation 插件不可用，此方法作为可靠替代。
     * 优先返回高精度 GPS 位置，失败降级网络/基站定位。
     */
    @PluginMethod
    public void getLocation(PluginCall call) {
        try {
            Context ctx = getContext().getApplicationContext();
            LocationManager lm = (LocationManager) ctx.getSystemService(Context.LOCATION_SERVICE);
            if (lm == null) {
                call.reject("系统定位服务不可用");
                return;
            }

            // 1) 先尝试获取最近已知位置（最快速，但可能不精确）
            Location bestLocation = null;
            try {
                List<String> providers = lm.getProviders(true);
                for (String provider : providers) {
                    Location loc = lm.getLastKnownLocation(provider);
                    if (loc != null && (bestLocation == null || loc.getAccuracy() < bestLocation.getAccuracy())) {
                        bestLocation = loc;
                    }
                }
            } catch (SecurityException e) {
                call.reject("位置权限未授予");
                return;
            }

            // 2) 如果有精度较好的缓存位置（< 500m），直接返回（避免等待 GPS 冷启动）
            final Location[] cachedLoc = {null};
            if (bestLocation != null && bestLocation.getAccuracy() < 500) {
                cachedLoc[0] = bestLocation;
                JSObject ret = new JSObject();
                ret.put("lat", bestLocation.getLatitude());
                ret.put("lng", bestLocation.getLongitude());
                ret.put("accuracy", (double) bestLocation.getAccuracy());
                ret.put("source", "cache");
                call.resolve(ret);
                return;
            } else if (bestLocation != null) {
                cachedLoc[0] = bestLocation;
            }

            // 3) 等待新位置：优先 GPS，超时降级网络
            // 使用单次请求（避免持续监听）
            final boolean[] completed = {false};
            final Location[] finalLoc = {null};

            // GPS 请求
            android.location.LocationListener gpsListener = new android.location.LocationListener() {
                @Override
                public void onLocationChanged(Location loc) {
                    if (!completed[0]) {
                        completed[0] = true;
                        finalLoc[0] = loc;
                        JSObject ret = new JSObject();
                        ret.put("lat", loc.getLatitude());
                        ret.put("lng", loc.getLongitude());
                        ret.put("accuracy", (double) loc.getAccuracy());
                        ret.put("source", "gps");
                        call.resolve(ret);
                    }
                }
                @Override public void onStatusChanged(String p, int s, android.os.Bundle e) {}
                @Override public void onProviderEnabled(String p) {}
                @Override public void onProviderDisabled(String p) {}
            };

            // 网络定位请求
            android.location.LocationListener networkListener = new android.location.LocationListener() {
                @Override
                public void onLocationChanged(Location loc) {
                    if (!completed[0]) {
                        completed[0] = true;
                        finalLoc[0] = loc;
                        JSObject ret = new JSObject();
                        ret.put("lat", loc.getLatitude());
                        ret.put("lng", loc.getLongitude());
                        ret.put("accuracy", (double) loc.getAccuracy());
                        ret.put("source", "network");
                        call.resolve(ret);
                    }
                }
                @Override public void onStatusChanged(String p, int s, android.os.Bundle e) {}
                @Override public void onProviderEnabled(String p) {}
                @Override public void onProviderDisabled(String p) {}
            };

            Looper looper = Looper.getMainLooper();

            // 启动 GPS 监听（如果可用）
            boolean gpsStarted = false;
            try {
                if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    lm.requestSingleUpdate(LocationManager.GPS_PROVIDER, gpsListener, looper);
                    gpsStarted = true;
                }
            } catch (SecurityException e) {}

            // 启动网络监听
            boolean networkStarted = false;
            try {
                if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                    lm.requestSingleUpdate(LocationManager.NETWORK_PROVIDER, networkListener, looper);
                    networkStarted = true;
                }
            } catch (SecurityException e) {}

            if (!gpsStarted && !networkStarted) {
                call.reject("无可用的定位提供者（GPS/网络均未开启）");
                return;
            }

            // 超时处理：10 秒后未定位则返回最后一次缓存位置（如果有）
            final boolean gps = gpsStarted;
            final boolean net = networkStarted;
            new android.os.Handler(looper).postDelayed(() -> {
                if (!completed[0]) {
                    completed[0] = true;
                    try { lm.removeUpdates(gpsListener); } catch (SecurityException e) {}
                    try { lm.removeUpdates(networkListener); } catch (SecurityException e) {}

                    if (cachedLoc[0] != null) {
                        JSObject ret = new JSObject();
                        ret.put("lat", cachedLoc[0].getLatitude());
                        ret.put("lng", cachedLoc[0].getLongitude());
                        ret.put("accuracy", (double) cachedLoc[0].getAccuracy());
                        ret.put("source", "cache");
                        call.resolve(ret);
                    } else {
                        call.reject("定位超时，未获取到位置");
                    }
                }
            }, 10000);

        } catch (Throwable t) {
            Log.e(TAG, "getLocation failed", t);
            call.reject("定位失败: " + t.getMessage());
        }
    }
}
