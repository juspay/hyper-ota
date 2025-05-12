package `in`.juspay.hyperota.constants

import androidx.annotation.Keep

@Keep
object LogSubCategory {
    @Keep
    object Action {
        const val SYSTEM = "system"
    }

    @Keep
    object LifeCycle {
        const val HYPER_OTA = "hyperota"
    }

    @Keep
    object ApiCall {
        const val NETWORK = "network"
    }
}
