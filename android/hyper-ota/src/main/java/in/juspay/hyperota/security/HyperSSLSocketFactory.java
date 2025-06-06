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

package in.juspay.hyperota.security;

import android.annotation.SuppressLint;
import android.net.http.X509TrustManagerExtensions;

import androidx.annotation.Keep;

import java.security.KeyStore;
import java.security.SecureRandom;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.Set;

import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.TrustManagerFactory;
import javax.net.ssl.X509TrustManager;

import in.juspay.hyperota.BuildConfig;
import in.juspay.hyperota.network.JuspaySSLSocketFactory;
import in.juspay.hyperota.utils.OTAUtils;


public class HyperSSLSocketFactory extends JuspaySSLSocketFactory {
    private final SSLSocketFactory sslSocketFactory;
    public static final X509TrustManager DEFAULT_TRUST_MANAGER = getDefaultTrustManager();

    public HyperSSLSocketFactory(final Set<String> acceptedCerts) throws Exception {
        SSLContext ssl = SSLContext.getInstance("SSL");
        final X509TrustManagerExtensions defaultTrustExtension = new X509TrustManagerExtensions(DEFAULT_TRUST_MANAGER);
        TrustManager[] managers = new TrustManager[]{
                new CustomX509TrustManager(DEFAULT_TRUST_MANAGER, defaultTrustExtension, acceptedCerts)
        };
        ssl.init(null, managers, new SecureRandom());
        sslSocketFactory = ssl.getSocketFactory();
    }

    private static X509TrustManager getDefaultTrustManager() {
        try {
            TrustManagerFactory tmf = TrustManagerFactory
                    .getInstance(TrustManagerFactory.getDefaultAlgorithm());
            tmf.init((KeyStore) null);
            return (X509TrustManager) tmf.getTrustManagers()[0];
        } catch (Exception ignored) {
            return null;
        }
    }

    @SuppressLint("CustomX509TrustManager")
    static class CustomX509TrustManager implements X509TrustManager {
        private final X509TrustManager defaultTrust;
        private final X509TrustManagerExtensions defaultTrustExtension;
        private final Set<String> acceptedCerts;

        CustomX509TrustManager(X509TrustManager defaultTrust, X509TrustManagerExtensions defaultTrustExtension , Set<String> acceptedCerts){
            this.defaultTrust = defaultTrust;
            this.acceptedCerts = acceptedCerts;
            this.defaultTrustExtension = defaultTrustExtension;
        }

        public X509Certificate[] getAcceptedIssuers() {
            if(BuildConfig.BUILD_TYPE.equals("debug") || BuildConfig.BUILD_TYPE.equals("qa")) {
                return null;
            } else {
                return defaultTrust.getAcceptedIssuers();
            }
        }

        @SuppressLint("TrustAllX509TrustManager")
        public void checkClientTrusted(X509Certificate[] certs, String authType) throws CertificateException {
            if (!BuildConfig.BUILD_TYPE.equals("debug") && !BuildConfig.BUILD_TYPE.equals("qa")) {
                defaultTrust.checkClientTrusted(certs, authType);
            }
        }

        @SuppressLint("TrustAllX509TrustManager")
        public void checkServerTrusted(X509Certificate[] certs, String authType) throws CertificateException {
            defaultTrust.checkServerTrusted(certs, authType);
            if(OTAUtils.validatePinning(certs, acceptedCerts)) {
                throw new CertificateException("SSL Pinning failed");
            }
        }

        @Keep
        public void checkServerTrusted(X509Certificate[] certs, String authType, String hostName)
                throws CertificateException {
            defaultTrustExtension.checkServerTrusted(certs, authType,hostName);
            if(OTAUtils.validatePinning(certs, acceptedCerts)) {
                throw new CertificateException("SSL Pinning failed");
            }
        }
    }

    public SSLSocketFactory getSslSocketFactory() {
        return sslSocketFactory;
    }
}
