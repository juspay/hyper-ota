package `in`.juspay.airborne.constants

import androidx.annotation.Keep

internal object APIConstants {
    @Keep
    object Analytics {
        const val URL = "https://airbone.juspay.in/analytics"
        const val EVENT_ENDPOINT = "/events"
    }

    @Keep
    object HyperOTA {
        const val RELEASE_CONFIG_ENDPOINT = "https://airborne.juspay.in/release/v2"
    }
}