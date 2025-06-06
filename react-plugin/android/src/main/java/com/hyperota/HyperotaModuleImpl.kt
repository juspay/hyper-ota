package com.hyperota

import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.Promise
import `in`.juspay.hyperota.LazyDownloadCallback
import `in`.juspay.hyperota.TrackerCallback
import org.json.JSONObject

/**
 * Implementation class that handles the actual HyperOTA operations.
 * This class is shared between old and new architecture modules.
 */
class HyperotaModuleImpl(private val reactContext: ReactApplicationContext) {
    
    companion object {
        private var isInitialized = false
        
        /**
         * Initialize HyperOTA from native code (typically from MainApplication)
         */
        @JvmStatic
        fun initializeHyperOTA(
            context: Context,
            appId: String,
            indexFileName: String,
            appVersion: String,
            releaseConfigTemplateUrl: String,
            headers: Map<String, String>? = null,
            lazyDownloadCallback: LazyDownloadCallback? = null,
            trackerCallback: TrackerCallback? = null
        ) {
            if (!isInitialized) {
                HyperOTAReact.init(
                    context,
                    appId,
                    indexFileName,
                    appVersion,
                    releaseConfigTemplateUrl,
                    headers,
                    lazyDownloadCallback,
                    trackerCallback
                )
                isInitialized = true
            }
        }
    }
    
    fun readReleaseConfig(promise: Promise) {
        try {
            val config = HyperOTAReact.instance.getReleaseConfig()
            promise.resolve(config)
        } catch (e: Exception) {
            promise.reject("HYPER_OTA_ERROR", "Failed to read release config: ${e.message}", e)
        }
    }
    
    fun getFileContent(filePath: String, promise: Promise) {
        try {
            val content = HyperOTAReact.instance.getFileContent(filePath)
            promise.resolve(content)
        } catch (e: Exception) {
            promise.reject("HYPER_OTA_ERROR", "Failed to read file content: ${e.message}", e)
        }
    }
    
    fun getBundlePath(promise: Promise) {
        try {
            val path = HyperOTAReact.instance.getBundlePath()
            promise.resolve(path)
        } catch (e: Exception) {
            promise.reject("HYPER_OTA_ERROR", "Failed to get bundle path: ${e.message}", e)
        }
    }
}
