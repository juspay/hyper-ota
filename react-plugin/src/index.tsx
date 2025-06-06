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

import { NativeModules, Platform } from 'react-native';

const LINKING_ERROR =
  `The package 'react-native-hyperota' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

// @ts-expect-error
const isTurboModuleEnabled = global.__turboModuleProxy != null;

const HyperotaModule = isTurboModuleEnabled
  ? require('./NativeHyperota').default
  : NativeModules.HyperOta;

const HyperOta = HyperotaModule
  ? HyperotaModule
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

export function readReleaseConfig(): Promise<string> {
  return HyperOta.readReleaseConfig();
}

export function getFileContent(filePath: string): Promise<string> {
  return HyperOta.getFileContent(filePath);
}

export function getBundlePath(): Promise<string> {
  return HyperOta.getBundlePath();
}

export default HyperOta;
