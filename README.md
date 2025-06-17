# Airborne: Seamless Over-The-Air Updates for Your Applications

Airborne empowers developers to effortlessly integrate Over-The-Air (OTA) update capabilities into their **Android, iOS, and React Native applications**. Our primary focus is to provide robust, easy-to-use SDKs and plugins that streamline the update process directly within your client applications.

Optionally, for those who require full control over the update infrastructure, Airborne also offers a comprehensive backend server.

## ✨ Empower Your Apps with OTA Updates: Key SDK Features

Airborne's SDKs and plugins are designed to make OTA updates a breeze:

*   **Effortless Integration**: Lightweight SDKs for native Android and iOS, plus a dedicated plugin for React Native applications.
*   **Client-Side Control**: Manage update checks, downloads, and installations directly from your application code.
*   **Flexible Update Strategies**: Implement various update flows, such as silent updates, user-prompted updates, or forced updates.
*   **Cross-Platform Consistency**: The React Native plugin ensures a consistent OTA experience across both Android and iOS.
*   **Open Source**: Our SDKs are open source, allowing for transparency, customization, and community contributions.

## 🚀 Core Components: SDKs First

Airborne is primarily about enabling your applications with powerful update mechanisms:

*   **[Airborne Android SDK](android/README.md)**: Integrate OTA update capabilities directly into your native Android applications. This lightweight SDK provides the tools to check for, download, and apply updates seamlessly. (Further details in its README).
*   **[Airborne iOS SDK](iOS/README.md)**: Similarly, equip your native iOS applications with OTA functionality using our dedicated iOS SDK. (Further details in its README).
*   **[Airborne React Native Plugin](react-plugin/README.md)**: The ideal solution for React Native developers. This plugin allows you to manage OTA updates across both Android and iOS platforms with a unified JavaScript API. (Further details in its README).
*   **[Airborne React Native Example](react-example/README.md)**: A practical example application demonstrating how to use the Airborne React Native Plugin and integrate it with an update source. (Further details in its README).

## SDK Configuration and Download Flow Details

This section delves into the specifics of the Airborne SDK's configuration file structure and the download/usage flows it manages.

### Core Concepts

We are seeing 2 broad categories of files that have to be downloaded:
*   **Package**: An atomic unit, which consists of files and properties requiring all files to be present to boot. A package can be further divided into two sets:
    *   **Important**: If these files are not present by the boot timeout, then this package is not used.
    *   **Lazy**: If the priority files are downloaded by boot timeout, then these files will download in parallel and inform the application upon completion.
*   **Resources**: These are files that will work in any combination. All resources that load before the boot timeout are used in that session.

### Configuration File Structure

The SDK requires a configuration file with the following structure:

```json
{
  "version": "1",
  "config": {
    "version": "1.0.0",
    "release_config_timeout": 1000,
    "boot_timeout": 1000,
    "properties": {}
  },
  "package": {
    "name": "Application_Name",
    "version": "1.0.0",
    "index": {
        "url": "https://assets.juspay.in/bundles/index.js",
        "filePath": "index.js"
      },
    "properties": {},
    "important": [
      {
        "url": "https://assets.juspay.in/bundles/initial.js",
        "filePath": "initial.js"
      }
    ],
    "lazy": [
      {
        "url": "https://assets.juspay.in/images/card.png",
        "filePath": "card.png"
      }
    ]
  },
  "resources": [
    {
      "url": "https://assets.juspay.in/configs/config.js",
      "filePath": "config.js"
    }
  ]
}
```

The above structure has 4 parts: `version`, `config`, `package`, and `resources`.

*   **Version**: This is the version of the structure of the above file.
*   **Config**: Contains the configuration for the SDK to decide the behavior of downloads. It contains the following keys:
    *   `version`: Used to indicate the current version of the config.
    *   `release_config_timeout`: Timeout for this file to complete downloading. This is used in the next session.
    *   `boot_timeout`: Timeout for both the package and resource block to complete downloading. This is called boot time since it is an indicator that the application can use the package to begin booting.
    *   `properties`: This is a user-defined field block which can be used to send any config keys to the application.
*   **Package**: A package is an atomic unit. The package block as mentioned above is a transactional set of files. The package block contains the spec for the package. It contains the following keys:
    *   `name`: The name of the application represented by this package.
    *   `version`: The version of this package. Note: if the version is not changed, the SDK will not initiate the download of the package.
    *   `properties`: This is a user-defined field block which can be used to send any config keys to configure their application. This block is used to send keys specific to this version of the package, unlike the block in `config` which will give the latest available.
    *   `index`: A special entry for the file used as the entry point to the package.
    *   `important`: List of files required at the start of the application. The application cannot boot without these files.
    *   `lazy`: List of files which extend the `important` block; This can be used for non-critical code files, images, etc.
*   **Resources**: List of files which will attempt to download before the `boot_timeout`. All files that complete before timeout will be available during boot.

### Download and Usage Flow

#### Case 1: Happy Case
The entire `package.important` block is available before boot timeout.

![Case 1: Happy Case](readme-images/Case%201%20Happy%20Case.png)

#### Case 2: Package Timeout
If the `package.important` block is not completely downloaded on time, the entire package set is not used. The SDK will supply the previous package along with relevant configurations to its users.

![Case 2: Package Timeout](readme-images/Case%202%20Package%20Timeout.png)

#### Case 3: Resource Timeout
If the resource block is not completely downloaded by the time of load, then all files downloaded before the timeout are used. Files downloaded after are not available in this session. This ensures that file read operations in one session are idempotent.

![Case 3: Resource Timeout](readme-images/Case%203%20Resource%20Timeout.png)

### Feature list
*   Splits (Webpack - split) support for bundles
*   Security via signature validation
*   CLI for pushing releases
*   React plugin to use sdk
*   Juspay server / Self hosted
*   Adoption Analytics

### Optional Add-on: The Airborne Server

For developers who need a self-hosted backend solution to manage and distribute updates:

*   **[Airborne Server](server/README.md)**: A robust backend system that can manage application versions, store update packages, and deliver them to your SDK-integrated applications.
    *   **Key functionalities**: User authentication (via Keycloak), organization/application management, package storage, release configurations, and a dashboard UI.
    *   **Technology stack**: Rust (Actix Web), PostgreSQL, Keycloak, Docker, LocalStack (for AWS emulation).
    *   **Note**: While powerful, using this server is optional. The SDKs can be configured to work with other update distribution mechanisms if preferred.

## 🏁 Getting Started with Airborne SDKs

Integrating OTA updates into your application is straightforward:

1.  **Choose Your SDK/Plugin**:
    *   For **native Android** applications: Use the [Airborne Android SDK](android/README.md).
    *   For **native iOS** applications: Use the [Airborne iOS SDK](iOS/README.md).
    *   For **React Native** applications: Use the [Airborne React Native Plugin](react-plugin/README.md). Refer to the [Airborne React Native Example](react-example/README.md) for a practical guide.

2.  **Integrate into Your Project**: Follow the specific installation and setup instructions provided in the README of your chosen SDK/plugin.

3.  **Configure Update Source**: Point your SDK/plugin to an update source. This could be the optional Airborne Server or any other compatible update distribution mechanism.

4.  **Implement Update Logic**: Use the SDK/plugin APIs to check for updates, download them, and apply them according to your application's requirements.

### Setting up the Optional Airborne Server

If you choose to use the self-hosted Airborne Server:

**Prerequisites:**

*   Docker and Docker Compose
*   Git

**One-Command Setup (from the `server` directory):**

1.  **Clone the Repository** (if you haven't already):
    ```bash
    git clone <repository-url> # Replace <repository-url> with the actual URL
    cd airborne/server
    ```
2.  **Start the Server**:
    *   Development mode (with hot-reloading):
        ```bash
        ./run.sh dev
        ```
    *   For other run options (build, production, detach), see the [Airborne Server README](server/README.md).

**Services Started by `./run.sh dev`:**

*   **Backend API**: `http://localhost:8081`
*   **Keycloak (Authentication)**: `http://localhost:8180` (Default admin: `admin/admin`)
*   And other development services like LocalStack, Superposition, and PostgreSQL.

For more detailed server setup, API routes, database schema, and ACL information, please refer to the **[Airborne Server README](server/README.md)**.

## 🤝 Contributing

We welcome contributions to Airborne, especially to our SDKs and plugins! If you're interested in contributing:

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix (`git checkout -b feature/your-feature-name`).
3.  Make your changes and commit them with clear, descriptive messages.
4.  Push your changes to your fork (`git push origin feature/your-feature-name`).
5.  Submit a pull request to the main repository.

Please ensure your code adheres to existing coding styles and includes appropriate tests where applicable. Key areas for contribution include enhancing SDK features, improving the developer experience, or adding more examples.

## 📄 License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

---

*This README provides a general overview. For detailed information on specific SDKs, plugins, or the optional server, please refer to the documentation within each sub-project.*
