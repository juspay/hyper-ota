package `in`.juspay.airborne

import android.content.Context
import androidx.annotation.Keep
import `in`.juspay.airborne.constants.APIConstants
import `in`.juspay.airborne.services.AirborneAnalytics
import `in`.juspay.hyperota.HyperOTAServices
import `in`.juspay.hyperota.LazyDownloadCallback
import `in`.juspay.hyperota.TrackerCallback
import `in`.juspay.hyperota.ota.ApplicationManager
import org.json.JSONObject

/** * Airborne is a library that allows for the management of Over-The-Air (OTA) updates for your application.
* It provides functionality to track events, handle lazy downloads, and manage application updates.
*
* @param context The Android context.
* @param tenantId The tenant ID.
* @param organizationId The organization ID.
* @param appId The application ID.
* @param fileName The name of the index file.
* @param appVersion The version of the application.
* @param useBundledAssets Whether to use bundled assets or not.
* @param lazyDownloadCallback Callback for lazy download events.
* @param trackerCallback Callback for tracking events.
*/
@Keep
class Airborne(
    private val context: Context,
    tenantId: String,
    private val organizationId: String,
    private val appId: String,
    private val fileName: String,
    private val appVersion: String,
    private val useBundledAssets: Boolean,
    private val lazyDownloadCallback: LazyDownloadCallback,
    private val trackerCallback: TrackerCallback,
) {

    private val airborneAnalytics = AirborneAnalytics(
        context,
        tenantId,
        organizationId,
        appId,
        appVersion
    )

    private val airborneTrackerCallback: TrackerCallback = object: TrackerCallback() {
        override fun track(
            category: String,
            subCategory: String,
            level: String,
            label: String,
            key: String,
            value: Any
        ) {
            airborneAnalytics.track(
                category,
                subCategory,
                level,
                label,
                key,
                value
            )
            trackerCallback.track(
                category,
                subCategory,
                level,
                label,
                key,
                value
            )
        }

        override fun track(
            category: String,
            subCategory: String,
            level: String,
            label: String,
            key: String,
            value: JSONObject
        ) {
            airborneAnalytics.track(
                category,
                subCategory,
                level,
                label,
                key,
                value
            )
            trackerCallback.track(
                category,
                subCategory,
                level,
                label,
                key,
                value
            )
        }

        override fun trackException(
            category: String,
            subCategory: String,
            label: String,
            description: String,
            e: Throwable
        ) {
            airborneAnalytics.trackException(
                category,
                subCategory,
                label,
                description,
                e
            )
            trackerCallback.trackException(
                category,
                subCategory,
                label,
                description,
                e
            )
        }
    }

    /**
     * Creates an instance of [ApplicationManager] to manage the application updates.
     *
     * @param headers Optional headers to be used in the request.
     * @return An instance of [ApplicationManager].
     */
    @Keep
    fun createApplicationManager(
        headers: Map<String, String>? = null,
    ): ApplicationManager {
        val hyperOTAServices = HyperOTAServices(
            context,
            appId,
            fileName,
            appVersion,
            buildReleaseConfigTemplateUrl(),
            useBundledAssets,
            airborneTrackerCallback
        )

        val applicationManager = hyperOTAServices.createApplicationManager(headers)
        applicationManager.loadApplication(appId, lazyDownloadCallback)
        applicationManager.readReleaseConfig()

        return applicationManager
    }

    private fun buildReleaseConfigTemplateUrl(): String {
        return "${APIConstants.HyperOTA.RELEASE_CONFIG_ENDPOINT}/${organizationId}/${appId}"
    }
}