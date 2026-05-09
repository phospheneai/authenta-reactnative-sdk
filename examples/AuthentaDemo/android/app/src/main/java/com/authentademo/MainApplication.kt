package com.authentademo

import android.app.Application
import com.facebook.react.ReactHost
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactNativeApplicationEntryPoint
import com.facebook.react.defaults.DefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost by lazy {
    MainApplicationReactNativeHost(this)
  }

  override val reactHost: ReactHost by lazy {
    DefaultReactHost.getDefaultReactHost(applicationContext, reactNativeHost)
  }

  override fun onCreate() {
    super.onCreate()
    ReactNativeApplicationEntryPoint.loadReactNative(this)
  }
}
