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

/* Class for maintaining a `namespace` through the application.
 * The main functionality provided is to open files & read/write
 * shared-preferences according to a particular namespace.
 */
package `in`.juspay.hyperota.services

import android.annotation.SuppressLint
import android.content.Context
import android.content.SharedPreferences
import android.content.res.AssetManager
import android.util.Log
import androidx.annotation.Keep
import androidx.core.content.edit
import java.io.File
import java.io.IOException
import java.io.InputStream

@Keep
open class Workspace(ctx: Context, workspacePath: String) {
    private val path = trimFileSeparator(workspacePath)
    private var root: File
    val cacheRoot: File
    private val sharedPrefsList: List<SharedPreferences>
    private val assetManager: AssetManager

    init {
        Workspace.ctx = ctx
        root = mkRoot(ctx, this.path)
        cacheRoot = mkCacheRoot(ctx, this.path)
        val sharedPrefsName = this.path.replace('/', '_')
        assetManager = ctx.assets
        val spl = ArrayList<SharedPreferences>()
        if (fallbackSharedPreferencesJuspay == null) {
            fallbackSharedPreferencesJuspay = ctx
                .getSharedPreferences("juspay", Context.MODE_PRIVATE)
        }
        if (fallbackSharedPreferencesGodel == null) {
            fallbackSharedPreferencesGodel = ctx
                .getSharedPreferences("godel", Context.MODE_PRIVATE)
        }
        if (path == FALLBACK_WORKSPACE) {
            fallbackSharedPreferencesJuspay?.let { spl.add(it) }
            fallbackSharedPreferencesGodel?.let { spl.add(it) }
        } else {
            spl.add(ctx.getSharedPreferences(sharedPrefsName, Context.MODE_PRIVATE))
            fallbackSharedPreferencesJuspay?.let { spl.add(it) }
            fallbackSharedPreferencesGodel?.let { spl.add(it) }
        }
        sharedPrefsList = spl
    }

    fun clean(ctx: Context) {
        if (root.exists()) {
            root.deleteRecursively()
            mkRoot(ctx, path)
        }
    }

    fun open(filePath: String): File = open(root, filePath)

    fun openInCache(filePath: String): File = open(cacheRoot, filePath)

    private fun open(root: File, filePath: String) =
        File(root, trimFileSeparator(filePath))

    @Throws(IOException::class)
    fun openAsset(filePath: String): InputStream {
        val trimmed = trimFileSeparator(filePath)
        return try {
            assetManager.open("$path/$trimmed")
        } catch (e: IOException) {
            if (path != FALLBACK_WORKSPACE) {
                Log.d(TAG, "$e, trying fallback workspace.")
                assetManager.open("$FALLBACK_WORKSPACE/$trimmed")
            } else {
                throw e
            }
        }
    }

    fun getFromSharedPreference(key: String?, default: String?): String? {
        for (sharedPref in sharedPrefsList) {
            sharedPref.getString(key, null)?.let {
                return it
            }
        }
        return default
    }

    fun writeToSharedPreference(key: String?, value: String?): Unit? = key?.let {
        sharedPrefsList[0].edit {
            putString(it, value)
        }
    }

    fun removeFromSharedPreference(key: String?): Unit? = key?.let {
        for (sharedPref in sharedPrefsList) {
            sharedPref.edit()?.remove(it)?.apply()
        }
    }

    companion object {
        private const val TAG = "Workspace"
        private const val FALLBACK_WORKSPACE = "juspay"

        @SuppressLint("StaticFieldLeak")
        @JvmStatic
        var ctx: Context? = null
        private var fallbackSharedPreferencesJuspay: SharedPreferences? = null
        private var fallbackSharedPreferencesGodel: SharedPreferences? = null

        protected fun trimFileSeparator(path: String) =
            path.trim(' ', '/')

        private fun mkRoot(ctx: Context, workspacePath: String): File {
            if (workspacePath.contains("/")) {
                val i = workspacePath.indexOf('/')
                val rootDirName = workspacePath.substring(0, i)
                val rootDir = ctx.getDir(rootDirName, Context.MODE_PRIVATE)
                val workspaceDir = File(rootDir, workspacePath.substring(i + 1))
                if (!workspaceDir.exists()) {
                    workspaceDir.mkdirs()
                }

                return workspaceDir
            } else {
                return ctx.getDir(workspacePath, Context.MODE_PRIVATE)
            }
        }

        private fun mkCacheRoot(ctx: Context, workspacePath: String): File {
            val cacheRoot = File(ctx.cacheDir, workspacePath)
            if (!cacheRoot.exists()) {
                cacheRoot.mkdirs()
            }
            return cacheRoot
        }
    }
}
