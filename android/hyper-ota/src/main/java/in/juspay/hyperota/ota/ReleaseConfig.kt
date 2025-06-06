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

import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.net.MalformedURLException
import java.net.URL
import java.util.Collections

internal typealias Package = ReleaseConfig.PackageManifest
internal typealias Resources = ReleaseConfig.ResourceManifest

internal data class ReleaseConfig(
    val version: String,
    val config: Config,
    val pkg: PackageManifest,
    val resources: ResourceManifest
) {
    companion object {
        private fun JSONObject.getURL(key: String) =
            try {
                URL(this.getString(key))
            } catch (e: MalformedURLException) {
                throw JSONException("Property '$key' is not a valid URL.")
            }

        private fun JSONArray.getSplit(i: Int) =
            try {
                val json = this.getJSONObject(i)
                Split(json.getURL("url"), json.getString("filePath"), if (json.has("isDownloaded")) json.getBoolean("isDownloaded") else null)
            } catch (e: JSONException) {
                throw JSONException("JSON at index '$i' is not a valid Split")
            }

        fun deSerialize(serialized: String): Result<ReleaseConfig> =
            try {
                val json = JSONObject(serialized)
                val releaseConfig = ReleaseConfig(
                    json.getString("version"),
                    configFromJSON(json.getJSONObject("config")),
                    packageFromJSON(json.getJSONObject("package")),
                    resourcesFromJSON(json.getJSONArray("resources"))
                )
                Result.success(releaseConfig)
            } catch (e: JSONException) {
                Result.failure(e)
            }

        fun deSerializeConfig(serialized: String): Result<Config> =
            try {
                Result.success(configFromJSON(JSONObject(serialized)))
            } catch (e: JSONException) {
                Result.failure(e)
            }

        private fun configFromJSON(json: JSONObject): Config =
            Config(
                json.getString("version"),
                json.getLong("release_config_timeout"),
                json.getLong("boot_timeout"),
                json.getJSONObject("properties")
            )

        fun deSerializePackage(serialized: String): Result<PackageManifest> =
            try {
                Result.success(packageFromJSON(JSONObject(serialized)))
            } catch (e: JSONException) {
                Result.failure(e)
            }

        fun packageFromJSON(json: JSONObject): PackageManifest {
            return PackageManifest(
                json.getString("name"),
                json.getString("version"),
                json.getJSONObject("properties"),
                Split(json.getURL("index")),
                json.getJSONArray("important").let {
                    List(it.length()) { i -> it.getSplit(i) }
                },
                json.getJSONArray("lazy").let {
                    List(it.length()) { i -> it.getSplit(i) }
                }
            )
        }

        fun deSerializeResources(serialized: String): Result<ResourceManifest> =
            try {
                Result.success(resourcesFromJSON(JSONArray(serialized)))
            } catch (e: JSONException) {
                Result.failure(e)
            }

        fun resourcesFromJSON(array: JSONArray): ResourceManifest {
            val entries = array.let {
                List(it.length()) { i -> it.getSplit(i) }
            }
            return ResourceManifest(entries)
        }
    }

    fun serialize(): String =
        JSONObject()
            .put("version", version)
            .put("config", config.toJSON())
            .put("package", pkg.toJSON())
            .put("resources", resources.toJSON())
            .toString()

    data class Config(
        val version: String,
        val releaseConfigTimeout: Long,
        val bootTimeout: Long,
        val properties: JSONObject
    ) {
        fun toJSON(): JSONObject =
            JSONObject()
                .put("version", version)
                .put("release_config_timeout", releaseConfigTimeout)
                .put("boot_timeout", bootTimeout)
                .put("properties", properties)
    }

    data class Split(val url: URL, var filePath: String, var isDownloaded: Boolean?) {
        val fileName = url.path.split("/").last()

        constructor(url: URL) : this(url, url.path.split("/").last(), null)

        override fun equals(other: Any?): Boolean {
            return other is Split &&
                url == other.url &&
                filePath == other.filePath
        }

        override fun hashCode(): Int {
            return 31 * url.hashCode() + filePath.hashCode()
        }

        fun toJSON(): JSONObject {
            val json = JSONObject().put("url", this.url.toString()).put("filePath", this.filePath)
            isDownloaded?.let {
                json.put("isDownloaded", isDownloaded)
            }
            return json
        }
    }

    data class PackageManifest(
        val name: String,
        val version: String,
        val properties: JSONObject,
        val index: Split,
        val important: List<Split>,
        val lazy: List<Split>
    ) {
        private val allSplits: List<Split>
            get() = Collections.unmodifiableList(important.toMutableList() + index + lazy.toMutableList())

        val importantSplits: List<Split>
            get() = Collections.unmodifiableList(important.toMutableList() + index)

        val fileNames: List<String>
            get() = allSplits.map { it.fileName }

        val filePaths: List<String>
            get() = allSplits.map { it.filePath }

        fun toJSON(): JSONObject =
            JSONObject()
                .put("name", name)
                .put("version", version)
                .put("properties", properties)
                .put("index", index.url.toString())
                .put("important", JSONArray(important.map { it.toJSON() }))
                .put("lazy", JSONArray(lazy.map { it.toJSON() }))
    }

    data class ResourceManifest(private val entries: List<Split>) : List<Split> by entries {
        fun toJSON(): JSONArray {
            val array = JSONArray()
            for (r in entries) {
                array.put(r.toJSON())
            }
            return array
        }

        val filePaths: List<String>
            get() = entries.map { it.filePath }
    }
}
