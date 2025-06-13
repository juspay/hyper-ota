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

import android.os.Build
import android.util.Log
import `in`.juspay.hyperota.BuildConfig
import `in`.juspay.hyperota.LazyDownloadCallback
import `in`.juspay.hyperota.R
import `in`.juspay.hyperota.TrackerCallback
import `in`.juspay.hyperota.constants.LogCategory
import `in`.juspay.hyperota.constants.LogLevel
import `in`.juspay.hyperota.constants.LogSubCategory
import `in`.juspay.hyperota.network.NetUtils
import `in`.juspay.hyperota.ota.ApplicationManager.StateKey
import `in`.juspay.hyperota.ota.Constants.APP_DIR
import `in`.juspay.hyperota.ota.Constants.CONFIG_FILE_NAME
import `in`.juspay.hyperota.ota.Constants.DEFAULT_CONFIG
import `in`.juspay.hyperota.ota.Constants.DEFAULT_RESOURCES
import `in`.juspay.hyperota.ota.Constants.DEFAULT_VERSION
import `in`.juspay.hyperota.ota.Constants.PACKAGE_DIR_NAME
import `in`.juspay.hyperota.ota.Constants.PACKAGE_MANIFEST_FILE_NAME
import `in`.juspay.hyperota.ota.Constants.RC_VERSION_FILE_NAME
import `in`.juspay.hyperota.ota.Constants.RESOURCES_DIR_NAME
import `in`.juspay.hyperota.ota.Constants.RESOURCES_FILE_NAME
import `in`.juspay.hyperota.services.FileProviderService
import `in`.juspay.hyperota.services.TempWriter
import `in`.juspay.hyperota.services.Workspace
import `in`.juspay.hyperota.utils.OTAUtils
import okhttp3.Response
import okhttp3.ResponseBody
import org.json.JSONException
import org.json.JSONObject
import java.io.BufferedReader
import java.io.Closeable
import java.io.IOException
import java.io.InputStream
import java.io.InterruptedIOException
import java.net.HttpURLConnection.HTTP_OK
import java.net.URL
import java.nio.charset.StandardCharsets
import java.util.Queue
import java.util.UUID
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.Callable
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Future
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.locks.LockSupport

internal typealias OnFinishCallback = (UpdateResult, JSONObject) -> Unit
private typealias FetchResult = UpdateTask.Result<Pair<Response, ResponseBody>>

internal class UpdateTask(
    private val releaseConfigUrl: String,
    private val fileProviderService: FileProviderService,
    private var localReleaseConfig: ReleaseConfig?,
    private val fileLock: Any,
    tracker: TrackerCallback,
    private val netUtils: NetUtils,
    rcHeaders: Map<String, String>? = null,
    private val lazyDownloadCallback: LazyDownloadCallback?
) {
    private val updateUUID = UUID.randomUUID().toString()

    // Using 'CopyOnWriteArrayList' to avoid 'ConcurrentModificationException'.
    private val trackers: MutableList<TrackerCallback> = CopyOnWriteArrayList()
    private val waitQueue: Queue<Pair<WaitTask, Stage>> = ArrayBlockingQueue(256)

    @Volatile
    private var currentStage = Stage.INITIALIZING
    private var currentStageStartTime = System.currentTimeMillis()
    private var releaseConfigTimeout =
        (localReleaseConfig?.config ?: DEFAULT_CONFIG).releaseConfigTimeout
    private var initTime = System.currentTimeMillis()
    private var updateTimedOut = AtomicBoolean(false)
    private var packageUpdate: Future<Update.Package>? = null
    private var resourceUpdate: ResourceUpdateTask? = null
    private var resourceDownloadStatus = ResourceUpdateStatus.RESOURCES_DOWNLOADING

    @Volatile
    private var packageTimeout =
        (localReleaseConfig?.config ?: DEFAULT_CONFIG).bootTimeout

    @Volatile
    private var currentResult: UpdateResult = UpdateResult.NA
    private var onFinish: OnFinishCallback? = null

    private var defaultHeaders = mutableMapOf(
        "x-os-version" to Build.VERSION.RELEASE,
        "x-hyper-ota-version" to SDK_VERSION,
        "x-release-config-version" to localReleaseConfig?.version.toString(),
        "x-package-version" to localReleaseConfig?.pkg?.version,
        "x-config-version" to localReleaseConfig?.config?.version
    )

    // TODO Move to storing in main app dir & remove this var.
    private var resourceSaveFuture: Future<Unit>? = null

    init {
        tracker.let { trackers.add(it) }
        val sortedHeaders = (rcHeaders ?: emptyMap()).toSortedMap()
        val headersString = sortedHeaders.entries.joinToString(";") { "${it.key}=${it.value}" }
        defaultHeaders["x-dimension"] = headersString
    }

    fun updateReleaseConfig(newConfig: ReleaseConfig?) {
        newConfig?.let {
            localReleaseConfig = it
            releaseConfigTimeout = it.config.releaseConfigTimeout
            packageTimeout = it.config.bootTimeout

            // Updating headers too
            defaultHeaders["x-release-config-version"] = it.version
            defaultHeaders["x-package-version"] = it.pkg.version
            defaultHeaders["x-config-version"] = it.config.version
        }
    }

    private fun updateTimeouts(fetchedReleaseConfig: ReleaseConfig) {
        releaseConfigTimeout = fetchedReleaseConfig.config.releaseConfigTimeout
        packageTimeout = fetchedReleaseConfig.config.bootTimeout
    }

    fun run(onFinish: OnFinishCallback) {
        trackInit()
        if (currentStage == Stage.INITIALIZING) {
            this.onFinish = onFinish
            initTime = System.currentTimeMillis()
            onComplete(Stage.INITIALIZING)
            doAsync { runInternal() }
        }
    }

    private fun setCurrentResult(
        version: String? = null,
        config: ReleaseConfig.Config? = null,
        pkg: ReleaseConfig.PackageManifest? = null,
        resources: Resources? = null
    ) = try {
        if (config != null || pkg != null || resources != null) {
            val currentRes = (currentResult as? UpdateResult.Ok)?.releaseConfig

            val releaseConfig = ReleaseConfig(
                version ?: currentRes?.version ?: (localReleaseConfig?.version ?: DEFAULT_VERSION),
                config ?: currentRes?.config ?: (localReleaseConfig?.config ?: DEFAULT_CONFIG),
                pkg ?: currentRes?.pkg ?: localReleaseConfig?.pkg!!,
                resources ?: currentRes?.resources ?: (localReleaseConfig?.resources ?: DEFAULT_RESOURCES)
            )
            currentResult = UpdateResult.Ok(releaseConfig)
        }
        Unit
    } catch (e: NullPointerException) {
        currentResult = UpdateResult.Error.Unknown
    }

    private fun runInternal() {
        val fetched = fetchReleaseConfig()
        if (fetched == null) {
            currentResult = UpdateResult.Error.RCFetchError
            onComplete(Stage.FINISHED)
            return
        }
        updateTimeouts(fetched)
        onComplete(Stage.FETCHING_RC)
        val pupdateStart = System.currentTimeMillis()
        packageUpdate = doAsync { downloadPackageUpdate(fetched.pkg) }
        resourceUpdate = ResourceUpdateTask(localReleaseConfig?.resources, fetched.resources)
        resourceUpdate?.start()
        var updatedConfig: ReleaseConfig.Config? = null
        if (fetched.version != localReleaseConfig?.version) {
            if (writeRCVersion(fetched.version)) {
                trackInfo(
                    "rc_version_updated",
                    JSONObject().put("new_rc_version", fetched.version)
                )
                Log.d(TAG, "RC Version updated.")
            }
        }
        if (fetched.config.version != localReleaseConfig?.config?.version) {
            if (writeConfig(fetched.config)) {
                updatedConfig = fetched.config
                setCurrentResult(fetched.version, updatedConfig)
                trackInfo(
                    "config_updated",
                    JSONObject().put("new_config_version", fetched.config.version)
                )
                Log.d(TAG, "Config updated.")
            }
        }
        val presult = packageUpdate?.get()
        resourceUpdate?.awaitResourceUpdates()
        onComplete(Stage.DOWNLOADING_UPDATES)
        var didPackageUpdate = false
        var updatedPackage: ReleaseConfig.PackageManifest? = null
        if (!updateTimedOut.get()) {
            Log.d(TAG, "Installing package as updateTimedout is false")
            val packageInstallFuture = doAsync {
                presult?.let {
                    installPackageUpdate(it, fetched.pkg, pupdateStart)
                }
            }
            didPackageUpdate = packageInstallFuture.get()
            updatedPackage = if (didPackageUpdate) fetched.pkg else null
        }
        val resources = resourceUpdate?.installDownloadedResources()
        resourceUpdate?.completeResourceDownload()
        // Fallback gracefully
        onComplete(Stage.INSTALLING)
        setCurrentResult(fetched.version, updatedConfig, updatedPackage, resources)
        val shouldDownloadCurLazySplits = updateTimedOut.get() || !didPackageUpdate

        if (shouldDownloadCurLazySplits) {
            Log.d(TAG, "Starting lazy splits download of current pkg version ${localReleaseConfig?.pkg?.version}")
            localReleaseConfig?.pkg?.let { downloadLazySplits(null, it, true) }
        }

        if (presult is Update.Package.Finished) {
            Log.d(TAG, "Starting lazy splits download of new pkg version ${localReleaseConfig?.pkg?.version}")
            downloadLazySplits(presult.tempWriter, fetched.pkg, !shouldDownloadCurLazySplits)
        }
        trackEnd()
        val state = loadPersistentState()
        onFinish?.let { it(currentResult, state) }
    }

    // returns if the wait is success
    private fun waitForStage(stage: Stage, timeout: Long): Boolean {
        try {
            awaitCompletion(stage, timeout)
        } catch (e: TimeoutException) {
            if (currentStage.ordinal < stage.ordinal + 1) {
                updateTimedOut.set(true)
                Log.d(TAG, "Timeout waiting for ${stage.name}")
                return false
            }
        }
        return true
    }

    fun await(tracker: TrackerCallback): UpdateResult {
        tracker.let {
            if (!trackers.contains(it)) {
                trackers.add(it)
            }
        }
        if (!waitForStage(Stage.FETCHING_RC, releaseConfigTimeout)) {
            return UpdateResult.ReleaseConfigFetchTimeout
        }
        if (!waitForStage(Stage.DOWNLOADING_UPDATES, packageTimeout)) {
            val releaseConfig = when (val currentResult = currentResult) {
                is UpdateResult.Ok -> currentResult.releaseConfig
                else -> null
            }
            return UpdateResult.PackageUpdateTimeout(releaseConfig)
        }
        if (!waitForStage(Stage.INSTALLING, 10000)) {
            return UpdateResult.Error.Unknown
        }
        return currentResult
    }

    @Throws(TimeoutException::class)
    private fun awaitCompletion(stage: Stage, timeoutMillis: Long) {
        val startTime = System.currentTimeMillis()
        Log.d(TAG, "awaitCompletion: awaiting ${stage.name} for ${timeoutMillis}ms")
        val wt = WaitTask()
        val entry = wt to stage
        val enqueued = waitQueue.offer(entry)
        if (!enqueued) {
            Log.e(TAG, "Failed to enqueue!")
        }
        // Checking after queuing to avoid a race cond. where the thread would enter a critical
        // block & then be re-scheduled. Which would lead to an await even though the stage has
        // passed.
        if (currentStage.ordinal > stage.ordinal || currentStage == Stage.FINISHED) {
            if (enqueued) {
                waitQueue.remove(entry)
            }
            wt.complete()
        }

        try {
            wt.get(timeoutMillis, TimeUnit.MILLISECONDS)
        } catch (e: TimeoutException) {
            if (stage == Stage.DOWNLOADING_UPDATES) {
                // stop resource wait
                resourceDownloadStatus = ResourceUpdateStatus.RESOURCES_TIMEDOUT
                val resources = resourceUpdate?.installDownloadedResources()
                setCurrentResult(resources = resources)
                if (packageUpdate?.isDone != true) {
                    throw e
                }
            } else {
                throw e
            }
        }
        logTimeTaken(startTime, "awaitCompletion: ${stage.name}")
    }

    private fun onComplete(completedStage: Stage) {
        if (completedStage.ordinal < currentStage.ordinal || currentStage == Stage.FINISHED) {
            Log.d(
                TAG,
                "Received completion of stage ${completedStage.name} even though current stage is" +
                    "${currentStage.name}."
            )
            return
        }
        val timeTaken = System.currentTimeMillis() - currentStageStartTime
        currentStageStartTime = System.currentTimeMillis()
        Log.d(TAG, "Ended stage: ${completedStage.name} ${timeTaken}ms")
        currentStage = when (completedStage) {
            Stage.INITIALIZING -> Stage.FETCHING_RC
            Stage.FETCHING_RC -> Stage.DOWNLOADING_UPDATES
            Stage.DOWNLOADING_UPDATES -> Stage.INSTALLING
            Stage.INSTALLING -> Stage.FINISHED
            Stage.FINISHED -> Stage.FINISHED
        }
        Log.d(TAG, "Reached stage: ${currentStage.name}")
        var qSize = waitQueue.size
        while (qSize-- > 0) {
            waitQueue.poll()?.let { entry ->
                val (wtask, wstage) = entry
                if (wstage.ordinal <= completedStage.ordinal) {
                    wtask.complete()
                } else {
                    waitQueue.offer(entry)
                }
            }
        }
        if (currentStage == Stage.FINISHED) {
            // drain queue
            while (waitQueue.isNotEmpty()) {
                waitQueue.poll()?.let { (wtask, _) -> wtask.complete() }
            }
            resourceSaveFuture?.get()
        }
    }

    private fun fetchReleaseConfig(): ReleaseConfig? {
        val startTime = System.currentTimeMillis()
        return when (val fr = fetch(releaseConfigUrl, noCache = true)) {
            is Result.Ok -> {
                val body = fr.v.second
                val serialized = String(body.bytes(), StandardCharsets.UTF_8)
                try {
                    val releaseConfig = ReleaseConfig.deSerialize(serialized).getOrThrow()
                    trackReleaseConfigFetchResult(fr, startTime)
                    releaseConfig
                } catch (e: Exception) {
                    Log.e(
                        TAG,
                        "Failed to parse release config ${Log.getStackTraceString(e)}"
                    )
                    trackReleaseConfigFetchResult(Result.Error.ParseError(e), startTime)
                    null
                }
            }

            is Result.Error -> {
                trackReleaseConfigFetchResult(fr, startTime)
                null
            }
        }
    }

    fun copyTempPkg(): ReleaseConfig.PackageManifest? {
        readPersistentState(StateKey.SAVED_PACKAGE_UPDATE_OTA)?.let {
            Log.d(TAG, "Found saved pkg $it.")
            try {
                val tw = fileProviderService.reOpenTempWriter(it.getString("dir"))
                val pkg = ReleaseConfig.packageFromJSON(
                    it.getJSONObject("package_manifest")
                )
                val result = movePackageUpdate(tw, pkg, System.currentTimeMillis())
                if (result) {
                    removeFromPersistentState(StateKey.SAVED_PACKAGE_UPDATE_OTA)
                    return pkg
                }
                return null
            } catch (e: Exception) {
                removeFromPersistentState(StateKey.SAVED_RESOURCE_UPDATE_OTA)
                trackException(
                    "saved_resources_corrupted",
                    e
                )
                return null
            }
        }
        return null
    }

    private fun installPackageUpdate(
        update: Update.Package,
        pkg: ReleaseConfig.PackageManifest,
        startTime: Long
    ): Boolean = when (update) {
        Update.Package.Failed -> {
            trackPackageUpdateResult(Result.Error(), startTime)
            false
        }

        Update.Package.NA -> {
            trackInfo(LogKey.PACKAGE_UPDATE_RESULT, JSONObject().put("result", "No package update available").put("time_taken", System.currentTimeMillis() - startTime))
            Log.d(TAG, "Application is up to-date!")
            false
        }

        is Update.Package.Finished -> {
            pkg.lazy.forEach {
                it.isDownloaded = false
            }
            movePackageUpdate(update.tempWriter, pkg, startTime)
        }
    }

    private fun movePackageUpdate(tw: TempWriter, pkg: ReleaseConfig.PackageManifest, startTime: Long): Boolean {
        val didCopy = copyFilesAsync(tw, "$APP_DIR/$PACKAGE_DIR_NAME")
        if (didCopy) {
            Log.d(TAG, "Copied important splits.")
        }

        val didWriteManifest = if (didCopy) {
            pkg.important.forEach {
                it.isDownloaded = true
            }
            writePackageManifest(pkg)
        } else {
            false
        }
        if (didWriteManifest) {
            Log.d(TAG, "Wrote package manifest.")
        }
        val didInstall = didCopy && didWriteManifest

        if (didInstall) {
            Log.d(TAG, "Installed new important package version: ${pkg.version}")
            trackPackageUpdateResult(Result.Ok(pkg.version), startTime)
        } else {
            Log.e(TAG, "An error occurred while installing the important package splits.")
            val msg = if (!didCopy) {
                "important splits package copy failed"
            } else {
                "release config write failed"
            }
            trackPackageUpdateResult(Result.Error.CustomError(msg), startTime)
        }
        return didInstall
    }

    private fun saveDownloadedPackages(
        update: Update.Package,
        pkg: ReleaseConfig.PackageManifest
    ) {
        when (update) {
            is Update.Package.Finished -> {
                pkg.lazy.forEach {
                    it.isDownloaded = true
                }
                val json = JSONObject(
                    mapOf(
                        "dir" to update.tempWriter.dirName,
                        "package_manifest" to pkg.toJSON()
                    )
                )
                Log.d(TAG, "Saved resources $pkg")
                setInPersistentState(StateKey.SAVED_PACKAGE_UPDATE_OTA, json)
            }

            else -> {}
        }
    }

    private fun incrementLazyDownloadCount(count: AtomicInteger, pkg: ReleaseConfig.PackageManifest, filePath: String, downloadResult: Boolean) {
        if (downloadResult) {
            lazyDownloadCallback?.fileInstalled(filePath, true)
            if (count.incrementAndGet() == pkg.lazy.size) {
                lazyDownloadCallback?.lazySplitsInstalled(true)
            }
        } else {
            lazyDownloadCallback?.fileInstalled(filePath, false)
            lazyDownloadCallback?.lazySplitsInstalled(false)
            count.set(pkg.lazy.size + 1)
        }
    }

    private fun downloadLazySplits(tw: TempWriter?, pkg: ReleaseConfig.PackageManifest, pkgLoaded: Boolean) {
        val count = AtomicInteger(0)
        val updateResult = downloadLazyPackageUpdate(pkg, tw) { tw1: TempWriter, filePath: String, success: Boolean ->
            if (pkgLoaded) {
                val split = pkg.lazy.find {
                    it.filePath == filePath
                }
                if (split?.isDownloaded == true) {
                    incrementLazyDownloadCount(count, pkg, filePath, true)
                } else {
                    val downloadResult = success && copyFile(tw1, filePath, "$APP_DIR/$PACKAGE_DIR_NAME")
                    if (downloadResult) {
                        split?.isDownloaded = true
                    }
                    incrementLazyDownloadCount(count, pkg, filePath, downloadResult)
                }
                if (count.get() % 5 == 0) {
                    writePackageManifest(pkg)
                }
            }
        }

        if (pkgLoaded && updateResult is Update.Package.Finished) {
            writePackageManifest(pkg)
        }

        if (!pkgLoaded && (updateResult is Update.Package.Finished || updateResult is Update.Package.NA)) { // If no lazy splits are present, even then the pkg should be saved. Update.Package.NA
            saveDownloadedPackages(updateResult, pkg)
        }
    }

    private fun writeRCVersion(rcVersion: String): Boolean =
        writeManifest(RC_VERSION_FILE_NAME, rcVersion)

    private fun writeConfig(config: ReleaseConfig.Config): Boolean =
        writeManifest(CONFIG_FILE_NAME, config.toJSON().toString())

    private fun writePackageManifest(packageManifest: Package): Boolean =
        writeManifest(PACKAGE_MANIFEST_FILE_NAME, packageManifest.toJSON().toString())

    private fun downloadPackageUpdate(fetched: Package): Update.Package {
        val local = localReleaseConfig?.pkg
        if (local?.version == fetched.version) {
            trackInfo("important_package_update_info", JSONObject().put("package_splits_download", "No updates in app"))
            Log.d(TAG, "No updates in app.")
            return Update.Package.NA
        }
        trackInfo("package_update_download_started", JSONObject().put("package_version", fetched.version))

        Log.d(TAG, "New app version ${fetched.version} available, trying to download update.")
        try {
            val startTime = System.currentTimeMillis()
            val splits: List<ReleaseConfig.Split> =
                setDifference(fetched.importantSplits, local?.importantSplits ?: emptyList())
            Log.d(TAG, "Downloading important splits: $splits")

            val tw = fileProviderService.newTempWriter(PACKAGE_DIR_NAME)
            if (splits.isEmpty()) {
                trackInfo("important_package_update_info", JSONObject().put("important_package_splits_download", "important no new splits available"))
            } else {
                // Start downloads.
                Log.d(TAG, "Starting important split downloads.")
                val downloads = splits.map {
                    doAsync {
                        if (it.isDownloaded == true) {
                            Result.Ok(Unit)
                        } else {
                            downloadFile(tw, it.url, it.filePath)
                        }
                    }
                }
                // Wait for downloads to complete.
                Log.d(TAG, "Awaiting split downloads.")
                val downloadResults = downloads.map { it.get() }
                if (downloadResults.any { it is Result.Error }) {
                    Log.d(TAG, "Failed to download some important splits.")
                    return Update.Package.Failed
                }
                logTimeTaken(startTime, "Downloaded new important package splits")
            }
            return Update.Package.Finished(tw)
        } catch (e: Exception) {
            Log.d(TAG, "An exception occurred during important package update.")
            trackException("important_package_update_error", e)
            return Update.Package.Failed
        }
    }

    private fun downloadLazyPackageUpdate(fetched: Package, tempWriter: TempWriter? = null, downloadCallback: (tw: TempWriter, fileName: String, success: Boolean) -> Unit): Update.Package {
        val local = localReleaseConfig?.pkg
        val shouldDownloadLazySplits = fetched.lazy.isNotEmpty() && fetched.lazy.any { it.isDownloaded != true }

        if (!shouldDownloadLazySplits) {
            trackInfo("lazy_package_update_info", JSONObject().put("package_splits_download", "No updates in app"))
            Log.d(TAG, "No updates in app.")
            return Update.Package.NA
        }
        trackInfo("lazy_package_update_download_started", JSONObject().put("package_version", fetched.version))
        Log.d(
            TAG,
            "Trying to download lazy splits of the new app version ${fetched.version}."
        )

        try {
            val startTime = System.currentTimeMillis()
            val alreadyDownloaded = (local?.importantSplits.orEmpty() + local?.lazy.orEmpty()).filter { it.isDownloaded == true }
            alreadyDownloaded.forEach { it.isDownloaded = false }
            val splits: List<ReleaseConfig.Split> =
                setDifference(fetched.lazy, alreadyDownloaded)
            Log.d(TAG, "Downloading lazy splits: $splits")

            val tw = tempWriter ?: fileProviderService.newTempWriter(PACKAGE_DIR_NAME)
            fetched.lazy.intersect(alreadyDownloaded.toSet()).forEach {
                it.isDownloaded = true
                downloadCallback(tw, it.filePath, true)
            }

            if (splits.isEmpty()) {
                trackInfo("lazy_package_update_info", JSONObject().put("lazy_package_splits_download", "lazy no new splits available"))
            } else {
                // Start downloads.
                Log.d(TAG, "Starting lazy split downloads.")
                val downloads = splits.map {
                    doAsync {
                        val result = if (it.isDownloaded == true) {
                            Result.Ok(Unit)
                        } else {
                            downloadFile(tw, it.url, it.filePath)
                        }
                        downloadCallback(tw, it.filePath, result is Result.Ok)
                        result
                    }
                }
                // Wait for downloads to complete.
                Log.d(TAG, "Awaiting split downloads.")
                val downloadResults = downloads.map { it.get() }
                if (downloadResults.any { it is Result.Error }) {
                    Log.d(TAG, "Failed to download some lazy splits.")
                    return Update.Package.Failed
                }
                logTimeTaken(startTime, "Downloaded new lazy package splits")
            }
            return Update.Package.Finished(tw)
        } catch (e: Exception) {
            Log.d(TAG, "An exception occurred during lazy package update.")
            trackException("lazy_package_update_error", e)
            return Update.Package.Failed
        }
    }

    private fun copyFile(tempWriter: TempWriter, source: String, dest: String) = tempWriter.moveToMain(source, dest)

    private fun copyFilesAsync(tempWriter: TempWriter, dest: String): Boolean = tempWriter.list()
        ?.map {
            doAsync {
                tempWriter.moveToMain(it, dest)
            }
        }
        ?.map { it.get() }
        ?.all { it == true }
        ?: false

    private fun writeManifest(fileName: String, text: String): Boolean {
        Log.d(TAG, "writing manifest $fileName")
        val startTime = System.currentTimeMillis()
        val result = synchronized(fileLock) {
            fileProviderService.updateFile("app/$fileName", text.toByteArray())
        }
        logTimeTaken(startTime, "writeManifest $fileName")
        return result
    }

    // ----- PERSISTENT-STATE-UTILS -----
    private fun loadPersistentState(): JSONObject = try {
        val serialized = fileProviderService.readFromFile("$APP_DIR/state.json") // state.json
        JSONObject(serialized)
    } catch (e: JSONException) {
        trackException(
            "persistent_state_load_failed",
            e
        )
        savePersistentState(JSONObject())
        JSONObject()
    }

    private fun savePersistentState(state: JSONObject) {
        try {
            fileProviderService.updateFile("$APP_DIR/state.json", state.toString().toByteArray())
        } catch (e: Exception) {
            trackException(
                "persistent_state_save_failed",
                e,
                JSONObject().put("state", state)
            )
        }
    }

    @Suppress("SameParameterValue")
    private fun readPersistentState(key: StateKey): JSONObject? {
        Log.d(TAG, "readPersistentState: ${key.name}")
        val v = loadPersistentState().optJSONObject(key.name)
        Log.d(TAG, "readPersistentState exit")
        return v
    }

    @Suppress("SameParameterValue")
    private fun setInPersistentState(key: StateKey, value: JSONObject) {
        val state = loadPersistentState()
        try {
            state.put(key.name, value)
            savePersistentState(state)
        } catch (e: JSONException) {
            Log.e("Update Task", "Persistent state write failed $state")
            trackException(
                "persistent_state_set_failed",
                e,
                JSONObject()
                    .put("key", key)
                    .put("value", value)
            )
        }
    }

    private fun removeFromPersistentState(key: StateKey) {
        val state = loadPersistentState()
        state.remove(key.name)
        savePersistentState(state)
    }

    // ----- NETWORK-UTILS -----
    private fun downloadFile(
        tempWriter: TempWriter,
        url: URL,
        filePathToSaveIn: String
    ): Result<Unit> {
        Log.d(TAG, "downloadFile $url")
        val startTime = System.currentTimeMillis()
        val result = when (val fetchResult = fetch(url.toString(), true)) {
            is Result.Ok<Pair<Response, ResponseBody>> -> {
                try {
                    val body = fetchResult.v.second
                    if (Thread.interrupted()) {
                        Log.d(TAG, "Cancelled before writing: $filePathToSaveIn")
                        return Result.Error()
                    }
                    val bytes = body.bytes()
                    if (tempWriter.write(filePathToSaveIn, bytes)) {
                        Log.d(TAG, "File $filePathToSaveIn written to disk")
                        Result.Ok(Unit)
                    } else {
                        Log.e(TAG, "Write to disk failed while downloading: $filePathToSaveIn")
                        Result.Error()
                    }
                } catch (e: IOException) {
                    Log.e(TAG, "Error downloading file $filePathToSaveIn", e)
                    fetchResult.v.first.closeQuietly()
                    trackFileWriteError(filePathToSaveIn, e)
                    Result.Error()
                }
            }

            else -> Result.Error()
        }
        logTimeTaken(startTime, filePathToSaveIn)

        return result
    }

    private fun fetch(
        url: String,
        retryEnabled: Boolean = true,
        noCache: Boolean = false,
        tryCnt: Int = 0
    ): FetchResult =
        try {
            val headers = if (noCache) {
                defaultHeaders.apply {
                    put("cache-control", "no-cache")
                }
            } else {
                defaultHeaders
            }
            val resp = netUtils.doGet(url, headers, null, null, null)
            val code = resp.code()
            val body = resp.body()
            if (code != HTTP_OK) {
                Log.e(TAG, "Error in fetch $url code = $code")
                trackFetchHttpError(resp)
                resp.close()
                Result.Error.HttpError(resp)
            } else if (body == null) {
                Log.e(TAG, "Error in fetch $url body = null")
                trackFetchHttpError(resp)
                resp.close()
                Result.Error.HttpNoBody(resp)
            } else {
                Result.Ok(Pair(resp, body))
            }
        } catch (e: IOException) {
            Log.e(TAG, "Error in fetch $url", e)
            if (e is InterruptedIOException) {
                Result.Error()
            } else {
                trackFetchIOError(url, e)
                if (tryCnt < RETRY_LIMIT && retryEnabled) {
                    fetch(url, true, noCache, tryCnt + 1)
                } else {
                    Result.Error()
                }
            }
        }

    // ------- TRACKER-UTILS --------
    private fun trackReleaseConfigFetchResult(
        fetchResult: FetchResult,
        startTime: Long
    ) {
        val status = when (fetchResult) {
            is Result.Ok -> fetchResult.v.first.code()
            is Result.Error.HttpError -> fetchResult.response.code()
            is Result.Error.HttpNoBody -> fetchResult.response.code()
            else -> "-1"
        }
        val error = when (fetchResult) {
            is Result.Error.HttpError -> fetchResult.response.message()
            is Result.Error.HttpNoBody -> "HTTP_NO_BODY"
            is Result.Error.ParseError -> fetchResult.e.message
            else -> null
        }
        val value = JSONObject()
            .put("release_config_url", releaseConfigUrl)
            .put("status", status)
            .put("time_taken", System.currentTimeMillis() - startTime)
        error?.let { value.put("error", it) }
        if (fetchResult is Result.Error.ParseError) {
            value.put(
                "stack_trace",
                Log.getStackTraceString(fetchResult.e)
            )
        }
        trackInfo("release_config_fetch", value)
    }

    private fun trackPackageUpdateResult(updateResult: Result<String>, startTime: Long) {
        val pair = when (updateResult) {
            is Result.Ok -> Pair(updateResult.v, null)
            is Result.Error.CustomError -> Pair(null, updateResult.msg)
            else -> Pair(null, "Reason unknown")
        }
        val value = JSONObject()
        if (pair.first != null) {
            value
                .put("result", "SUCCESS")
                .put("package_version", pair.first)
        } else {
            value.put("result", "FAILED")
        }

        pair.second?.let {
            value.put("reason", pair.second)
        }

        trackInfo(
            LogKey.PACKAGE_UPDATE_RESULT,
            value.put("time_taken", System.currentTimeMillis() - startTime)
        )
    }

    private fun trackFileWriteError(fileName: String, e: Exception) {
        trackException(
            "file_write_failed",
            e,
            JSONObject().put("file_name", fileName)
        )
    }

    private fun trackFetchHttpError(response: Response) {
        val body = response.body()?.byteStream()?.utf8() ?: "null"
        trackError(
            "fetch_failed",
            JSONObject()
                .put("url", response.request().url().toString())
                .put("status", response.code())
                .put("body", body)
        )
    }

    private fun trackFetchIOError(
        url: String,
        e: IOException
    ) {
        trackException("fetch_failed", e, JSONObject().put("url", url))
    }

    private fun trackException(
        key: String,
        e: Exception,
        value: JSONObject = JSONObject()
    ) {
        trackError(
            key,
            value
                .put("error", e.message)
                .put("stack_trace", Log.getStackTraceString(e))
        )
    }

    private fun trackError(key: String, value: JSONObject) {
        trackGeneric(LogLevel.ERROR, key, value)
    }

    private fun trackInit() {
        val value = JSONObject()
        value
            .put("config_version", localReleaseConfig?.config?.version)
            .put("package_version", localReleaseConfig?.pkg?.version)
        trackInfo("init with local config versions", value)
    }

    private fun trackEnd() {
        trackInfo("end", JSONObject().put("time_taken", System.currentTimeMillis() - initTime))
    }

    private fun trackInfo(key: String, value: JSONObject) {
        trackGeneric(LogLevel.INFO, key, value)
    }

    private fun trackGeneric(level: String, key: String, value: JSONObject) {
        trackers.forEach {
            it.track(
                LogCategory.LIFECYCLE,
                LogSubCategory.LifeCycle.HYPER_OTA,
                level,
                LABEL,
                key,
                value.put("app_update_id", updateUUID)
            )
        }
    }

    private fun logTimeTaken(startTime: Long, label: String? = null) {
        if (BuildConfig.DEBUG || BuildConfig.BUILD_TYPE == "qa") {
            val totalTime = System.currentTimeMillis() - startTime
            val msg = "Time ${totalTime}ms"
            if (label != null) {
                Log.d(TAG, "$label $msg")
            } else {
                Log.d(TAG, msg)
            }
        }
    }

    private inner class ResourceUpdateTask(
        val currentResourceManifest: Resources?,
        val newResourceManifest: Resources
    ) {
        lateinit var futures: List<Future<Result<Pair<ReleaseConfig.Split, TempWriter>>>>
        lateinit var copied: List<ReleaseConfig.Split>
        lateinit var skipped: List<ReleaseConfig.Split>
        val tempWriter: TempWriter = fileProviderService.newTempWriter(RESOURCES_DIR_NAME)
        val commonResources = currentResourceManifest?.intersect(
            newResourceManifest.toSet()
        ) ?: emptySet()
        val newResources = newResourceManifest - commonResources
        val savedResourcesInfo = findSavedResources()
        val isDone: Boolean get() = futures.all { it.isDone }

        fun start() {
            Log.d(TAG, "Starting resource update task with resources $newResources")
            // TODO: if newResources is empty then log that there are no new resources

            futures = newResources.map { resource ->
                doAsync {
                    if (savedResourcesInfo != null &&
                        savedResourcesInfo.second.contains(resource)
                    ) {
                        Log.d(
                            TAG,
                            "Skipping download of saved resource: ${resource.filePath}"
                        )
                        Result.Ok(Pair(resource, savedResourcesInfo.first))
                    } else {
                        Log.d(TAG, "Downloading resource: ${resource.filePath}")
                        val result = downloadFile(tempWriter, resource.url, resource.filePath)
                        if (result is Result.Ok) {
                            Result.Ok(Pair(resource, tempWriter))
                        } else {
                            Result.Error()
                        }
                    }
                }
            }
        }

        fun awaitResourceUpdates(
        ) {
            val startTime = System.currentTimeMillis()
            val microsecond = TimeUnit.MICROSECONDS.toNanos(1)
            Log.d(TAG, "awaitDownloads: Starting wait.")

            while (resourceDownloadStatus == ResourceUpdateStatus.RESOURCES_DOWNLOADING && !updateTimedOut.get()) {
                if (isDone) {
                    break
                }
                LockSupport.parkNanos(microsecond)
            }

            if (!updateTimedOut.get()) {
                // Log saying that the process timedout - Pending on timeout logic
                Log.d(TAG, "awaitResources: Timeout.")
            }
            logTimeTaken(startTime, "awaitDownloads: Wait ended.")
        }

        fun installDownloadedResources(): Resources? {
            if (resourceDownloadStatus != ResourceUpdateStatus.RESOURCES_INSTALLING) {
                resourceDownloadStatus = ResourceUpdateStatus.RESOURCES_INSTALLING
                val finished = futures.filter { it.isDone }
                    .map { it.get() }

                copied = finished.filterIsInstance<Result.Ok<Pair<ReleaseConfig.Split, TempWriter>>>()
                    .map { copyResource(it.v.first, it.v.second) }
                    .mapNotNull { it.get() }

                trackInfo("updated_resources", JSONObject().put("resources", copied.map { it.toJSON() }))
                skipped = newResources.filter { !copied.contains(it) }

                if (copied.isEmpty()) {
                    Log.d(TAG, "No new resources to install.")
                    return null
                }

                val outdated = currentResourceManifest.orEmpty().filter {
                    skipped.contains(it)
                }
                val latest = newResourceManifest.filter {
                    copied.contains(it)
                }
                Log.d(TAG, "Retaining outdated resources: $outdated")
                Log.d(TAG, "Retaining common resources: $commonResources")
                Log.d(TAG, "Latest resources installed: $latest")
                val resources =
                    ReleaseConfig.ResourceManifest(outdated + latest + commonResources.toList())
                writeResourceManifest(resources)

                return resources
            }
            return null
        }

        fun completeResourceDownload() {
            if (skipped.isNotEmpty()) {
                Log.d(TAG, "Skipped resources $skipped")
                trackInfo(
                    "skipped_resources",
                    JSONObject().put("resources", skipped.map { it.toJSON() })
                )
                resourceSaveFuture = doAsync { saveDownloadedResources() }
            } else {
                if (savedResourcesInfo != null) {
                    OTAUtils.runOnBackgroundThread {
                        removeFromPersistentState(StateKey.SAVED_RESOURCE_UPDATE_OTA)
                    }
                }
                Log.d(TAG, "No resources skipped!")
            }
        }

        fun saveDownloadedResources() {
            val results = futures.map { it.get() }

            if (results.isEmpty()) {
                Log.d(TAG, "No resources to save.")
                return
            }

            Log.d(TAG, "Download results: $results")

            val downloaded = results
                .filterIsInstance<Result.Ok<Pair<ReleaseConfig.Split, TempWriter>>>()
                .filter { it.v.second.dirName == tempWriter.dirName }
                .map { it.v.first }

            val downloadEntries = newResourceManifest.filter {
                downloaded.contains(it) && skipped.contains(it)
            }
            val json = JSONObject(
                mapOf(
                    "dir" to tempWriter.dirName,
                    "resource_manifest" to ReleaseConfig.ResourceManifest(downloadEntries).toJSON()
                )
            )
            Log.d(TAG, "Saved resources $downloadEntries")
            setInPersistentState(StateKey.SAVED_RESOURCE_UPDATE_OTA, json)
        }

        private fun copyResource(
            resource: ReleaseConfig.Split,
            tempWriter: TempWriter
        ): Future<ReleaseConfig.Split?> =
            doAsync {
                if (tempWriter.moveToMain(resource.filePath, "$APP_DIR/$PACKAGE_DIR_NAME")) {
                    resource
                } else {
                    Log.e(TAG, "Failed to copy resource: ${resource.filePath}")
                    null
                }
            }

        private fun findSavedResources(): Pair<TempWriter, Resources>? =
            // TODO Move strings to constants.
            readPersistentState(StateKey.SAVED_RESOURCE_UPDATE_OTA)?.let {
                Log.d(TAG, "Found saved resources $it.")
                try {
                    val tw = fileProviderService.reOpenTempWriter(it.getString("dir"))
                    val resources = ReleaseConfig.resourcesFromJSON(
                        it.getJSONArray("resource_manifest")
                    )
                    if (resources.isNotEmpty()) {
                        Pair(tw, resources)
                    } else {
                        null
                    }
                } catch (e: Exception) {
                    removeFromPersistentState(StateKey.SAVED_RESOURCE_UPDATE_OTA)
                    trackException(
                        "saved_resources_corrupted",
                        e
                    )
                    null
                }
            }

        private fun writeResourceManifest(resourceManifest: Resources): Boolean {
            val json = resourceManifest.toJSON()
            return writeManifest(RESOURCES_FILE_NAME, json.toString())
        }
    }

    sealed interface Result<V> {
        open class Error<V> : Result<V> {
            data class HttpError<V>(val response: Response) : Error<V>()
            data class HttpNoBody<V>(val response: Response) : Error<V>()
            data class ParseError<V>(val e: Exception) : Error<V>()
            data class CustomError<V>(val msg: String) : Error<V>()
        }

        data class Ok<V>(val v: V) : Result<V>
    }

    sealed interface Update {
        object Error : Update
        sealed interface Package : Update {
            class Finished(val tempWriter: TempWriter) : Package
            object NA : Package
            object Failed : Package
        }
    }

    private enum class Stage {
        INITIALIZING,
        FETCHING_RC,
        DOWNLOADING_UPDATES,
        INSTALLING,
        FINISHED
    }

    private enum class ResourceUpdateStatus {
        RESOURCES_DOWNLOADING,
        RESOURCES_INSTALLING,
        RESOURCES_TIMEDOUT
    }

    private object LogKey {
        const val PACKAGE_UPDATE_RESULT = "package_update_result"
    }

    companion object {
        const val TAG = "UpdateTask"
        const val LABEL = "ota_update"
        const val RETRY_LIMIT = 1
        val SDK_VERSION: String = Workspace.ctx?.getString(R.string.hyper_ota_version) ?: "undefined"

        private fun <V> doAsync(callable: Callable<V>): Future<V> =
            OTAUtils.doAsync(callable)

        // Returns set difference, i.e. A - B
        private fun <V> setDifference(a: List<V>, b: List<V>): List<V> {
            return a.toSet().minus(b.toSet()).toList()
        }

        fun Closeable.closeQuietly() =
            try {
                this.close()
            } catch (_: IOException) {
            }

        fun InputStream.utf8() = this.bufferedReader().use(BufferedReader::readText)
    }
}
