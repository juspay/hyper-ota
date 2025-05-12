import { NativeModules, Platform } from 'react-native';

const LINKING_ERROR =
  `The package 'react-native-hyper-ota' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const HyperOta = NativeModules.HyperOta
  ? NativeModules.HyperOta
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

export function readReleaseConfig() {
  return HyperOta.readReleaseConfig();
}

export function getFileContent(filePath: String) {
  return HyperOta.getFileContent(filePath);
}

export function getBundlePath() {
  return HyperOta.getBundlePath();
}
