package `in`.juspay.hyperota

interface LazyDownloadCallback {
    fun fileInstalled(filePath: String, success: Boolean)
    fun lazySplitsInstalled(success: Boolean)
}
