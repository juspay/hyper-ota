package `in`.juspay.hyperota.services

import android.content.Context
import `in`.juspay.hyperota.TrackerCallback
import `in`.juspay.hyperota.constants.Labels
import `in`.juspay.hyperota.constants.LogCategory
import `in`.juspay.hyperota.constants.LogLevel
import `in`.juspay.hyperota.constants.LogSubCategory
import `in`.juspay.hyperota.constants.OTAConstants

class OTAServices(private val ctx: Context, val workspace: Workspace, val cleanUpValue: String, val useBundledAssets: Boolean, val trackerCallback: TrackerCallback) {
    val fileProviderService: FileProviderService = FileProviderService(this)
    val remoteAssetService: RemoteAssetService = RemoteAssetService(this)
    var clientId: String? = null

    init {
        firstTimeCleanup()
    }

    private fun firstTimeCleanup() {
        val prevBuildId = workspace.getFromSharedPreference(OTAConstants.OTA_BUILD_ID, "__failed")

        if (prevBuildId != cleanUpValue) {
            trackerCallback.track(
                LogCategory.LIFECYCLE,
                LogSubCategory.LifeCycle.HYPER_OTA,
                LogLevel.INFO,
                Labels.HyperOTA.FIRST_TIME_SETUP,
                "started",
                ""
            )
            workspace.writeToSharedPreference(OTAConstants.OTA_BUILD_ID, cleanUpValue)
            workspace.removeFromSharedPreference("asset_metadata.json")
            try {
                ctx.let { workspace.clean(it) }
                trackerCallback.track(
                    LogCategory.LIFECYCLE,
                    LogSubCategory.LifeCycle.HYPER_OTA,
                    LogLevel.INFO,
                    Labels.HyperOTA.FIRST_TIME_SETUP,
                    "completed",
                    ""
                )
            } catch (e: Exception) {
                // Handles JSONException and Security exception
                trackerCallback.trackAndLogException(
                    TAG,
                    LogCategory.LIFECYCLE,
                    LogSubCategory.LifeCycle.HYPER_OTA,
                    Labels.HyperOTA.FIRST_TIME_SETUP,
                    "Exception in firstTimeCleanUp",
                    e
                )
            }
        }
    }

    companion object {
        const val TAG = "OTAServices"
    }
}
