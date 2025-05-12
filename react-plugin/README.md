# react-native-hyper-ota

hyper ota

## Installation

```sh
npm install react-native-hyper-ota
```

## Usage


```js
import { readReleaseConfig, getBundlePath, getFileContent } from 'react-native-hyper-ota';

// ...

const result = await readReleaseConfig();
const bundlePath = await getBundlePath();

const getFileContent = await getFileContent("split/file name");

```


## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT

