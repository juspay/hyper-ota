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

package `in`.juspay.hyperota.services

import `in`.juspay.hyperota.constants.Labels
import `in`.juspay.hyperota.constants.LogCategory
import `in`.juspay.hyperota.constants.LogSubCategory
import java.io.File
import java.io.FileNotFoundException

class TempWriter internal constructor(s: String, m: FileProviderService.Mode, private val otaServices: OTAServices) {
    private val tempDir: File
    private val fileProviderService = otaServices.fileProviderService
    private val LOG_TAG = "TEMP_WRITER"

    init {
        var dir: File? = null
        when (m) {
            FileProviderService.Mode.NEW -> {
                val name = String.format("temp-%s-%s", s, System.currentTimeMillis())
                dir = otaServices.workspace.openInCache(name)
                dir.mkdir()
            }

            FileProviderService.Mode.RE_OPEN -> {
                dir = otaServices.workspace.openInCache(s)
                if (!dir.exists()) {
                    throw FileNotFoundException("$s does not exist in cache!")
                }
            }
        }
        tempDir = dir
    }

    fun write(fileName: String, content: ByteArray): Boolean {
        val f = File(tempDir, fileName)
        f.parentFile?.mkdirs()
        return fileProviderService.writeToFile(f, content)
    }

    val dirName: String
        get() = tempDir.name

    fun list(): Array<String>? {
        return fileProviderService.listFiles(tempDir)
    }

    fun moveToMain(fileName: String, dest: String): Boolean {
        try {
            val sourceFile = File(tempDir, fileName)
            val destFile: File = fileProviderService.getFileFromInternalStorage("$dest/$fileName")
//            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
//
//                Files.copy(sourceFile.toPath(), destFile.toPath(), StandardCopyOption.REPLACE_EXISTING)
//                return true
//            } else {
            return sourceFile.copyRecursively(destFile, true)
//            }
        } catch (e: Exception) {
            otaServices.trackerCallback.trackAndLogException(LOG_TAG, LogCategory.LIFECYCLE, LogSubCategory.LifeCycle.HYPER_OTA, Labels.System.FILE_PROVIDER_SERVICE, "moveToMain failed for file $fileName", e)
            return false
        }
    }
}
