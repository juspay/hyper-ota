package `in`.juspay.airborne.services

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import `in`.juspay.airborne.model.OTAEvent
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import android.provider.Settings
import `in`.juspay.airborne.constants.NetworkType
import `in`.juspay.airborne.network.OTAAnalyticsAPI
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.util.UUID

internal class AirborneAnalytics(
    private val context: Context,
    private val tenantId: String,
    private val organizationId: String,
    private val appId: String,
    private val appVersion: String,
) {

    private val dispatcher: CoroutineDispatcher = Dispatchers.IO
    private val sessionId: String = ""
    private val analyticsAPI: OTAAnalyticsAPI = OTAAnalyticsAPI()

    private var targetJsVersion: String = ""

    init {
        UUID.randomUUID().toString()
    }

    /**
     * Dispatches an OTA event with the provided parameters.
     *
     * @param eventType The type of the event (e.g., "APPLY_SUCCESS", "DOWNLOAD_FAILED").
     * @param releaseId The ID of the release.
     * @param currentJsVersion The current JavaScript version.
     * @param targetJsVersion The target JavaScript version.
     * @param rolloutPercentage The percentage of users to whom the release is rolled out.
     * @param appVersion The version of the native application.
     */
    private fun dispatchEvent(
        eventType: String,
        releaseId: String,
        currentJsVersion: String,
        targetJsVersion: String,
        rolloutPercentage: Int = 100,
        appVersion: String,
    ) {

        val event = OTAEvent(
            tenantId = tenantId,
            orgId = organizationId,
            appId = appId,
            deviceId = getDeviceId(),
            sessionId = sessionId,
            eventType = eventType,
            releaseId = releaseId,
            currentJsVersion = currentJsVersion,
            targetJsVersion = targetJsVersion,
            rolloutPercentage = rolloutPercentage,
            osVersion = getOsVersion(),
            appVersion = appVersion,
            deviceType = getDeviceType(),
            networkType = getNetworkType().toString()
        )

        try {
            kotlinx.coroutines.CoroutineScope(dispatcher).launch {
                try {
                    analyticsAPI.postEvent(event)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        } catch (e: Exception) {
            // Handle the exception, e.g., log it or notify the user
            e.printStackTrace()
        }
    }

    private fun dispatchEvent(
        eventType: String,
    ) {
        dispatchEvent(
            eventType = eventType,
            releaseId = targetJsVersion,
            currentJsVersion = appVersion,
            targetJsVersion = targetJsVersion,
            rolloutPercentage = 100,
            appVersion = appVersion
        )
    }

    fun track(
        category: String,
        subCategory: String,
        level: String,
        label: String,
        key: String,
        value: Any
    ){
        if(key == "update_checked") {
            if(value is JSONObject){
                this.targetJsVersion = value.optString("new_rc_version", "")
            }
        }
        if(key == "package_update_result"){
            if(value is JSONObject){
                val isSuccess = value.optString("result", "FAILED") == "SUCCESS"
                dispatch(key, isSuccess)
                return
            }
        }
        dispatch(key)
    }

    fun trackException(
        category: String,
        subCategory: String,
        label: String,
        description: String,
        e: Throwable
    ){
        dispatch(description)
    }

    private fun dispatch(key: String, isSuccess: Boolean = true) {

        val event = mapKeyToOtaEventType(key, isSuccess)
        if (event != null) {
            dispatchEvent(event)
        }
    }

    private fun mapKeyToOtaEventType(key: String, isSuccess: Boolean = true): String? {
        return when (key) {
            // UPDATE_CHECK
            "update_checked" -> "UPDATE_CHECK"

            // UPDATE_AVAILABLE
            "config_updated" -> "UPDATE_AVAILABLE"

            // DOWNLOAD_STARTED
            "package_update_download_started",
            "lazy_package_update_download_started" -> "DOWNLOAD_STARTED"

            // DOWNLOAD_COMPLETED / DOWNLOAD_FAILED
            "package_update_result" -> {
                if (isSuccess) "DOWNLOAD_COMPLETED"
                else "DOWNLOAD_FAILED"
            }

            // DOWNLOAD_FAILED
            "important_package_update_error",
            "lazy_package_update_error",
            "fetch_failed" -> "DOWNLOAD_FAILED"

            // APPLY_SUCCESS
            "updated_resources" -> "APPLY_SUCCESS"

            // APPLY_FAILURE
            "file_write_failed",
            "saved_resources_corrupted",
            "persistent_state_load_failed",
            "persistent_state_save_failed",
            "persistent_state_set_failed" -> "APPLY_FAILURE"

            // Skipped resources (could be considered successful)
            "skipped_resources" -> "APPLY_SUCCESS"

            "end" -> null

            else -> null
        }
    }

    private fun getDeviceId(): String =
        Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)

    private fun getOsVersion(): String =
        Build.VERSION.RELEASE.takeIf { it.isNotBlank() } ?: "Unknown"

    private fun getDeviceType(): String {
        return "Android"
    }

    private fun getNetworkType(): NetworkType {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return NetworkType.UNKNOWN

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val network = cm.activeNetwork ?: return NetworkType.UNKNOWN
            val caps = cm.getNetworkCapabilities(network) ?: return NetworkType.UNKNOWN
            when {
                caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> NetworkType.WIFI
                caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> NetworkType.MOBILE
                else -> NetworkType.UNKNOWN
            }
        } else {
            @Suppress("DEPRECATION")
            (cm.activeNetworkInfo?.type.let {
                when (it) {
                    ConnectivityManager.TYPE_WIFI -> NetworkType.WIFI
                    ConnectivityManager.TYPE_MOBILE -> NetworkType.MOBILE
                    else -> NetworkType.UNKNOWN
                }
            })
        }
    }
}