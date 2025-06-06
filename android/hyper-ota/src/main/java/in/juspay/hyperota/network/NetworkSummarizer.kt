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

/* Class used for storing metrics & then generating a report when asked. On generation
 * of the report, all the added metrics will be cleared.
 * Originally created to get quick analytics on network performance for an OTA update.
 */
package `in`.juspay.hyperota.network

import okhttp3.Response
import org.json.JSONObject
import java.net.URL
import java.util.Vector

class NetworkSummarizer {
    data class Metric(
        val url: URL,
        val status: Int,
        val latency: String,
        val xCache: String?
    ) {
        fun toJSON(): JSONObject =
            JSONObject()
                .put("url", url.toString())
                .put("status", status)
                .put("latency", latency)
                .put("x_cache", xCache ?: "NA")
    }

    data class Summary(
        val avgLatency: String,
        val sessionId: String,
        val updateId: String,
        val metrics: List<Metric>,
        val updated: Boolean
    ) {
        fun toJSON(): JSONObject =
            JSONObject()
                .put("avg_latency", avgLatency)
                .put("session_id", sessionId)
                .put("update_id", updateId)
                .put("metrics", metrics.map(Metric::toJSON))
                .put("updated", updated)
    }

    private var metrics: MutableList<Metric> = Vector()

    // This var is tech-debt, deprecate when you get the chance.
    private var totalLatency = 0L

    fun addMetric(response: Response, latency: Long) {
        val url = response.request().url().url()
        totalLatency += latency
        val metric = Metric(
            url,
            response.networkResponse()?.code() ?: response.code(),
            "%dms".format(latency),
            response.header("x-cache")
        )
        metrics.add(metric)
    }

    fun publishSummary(sessionId: String, updateId: String, didUpdate: Boolean): Summary {
        val summary = Summary(
            "%dms".format(Integer.max(1, ((totalLatency / metrics.size).toInt()))),
            sessionId,
            updateId,
            metrics,
            didUpdate
        )
        metrics = Vector()
        totalLatency = 0

        return summary
    }
}
