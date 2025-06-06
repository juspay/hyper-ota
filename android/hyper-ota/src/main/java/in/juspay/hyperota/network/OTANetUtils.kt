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

package `in`.juspay.hyperota.network

import android.content.Context
import `in`.juspay.hyperota.R
import `in`.juspay.hyperota.services.Workspace

class OTANetUtils(val ctx: Context, val clientId: String, private val appVersion: String, connectionTimeout: Int, readTimeout: Int, sslPinningRequired: Boolean = false) : NetUtils(connectionTimeout, readTimeout, sslPinningRequired) {

    constructor(ctx: Context, clientId: String, appVersion: String) : this(ctx, clientId, appVersion, 0, 0, false)

    override fun getDefaultSDKHeaders(): MutableMap<String, String> {
        val defaultHeaders = HashMap<String, String>()

        defaultHeaders["User-Agent"] = USER_AGENT
        defaultHeaders["Accept-Language"] = "en-US,en;q=0.5"
        defaultHeaders["X-Powered-By"] = "Juspay Hyper OTA Android"
        defaultHeaders["X-App-Name"] = "Hyper-OTA"
        defaultHeaders["Referer"] = ctx.packageName
        defaultHeaders["x-client-id"] = clientId
        defaultHeaders["x-app-version"] = appVersion
        defaultHeaders["x-hyper-ota-version"] =  Workspace.ctx?.getString(R.string.hyper_ota_version) ?: "undefined"


        return defaultHeaders
    }

    companion object {
        private val agent: String? = System.getProperty("http.agent")
        private var USER_AGENT = if (agent.isNullOrEmpty()) "Juspay Express Checkout Android SDK" else agent
    }
}
