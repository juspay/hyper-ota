package `in`.juspay.hyperota

import android.util.Log
import org.json.JSONObject

abstract class TrackerCallback {
    abstract fun track(category: String, subCategory: String, level: String, label: String, key: String, value: Any)
    abstract fun track(category: String, subCategory: String, level: String, label: String, key: String, value: JSONObject)

    abstract fun trackException(category: String, subCategory: String, label: String, description: String, e: Throwable)

    fun trackAndLogException(tag: String, category: String, subCategory: String, label: String, description: String, e: Throwable) {
        Log.e(tag, description, e)
        this.trackException(category, subCategory, label, description, e)
    }
}
