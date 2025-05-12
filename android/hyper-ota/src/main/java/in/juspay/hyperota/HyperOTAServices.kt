package `in`.juspay.hyperota

import android.content.Context
import androidx.annotation.Keep
import `in`.juspay.hyperota.ota.ApplicationManager
import `in`.juspay.hyperota.services.OTAServices
import `in`.juspay.hyperota.services.Workspace

@Keep
class HyperOTAServices(private val context: Context, workSpacePath: String, private val fileName: String, appVersion: String, private val releaseConfigTemplateUrl: String, useBundledAssets: Boolean, trackerCallback: TrackerCallback) {
    private val workspace: Workspace = Workspace(context, workSpacePath)
    private val otaServices: OTAServices = OTAServices(context, workspace, appVersion, useBundledAssets, trackerCallback)

    @Keep
    fun createApplicationManager(headers: Map<String, String>? = null): ApplicationManager {
        return ApplicationManager(context, releaseConfigTemplateUrl, otaServices, fileName, headers)
    }
}
