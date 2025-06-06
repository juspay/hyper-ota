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

import org.json.JSONObject

internal object Constants {
    const val APP_DIR = "app"
    const val PACKAGE_DIR_NAME = "package"
    const val RESOURCES_DIR_NAME = "resources"
    const val RC_VERSION_FILE_NAME = "rc_version.txt"
    const val PACKAGE_MANIFEST_FILE_NAME = "pkg.json"
    const val CONFIG_FILE_NAME = "config.json"
    const val RESOURCES_FILE_NAME = "resources.json"
    const val DEFAULT_VERSION = "1"
    val DEFAULT_CONFIG = ReleaseConfig.Config(
        version = "v000000",
        releaseConfigTimeout = 3000L,
        bootTimeout = 7000L,
        properties = JSONObject()
    )
    val DEFAULT_RESOURCES = ReleaseConfig.ResourceManifest(emptyList())
}
