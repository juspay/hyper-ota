# Hyper OTA: Seamless Over-The-Air Updates for Your Applications

Hyper OTA empowers developers to effortlessly integrate Over-The-Air (OTA) update capabilities into their **Android, iOS, and React Native applications**. Our primary focus is to provide robust, easy-to-use SDKs and plugins that streamline the update process directly within your client applications.

Optionally, for those who require full control over the update infrastructure, Hyper OTA also offers a comprehensive backend server.

## ✨ Empower Your Apps with OTA Updates: Key SDK Features

Hyper OTA's SDKs and plugins are designed to make OTA updates a breeze:

*   **Effortless Integration**: Lightweight SDKs for native Android and iOS, plus a dedicated plugin for React Native applications.
*   **Client-Side Control**: Manage update checks, downloads, and installations directly from your application code.
*   **Flexible Update Strategies**: Implement various update flows, such as silent updates, user-prompted updates, or forced updates.
*   **Cross-Platform Consistency**: The React Native plugin ensures a consistent OTA experience across both Android and iOS.
*   **Open Source**: Our SDKs are open source, allowing for transparency, customization, and community contributions.

## 🚀 Core Components: SDKs First

Hyper OTA is primarily about enabling your applications with powerful update mechanisms:

*   **[Hyper OTA Android SDK](android/README.md)**: Integrate OTA update capabilities directly into your native Android applications. This lightweight SDK provides the tools to check for, download, and apply updates seamlessly. (Further details in its README).
*   **[Hyper OTA iOS SDK](iOS/README.md)**: Similarly, equip your native iOS applications with OTA functionality using our dedicated iOS SDK. (Further details in its README).
*   **[Hyper OTA React Native Plugin](react-plugin/README.md)**: The ideal solution for React Native developers. This plugin allows you to manage OTA updates across both Android and iOS platforms with a unified JavaScript API. (Further details in its README).
*   **[Hyper OTA React Native Example](react-example/README.md)**: A practical example application demonstrating how to use the Hyper OTA React Native Plugin and integrate it with an update source. (Further details in its README).

### Optional Add-on: The Hyper OTA Server

For developers who need a self-hosted backend solution to manage and distribute updates:

*   **[Hyper OTA Server](server/README.md)**: A robust backend system that can manage application versions, store update packages, and deliver them to your SDK-integrated applications.
    *   **Key functionalities**: User authentication (via Keycloak), organization/application management, package storage, release configurations, and a dashboard UI.
    *   **Technology stack**: Rust (Actix Web), PostgreSQL, Keycloak, Docker, LocalStack (for AWS emulation).
    *   **Note**: While powerful, using this server is optional. The SDKs can be configured to work with other update distribution mechanisms if preferred.

## 🏁 Getting Started with Hyper OTA SDKs

Integrating OTA updates into your application is straightforward:

1.  **Choose Your SDK/Plugin**:
    *   For **native Android** applications: Use the [Hyper OTA Android SDK](android/README.md).
    *   For **native iOS** applications: Use the [Hyper OTA iOS SDK](iOS/README.md).
    *   For **React Native** applications: Use the [Hyper OTA React Native Plugin](react-plugin/README.md). Refer to the [Hyper OTA React Native Example](react-example/README.md) for a practical guide.

2.  **Integrate into Your Project**: Follow the specific installation and setup instructions provided in the README of your chosen SDK/plugin.

3.  **Configure Update Source**: Point your SDK/plugin to an update source. This could be the optional Hyper OTA Server or any other compatible update distribution mechanism.

4.  **Implement Update Logic**: Use the SDK/plugin APIs to check for updates, download them, and apply them according to your application's requirements.

### Setting up the Optional Hyper OTA Server

If you choose to use the self-hosted Hyper OTA Server:

**Prerequisites:**

*   Docker and Docker Compose
*   Git

**One-Command Setup (from the `server` directory):**

1.  **Clone the Repository** (if you haven't already):
    ```bash
    git clone <repository-url> # Replace <repository-url> with the actual URL
    cd hyper-ota/server
    ```
2.  **Start the Server**:
    *   Development mode (with hot-reloading):
        ```bash
        ./run.sh dev
        ```
    *   For other run options (build, production, detach), see the [Hyper OTA Server README](server/README.md).

**Services Started by `./run.sh dev`:**

*   **Backend API**: `http://localhost:8081`
*   **Keycloak (Authentication)**: `http://localhost:8180` (Default admin: `admin/admin`)
*   And other development services like LocalStack, Superposition, and PostgreSQL.

For more detailed server setup, API routes, database schema, and ACL information, please refer to the **[Hyper OTA Server README](server/README.md)**.

## 🤝 Contributing

We welcome contributions to Hyper OTA, especially to our SDKs and plugins! If you're interested in contributing:

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix (`git checkout -b feature/your-feature-name`).
3.  Make your changes and commit them with clear, descriptive messages.
4.  Push your changes to your fork (`git push origin feature/your-feature-name`).
5.  Submit a pull request to the main repository.

Please ensure your code adheres to existing coding styles and includes appropriate tests where applicable. Key areas for contribution include enhancing SDK features, improving the developer experience, or adding more examples.

## 📄 License

This project is licensed under the MIT License. (You can replace this with your preferred license and add a `LICENSE.md` file).

---

*This README provides a general overview. For detailed information on specific SDKs, plugins, or the optional server, please refer to the documentation within each sub-project.*
