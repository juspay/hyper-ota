package `in`.juspay.airborne.network

import `in`.juspay.airborne.constants.APIConstants
import `in`.juspay.airborne.model.OTAEvent
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

internal class OTAAnalyticsAPI(private val client: OkHttpClient = OkHttpClient(),
                      private val dispatcher: CoroutineDispatcher = Dispatchers.IO) {
    private val json = Json { prettyPrint = false; ignoreUnknownKeys = false }

    suspend fun postEvent(
        event: OTAEvent,
    ): String = withContext(dispatcher) {

        val jsonBody = json.encodeToString(event)
        val mediaType = "application/json; charset=utf-8".toMediaType()
        val body = jsonBody.toRequestBody(mediaType)

        val requestBuilder = Request.Builder()
            .url(APIConstants.Analytics.URL + APIConstants.Analytics.EVENT_ENDPOINT)
            .post(body)

//        headers.forEach { (key, value) ->
//            requestBuilder.addHeader(key, value)
//        }

        val request = requestBuilder.build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IOException("Unexpected HTTP code: ${response.code}")
            }
            response.body?.string() ?: throw IOException("Empty response body")
        }
    }
}