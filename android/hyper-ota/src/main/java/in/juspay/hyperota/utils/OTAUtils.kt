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

package `in`.juspay.hyperota.utils

import android.util.Base64
import android.util.Log
import java.io.File
import java.security.MessageDigest
import java.security.NoSuchAlgorithmException
import java.security.cert.CertificateException
import java.security.cert.X509Certificate
import java.util.concurrent.Callable
import java.util.concurrent.Future
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit

object OTAUtils {
    private const val LOG_TAG = "OTAUtils"

    private val sharedPool = ThreadPoolExecutor(4, 10, 5, TimeUnit.SECONDS, LinkedBlockingQueue())
    fun <V> doAsync(callable: Callable<V>): Future<V> = sharedPool.submit(callable)

    fun runOnBackgroundThread(task: Runnable?) {
        sharedPool.execute(task)
    }

    @JvmStatic
    fun deleteRecursive(fileOrDirectory: File): Boolean {
        if (!fileOrDirectory.exists()) return false
        if (fileOrDirectory.isDirectory) {
            var files = fileOrDirectory.listFiles()
            if (files == null) {
                files = arrayOfNulls(0)
            }
            for (child in files) {
                if (!deleteRecursive(child)) return false
            }
        }
        return fileOrDirectory.delete()
    }

    @JvmStatic
    @Throws(CertificateException::class)
    fun validatePinning(chain: Array<X509Certificate>, validPins: Set<String?>): Boolean {
        val md: MessageDigest
        val certChainMsg = StringBuilder()
        try {
            md = MessageDigest.getInstance("SHA-256")
        } catch (e: NoSuchAlgorithmException) {
            throw CertificateException("couldn't create digest")
        }

        for (cert in chain) {
            val publicKey = cert.publicKey.encoded
            md.update(publicKey, 0, publicKey.size)
            val pin = Base64.encodeToString(md.digest(), Base64.NO_WRAP)
            certChainMsg.append("    sha256/").append(pin).append(" : ")
                .append(cert.subjectDN.toString()).append("\n")
            return !validPins.contains(pin)
        }
        Log.d(LOG_TAG, certChainMsg.toString())
        return true
    }
}
