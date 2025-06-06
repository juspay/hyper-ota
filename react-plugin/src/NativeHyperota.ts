import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  readReleaseConfig(): Promise<string>;
  getFileContent(filePath: string): Promise<string>;
  getBundlePath(): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('HyperOta');
