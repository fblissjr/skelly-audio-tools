BOB the Skelly

## *Specifications and Roadmap*

[Specification: Skelly Show Creator v3.0 (Production-Ready)](#heading=)

[1. Project Overview & Goals](#heading=)

[2. Technology Stack & Tooling](#heading=)

[3. Core Workflow: Input → Process → Optimize → Sequence → Control](#heading=)

[Step 1: Input & Media Processing](#heading=)

[Step 2: Optimize](#heading=)

[Step 3: Sequence](#heading=)

[Step 4: Control & Export](#heading=)

[4. Deployment Strategy (Internal Web Server)](#heading=)

[4.1. How It Runs](#heading=)

[4.2. Sample Nginx Configuration](#heading=)

[5. Debugging, Logging, and Tooling](#heading=)

[5.1. Development & Build Tooling](#heading=)

[5.2. Runtime Debugging](#heading=)

[5.3. Application Logging](#heading=)

[Works cited](#heading=)

[Specification: Skelly Show Creator v4.0 (Granular Build Plan)](#heading=)

[1.0. Project Vision & Core Principles](#heading=)

[2.0. System Architecture & Technology Stack](#heading=)

[3.0. Granular Feature Specification: The User Workflow](#heading=)

[3.1. Module 1: Media Input & Pre-Processing](#heading=)

[3.2. Module 2: Audio Optimization ("The Power User's Toolbox")](#heading=)

[3.3. Module 3: BLE Sequencing & Control](#heading=)

[4.0. Deployment & Operations](#heading=)

[5.0. Developer Experience: Debugging & Logging](#heading=)

[Works cited](#works-cited)

[Specification: Skelly Show Creator v4.1 (AI Integration)](#specification:-skelly-show-creator-v4.1-(ai-integration))

[1.0. Version History & Goals](#1.0.-version-history-&-goals)

[2.0. System Architecture & Technology Stack (Additions)](#2.0.-system-architecture-&-technology-stack-(additions))

[3.0. Granular Feature Specification (Updates & Additions)](#3.0.-granular-feature-specification-(updates-&-additions))

[3.1. Module 2: Audio Optimization ("The Power User's Toolbox") - ENHANCEMENTS](#3.1.-module-2:-audio-optimization-("the-power-user's-toolbox")---enhancements)

[3.2. Module 4: Live AI Conversation (NEW)](#3.2.-module-4:-live-ai-conversation-(new))

# 

# **Specification: Skelly Show Creator v3.0 (Production-Ready)**

## **1. Project Overview & Goals**

This document outlines the final production-ready specifications for the **Skelly Show Creator**, a comprehensive, client-side web application.

* **Primary Goal:** To provide an intuitive, all-in-one web tool that allows a non-technical user to prepare audio, choreograph a synchronized light and motion show, and control the "Ultra Skelly" animatronic directly from their browser.  
* **Core Principles:**  
  * **Privacy First:** All user data (audio, video files) and processing must remain on the client's machine. The application will be serverless in its core functionality.  
  * **Ease of Use:** Abstract complex technical processes into simple, intuitive controls and visualizations.  
  * **Integrated Workflow:** Combine audio processing, show sequencing, and hardware control into a single, seamless experience.  
  * **Deployability:** The application must be deployable on a simple, internal web server with minimal configuration.

  ---

  ## **2. Technology Stack & Tooling** 


  

| Category | Technology/Tool | Purpose | 
| :---- | :---- | :---- |
| **Frontend Framework** | React (with Vite) | For building a modern, fast, and maintainable user interface. Vite provides an excellent development experience with fast builds. |
| **Audio Processing** | Web Audio API | Native browser API for all real-time audio effects (compression, EQ, noise gate) and visualization. |
| **Video/Audio Extraction** | ffmpeg.wasm | A WebAssembly port of FFmpeg for client-side extraction of audio from user-provided video files.1 |
| **Device Communication** | Web Bluetooth API | Native browser API for direct communication with the Skelly animatronic's BLE controller.4 |
| **Deployment Server** | Nginx | A lightweight, high-performance web server ideal for hosting the static files (HTML, CSS, JS) of the application.7 |
| **Debugging** | Browser DevTools, Source Maps | Standard browser tools (Chrome DevTools, Firefox Developer Tools) for JavaScript debugging, network inspection, and performance profiling.9 |
| **Logging** | Custom Logger Module | A simple, toggleable logging utility for development and troubleshooting.11 |

  ---

  ## **3. Core Workflow: Input → Process → Optimize → Sequence → Control** 


The user-facing workflow remains consistent with the v2.0 spec, providing a guided, step-by-step process. 

#### **Step 1: Input & Media Processing** 


* **File Upload:** A primary drag-and-drop interface for local audio (MP3, WAV) and video (MP4) files.12  
* **In-Browser Audio Extraction (ffmpeg.wasm):**  
  * If a user uploads a video file, the application will use ffmpeg.wasm to extract the audio stream directly in the browser.3  
  * The extracted audio data (as a Blob or ArrayBuffer) is then passed directly to the Web Audio API, requiring no server interaction.  
* **Addressing YouTube & yt-dlp:**  
  * As of October 2025, yt-dlp remains a command-line tool and does not have a functional WebAssembly port for direct in-browser use.14 Direct "stream ripping" from YouTube URLs in a browser is technically infeasible and violates YouTube's Terms of Service.  
  * **Solution:** The UI will not feature a YouTube URL input. Instead, it will provide a clear, guided workflow instructing the user to download their desired video using a third-party tool (like ClipGrab) and then upload the resulting video file to this application for secure, local audio extraction.

#### **Step 2: Optimize** 


* **Skelly-View Visualizer:** A dual-waveform display with the "Activation Overlay" remains the core feedback mechanism.12 The view will be zoomable and pannable for precision.  
* **Preprocessing Controls:** Intuitive sliders for "Consistency/Punch" (Compression) and "Silence Cleanup" (Noise Gate) powered by the Web Audio API.  
* **Segmentation:** Automatic 30-second segmentation with draggable markers for fine-tuning.12

#### **Step 3: Sequence** 

    
* **Multi-Track Timeline:** A visual timeline for arranging audio segments and choreographing BLE commands (lights, eyes, movement) against the audio.  
* **Command Palette:** A library of draggable elements representing the reverse-engineered BLE commands.

#### **Step 4: Control & Export** 

    
* **Live Control Panel (Web Bluetooth):** A dedicated UI for connecting to the Skelly animatronic. Features will include a connection button, status indicator, and a "Play Show" button that executes the sequenced audio and BLE commands in real-time.16  
* **Reliable Fallback (Export):** A "Download All as ZIP" button that packages the optimized 30-second audio clips for manual recording, ensuring a functional workflow for all users.12  
  ---

  ## **4. Deployment Strategy (Internal Web Server)**

    
  This application is designed as a collection of static assets (HTML, CSS, JavaScript, and WASM files) and can be easily hosted on any internal web server. Nginx is the recommended server due to its performance and simple configuration.7


#### **4.1. How It Runs** 

    
1. **Build Process:** The React/Vite project is built into a dist directory containing the final, optimized static files.  
2. **File Placement:** These files are copied to a directory on the internal server (e.g., /var/www/skelly-show-creator).  
3. **Nginx Configuration:** Nginx is configured to listen for HTTP requests and serve the files from that directory.  
   
   #### **4.2. Sample Nginx Configuration** 

     
A configuration file (e.g., /etc/nginx/sites-available/skelly-show-creator) would be created with the following content:

Nginx

server {
    listen 80;
    server_name skelly-creator.internal.local; # Or the server's IP address

    # Path to the built application files  
    root /var/www/skelly-show-creator;

    # Default file to serve  
    index index.html;

    location / {
        # Tries to find a file with the exact name, then a directory,  
        # otherwise falls back to index.html for client-side routing.  
        try_files $uri $uri/ /index.html;
    }

    # Required headers for SharedArrayBuffer, which is used by ffmpeg.wasm-mt  
    # This enables multi-threading for better performance.  
    add_header 'Cross-Origin-Opener-Policy' 'same-origin';
    add_header 'Cross-Origin-Embedder-Policy' 'require-corp';
}

This configuration is then enabled (e.g., via a symlink to sites-enabled) and the Nginx service is restarted.17 The application would then be accessible to anyone on the internal network.

---

## **5. Debugging, Logging, and Tooling**

A robust development and debugging workflow is critical for a project with this many interacting components.

#### **5.1. Development & Build Tooling**

* **Vite:** The development server provides Hot Module Replacement (HMR) for instant feedback during development. It also handles the build process, including transpilation and bundling, and correctly generates source maps for debugging.  
* **Source Maps:** The build process will generate source maps, which allow developers to set breakpoints and view console logs in the original TypeScript/JSX source code within the browser's developer tools, rather than the compiled JavaScript bundle.9


#### **5.2. Runtime Debugging** 

    
* **Browser Developer Tools:** This is the primary tool for debugging.  
  * **Console:** View logs, errors, and interact with the application's state.  
  * **Sources Tab:** Set breakpoints, step through code, and inspect variables in real-time.10  
  * **Network Tab:** Inspect the loading of assets, including the large ffmpeg.wasm core files.  
* **Web Bluetooth Debugging:** Chrome's internal bluetooth-internals page (chrome://bluetooth-internals) provides a low-level view of nearby devices, services, and characteristics, which is invaluable for debugging connection issues or verifying GATT services.  
* **WebAssembly Debugging:** Modern browser developer tools have support for WASM debugging, allowing developers to step through WASM code if necessary, though most interaction will be with the JavaScript wrapper.


#### **5.3. Application Logging** 

    
A custom, lightweight logger module will be implemented to provide control over debug output.  
* **Functionality:**  
  * The logger will wrap console.log(), console.warn(), and console.error().  
  * It will be enabled or disabled based on a value in the browser's localStorage.11 This allows a developer to turn on verbose logging on a production build without needing to re-deploy code.  
  * Logs will be prefixed with a timestamp and module name (e.g., Connecting to device...) for clarity.  
* **Usage Example:**  
  JavaScript  
  // In the browser console, to enable logging:  
  // > logger.activate();

  // In the application code:
  import logger from './logger';
  logger.log('BLE', 'Attempting to connect...');

This comprehensive approach ensures the application is not only feature-rich and user-friendly but also deployable, maintainable, and debuggable in a real-world environment.

#### **Works cited** 

1. ffmpeg.wasm | ffmpeg.wasm, accessed October 6, 2025, [https://ffmpegwasm.netlify.app/](https://ffmpegwasm.netlify.app/)
2. Overview - ffmpeg.wasm - Netlify, accessed October 6, 2025, [https://ffmpegwasm.netlify.app/docs/overview/](https://ffmpegwasm.netlify.app/docs/overview/)
3. FFmpeg.wasm, a pure WebAssembly / JavaScript port of FFmpeg | TechBlog, accessed October 6, 2025, [https://jeromewu.github.io/ffmpeg-wasm-a-pure-webassembly-javascript-port-of-ffmpeg/](https://jeromewu.github.io/ffmpeg-wasm-a-pure-webassembly-javascript-port-of-ffmpeg/)
4. Web Bluetooth API - MDN - Mozilla, accessed October 6, 2025, [https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)
5. Exploring the Web Bluetooth API. Use Cases, Advantages, and Limitations - Medium, accessed October 6, 2025, [https://medium.com/@kamresh485/exploring-the-web-bluetooth-api-use-cases-advantages-and-limitations-6f3f85946e44](https://medium.com/@kamresh485/exploring-the-web-bluetooth-api-use-cases-advantages-and-limitations-6f3f85946e44)
6. Communicating with Bluetooth devices over JavaScript | Capabilities, accessed October 6, 2025, [https://developer.chrome.com/docs/capabilities/bluetooth](https://developer.chrome.com/docs/capabilities/bluetooth)
7. Before Web Frameworks: Using nginx to Deploy a Website - Level Up Coding, accessed October 6, 2025, [https://levelup.gitconnected.com/before-web-frameworks-using-nginx-to-deploy-a-website-7a523e1845aa](https://levelup.gitconnected.com/before-web-frameworks-using-nginx-to-deploy-a-website-7a523e1845aa)
8. Serve Static Content | NGINX Documentation, accessed October 6, 2025, [https://docs.nginx.com/nginx/admin-guide/web-server/serving-static-content/](https://docs.nginx.com/nginx/admin-guide/web-server/serving-static-content/)
9. Debug a JavaScript or TypeScript app - Visual Studio (Windows) | Microsoft Learn, accessed October 6, 2025, [https://learn.microsoft.com/en-us/visualstudio/javascript/debug-nodejs?view=vs-2022](https://learn.microsoft.com/en-us/visualstudio/javascript/debug-nodejs?view=vs-2022)
10. node.js - Visual Studio Code debugging client side JavaScript - Stack Overflow, accessed October 6, 2025, [https://stackoverflow.com/questions/33407090/visual-studio-code-debugging-client-side-javascript](https://stackoverflow.com/questions/33407090/visual-studio-code-debugging-client-side-javascript)
11. Controling console.log client side - javascript - Stack Overflow, accessed October 6, 2025, [https://stackoverflow.com/questions/75152997/controling-console-log-client-side](https://stackoverflow.com/questions/75152997/controling-console-log-client-side)
12. ideas.txt
13. ffmpeg.wasm - GitHub, accessed October 6, 2025, [https://github.com/ffmpegwasm](https://github.com/ffmpegwasm)
14. yt-dlp and YouTube 2025 - antiX-forum, accessed October 6, 2025, [https://www.antixforum.com/forums/topic/yt-dlp-and-youtube-2025/](https://www.antixforum.com/forums/topic/yt-dlp-and-youtube-2025/)
15. Why is yt-dlp not updated? - General Discussion - DietPi Community Forum, accessed October 6, 2025, [https://dietpi.com/forum/t/why-is-yt-dlp-not-updated/22630](https://dietpi.com/forum/t/why-is-yt-dlp-not-updated/22630)
16. How To Use The Web Bluetooth API - confidence.sh, accessed October 6, 2025, [https://confidence.sh/blog/how-to-use-the-web-bluetooth-api/](https://confidence.sh/blog/how-to-use-the-web-bluetooth-api/)
17. Deploying a web-application using Nginx server and Reverse Proxy | by Rajani Ekunde, accessed October 6, 2025, [https://medium.com/@rajani103/deploying-a-noteapp-project-by-nginx-920067dca1b5](https://medium.com/@rajani103/deploying-a-noteapp-project-by-nginx-920067dca1b5)
18. Mini-Project: Deploying JavaScript Application with Nginx | by Husni B. - Medium, accessed October 6, 2025, [https://husbch.medium.com/mini-project-deploying-javascript-application-with-nginx-468e32fc72e5](https://husbch.medium.com/mini-project-deploying-javascript-application-with-nginx-468e32fc72e5)
    
    # **Specification: Skelly Show Creator v4.0 (Granular Build Plan)**
      
    

    ## **1.0. Project Vision & Core Principles**
      
* **Application Name:** Skelly Show Creator  
* **Elevator Pitch:** A production-grade, all-in-one, browser-based studio for transforming any audio or video file into a fully choreographed animatronic show, complete with direct, real-time control over the "Ultra Skelly" hardware.  
* **Core Principles:**  
  * **Client-Side First:** All media processing and device control must occur on the user's machine. No user files are ever uploaded to a server.  
  * **Power & Simplicity:** Provide a simple, one-click "Auto-Optimize" path for beginners, while exposing granular controls for power users to achieve perfect results.  
  * **Production Ready:** The application must be deployable, maintainable, and debuggable on a standard internal web server.

  ---

  ## **2.0. System Architecture & Technology Stack** 


  

| Category | Technology/Tool | Rationale & Granular Details |
| :---- | :---- | :---- |
| **Frontend Framework** | **React** (v19+) with **Vite** | Vite provides a superior developer experience with Hot Module Replacement (HMR) and efficient production builds. React's component model is ideal for the modular UI. |
| **State Management** | Zustand | A lightweight, unopinionated state management library that avoids boilerplate and is perfect for managing UI state and the audio processing pipeline. |
| **Media Extraction** | **ffmpeg.wasm** (Multi-Threaded) | The @ffmpeg/ffmpeg and @ffmpeg/core-mt packages will be used for client-side audio extraction from user-provided video files. The multi-threaded version is crucial for performance. |
| **Audio Processing** | **Web Audio API** | The native browser API will be used for all real-time audio effects. This avoids external dependencies and ensures maximum performance. |
| **Device Control** | **Web Bluetooth API** | The native navigator.bluetooth API will be used for direct device discovery, connection, and command execution.1 |
| **Deployment Server** | **Nginx** | A lightweight, high-performance web server perfect for serving the static build artifacts (HTML, JS, CSS, WASM). |
| **Debugging & Logging** | Browser DevTools & Custom Logger | Standard browser tools for stepping through code, augmented by a custom, localStorage-toggleable logger for detailed diagnostics in any environment. |

  ---

  ## **3.0. Granular Feature Specification: The User Workflow** 

  

  ### **3.1. Module 1: Media Input & Pre-Processing** 


  This module handles getting media into the application and preparing it for the audio pipeline.

* **3.1.1. UI Components:**  
  * A primary drag-and-drop zone that accepts local audio (MP3, WAV, M4A) and video (MP4, MOV, WEBM) files.  
  * A clear instructional panel addressing the YouTube workflow: "For YouTube audio, please use a service like ClipGrab to download the video as an MP4 file, then drop that file here." This avoids legal and technical issues with direct ripping.  
* **3.1.2. ffmpeg.wasm Integration Logic:**  
  * **Lazy Loading:** The ffmpeg.wasm core (approx. 30MB) will only be loaded on-demand when the user first uploads a video file to avoid a large initial payload. A loading indicator must be displayed during this one-time setup.  
  * **File Handling:**  
    1. When a video file is dropped, it will be read into an ArrayBuffer.  
    2. The ffmpeg.writeFile() method will write this buffer to the in-memory filesystem as input.mp4.  
    3. The ffmpeg.exec() command will be called with the arguments: 
-i', 'input.mp4', '-vn', '-acodec', 'libmp3lame', '-q:a', '2', 'output.mp3'
. This strips the video (-vn) and encodes the audio to a high-quality MP3.  
    4. The ffmpeg.readFile('output.mp3') method will retrieve the resulting audio data as a Uint8Array.  
    5. This array will be converted to a Blob and passed to the Web Audio API for decoding.  
  * **Progress & Logging:** The ffmpeg.on('log',...) and ffmpeg.on('progress',...) event listeners will be used to display real-time progress of the extraction process to the user.


  ### **3.2. Module 2: Audio Optimization ("The Power User's Toolbox")** 


  This module is the core of the audio processing, designed for maximum control over mouth movement.

* 3.2.1. Web Audio API Graph: The audio processing will be structured as a chain of AudioNode objects:  
  AudioBufferSourceNode → BiquadFilterNode (Low-pass) → BiquadFilterNode (High-pass) → DynamicsCompressorNode → GainNode → AnalyserNode → DynamicsCompressorNode (Limiter) → AudioDestinationNode  
* **3.2.2. UI Controls & Node Mapping:**  
  * **"Rumble Filter" (High-Pass Filter):**  
    * **UI:** A slider labeled "Rumble Filter" from 20 Hz to 300 Hz.  
    * **Function:** Controls the frequency of a BiquadFilterNode with type "highpass". This removes low-frequency noise that can cause unwanted jaw movement.  
  * **"Hiss Filter" (Low-Pass Filter):**  
    * **UI:** A slider labeled "Hiss Filter" from 20 kHz down to 3 kHz.  
    * **Function:** Controls the frequency of a BiquadFilterNode with type "lowpass". This removes high-frequency hiss.  
  * **"Consistency/Punch" (Compressor):**  
    * **UI:** A single "Consistency" slider (0-100). An "Advanced" toggle reveals individual sliders for Threshold, Ratio, Attack, and Release.  
    * **Function:** These sliders directly map to the properties of the primary DynamicsCompressorNode to give the user full control over the dynamic range.  
  * **"Silence Cleanup" (Noise Gate):**  
    * **UI:** A slider labeled "Cleanup Threshold" (-100dB to 0dB).  
    * **Function:** This will not use a dedicated node. Instead, the AnalyserNode will continuously get byte frequency data. A JavaScript function will check if the average volume is below the user-defined threshold. If it is, the GainNode's gain will be set to 0; otherwise, it will be set to 1.  
  * **"Final Polish" (Limiter):**  
    * **UI:** An "On/Off" toggle labeled "Prevent Distortion (Limiter)".  
    * **Function:** This controls a final DynamicsCompressorNode with a very high ratio (e.g., 20:1) and a threshold near 0dB. This acts as a "brickwall" limiter to prevent clipping and distortion after all other processing.  
* **3.2.3. Skelly-View Visualizer:**  
  * The AnalyserNode will provide data for a <canvas>-based waveform renderer.  
  * The "Activation Overlay" color will be calculated in real-time based on the processed audio's amplitude, using a configurable threshold that represents the Skelly's motor activation point. This threshold should itself be a hidden "power user" setting.


  ### **3.3. Module 3: BLE Sequencing & Control** 


  This module integrates direct hardware control.

* **3.3.1. BLE Command Library:**  
  * A separate TypeScript/JSON module will house the reverse-engineered BLE commands. This map is the cornerstone of the control system.  
  * **Structure:** An object mapping human-readable names (e.g., EYES_FLAMES, ARM_RAISE) to their corresponding byte arrays (e.g., new Uint8Array()).
* **3.3.2. Connection Manager:**  
  * **UI:** A "Connect to Skelly" button and a persistent status indicator ("Disconnected", "Connecting...", "Connected").  
  * **Logic:**  
    1. Clicking "Connect" triggers navigator.bluetooth.requestDevice().  
    2. The options object will be { acceptAllDevices: true, optionalServices: }. The 128-bit vendor-specific Service UUID is critical.3  
    3. Upon connection, the BluetoothRemoteGATTServer object is stored in the application's state.  
    4. Event listeners for gattserverdisconnected will be attached to handle automatic reconnection attempts.
* **3.3.3. Sequencer Timeline:**  
  * **UI:** A multi-track timeline interface synchronized with the audio waveform. Tracks for "Torso Lights," "Eye Animation," "Head Movement," etc.  
  * **Functionality:** Users drag command blocks from a palette onto the timeline. Each block represents a specific command from the BLE library and has a start time.
* **3.3.4. Live Playback Engine:**  
  * **UI:** A master "Play Show" button.  
  * **Logic:**  
    1. Starts audio playback via the Web Audio API.  
    2. Uses requestAnimationFrame or a setTimeout-based loop to check the current audio playback time.  
    3. When the playback time matches the start time of a command on the timeline, it retrieves the corresponding byte array.  
    4. It then calls a writeSkellyCommand() function, which gets the primary service and write characteristic from the stored GATT server object and sends the data using characteristic.writeValueWithResponse().

  ---

  ## **4.0. Deployment & Operations** 


* **4.1. Build Process:**  
  * The vite build command will be used to generate a dist directory containing all static assets.  
  * Source maps will be generated for production builds to aid in debugging, but will not be publicly accessible on the server.  
* **4.2. Nginx Server Configuration:**  
  * The application will be hosted on an internal Nginx server.  
  * The configuration file (/etc/nginx/sites-available/skelly-creator) will contain:  
    Nginx  
    server {
        listen 80;
        server_name skelly-creator.internal.local;

        root /var/www/skelly-creator;
        index index.html;

        location / {
            try_files $uri /index.html;
        }

        # REQUIRED for ffmpeg.wasm multi-threading (SharedArrayBuffer)  
        add_header 'Cross-Origin-Opener-Policy' 'same-origin';
        add_header 'Cross-Origin-Embedder-Policy' 'require-corp';
    }

  * This configuration ensures that all routes are handled by the React application and, critically, sets the required headers for SharedArrayBuffer to function, enabling the multi-threaded WASM core.

  ---

  ## **5.0. Developer Experience: Debugging & Logging** 


* **5.1. Browser Debugging Tools:**  
  * **Standard DevTools:** The Sources tab will be the primary tool for setting breakpoints and stepping through JavaScript code.  
  * **BLE Internals:** Chrome's chrome://bluetooth-internals page will be used for low-level debugging of BLE connections, services, and characteristics.  
* **5.2. Custom Application Logger:**  
  * A custom logger module (logger.js) will be implemented to provide namespaced and toggleable logging.  
  * **Implementation:**  
    JavaScript  
    // logger.js  
    let isLoggingActive = localStorage.getItem('skelly_logger_active') === 'true';

    const logger = {
      log: (namespace,...args) => {
        if (isLoggingActive) {
          console.log(`[${namespace}]`,...args);
        }
      },
      activate: () => {
        isLoggingActive = true;
        localStorage.setItem('skelly_logger_active', 'true');
        console.log("Skelly Logger Activated.");
      },
      deactivate: () => {
        isLoggingActive = false;
        localStorage.setItem('skelly_logger_active', 'false');
      }
    };

    window.skellyLogger = logger; // Expose to window for easy access  
    export default logger;

  * **Usage:** Developers can enable/disable logging from the browser console by calling skellyLogger.activate() or skellyLogger.deactivate(). Within the code, calls will be made like logger.log('BLE', 'Sending command:', bytes). This provides granular control for troubleshooting in both development and production environments.

#### **Works cited** {#works-cited}

1. Practical Introduction to BLE GATT Reverse Engineering: Hacking the Domyos EL500, accessed October 5, 2025, [https://jcjc-dev.com/2023/03/19/reversing-domyos-el500-elliptical/](https://jcjc-dev.com/2023/03/19/reversing-domyos-el500-elliptical/)
2. Home Depot App-Controlled Skeleton 2025 – Unboxing, Setup & Demo - YouTube, accessed October 5, 2025, [https://www.youtube.com/watch?v=DdYc4Yk9Qbw](https://www.youtube.com/watch?v=DdYc4Yk9Qbw)
3. Reverse Engineering a Bluetooth Lightbulb | by Uri Shaked - Medium, accessed October 5, 2025, [https://medium.com/@urish/reverse-engineering-a-bluetooth-lightbulb-56580fcb7546](https://medium.com/@urish/reverse-engineering-a-bluetooth-lightbulb-56580fcb7546)
4. Reverse Engineering Smart Bluetooth Low Energy Devices : 11 Steps - Instructables, accessed October 5, 2025, [https://www.instructables.com/Reverse-Engineering-Smart-Bluetooth-Low-Energy-Dev/](https://www.instructables.com/Reverse-Engineering-Smart-Bluetooth-Low-Energy-Dev/)

# **Specification: Skelly Show Creator v4.1 (AI Integration)** {#specification:-skelly-show-creator-v4.1-(ai-integration)}

## **1.0. Version History & Goals** {#1.0.-version-history-&-goals}

* **Version:** 4.1  
* **Parent Document:** v4.0 (Production-Ready)  
* **Primary Goal:** To extend the application's functionality by incorporating a real-time, AI-driven conversational mode, allowing the user to engage in spoken dialogue with the animatronic.  
* **Secondary Goals:**  
  * To integrate client-side Speech-to-Text (STT), Text-to-Speech (TTS), and Voice Activity Detection (VAD) for a seamless conversational loop.  
  * To provide an interface for connecting to third-party Large Language Models (LLMs) for generating intelligent responses.  
  * To further enhance the audio optimization module with more granular controls for power users, ensuring superior jaw movement synchronization for all audio sources.

---

## **2.0. System Architecture & Technology Stack (Additions)** {#2.0.-system-architecture-&-technology-stack-(additions)}

The core technology stack from v4.0 remains. The following components are added to support the new AI module.

| Category | Technology/Tool | Rationale & Granular Details |
| :---- | :---- | :---- |
| **Speech-to-Text (STT)** | **Web Speech API (SpeechRecognition)** | Native browser API for client-side speech recognition. It's privacy-preserving and requires no external dependencies for the core functionality. |
| **Voice Activity Detection (VAD)** | **Web Audio API (AnalyserNode)** | A custom VAD will be built using the Web Audio API to monitor microphone input levels. This provides more responsive and accurate endpointing than relying on STT timeouts alone. |
| **Text-to-Speech (TTS)** | **Web Speech API (SpeechSynthesis)** & **WASM-based TTS (e.g., Piper)** | A dual approach. The native SpeechSynthesis API will be the default for ease of use. A WASM-based engine like Piper will be integrated as a high-quality option, generating audio blobs that can be fed into our existing optimization pipeline. |
| **AI/Language Model** | **Third-Party LLM APIs (e.g., Google Gemini, OpenAI GPT)** | The application will provide an interface for users to input their own API keys. This offloads the complex AI reasoning to a powerful cloud service, as shown in the user's example, while keeping the application itself lightweight. |

---

## **3.0. Granular Feature Specification (Updates & Additions)** {#3.0.-granular-feature-specification-(updates-&-additions)}

### **3.1. Module 2: Audio Optimization ("The Power User's Toolbox") - ENHANCEMENTS** {#3.1.-module-2:-audio-optimization-(