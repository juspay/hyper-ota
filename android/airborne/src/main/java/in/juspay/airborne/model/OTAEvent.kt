package `in`.juspay.airborne.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable as KSerializable

@KSerializable
internal data class OTAEvent(
    @SerialName("tenant_id") val tenantId: String,
    @SerialName("org_id") val orgId: String,
    @SerialName("app_id") val appId: String,
    @SerialName("device_id") val deviceId: String,
    @SerialName("session_id") val sessionId: String,
    @SerialName("event_type") val eventType: String,
    @SerialName("release_id") val releaseId: String,
    @SerialName("current_js_version") val currentJsVersion: String,
    @SerialName("target_js_version") val targetJsVersion: String,
    @SerialName("rollout_percentage") val rolloutPercentage: Int,
    @SerialName("os_version") val osVersion: String,
    @SerialName("app_version") val appVersion: String,
    @SerialName("device_type") val deviceType: String,
    @SerialName("network_type") val networkType: String
)