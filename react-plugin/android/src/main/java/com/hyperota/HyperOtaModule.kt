package com.hyperota

import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class HyperOtaModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String {
    return NAME
  }

  @ReactMethod
  fun readReleaseConfig(promise: Promise) {
    try{
      promise.resolve(HyperOTAReact.instance.getReleaseConfig())
    }catch(e: Exception){
      e.message?.let { promise.reject("HYPER_OTA_NOT_INIT", it) }

    }
  }

  @ReactMethod
  fun getFileContent(filePath: String, promise: Promise) {
    try{
    promise.resolve(HyperOTAReact.instance.getFileContent(filePath))
    }catch(e: Exception){
      e.message?.let { promise.reject("HYPER_OTA_NOT_INIT", it) }
    }
  }

  @ReactMethod
  fun getBundlePath(promise: Promise) {
    try{
      promise.resolve(HyperOTAReact.instance.getBundlePath())
    }catch(e: Exception){
      e.message?.let { promise.reject("HYPER_OTA_NOT_INIT", it) }
    }
  }

  companion object {
    const val NAME = "HyperOta"
  }
}
