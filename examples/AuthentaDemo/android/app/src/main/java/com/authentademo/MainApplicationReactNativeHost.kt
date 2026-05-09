package com.authentademo

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactNativeHost

class MainApplicationReactNativeHost(application: Application) : DefaultReactNativeHost(application) {

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
