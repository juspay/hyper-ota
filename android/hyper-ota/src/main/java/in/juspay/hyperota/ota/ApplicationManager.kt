// Copyright 2025 Juspay Technologies
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package `in`.juspay.hyperota.ota

import android.content.Context
import android.util.Log
import `in`.juspay.hyperota.LazyDownloadCallback
import `in`.juspay.hyperota.constants.LogCategory
import `in`.juspay.hyperota.constants.LogLevel
import `in`.juspay.hyperota.constants.LogSubCategory
import `in`.juspay.hyperota.network.OTANetUtils
import `in`.juspay.hyperota.ota.Constants.CONFIG_FILE_NAME
import `in`.juspay.hyperota.ota.Constants.DEFAULT_CONFIG
import `in`.juspay.hyperota.ota.Constants.DEFAULT_RESOURCES
import `in`.juspay.hyperota.ota.Constants.PACKAGE_DIR_NAME
import `in`.juspay.hyperota.ota.Constants.PACKAGE_MANIFEST_FILE_NAME
import `in`.juspay.hyperota.ota.Constants.RC_VERSION_FILE_NAME
import `in`.juspay.hyperota.ota.Constants.RESOURCES_FILE_NAME
import `in`.juspay.hyperota.services.OTAServices
import `in`.juspay.hyperota.utils.OTAUtils
import org.json.JSONArray
import org.json.JSONObject
import java.lang.ref.WeakReference
import java.util.concurrent.Callable
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentMap
import java.util.concurrent.Future

class ApplicationManager(
    private val ctx: Context,
    private val releaseConfigTemplateUrl: String,
    private val otaServices: OTAServices,
    private val fileName: String,
    private val rcHeaders: Map<String, String>? = null
) {
    private var shouldUpdate = true
    private var releaseConfig: ReleaseConfig? = null
    private var loadWaitTask = WaitTask()
    private val workspace = otaServices.workspace
    private val tracker = otaServices.trackerCallback
    private var indexFolderPath = ""

    fun loadApplication(unSanitizedClientId: String, lazyDownloadCallback: LazyDownloadCallback? = null) {
        doAsync {
            otaServices.clientId = unSanitizedClientId
            val clientId = sanitizeClientId(unSanitizedClientId)
            trackInfo("init", JSONObject().put("client_id", clientId))
            val startTime = System.currentTimeMillis()
            try {
                if (releaseConfig == null) {
                    val newRef = WeakReference(ctx)
                    val currentRef = CONTEXT_MAP[clientId]
                    val initialized = if (currentRef == null) {
                        CONTEXT_MAP.putIfAbsent(clientId, newRef) != null
                    } else if (currentRef.get() == null) {
                        !CONTEXT_MAP.replace(clientId, currentRef, newRef)
                    } else {
                        true
                    }
                    val contextRef = CONTEXT_MAP[clientId] ?: newRef
                    releaseConfig = readReleaseConfig(contextRef)
                    if (shouldUpdate) {
                        releaseConfig = tryUpdate(clientId, initialized, contextRef, lazyDownloadCallback)
                    } else {
                        Log.d(TAG, "Updates disabled, running w/o updating.")
                    }
                }
                if (releaseConfig == null) {
                    return@doAsync
                }
                val rc = releaseConfig!!
                indexFolderPath = getIndexFilePath(rc.pkg.index.filePath)
                trackBoot(rc, startTime)
            } catch (e: Exception) {
                Log.e(TAG, "Critical exception while loading app! $e")
                trackError(
                    LogLabel.APP_LOAD_EXCEPTION,
                    "Exception raised while loading application.",
                    e
                )
            } finally {
                loadWaitTask.complete()
                logTimeTaken(startTime, "loadApplication")
            }
        }
    }

    fun getIndexBundlePath(): String {
        loadWaitTask.get()
        return indexFolderPath
    }

    private fun tryUpdate(clientId: String, initialized: Boolean, fileLock: Any, lazyDownloadCallback: LazyDownloadCallback? = null): ReleaseConfig? {
        val startTime = System.currentTimeMillis()
        val url = releaseConfigTemplateUrl
        val newTask =
            UpdateTask(url, otaServices.fileProviderService, releaseConfig, fileLock, tracker, OTANetUtils(ctx, clientId, otaServices.cleanUpValue), rcHeaders, lazyDownloadCallback)
        val runningTask = RUNNING_UPDATE_TASKS.putIfAbsent(clientId, newTask) ?: newTask
        if (runningTask == newTask) {
            Log.d(TAG, "No running update tasks for '$clientId', starting new task.")
            val pkg = runningTask.copyTempPkg()
            pkg?.let { p ->
                releaseConfig = releaseConfig?.copy(pkg = p)
                runningTask.updateReleaseConfig(releaseConfig)
            }
            newTask.run { updateResult, persistentState ->
                Log.d(TAG, "Running onFinish for '$clientId'")
                if (!initialized) {
                    runCleanUp(persistentState, updateResult)
                }
                RUNNING_UPDATE_TASKS.remove(clientId)
                logTimeTaken(startTime, "Update task finished for '$clientId'.")
            }
        } else {
            Log.d(TAG, "Update task already running for '$clientId'.")
        }
        val uresult = runningTask.await(tracker)
        trackUpdateResult(uresult)
        val rc = when (uresult) {
            is UpdateResult.Ok -> uresult.releaseConfig
            is UpdateResult.PackageUpdateTimeout ->
                uresult.releaseConfig ?: releaseConfig

            UpdateResult.Error.RCFetchError ->
                releaseConfig

            else -> releaseConfig
        }
        logTimeTaken(startTime, "tryUpdate")
        return rc
    }

    private fun runCleanUp(persistentState: JSONObject, updateResult: UpdateResult) {
        // Shouldn't delete internal files.
        // shouldn't delete resources.
        Log.d(TAG, "runCleanUp: updateResult: $updateResult")
        val updatedRc = when (updateResult) {
            is UpdateResult.Ok -> updateResult.releaseConfig
            else -> null
        }
        val pkgSplits = releaseConfig?.pkg?.filePaths ?: emptyList()
        Log.d(TAG, "runCleanUp: Current splits: $pkgSplits")
        val newPkgSplits = updatedRc?.pkg?.filePaths ?: emptyList()
        Log.d(TAG, "runCleanUp: New splits: $newPkgSplits")
        val pkgDir = "app/$PACKAGE_DIR_NAME"
        val resourceFiles =
            releaseConfig?.resources?.filePaths ?: emptyList()
        val newResourceFiles =
            updatedRc?.resources?.filePaths ?: emptyList()
        val splits = pkgSplits + newPkgSplits + resourceFiles + newResourceFiles
        cleanUpDir(pkgDir, splits)
//        val resourceFiles =
//            releaseConfig?.resources?.map { it.filePath } ?: emptyList()
//        val newResourceFiles =
//            updatedRc?.resources?.map { it.filePath } ?: emptyList()
//        cleanUpDir("app/$RESOURCES_DIR_NAME", resourceFiles + newResourceFiles)

        val savedPkgDir = persistentState.optJSONObject(StateKey.SAVED_PACKAGE_UPDATE_OTA.name)
            ?.optString("dir")
        val savedResDir = persistentState.optJSONObject(StateKey.SAVED_RESOURCE_UPDATE_OTA.name)
            ?.optString("dir")
        val cacheDirs = (workspace.cacheRoot.list()?.toList() ?: ArrayList())
            .map { workspace.openInCache(it) }
        val tmpDirRegex = Regex("temp-.*-\\d+")
        val failures = cacheDirs
            .filter {
                it.isDirectory &&
                    it.name != savedPkgDir &&
                    it.name != savedResDir &&
                    it.name.matches(tmpDirRegex)
            }
            .mapNotNull {
                Log.d(TAG, "Deleting temp directory ${it.name}")
                if (!it.deleteRecursively()) {
                    it.name
                } else {
                    null
                }
            }
        if (failures.isNotEmpty()) {
            val message = "Failed to delete some temporary directories during clean-up."
            trackError(
                LogLabel.CLEAN_UP_ERROR,
                JSONObject().put("message", message).put("failures", failures)
            )
        }
    }

    private fun cleanUpDir(dir: String, requiredFiles: List<String>) {
        Log.d(TAG, "requiredFiles for $dir $requiredFiles")
        val current = otaServices.fileProviderService.listFilesRecursive(dir)?.toList() ?: emptyList()
        val redundant = setDifference(current, requiredFiles)
        if (redundant.isEmpty()) {
            Log.d(TAG, "No clean-up required for dir: $dir")
            return
        }
        val startTime = System.currentTimeMillis()
        val failures = redundant.mapNotNull {
            if (otaServices.fileProviderService.deleteFileFromInternalStorage("$dir/$it")) {
                Log.d(TAG, "Deleted file $it from $dir")
                null
            } else {
                it
            }
        }
        if (failures.isNotEmpty()) {
            trackError(
                LogLabel.CLEAN_UP_ERROR,
                JSONObject()
                    .put("message", "Failed to delete some files during clean up.")
                    .put("failures", failures)
            )
        }

        logTimeTaken(startTime)
    }

    private fun readReleaseConfig(lock: Any): ReleaseConfig? {
        synchronized(lock) {
            try {
                val rcVersion = readFileAsync(RC_VERSION_FILE_NAME).get()
                val configFuture = readFileAsync(CONFIG_FILE_NAME)
                val pkgFuture = readFileAsync(PACKAGE_MANIFEST_FILE_NAME)
                val resFuture = readFileAsync(RESOURCES_FILE_NAME)

                val config = ReleaseConfig.deSerializeConfig(
                    configFuture.get()
                ).getOrElse { e ->
                    trackReadReleaseConfigError(e)
                    DEFAULT_CONFIG
                }
                val pkg = ReleaseConfig.deSerializePackage(
                    pkgFuture.get()
                ).getOrThrow()
                val resources = ReleaseConfig.deSerializeResources(
                    resFuture.get()
                ).getOrElse { e ->
                    trackReadReleaseConfigError(e)
                    DEFAULT_RESOURCES
                }
                Log.d(TAG, "Local release config loaded.")
                return ReleaseConfig(rcVersion, config, pkg, resources)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to read local release config. $e")
                trackReadReleaseConfigError(e)
            }
        }
        return null
    }

    private fun trackReadReleaseConfigError(e: Throwable) {
        when (e) {
            is Exception -> {
                val value = JSONObject()
                    .put("error", e.message)
                    .put("stack_trace", Log.getStackTraceString(e))
                trackError("read_release_config_error", value)
            }
        }
    }

    private fun readFileAsync(filePath: String): Future<String> = doAsync {
        readFile(filePath)
    }

    private fun readFile(filePath: String): String =
        otaServices.fileProviderService.readFromFile("app/$filePath")

    fun readSplit(fileName: String): String {
        return readFile("$PACKAGE_DIR_NAME/$fileName")
    }

    fun readReleaseConfig(): String {
        return releaseConfig?.serialize() ?: ""
    }

    private fun trackUpdateResult(updateResult: UpdateResult) {
        val result = when (updateResult) {
            is UpdateResult.Ok -> "OK"
            is UpdateResult.PackageUpdateTimeout -> "PACKAGE_TIMEOUT"
            UpdateResult.ReleaseConfigFetchTimeout -> "RELEASE_CONFIG_TIMEOUT"
            UpdateResult.Error.RCFetchError -> "ERROR"
            UpdateResult.Error.Unknown -> "ERROR"
            UpdateResult.NA -> "NA"
        }
        trackInfo("update_result", JSONObject().put("result", result))
    }

    private fun trackBoot(releaseConfig: ReleaseConfig, startTime: Long) {
        val (rcVersion, config, pkg, resources) = releaseConfig
        val rversions = resources.fold(JSONArray()) { acc, v ->
            acc.put(v.fileName)
            acc
        }
        trackInfo(
            "boot",
            JSONObject()
                .put("release_config_version", rcVersion)
                .put("config_version", config.version)
                .put("package_version", pkg.version)
                .put("resource_versions", rversions)
                .put("time_taken", System.currentTimeMillis() - startTime)
        )
    }

    private fun trackInfo(label: String, value: JSONObject) {
        trackGeneric(label, value, LogLevel.INFO)
    }

    private fun trackError(label: String, msg: String, e: Exception? = null) {
        val value = JSONObject().put("message", msg)
        e?.let { value.put("stack_trace", Log.getStackTraceString(e)) }
        trackError(label, value)
    }

    private fun trackError(label: String, value: JSONObject) {
        trackGeneric(label, value, LogLevel.ERROR)
    }

    private fun trackGeneric(label: String, value: JSONObject, level: String) {
        tracker.track(
            LogCategory.LIFECYCLE,
            LogSubCategory.LifeCycle.HYPER_OTA,
            level,
            TAG,
            label,
            value
        )
    }

    private fun logTimeTaken(startTime: Long, label: String? = null) {
        val totalTime = System.currentTimeMillis() - startTime
        val msg = "Time ${totalTime}ms"
        if (label != null) {
            Log.d(TAG, "$label $msg")
        } else {
            Log.d(TAG, msg)
        }
    }

    enum class StateKey {
        SAVED_PACKAGE_UPDATE_OTA,
        SAVED_RESOURCE_UPDATE_OTA
    }

    private object LogLabel {
        const val APP_LOAD_EXCEPTION = "app_load_exception"
        const val CLEAN_UP_ERROR = "clean_up_error"
    }

    private fun getIndexFilePath(fileName: String): String {
        val file = otaServices.fileProviderService.getFileFromInternalStorage("app/$PACKAGE_DIR_NAME/$fileName")
        if (file.exists()) {
            return file.absolutePath
        }
        return ""
    }

    companion object {
        const val TAG = "ApplicationManager"
        private val CONTEXT_MAP:
            ConcurrentMap<String, WeakReference<Context>> = ConcurrentHashMap()
        private val RUNNING_UPDATE_TASKS:
            ConcurrentMap<String, UpdateTask> = ConcurrentHashMap()

        private fun <V> doAsync(callable: Callable<V>): Future<V> =
            OTAUtils.doAsync(callable)

        // Returns set difference, i.e. A - B
        private fun <V> setDifference(a: List<V>, b: List<V>): List<V> {
            return a.toSet().minus(b.toSet()).toList()
        }

        private fun sanitizeClientId(clientId: String) = clientId.split('_')[0].lowercase()
    }
}
