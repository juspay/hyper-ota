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

import android.util.Log
import org.json.JSONObject

abstract class TrackerCallback {
    abstract fun track(category: String, subCategory: String, level: String, label: String, key: String, value: Any)
    abstract fun track(category: String, subCategory: String, level: String, label: String, key: String, value: JSONObject)

    abstract fun trackException(category: String, subCategory: String, label: String, description: String, e: Throwable)

    fun trackAndLogException(tag: String, category: String, subCategory: String, label: String, description: String, e: Throwable) {
        Log.e(tag, description, e)
        this.trackException(category, subCategory, label, description, e)
    }
}
