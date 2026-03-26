package com.authentademo

import android.app.Application
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost by lazy {
    MainApplicationReactNativeHost(this)
  }
}
