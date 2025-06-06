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

package `in`.juspay.hyperota

import android.content.Context
import androidx.annotation.Keep
import `in`.juspay.hyperota.ota.ApplicationManager
import `in`.juspay.hyperota.services.OTAServices
import `in`.juspay.hyperota.services.Workspace

@Keep
class HyperOTAServices(private val context: Context, workSpacePath: String, private val fileName: String, appVersion: String, private val releaseConfigTemplateUrl: String, useBundledAssets: Boolean, trackerCallback: TrackerCallback) {
    private val workspace: Workspace = Workspace(context, workSpacePath)
    private val otaServices: OTAServices = OTAServices(context, workspace, appVersion, useBundledAssets, trackerCallback)

    @Keep
    fun createApplicationManager(headers: Map<String, String>? = null): ApplicationManager {
        return ApplicationManager(context, releaseConfigTemplateUrl, otaServices, fileName, headers)
    }
}
