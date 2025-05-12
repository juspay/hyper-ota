package `in`.juspay.hyperota.ota

internal sealed interface UpdateResult {
    object NA : UpdateResult
    data class Ok(val releaseConfig: ReleaseConfig) : UpdateResult
    sealed interface Error : UpdateResult {
        object RCFetchError : Error
        object Unknown : Error
    }
    object ReleaseConfigFetchTimeout : UpdateResult
    data class PackageUpdateTimeout(val releaseConfig: ReleaseConfig?) : UpdateResult
}
