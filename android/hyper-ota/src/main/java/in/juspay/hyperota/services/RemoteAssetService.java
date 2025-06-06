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

package in.juspay.hyperota.services;

import static in.juspay.hyperota.constants.OTAConstants.ATTR_HASH_IN_DISK;
import static in.juspay.hyperota.services.ServiceConstants.ASSET_METADATA_FILE_NAME;
import static in.juspay.hyperota.services.ServiceConstants.ATTR_LAST_CHECKED;
import static in.juspay.hyperota.services.ServiceConstants.ATTR_ZIPHASH_IN_DISK;

import android.util.Log;

import androidx.annotation.NonNull;

import org.json.JSONException;
import org.json.JSONObject;

import in.juspay.hyperota.TrackerCallback;
import in.juspay.hyperota.constants.Labels;
import in.juspay.hyperota.constants.LogCategory;
import in.juspay.hyperota.constants.LogSubCategory;

/**
 * Utility functions that deal with downloading of hot-pushed assets.
 * <p>
 * <em>This file contains the critical functions that are
 * required by the Juspay SDKs to run, and care has to be taken to modify. Please stop if you do not know where you are
 * going.</em>
 *
 * @author Veera Manohara Subbiah [veera.subbiah@juspay.in]
 * @author Sri Harsha Chilakapati [sri.harsha@juspay.in]
 * @since 26/04/2017
 */
public class RemoteAssetService {
    private static final String LOG_TAG = "RemoteAssetService";

    private JSONObject assetMetadata;

    @NonNull
    private final OTAServices otaServices;

    public RemoteAssetService(@NonNull OTAServices otaServices) {
        this.otaServices = otaServices;
    }

    public synchronized void getMetadata(String location) throws JSONException {
        final TrackerCallback trackerCallback = otaServices.getTrackerCallback();
        try {
            assetMetadata = new JSONObject(otaServices.getWorkspace().getFromSharedPreference(ASSET_METADATA_FILE_NAME, "{}"));
        } catch (JSONException e) {
            trackerCallback.trackAndLogException(LOG_TAG, LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.REMOTE_ASSET_SERVICE, "Exception trying to read from KeyStore: " + ASSET_METADATA_FILE_NAME, e);
            throw new RuntimeException("Unexpected internal error.", e);
        }

        Log.d(LOG_TAG, "assetMetadata: " + assetMetadata);

        if (!assetMetadata.has(location)) {
            assetMetadata.put(location, new JSONObject());
            ((JSONObject) assetMetadata.get(location)).put(ATTR_LAST_CHECKED, 0);
            ((JSONObject) assetMetadata.get(location)).put(ATTR_HASH_IN_DISK, "");
            ((JSONObject) assetMetadata.get(location)).put(ATTR_ZIPHASH_IN_DISK, "");
        }

        assetMetadata.get(location);
    }

    public synchronized void resetMetadata(String location) throws JSONException {
        if (assetMetadata == null) {
            getMetadata(location);
        }

        assetMetadata.remove(location);
        otaServices.getWorkspace().writeToSharedPreference(ASSET_METADATA_FILE_NAME, assetMetadata.toString());
    }
}
