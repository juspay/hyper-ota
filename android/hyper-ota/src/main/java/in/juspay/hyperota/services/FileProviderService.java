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

import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.util.HashSet;
import java.util.Set;
import java.util.TreeSet;

import in.juspay.hyperota.TrackerCallback;
import in.juspay.hyperota.constants.Labels;
import in.juspay.hyperota.constants.LogCategory;
import in.juspay.hyperota.constants.LogLevel;
import in.juspay.hyperota.constants.LogSubCategory;
import in.juspay.hyperota.utils.OTAUtils;

/**
 * A class that contains helper methods for files.
 *
 * @author Sahil Dave [sahil.dave@juspay.in]
 * @author Sri Harsha Chilakapati [sri.harsha@juspay.in]
 * @author Dayanidhi D [dayanidhi.d@juspay.in]
 * @since 14/03/2017
 */
public class FileProviderService {
    private static final String LOG_TAG = "FileProviderService";
    @NonNull
    private final OTAServices otaServices;

    public FileProviderService(@NonNull OTAServices otaServices) {
        this.otaServices = otaServices;
    }

    @NonNull
    public String readFromFile(String fileName) {
        String data;
        data = readFromInternalStorage(fileName);

        if (data == null) {
            data = readFromAssets(fileName);
        }

        return data == null ? "" : data;
    }

    private String readFromInternalStorage(String realFileName) {
        if (otaServices.getUseBundledAssets()) {
            return null;
        }

        StringBuilder returnString = new StringBuilder();

        try {
            File file = getFileFromInternalStorage(realFileName);
            try (FileInputStream fis = new FileInputStream(file)) {
                try (InputStreamReader isr = new InputStreamReader(fis)) {
                    try (BufferedReader input = new BufferedReader(isr)) {
                        int num;
                        while ((num = input.read()) != -1) {
                            returnString.append((char) num);
                        }
                    }
                }
                otaServices.getTrackerCallback().track(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, LogLevel.DEBUG, Labels.System.FILE_PROVIDER_SERVICE, "readFromInternalStorage", "Returning the file content for " + realFileName);
                if (realFileName.endsWith(".json")) {
                    try {
                        new JSONObject(String.valueOf(returnString));
                    } catch (JSONException ignored) {
                        try {
                            new JSONArray(String.valueOf(returnString));
                        } catch (JSONException ignored1) {
                            deleteAndRemoveMetadata(realFileName);
                            return null;
                        }
                    }
                }
                return returnString.toString();
            }
        } catch (Exception e) {
            otaServices.getTrackerCallback().trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "read from internal storage failed", e);
        }

        return null;
    }

    private String readFromAssets(String fileName) {
        final TrackerCallback tracker = otaServices.getTrackerCallback();

        try {
            byte[] data = getAssetFileAsByte(fileName);
            Log.d(LOG_TAG, "Done reading " + fileName + " from assets");
            return new String(data);
        } catch (Exception e) {
            tracker.trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "Exception trying to read from file: " + fileName, e);
            return null;
        }
    }

    public boolean updateFile(String fileName, byte[] content) {
        return writeToFile(fileName, content);
    }

    private boolean copyFile(File from, File to) {
        try {
            Log.d(LOG_TAG, "copyFile: " + from.getAbsolutePath() + "   " + to.getAbsolutePath());

            try (InputStream in = new FileInputStream(from)) {
                try (OutputStream out = new FileOutputStream(to)) {
                    byte[] buffer = new byte[1024];
                    int read;
                    while ((read = in.read(buffer)) != -1) {
                        out.write(buffer, 0, read);
                    }
                    // write the output file (You have now copied the file)
                    out.flush();
                }
            }
            return true;
        } catch (FileNotFoundException e) {
            otaServices.getTrackerCallback().trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "File not found: " + from.getName(), e);
            return false;
        } catch (Exception e) {
            otaServices.getTrackerCallback().trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "Exception: " + from.getName(), e);
            return false;
        }
    }

    private boolean writeToFile(String realFileName, byte[] content) {
        return writeToFile(getFileFromInternalStorage(realFileName), content);
    }

    boolean writeToFile(File file, byte[] content) {
        final TrackerCallback tracker = otaServices.getTrackerCallback();
        try (FileOutputStream fos = new FileOutputStream(file)) {
            fos.write(content);
            return true;
        } catch (FileNotFoundException e) {
            tracker.trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "File not found: " + file.getName(), e);
        } catch (IOException e) {
            tracker.trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "IOException: " + file.getName(), e);
        } catch (Exception e) {
            tracker.trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "Exception: " + file.getName(), e);
        }

        return false;
    }

    private InputStream openAsset(String fileName) throws IOException {
        return otaServices.getWorkspace().openAsset(fileName);
    }

    public File getFileFromInternalStorage(String fileName) {
        Log.d(LOG_TAG, "Getting file from internal storage. Filename: " + fileName);

        final File file = otaServices.getWorkspace().open(fileName);
        final File parent = file.getParentFile();
        if (parent != null && !parent.exists()) {
            parent.mkdirs();
        }
        return file;
    }

    public byte[] getAssetFileAsByte(String fileName) {
        final TrackerCallback tracker = otaServices.getTrackerCallback();

        try {
            try (ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
                try (InputStream is = openAsset(fileName)) {
                    readFromInputStream(bos, is);
                }
                return bos.toByteArray();
            }
        } catch (FileNotFoundException e) {
            tracker.trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "Could not read " + fileName, e);
            throw new RuntimeException(e);
        } catch (IOException e) {
            tracker.trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "Could not read " + fileName, e);
            deleteFileFromInternalStorage(fileName);

            throw new RuntimeException(e);
        } catch (Exception e) {
            tracker.trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "Exception: Could not read " + fileName, e);
            deleteFileFromInternalStorage(fileName);
        }

        return new byte[]{};
    }

    private void readFromInputStream(ByteArrayOutputStream bos, InputStream is) throws IOException {
        byte[] buffer = new byte[4096];
        int read;

        while ((read = is.read(buffer)) != -1) {
            bos.write(buffer, 0, read);
        }
    }

    @SuppressWarnings("UnusedReturnValue")
    public boolean deleteFileFromInternalStorage(String fileName) {
        final TrackerCallback tracker = otaServices.getTrackerCallback();
        final RemoteAssetService remoteAssetService = otaServices.getRemoteAssetService();

        File fileToDelete = getFileFromInternalStorage(fileName);

        if (fileToDelete.exists()) { // TODO why is this named as Corrupted file
            Log.d(LOG_TAG, "Deleting " + fileName + " from internal storage");
            tracker.track(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, LogLevel.WARNING, Labels.System.FILE_PROVIDER_SERVICE, "file_deleted", fileName);
            try {
                remoteAssetService.resetMetadata(fileName);
            } catch (Exception e) {
                tracker.trackException(LogCategory.ACTION, LogSubCategory.Action.SYSTEM, Labels.System.FILE_PROVIDER_SERVICE, "Error while resetting etag", e);
            }

            return fileToDelete.isDirectory() ? OTAUtils.deleteRecursive(fileToDelete) : fileToDelete.delete();
        } else {
            Log.e(LOG_TAG, fileName + " not found");
            return false;
        }
    }

    @Nullable
    public String[] listFiles(String dirPath) {
        File dir = otaServices.getWorkspace().open(dirPath);
        return listFiles(dir);
    }

    @Nullable
    public String[] listFilesRecursive(String dirPath) {
        File dir = otaServices.getWorkspace().open(dirPath);
        return listAllFilesRecursively("" , dir).toArray(new String[0]);
    }

    String[] listFiles(File dir) {
        if (dir.exists()) {
            File[] fs = dir.listFiles();
            // Using set to ensure uniqueness.
            Set<String> al = new TreeSet<>();
            if (fs != null) {
                for (File f : fs) {
                    al.add(f.getName());
                }
            }
            return al.toArray(new String[0]);
        } else {
            return null;
        }
    }

    Set<String> listAllFilesRecursively(String prefix, File dir) {
        Set<String> files = new HashSet<>();
        if (dir == null || !dir.exists()) {
            return files;
        }

        File[] entries = dir.listFiles();
        if (entries != null) {
            for (File entry : entries) {
                if (entry.isDirectory()) {
                    files.addAll(listAllFilesRecursively(prefix + entry.getName() + "/", entry));
                } else {
                    files.add(prefix + entry.getName());
                }
            }
        }

        return files;
    }

    private void deleteAndRemoveMetadata(String fileName) {
        try {
            getFileFromInternalStorage(fileName).delete();
            otaServices.getRemoteAssetService().resetMetadata(fileName);
        } catch (Exception ignore) {
        }
    }

    public TempWriter newTempWriter(String label) {
        try {
            return new TempWriter(label, Mode.NEW, otaServices);
        } catch (Exception e) {
            // Un-reachable code.
            throw new RuntimeException(e);
        }
    }

    public TempWriter reOpenTempWriter(String name) throws FileNotFoundException {
        return new TempWriter(name, Mode.RE_OPEN, otaServices);
    }

    enum Mode {
        NEW,
        RE_OPEN
    }
}
