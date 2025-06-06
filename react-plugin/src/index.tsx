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
