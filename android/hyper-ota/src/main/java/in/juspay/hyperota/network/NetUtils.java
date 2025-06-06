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

package in.juspay.hyperota.network;

import android.content.Context;
import android.util.Log;

import androidx.annotation.IntRange;
import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.net.URL;
import java.net.URLEncoder;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLSocketFactory;

import in.juspay.hyperota.TrackerCallback;
import in.juspay.hyperota.constants.Labels;
import in.juspay.hyperota.constants.LogCategory;
import in.juspay.hyperota.constants.LogLevel;
import in.juspay.hyperota.constants.LogSubCategory;
import in.juspay.hyperota.security.HyperSSLSocketFactory;
import in.juspay.hyperota.services.Workspace;

import okhttp3.Cache;
import okhttp3.Call;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okio.BufferedSink;

/**
 * Utility functions to call URL's using pure URLConnections
 *
 * @author Sriduth
 */
@SuppressWarnings("JavaDoc")
public class NetUtils {
    private static final String HTTP_CACHE_NAME = "hyper-http-cache";
    private static final MediaType MEDIA_TYPE_TEXT = MediaType.parse("text/plain");
    private static final String TAG = "NetUtils";

    private int readTimeout;
    public static final OkHttpClient DEFAULT_HTTP_CLIENT = buildHttpClient();

    private int connectionTimeout;
    private boolean trackMetrics = false;
    private final NetworkSummarizer networkSummarizer = new NetworkSummarizer();
    private SSLSocketFactory sslSocketFactory;
    private String sessionId;

    @SuppressWarnings("SameParameterValue")
    public NetUtils(@IntRange(from = 0, to = Integer.MAX_VALUE) int connectionTimeout,
                    @IntRange(from = 0, to = Integer.MAX_VALUE) int readTimeout) throws NoSuchAlgorithmException, KeyManagementException {
        this(connectionTimeout, readTimeout, false);
    }

    @SuppressWarnings("SameParameterValue")
    public NetUtils(@IntRange(from = 0, to = Integer.MAX_VALUE) int connectionTimeout,
                    @IntRange(from = 0, to = Integer.MAX_VALUE) int readTimeout,
                    boolean sslPinningRequired) throws NoSuchAlgorithmException, KeyManagementException {
        this.connectionTimeout = connectionTimeout;
        this.readTimeout = readTimeout;
        /*
         * Using new builder here will not use a new connection pool etc,
         * instead it will use the base client's. So connection pool/cache etc will be shared across.
         * See: https://square.github.io/okhttp/5.x/okhttp/okhttp3/-ok-http-client/index.html
         */
        OkHttpClient httpClient = DEFAULT_HTTP_CLIENT.newBuilder()
                .readTimeout(readTimeout, TimeUnit.MILLISECONDS)
                .connectTimeout(connectionTimeout, TimeUnit.MILLISECONDS)
                .build();
        this.sslSocketFactory = new JuspaySSLSocketFactory();
    }

    private static OkHttpClient buildHttpClient() {
        File cacheDir = Workspace.getCtx()
                .getDir(HTTP_CACHE_NAME, Context.MODE_PRIVATE);
        long ONE_MB = 1024L * 1024L;
        Cache httpCache = new Cache(cacheDir, 10 * ONE_MB);
        return new OkHttpClient.Builder()
                .cache(httpCache)
                /* This settings controls the following of redirects from HTTPS to HTTP & vice-versa.
                 * HttpUrlConnection has it disabled by default, so for the sake of parity this has
                 * also been disabled in okhttp.
                 */
                .followSslRedirects(false)
                .build();
    }

    private static void setHeaders(
            @NonNull Request.Builder requestBuilder,
            @Nullable Map<String, String> headers
    ) {
        if (headers != null) {
            for (Map.Entry<String, String> header : headers.entrySet()) {
                String name = header.getKey();
                String value = header.getValue();
                if (name == null || value == null) {
                    continue;
                }
                boolean isAcceptingGZip =
                        name.equalsIgnoreCase("accept-encoding")
                                && value.equalsIgnoreCase("gzip");
                if (isAcceptingGZip) {
                    /*
                     * This header is not needed as Okhttp will handle adding this header
                     * & decoding the body. And if you add it here, we'll have to handle
                     * gzip decoding.
                     */
                    continue;
                }
                requestBuilder.header(name, value);
            }
        }
    }

    private RequestBody createRequestBody(
            @NonNull byte[] rawBody,
            @Nullable String contentType
    ) {
        return new RequestBody() {
            @Override
            public MediaType contentType() {
                if (contentType == null || MediaType.parse(contentType) == null) {
                    return MEDIA_TYPE_TEXT;
                } else {
                    return MediaType.parse(contentType);
                }
            }

            @Override
            public void writeTo(@NonNull BufferedSink bufferedSink) throws IOException {
                bufferedSink.write(rawBody);
            }
        };
    }

    @Nullable
    private String getContentType(@Nullable Map<String, String> headers) {
        String contentType = null;
        if (headers != null) {
            contentType = headers.get("content-type");
            if (contentType == null) {
                contentType = headers.get("Content-Type");
            }
        }

        return contentType;
    }

    @Keep
    public String generateQueryString(@Nullable Map<String, String> queryString)
            throws UnsupportedEncodingException {
        StringBuilder sb = new StringBuilder();
        if (queryString != null) {
            for (Map.Entry<String, String> e : queryString.entrySet()) {
                if (sb.length() > 0) {
                    sb.append('&');
                }
                sb.append(URLEncoder.encode(e.getKey(), "UTF-8")).append('=')
                        .append(URLEncoder.encode(e.getValue(), "UTF-8"));
            }
        }

        return sb.toString();
    }

    public Response doPut(@NonNull final Context context, URL url, byte[] data, @Nullable Map<String, String> headers, NetUtils netUtils, JSONObject options, @Nullable String tag) throws Exception {
        return doMethod("PUT", url.toString(), null, headers, data, null, options, tag);
    }

    public void setReadTimeout(@IntRange(from = 0, to = Integer.MAX_VALUE) int readTimeout) {
        this.readTimeout = readTimeout;
    }

    public void setConnectionTimeout(@IntRange(from = 0, to = Integer.MAX_VALUE) int connectionTimeout) {
        this.connectionTimeout = connectionTimeout;
    }

    protected Map<String, String> getDefaultSDKHeaders() { // specific

        return new HashMap<>();
    }

    /**
     * Template to be the JSON type : {@link JSONObject} or {@link org.json.JSONArray}
     *
     * @param <T>  Type of JSON: Object / Array
     * @param url  url to send the post request to
     * @param json JSON payload
     * @return String response
     * @throws IOException
     */
    public <T> Response postJson(URL url, T json, JSONObject options) throws IOException {
        return doPost(url, json.toString().getBytes(), "application/json", null, options, null);
    }

    /**
     * POSTS the given key value params as form data
     *
     * @param url         {@inheritDoc}
     * @param queryParams {@inheritDoc}
     * @return {@inheritDoc}
     * @throws IOException
     */
    public Response postForm(URL url, Map<String, String> queryParams, JSONObject options)
            throws IOException {
        return doPost(url, generateQueryString(queryParams).getBytes(), "application/x-www-form-urlencoded", null, options, null);
    }

    /**
     * Do a simple post to a url
     *
     * @param url
     * @return
     * @throws IOException
     */
    public Response postUrl(URL url, Map<String, String> urlParams, JSONObject options)
            throws IOException {
        return doPost(url, generateQueryString(urlParams).getBytes(), "application/x-www-form-urlencoded", null, options, null);
    }

    /**
     * Do a simple post to a url
     *
     * @param url
     * @return
     * @throws IOException
     */
    public Response postUrl(URL url, Map<String, String> headers, Map<String, String> urlParams, JSONObject options, @Nullable String tag)
            throws IOException {
        return doPost(url, generateQueryString(urlParams).getBytes(), "application/json", headers, options, tag);
    }

    /**
     * Do a simple post to a url
     *
     * @param url
     * @return
     * @throws IOException
     */
    public Response postUrl(URL url, Map<String, String> headers, String urlParams, JSONObject options, @Nullable String tag)
            throws IOException {
        return doPost(url, urlParams.getBytes(), "application/x-www-form-urlencoded", headers, options, tag);
    }

    /**
     * @param url URL to post to
     * @return JuspayHttpsResponse object having wrapped response contents.
     * @throws IOException
     */
    public Response postUrl(URL url, JSONObject options) throws IOException {
        return doPost(url, null, "application/x-www-form-urlencoded", null, options, null);
    }

    public Response deleteUrl(URL url, Map<String, String> urlParams, JSONObject options)
            throws IOException {
        return doDelete(url, generateQueryString(urlParams).getBytes(), "application/x-www-form-urlencoded", null, options, null);
    }

    public Response deleteUrl(URL url, Map<String, String> headers, Map<String, String> urlParams, JSONObject options, @Nullable String tag)
            throws IOException {
        return doDelete(url, generateQueryString(urlParams).getBytes(), "application/json", headers, options, tag);
    }

    public Response deleteUrl(URL url, Map<String, String> headers, String urlParams, JSONObject options, @Nullable String tag)
            throws IOException {
        return doDelete(url, urlParams.getBytes(), "application/x-www-form-urlencoded", headers, options, tag);
    }

    // ------------------

    public Response deleteUrl(URL url, JSONObject options) throws IOException {
        return doDelete(url, null, "application/x-www-form-urlencoded", null, options, null);
    }

    public Response doPost(URL url, byte[] payload, String defaultContentType, @Nullable Map<String, String> headers, JSONObject options, @Nullable String tag) throws IOException {
        return doMethod("POST", url.toString(), null, headers, payload, defaultContentType, options, tag);
    }

    public Response doGet(@NonNull String url) throws IOException {
        return doGet(url, null, null, null, null);
    }

    public Response doGet(@NonNull String url, @Nullable Map<String, String> headers) throws IOException {
        return doMethod("GET", url, null, headers, null, null, null, null);
    }

    public Response doGet(@NonNull String url, @Nullable Map<String, String> headers, @Nullable Map<String, String> queryParams, JSONObject options, @Nullable String tag) throws IOException {
        return doMethod("GET", url, queryParams, headers, null, null, options, tag);
    }

    public Response doHead(@NonNull String url, @Nullable Map<String, String> headers, @Nullable Map<String, String> queryParams, JSONObject options, @Nullable String tag) throws IOException {
        return doMethod("HEAD", url, queryParams, headers, null, null, options, tag);
    }

    public Response doDelete(URL url, byte[] payload, String defaultContentType, @Nullable Map<String, String> headers, JSONObject options, @Nullable String tag) throws IOException {
        return doMethod("DELETE", url.toString(), null, headers, payload, defaultContentType, options, tag);
    }

    private Response doMethod(
            @NonNull String method,
            @NonNull String url,
            @Nullable Map<String, String> queryParams,
            @Nullable Map<String, String> headers,
            @Nullable byte[] payload,
            @Nullable String defaultContentType,
            @Nullable JSONObject options,
            @Nullable String tag) throws IOException {
        String query = generateQueryString(queryParams);
        StringBuilder s = new StringBuilder(url);
        if (!query.isEmpty()) {
            s.append("?").append(query);
            url = s.toString();
        }
        Request.Builder requestBuilder = new Request.Builder()
                .url(url);
        if (tag != null) {
            requestBuilder.tag(tag);
        }

        if (headers != null) {
            setHeaders(requestBuilder, headers);
        }
        setHeaders(requestBuilder, getDefaultSDKHeaders());

        if (payload != null) {
            String contentType = getContentType(headers);
            if (contentType == null) {
                contentType = defaultContentType;
            }
            RequestBody requestBody = createRequestBody(payload, contentType);
            requestBuilder.method(method, requestBody);
        } else {
            requestBuilder.method(method, null);
        }

        /*
         * Using new builder here will not use a new connection pool etc,
         * instead it will use the base client's. So connection pool, cache etc will be shared.
         * See: https://square.github.io/okhttp/5.x/okhttp/okhttp3/-ok-http-client/index.html
         */
        OkHttpClient.Builder clientBuilder = DEFAULT_HTTP_CLIENT.newBuilder();
        if (options != null) {
            setOptions(clientBuilder, options);
        }
        if (sslSocketFactory != null && HyperSSLSocketFactory.DEFAULT_TRUST_MANAGER != null) {
            clientBuilder.sslSocketFactory(
                    sslSocketFactory,
                    HyperSSLSocketFactory.DEFAULT_TRUST_MANAGER
            );
        }
        long startTime = System.currentTimeMillis();
        Response response = clientBuilder.build().newCall(requestBuilder.build()).execute();
        long latency = System.currentTimeMillis() - startTime;

        String cacheStat = "CACHE-MISS";
        if (method.equalsIgnoreCase("GET")) {
            Response rawNetworkResponse = response.networkResponse();
            int rawNetworkHttpStatus = rawNetworkResponse != null ?
                    rawNetworkResponse.code() : -1;
            if (response.cacheResponse() != null && rawNetworkHttpStatus == 304) {
                cacheStat = "CONDITIONAL-HIT";
            } else if (response.cacheResponse() != null && rawNetworkHttpStatus == -1) {
                cacheStat = "CACHE-HIT";
            }
            Log.d(
                    TAG,
                    String.format("GET %s %s -> %s ms [%s] [x-cache: %s]",
                            url,
                            response.code(),
                            latency,
                            cacheStat,
                            response.header("x-cache")
                    )
            );
        } else {
            Log.d(
                    TAG,
                    String.format("%s %s %s -> %s ms",
                            method,
                            url,
                            response.code(),
                            latency
                    )
            );
        }

        if (!cacheStat.equalsIgnoreCase("CACHE-HIT") && trackMetrics) {
            networkSummarizer.addMetric(response, latency);
        }

        return response;
    }

    public byte[] fetchIfModified(String fileUrl, Map<String, String> connectionHeaders) throws IOException {
        Response response = doGet(fileUrl, connectionHeaders, null, new JSONObject(), null);
        int responseCode = response.code();

        if (responseCode == HttpsURLConnection.HTTP_OK) {
            return new JuspayHttpsResponse(response).responsePayload;
        }

        return null;
    }

    @SuppressWarnings("WeakerAccess")
    public SSLSocketFactory getSslSocketFactory() {
        return sslSocketFactory;
    }

    public void setSslSocketFactory(SSLSocketFactory sslSocketFactory) {
        this.sslSocketFactory = sslSocketFactory;
    }

    public static void cancelAPICall(String tag, @Nullable TrackerCallback trackerCallback) {
        try {
            for (Call call : DEFAULT_HTTP_CLIENT.dispatcher().runningCalls()) {
                if (tag.equals(call.request().tag())) {
                    call.cancel();
                    if (trackerCallback != null)
                        trackerCallback.track(LogCategory.ACTION, LogSubCategory.ApiCall.NETWORK, LogLevel.INFO, Labels.Network.CANCEL_API, "Cancelling api call from running calls", tag);
                    return;
                }
            }

            for (Call call : DEFAULT_HTTP_CLIENT.dispatcher().queuedCalls()) {
                if (tag.equals(call.request().tag())) {
                    call.cancel();
                    trackerCallback.track(LogCategory.ACTION, LogSubCategory.ApiCall.NETWORK, LogLevel.INFO, Labels.Network.CANCEL_API, "Cancelling api call from queued calls", tag);
                    return;
                }
            }
        } catch (Exception e) {
            trackerCallback.trackAndLogException("NetUtils", LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.Network.CANCEL_API, "Exception while Cancelling API with tag " + tag, e);
            return;
        }
        trackerCallback.track(LogCategory.ACTION, LogSubCategory.ApiCall.NETWORK, LogLevel.INFO, Labels.Network.CANCEL_API, "Not able to Cancel api call from queued/running calls", tag);
    }

    private void setOptions(
            OkHttpClient.Builder clientBuilder,
            JSONObject options) {
        int connectionTimeout = options.optInt(
                "connectionTimeout",
                this.connectionTimeout
        );
        int readTimeout = options.optInt(
                "readTimeout",
                this.readTimeout
        );
        int writeTimeout = options.optInt(
                "writeTimeout",
                -1);
        boolean retryOnConnectionFailure = options.optBoolean(
                "retryOnConnectionFailure",
                true
        );
        if (connectionTimeout != -1) {
            clientBuilder.connectTimeout(connectionTimeout, TimeUnit.MILLISECONDS);
        }
        if (readTimeout != -1) {
            clientBuilder.readTimeout(readTimeout, TimeUnit.MILLISECONDS);
        }
        if (writeTimeout != -1) {
            clientBuilder.writeTimeout(writeTimeout, TimeUnit.MILLISECONDS);
        }
        clientBuilder.retryOnConnectionFailure(retryOnConnectionFailure);
    }

    public void setTrackMetrics(boolean bool) {
        trackMetrics = bool;
    }

    public void postMetrics(String url, String sessionId, String updateId, boolean didUpdate) throws IOException {
        try {
            NetworkSummarizer.Summary summary =
                    networkSummarizer.publishSummary(sessionId, updateId, didUpdate);
            Map<String, String> qParams = new HashMap<>();
            qParams.put("summary", summary.toJSON().toString());
            // TODO Add a noTrack flag in this call.
            doMethod("GET", url, qParams, null, null, null, null, null).close();
        } catch (Exception ignored) {
        }
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }
}
