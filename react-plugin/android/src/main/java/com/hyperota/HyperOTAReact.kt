package com.hyperota

import android.content.Context
import androidx.annotation.Keep
import `in`.juspay.hyperota.HyperOTAServices
import `in`.juspay.hyperota.LazyDownloadCallback
import `in`.juspay.hyperota.TrackerCallback
import org.json.JSONObject

@Keep
class HyperOTAReact private constructor(
    context: Context,
    appId: String,
    private val indexFileName: String,
    appVersion: String,
    releaseConfigTemplateUrl: String,
    headers: Map<String, String>? = null,
    lazyDownloadCallback: LazyDownloadCallback,
    trackerCallback: TrackerCallback = defaultTrackerCallback
) {
    private val hyperOTAServices = HyperOTAServices(
        context,
        appId,
        indexFileName,
        appVersion,
        releaseConfigTemplateUrl,
        false,
        trackerCallback
    )

    private val applicationManager = hyperOTAServices.createApplicationManager(headers)

    init {
        applicationManager.loadApplication(appId, lazyDownloadCallback)
    }

    /**
     * @return The path of the index bundle, or asset path fallback if empty.
     */
    @Keep
    fun getBundlePath(): String {
        val filePath = applicationManager.getIndexBundlePath()
        return filePath.ifEmpty { "assets://$indexFileName" }
    }

    /**
     * Reads the content of the given file.
     * @param filePath The relative path of the file.
     * @return The content of the file as String.
     */
    @Keep
    fun getFileContent(filePath: String): String {
        return applicationManager.readSplit(filePath)
    }

    /**
     * @return Stringified JSON of the release config.
     */
    @Keep
    fun getReleaseConfig(): String {
        return applicationManager.readReleaseConfig()
    }

    companion object {
        private var initializer: (() -> HyperOTAReact)? = null

        /**
         * Lazily initialized singleton instance.
         */
        @JvmStatic
        val instance: HyperOTAReact by lazy(LazyThreadSafetyMode.SYNCHRONIZED) {
            initializer?.invoke()
                ?: throw IllegalStateException("HyperOTAReact initializer not set. Call init() first.")
        }

        /**
         * Initializes the HyperOTAReact singleton.
         */
        @JvmStatic
        fun init(
            context: Context,
            appId: String,
            indexFileName: String,
            appVersion: String,
            releaseConfigTemplateUrl: String,
            headers: Map<String, String>? = null,
            lazyDownloadCallback: LazyDownloadCallback? = null,
            trackerCallback: TrackerCallback? = null
        ) {
            initializer = {
                HyperOTAReact(
                    context,
                    appId,
                    indexFileName,
                    appVersion,
                    releaseConfigTemplateUrl,
                    headers,
                    lazyDownloadCallback ?: defaultLazyCallback,
                    trackerCallback ?: defaultTrackerCallback
                )
            }
        }

        /**
         * Default LazyDownloadCallback implementation.
         */
        private val defaultLazyCallback = object : LazyDownloadCallback {
            override fun fileInstalled(filePath: String, success: Boolean) {
                // Default implementation: log the file installation status
                if (success) {
                    println("HyperOTAReact: File installed successfully: $filePath")
                } else {
                    println("HyperOTAReact: File installation failed: $filePath")
                }
            }

            override fun lazySplitsInstalled(success: Boolean) {
                // Default implementation: log the lazy splits installation status
                if (success) {
                    println("HyperOTAReact: Lazy splits installed successfully")
                } else {
                    println("HyperOTAReact: Lazy splits installation failed")
                }
            }
        }

        /**
         * Default no-op TrackerCallback.
         */
        private val defaultTrackerCallback = object : TrackerCallback() {
            override fun track(
                category: String,
                subCategory: String,
                level: String,
                label: String,
                key: String,
                value: Any
            ) {
                // No-op
            }

            override fun track(
                category: String,
                subCategory: String,
                level: String,
                label: String,
                key: String,
                value: JSONObject
            ) {
                // No-op
            }

            override fun trackException(
                category: String,
                subCategory: String,
                label: String,
                description: String,
                e: Throwable
            ) {
                // No-op
            }
        }
    }
}
