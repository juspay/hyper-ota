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

package `in`.juspay.hyperotareact

import android.content.Context
import androidx.annotation.Keep
import `in`.juspay.hyperota.HyperOTAServices
import `in`.juspay.hyperota.LazyDownloadCallback
import `in`.juspay.hyperota.TrackerCallback
import org.json.JSONObject

@Keep
class HyperOTAReact(context: Context, appId: String, private val indexFileName: String, appVersion: String, releaseConfigTemplateUrl: String, headers: Map<String, String>? = null, lazyDownloadCallback: LazyDownloadCallback, trackerCallback: TrackerCallback) {

    private val hyperOTAServices = HyperOTAServices(context, appId, indexFileName, appVersion, releaseConfigTemplateUrl, false, trackerCallback)

    private val applicationManager = hyperOTAServices.createApplicationManager(headers)

    @Keep
    constructor(context: Context, appId: String, indexFileName: String, appVersion: String, releaseConfigTemplateUrl: String, headers: Map<String, String>? = null, lazyDownloadCallback: LazyDownloadCallback) : this(
        context,
        appId,
        indexFileName,
        appVersion,
        releaseConfigTemplateUrl,
        headers,
        lazyDownloadCallback,
        object : TrackerCallback() {
            override fun track(
                category: String,
                subCategory: String,
                level: String,
                label: String,
                key: String,
                value: Any
            ) {
            }

            override fun track(
                category: String,
                subCategory: String,
                level: String,
                label: String,
                key: String,
                value: JSONObject
            ) {
            }

            override fun trackException(
                category: String,
                subCategory: String,
                label: String,
                description: String,
                e: Throwable
            ) {
            }
        }
    )

    init {
        applicationManager.loadApplication(appId, lazyDownloadCallback)
    }

    /**
     * @return The path of index bundle
     */
    @Keep
    fun getBundlePath(): String {
        val filPath = applicationManager.getIndexBundlePath()
        return filPath.ifEmpty { "assets://$indexFileName" }
    }

    /**
     * @param filePath The path of the file to get the content from
     * @return The content of the file
     */
    @Keep
    fun getFileContent(filePath: String): String {
        return applicationManager.readSplit(filePath)
    }

    /**
     *
     * @return returns a stringified JSON of release config
     */
    @Keep
    fun getReleaseConfig(): String {
        return applicationManager.readReleaseConfig()
    }
}
