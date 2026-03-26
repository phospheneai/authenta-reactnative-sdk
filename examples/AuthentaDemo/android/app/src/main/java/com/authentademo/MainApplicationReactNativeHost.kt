package com.authentademo

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage

class MainApplicationReactNativeHost(application: Application) : ReactNativeHost(application) {

  override fun getPackages(): List<ReactPackage> {
    return PackageList(this).packages
  }

  override fun getJSMainModuleName(): String {
    return "index"
  }

  override fun getUseDeveloperSupport(): Boolean {
    return BuildConfig.DEBUG
  }
}
