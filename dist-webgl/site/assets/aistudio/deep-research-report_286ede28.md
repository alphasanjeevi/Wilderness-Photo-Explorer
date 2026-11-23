# Wilderness Photo Explorer – Product Requirements

**Version 1.0 – 2026-11-23**

This document specifies the **Wildlife Photography Exploration Game** (“Wilderness Photo Explorer”) targeting web, Android, and iOS. All core objectives and game logic are **locked**: this is a peaceful, non-combat wildlife discovery game. Players explore diverse habitats by vehicle, photograph animals, and build a wildlife field journal. The PRD outlines the MVP scope (one tropical forest biome with 20 species, etc.) and additional features for future releases. We define clear agent roles, implementation guardrails, traceable requirements, and a visual design package with concept art and wireframes.  

**Key Governance**: The game’s core loop and non-combat objective are immutable (locked requirements). No AI agent or developer may alter the objective, gameplay loop, or remove/add features beyond the defined scope without explicit owner approval. All requirements must be testable and link to acceptance criteria. A change-request template is provided for any proposed changes to locked requirements.

## Table of Contents

1. [Executive Summary](#executive-summary)  
2. [Vision & Product Principles](#vision-principles)  
3. [Target Audience & Personas](#audience-personas)  
4. [Core Gameplay Loop](#core-loop)  
5. [Objectives & Non-goals](#objectives-non-goals)  
6. [Gameplay Systems](#gameplay-systems)  
   - 6.1. [World / Biome Design](#world)  
   - 6.2. [Vehicles & Controls](#vehicles)  
   - 6.3. [Wildlife Spawning & Behavior](#wildlife)  
   - 6.4. [Photography Mechanics](#photography)  
   - 6.5. [Species Library (Field Journal)](#library)  
   - 6.6. [Progression & Save](#progression)  
   - 6.7. [Weather, Time & Audio](#weather)  
   - 6.8. [UI/UX Overview](#uiux)  
7. [Platform & Technical Architecture](#technical)  
   - 7.1. [Engine / Framework Recommendation](#engine)  
   - 7.2. [Cross-Platform Architecture](#cross-platform)  
   - 7.3. [Controls & Input](#controls)  
   - 7.4. [Graphics & Performance](#performance)  
   - 7.5. [Saving & Sync](#saving)  
   - 7.6. [Accessibility & Localization](#accessibility)  
   - 7.7. [Monetization & Privacy](#monetization)  
   - 7.8. [Risks & Mitigations](#risks)  
8. [Agent Implementation & Process](#implementation)  
   - 8.1. [Team Roles & Collaboration](#team-roles)  
   - 8.2. [Requirements Traceability](#traceability)  
   - 8.3. [Guardrails & Change Control](#guardrails)  
   - 8.4. [System Architecture & Modules](#system-arch)  
   - 8.5. [Data Schemas & State](#data-schemas)  
   - 8.6. [Interface Contracts & APIs](#interfaces)  
   - 8.7. [Definition of Done & QA](#definition-of-done)  
   - 8.8. [Milestones & Acceptance Criteria](#milestones)  
9. [Visual Design Concept](#visual-design)  
   - 9.1. [Art Style & Mood](#art-style)  
   - 9.2. [Sample In-Game Scene (Tropical Forest)](#sample-scene)  
   - 9.3. [Camera Mode UI](#camera-ui)  
   - 9.4. [Species Library UI](#library-ui)  
   - 9.5. [Home / Destination UI](#home-ui)  
   - 9.6. [Annotated Wireframes](#wireframes)  
10. [Appendix: Change Request Template](#change-request)  

---

## 1. Executive Summary

**Wilderness Photo Explorer** is a **cozy, non-competitive wildlife photography game**. The player visits different biomes by driving vehicles, explores calmly, observes animals and insects, and uses an in-game camera to capture photos. Every photographed species is recorded in a persistent field journal. The goal is **exploration and discovery**, not collecting or hunting. The first MVP will feature a tropical forest region, one off-road jeep, and ~20 species of animals/birds/insects. Additional regions (savanna, desert, etc.), vehicles, and a larger species library are planned post-launch. The experience should be **immersive, relaxing, and educational**, akin to a real-life nature photographer’s journey.  

The **core game loop** is: _Choose destination → Drive & explore → Spot wildlife → Photograph animal behaviors → Unlock/update species entry → Return or pick new destination_. There are **no time pressures or combat**; success is marked by filling the wildlife journal, not by points or competition. The game targets web browsers and mobile (Android/iOS), requiring responsive design, touch controls, and cross-platform parity.

This PRD serves as a system-of-record for development. It includes requirements IDs (e.g. `REQ-xxxx`) that link to acceptance tests. It defines strict agent roles and guardrails to keep the implementation aligned with the locked design. Additional features (new biomes, vehicles) are roadmapped but not part of the initial MVP. Visual mockups and wireframes illustrate the intended look: calm, low-poly 3D, with warm earthy colors and clean UI elements.  

Key design principles include: **simplicity**, **accessibility**, **coziness**, **consistency across platforms**, and **preservation of the core peaceful discovery theme**.  

## 2. Vision & Product Principles

- **Cozy Exploration**: Players experience a tranquil journey through nature. Gameplay must feel **calm and meditative**, with no stressors.  
- **Discovery & Learning**: Emphasize curiosity. Provide interesting animal facts in the journal to educate and reward exploration.  
- **Authenticity**: Realistic yet stylized wildlife behavior and environments. Animals move naturally; plants and weather feel lifelike.  
- **Intuitive Controls**: Driving and camera controls must be easy for casual players on any device (touch or mouse/keyboard).  
- **Progression Through Play**: Unlocking the species library is the only progression; it encourages thorough exploration, not grinding.  
- **Fair and Friendly**: No pay-to-win, no ads, no hidden timers. Monetization (if any) should be non-intrusive (e.g. premium paid app or one-time purchase).  
- **Accessibility & Inclusivity**: Clear visuals (high contrast for UI text), scalable UI for different screens, subtitles for any audio cues, intuitive icons.  

**Principle Examples**: The game is closer in spirit to *Alba: A Wildlife Adventure* or *Pokémon Snap* (photography gameplay) than to shooters or race games. It is a *game about being gentle in nature*, not about capturing animals as trophies.  

## 3. Target Audience & Personas

- **Casual Nature Enthusiasts**: Ages 10-50, enjoy relaxing games or nature documentaries, appreciate wildlife.  
- **Students & Educators**: People interested in learning about animals and habitats; could be used in an educational context.  
- **Mobile Gamers Seeking Relaxation**: Players looking for a cozy game on the go (10-20 minute sessions).  
- **Photography Fans**: Gamers who enjoy photo-taking mechanics (akin to in-game photo modes).  

**Persona 1 – “Nature Photographer”**: Sarah, 28, amateur wildlife photographer. She values beauty and detail. She wants a laid-back game where she can take scenic shots and learn facts about animals.  
**Persona 2 – “Explorer Parent”**: Leo, 35, plays with his 8-year-old daughter. They like traveling through virtual worlds together. Leo likes the educational aspect, daughter likes finding cute creatures.  

## 4. Core Gameplay Loop

1. **Destination Selection**: Player picks a biome/region to explore (MVP: a tropical forest).  
2. **Embark Journey**: Player enters a vehicle (jeep) and starts driving into the region.  
3. **Observe Wildlife**: While driving or walking, player spots animals based on ambient cues (sounds, tracks).  
4. **Photograph & Discover**: Player stops and uses the camera mode to frame and photograph an animal’s pose or behavior.  
5. **Journal Update**: Each successful photo unlocks or updates a species entry in the Wildlife Field Journal.  
6. **Collect Memories**: Photographs and data (location, time, behavior) are saved for the player to view later.  
7. **Repeat**: Player may stay in same region for undiscovered species or return to base to review the journal. Then choose another region/continue.

_No timers, no combat/hunting, no race against other players. Focus is on enjoyment of discovery._

## 5. Objectives & Non-goals

### Objectives (What We Will Deliver)
- **MVP Scope** (locked features):
  - One tropical forest biome (open, explorable).
  - One drivable vehicle (off-road jeep).
  - ~20 wildlife species (mix of mammals, birds, insects).  
  - Photo mode with basic camera (zoom, focus indicator, shutter).  
  - Weather (sunny, rainy) and day/evening cycle.  
  - Wildlife Field Journal with entries for each species (unlocks on first photo).  
  - Progression by “discovering” (photographing) all 20 species.  
  - Basic UI: in-world HUD (speedometer, time), camera UI, journal UI, main menu.  
  - Cross-platform controls and UI for web, Android, iOS.

- **Future Enhancements** (post-MVP roadmap, **not** to be implemented now without approval):
  - Additional biomes (savanna, mountains, wetlands, desert, etc.).  
  - Multiple vehicles (jeeps, boats, bicycles, snowmobile).  
  - More species and behaviors (predator-prey interactions, night animals).  
  - Enhanced camera features (filters, manual exposure) – optional.  
  - Multiplayer sharing or social (optional sharing of photos).  
  - Seasonal changes, limited-time events.

### Non-goals (Explicit Out-of-Scope)
- **No Combat/Hunting**: Player cannot shoot, trap, or harm animals.  
- **No Competitive Pressure**: No leaderboards or timed challenges.  
- **No Grinding for Materials**: The goal is discovery, not resource collection.  
- **No Capturing or Owning Animals**: Wildlife remain wild; player only “collects” photos.  
- **Not a Simulation of Real Animals**: While realistic cues exist, deep AI simulation (e.g. large herds with full social behaviors) is out of MVP scope.  
- **No Third-Person Cinematic Story**: Limited narrative, no cutscenes. If any story is present, it’s minor (e.g. an underlying purpose of conservation).

## 6. Gameplay Systems

### 6.1. World / Biome Design

- **MVP Biome: Tropical Forest**  
  - Dense forest with paths/trails for driving.  
  - Key landmarks (river, clearing, ruined hut) to help navigation and interest.  
  - Varied terrain (hills, open meadow) but no steep cliffs or obstacles beyond vehicle capability.  
  - Flora: Trees, bushes, vines, reeds. Some climbable rocks/pipes maybe.  

- **Layout**: Single continuous world (no loading between scenes). Outskirts or research base area, main exploration area with looped trails. Possibly one-way “entrance” and “exit” gates but exploration is free.  

- **Scale**: Walkable/drivable area ~1 km² (design for ~15–20 minute exploration per session). With animal respawn zones.  

- **Art Style**: Low-poly 3D with soft lighting. Use a palette of greens, browns, and colorful wildlife. (Detailed concept in Visual Design section.)

- **Environment Features**:
  - **Research Base/Camp**: Starting point. Basic UI (map selection), vehicle spawn, journal access.  
  - **Landmarks**: A river (with small boat optional in future), a waterfall, an old treehouse, etc. These can have unique wildlife.  
  - **Dynamic Elements**: Swaying leaves, rippling water, rain/shower, fireflies at dusk.  

### 6.2. Vehicles & Controls

- **MVP Vehicle**: A sturdy 4x4 Jeep with roof rack (for atmosphere).  
- **Controls**:
  - **Desktop**: WASD/arrow keys for forward/back/turn; mouse to look around (camera rotation) when outside vehicle.  
  - **Mobile**: Touch joystick or steering wheel UI for movement; touch drag for camera look/vehicle turning. Possibly gyro-aim for camera. Provide toggle UI for drive/walk modes.
  - **Gamepad**: (Optional) Typical driving controls.

- **Vehicle Mechanics**:
  - Free driving physics with adjustable speed (max ~30 km/h).  
  - Off-road travel on paths and some light rough terrain; not a physics sim (no roll-over).  
  - Player can exit vehicle anywhere to walk (if implemented) or always have camera accessible from driving viewpoint. (Walking on foot can be future expansion; initial MVP likely stationary drive + photo).  
  - Basic HUD: Speedometer, odometer, compass (direction), mini minimap optional.

- **Interaction**:
  - Enter/exit vehicle with a button/key.  
  - Honk/alert button (could cause animals to scatter).  
  - Engine sound (sound off when stationary for ambiance).

### 6.3. Wildlife Spawning & Behavior

- **Species**: 20 total (approx 10 mammals, 5 birds, 5 insects). Examples: red fox, deer, monkey, toucan, frog, butterfly, jaguar, capybara, deer mouse, parrot, tropical fish, tree frog, etc.  
- **Spawning**: Each species has defined habitat zones (forest, river, clearing). They spawn at random intervals with simple patterns. Rare species spawn less frequently.  
- **Behaviors**:
  - **Idle/Patrol**: Animals roam a local area or perch (e.g., birds on branch).  
  - **Interaction**:  
    - If the player approaches quietly, animals may stay. If too close or fast (drive quick), they flee or hide. (Avoid overly spooking - maybe freeze if slow approach.)  
    - Birds may fly away if startled.  
    - Deer/herbivores graze near clearings or meadows. Predators (e.g., big cat) stay hidden, maybe movement at night/rain only.  
  - **Group Behavior**: Some animals in pairs or groups (e.g., a pair of parrots, herd of deer).  
  - **Time-based Behavior**: Some species active at dusk/dawn (e.g., owls) – not in MVP, but can spawn a few creatures more visible in evening.  
- **Technical**:
  - Use simple state machines for animals (Idle, Walk, Run, Flee, Hide).  
  - No pathfinding through dense terrain – stick to roam on navmesh or open ground.  
  - Trigger volumes for spawning and de-spawning animals to manage performance.  
  - Animal models should be low-poly and use simple animation loops (walking, idle, grazing).

*This fosters a living world without complex combat AI. The goal is the feeling of nature, not realism of ecosystem simulation.*  

### 6.4. Photography Mechanics

- **Entering Photo Mode**: Press a button (e.g. “C” or on-screen icon) to activate the camera UI and freeze world view (like taking a photo in camera mode).  
- **Camera Controls**:
  - **Zoom**: Adjust focal length (e.g. mouse scroll or pinch) up to 3x–5x.  
  - **Focus/Sharpness**: Represented by a small circle icon (target). If the animal is within the target area for 1–2 seconds, the focus locks (UI hint).  
  - **Shutter**: A button to capture. May allow bracketing (optional multiple shots).  
  - **Viewfinder Overlay**: Optional grid or framing lines. Minimal UI: maybe just a crosshair and current species name if in focus.  
- **Shot Evaluation** (for progression):
  - On shutter press, check if species centered and in focus. If yes, mark species as “photographed”. If not, allow trying again.  
  - No scoring or “points”. Possibly a simple “Good shot” label if well-framed, but avoid harsh grading.  
- **Photo Gallery**: Photos are saved (thumbnail to view in journal). Players can view them later (and possibly set as device wallpaper or share outside app – if implemented).

### 6.5. Species Library / Field Journal

- **Description**: A persistent in-game encyclopedia of discovered species. Accessible from main menu or in-world UI.  
- **Entries**:
  - For each species: common name, scientific name, classification (mammal/bird/etc), habitat description, diet, interesting facts. Include one high-quality artist render (or field photo) per species.  
  - Unlock condition: First photograph of species unlocks basic entry (name, image). Further photos can add “Behavior notes” (e.g. “observed hunting at dusk”) and increase a “Discovery count”.  
- **UI Layout**:
  - List or grid of species icons (locked/unlocked state).  
  - Selecting one shows details and gallery of player’s photos of that species.  
  - Filter by animal type or region (future).  
  - Papers or book-like aesthetic background to feel like a field notebook.

*The journal is the main progress tracker: the MVP goal is “complete all 20 entries”.*  

### 6.6. Progression & Save

- **Progress Save**:
  - Player data includes unlocked species and their photos, current vehicle selection, and game settings.  
  - Save on device local storage. Optionally use cloud save (iCloud/Google Drive) for cross-device sync (future). For web, use browser localStorage/IndexedDB.  
- **Progression**:
  - The primary progression metric is the completion of the journal.  
  - No levels or skill trees. Unlocks only cover new species info, not new abilities.  
  - Minimal tutorial/progression: A short onboarding tutorial (a “guide” or NPC camera tips) can teach driving and photo basics.  
- **Post-MVP**:
  - Future updates could add badges or achievements (“birdwatcher”, “marathon driver”), but none required in MVP.  

### 6.7. Weather, Time & Audio

- **Time Cycle**: Day and evening (sunset), perhaps not full night for MVP. If night, minimal interface (e.g. headlamp on jeep). Transition completes in ~15 real minutes (fast-forward).  
- **Weather**: At least two states: **Clear** and **Rainy**.  
  - Rain brings gentle sound, wet environment, some animals (rain-preferring). Possibly rain spawns frogs, insects. Can find frogs after rain.  
- **Ambient Audio**:
  - Forest sounds (wind, leaves, distant animal calls).  
  - Specific wildlife audio (bird song, monkey calls, insect buzzing).  
  - Jeep engine, honk, footsteps if player can exit.  
  - Soft background music or none? Possibly a gentle ambient soundtrack during driving.  
- **Non-stress**: Music and sounds should be gentle. No loud alarms or boss music.

### 6.8. UI/UX Overview

- **HUD (in world)**:
  - Minimal: maybe vehicle speed, compass/direction, time of day, weather icon. Possibly camera ready indicator.  
  - Hide HUD when in photo mode (except crosshair/zoom UI).  
- **Menus**:
  - **Home/Main Menu**: “Start Game” (enter camp), “Species Journal”, “Settings”, “Help”.  
  - **Destination Selection** (if multiple regions later; MVP has single region).  
  - **Pause Menu**: Resume, Options, Journal, Quit.  
- **Mobile UI**:
  - Buttons and touchpads sized for finger (≥48px).  
  - Layout adapts to portrait vs landscape (portrait might show controls at bottom, landscape on sides).  
- **Aesthetics**: Clean, legible fonts. Earthy color scheme. Soft background textures (like parchment) for menus. UI icons themed (leaf, camera, etc.).  
- **Accessibility**:
  - UI scaling for small screens.  
  - Alternate text (for images in journal) and subtitles for any narration or voiced tips.  
  - Colorblind-friendly palette options.  

## 7. Platform & Technical Architecture

### 7.1. Engine / Framework Recommendation

- **Recommendation**: Use **Unity 2025+ LTS** or **Godot 4+**. Both support WebGL, Android, and iOS.  
  - *Unity Pros*: Mature cross-platform pipeline (WebGL, Android, iOS builds), rich asset store (e.g. low-poly packs, free environment assets), robust tools (Profiler, UI system). Many mobile games use Unity for 3D.  
  - *Unity Cons*: WebGL builds can be large (tens of MB) and need compression. Performance tuning required (Unity defaults to 30 fps on mobile).  
  - *Godot Pros*: Lightweight, open source, easy to export to HTML5 (via WebAssembly), smaller binaries. Godot 4 has a decent 3D renderer.  
  - *Godot Cons*: Younger ecosystem for 3D, some limitations in mobile UI. Export sizes can also be large (43MB as reported for one project).  
- **Chosen Engine**: **Unity** (recommended) for rapid development and strong cross-platform support. Godot is a viable alternative if open-source preference. We will outline architecture generically so either engine can implement.  

### 7.2. Cross-Platform Architecture

- **Shared Codebase**: One code repository targeting all platforms. Use abstraction layers for platform specifics.  
- **Scripting Language**: C# (Unity) or GDScript/C# (Godot).  
- **Rendering**: 
  - Unity: Use Universal Render Pipeline (URP) for mobile/WebGL optimized features (lightweight, supports soft lighting).  
  - Godot: Use Mobile/Terrain preset with low-quality lights by default; enable lighter GI/SSAO for high-end.  
- **Platform-specific Adapters**: 
  - Abstract input (touch vs mouse/keyboard).  
  - Abstract file system (WebGL cannot use local files, use browser storage or remote assets).  
  - Define build pipelines: WebGL build with compression (Brotli) and lazy loading; mobile builds via Xcode (iOS) and Gradle (Android).  
- **Testing Matrix**: Identify key target devices: e.g. iPhone 12+, a mid-tier Android (e.g. Snapdragon 700 series), desktop Chrome/Edge, and a tablet. Also test a low-end Android to ensure 30fps viability.  

### 7.3. Controls & Interaction

- **Touch (Mobile)**: 
  - Virtual joystick for movement (left thumb), camera drag (right thumb).  
  - On-screen button for photo mode, honk, exit vehicle.  
  - UI layout adjusts to portrait/landscape: e.g., joystick bottom-left in portrait; larger area in landscape.  
- **Mouse/Keyboard (Web/Desktop)**: 
  - WASD or Arrow keys for vehicle, mouse to look/steer.  
  - Click UI or keys (C for camera) for actions.  
  - Keyboard/gamepad support as options.  
- **Screen Sizes**: 
  - Design UI for 1080x1920 (portrait mobile), 1920x1080 (landscape mobile and web). Use responsive anchor layout.  
  - Orientation: Prefer landscape for driving view, but support portrait in UI-only screens.  
- **Input Scaling**:
  - Use Unity’s Input System or Godot’s InputMap for unified handling.  
  - Sensitivity and dead zones adjustable in settings.

### 7.4. Graphics & Performance

- **Target Frame Rate**: 30 FPS on mobile as baseline. Option to unlock higher on tablets/desktop. Use `Application.targetFrameRate`.  
- **Art Budget**: Low-poly models (<1000 tris each). Textures at most 1024×1024, compress to WebP/DXT if possible.  
- **Quality Settings**: 
  - Mobile: Medium shadows (no realtime shadows if too costly), 1 draw-call per object, baked lighting if feasible.  
  - WebGL: Lower memory usage (avoid large meshes, reduce particle effects). Keep initial WebGL memory under ~200MB.  
- **Batching**: Combine static vegetation meshes (Unity Static Batching / Godot Batch). Use GPU instancing for repetitive models (trees, rocks).  
- **Lighting**: Warm directional light (sun), ambient occlusion softly baked, one or two point lights (lantern). No complex light probes initially.  
- **Profiling Tools**: Unity Profiler for mobile usage (CPU/GPU), Godot’s debugger and WebGL profiler.  
- **WebGL Build**: Minimize file size (enable code stripping, IL2CPP, gzip/Brotli compression). Provide a loading screen or progress bar for web.  
- **Memory**: Keep runtime memory < 200MB on WebGL to avoid OOM. For mobile < 150MB. Optimize textures/objects to meet this.  

### 7.5. Saving & Sync

- **Local Save**: Use persistent local storage.  
  - Web: IndexedDB or LocalStorage (with JSON for small data).  
  - Android/iOS: File or PlayerPrefs/SharedPreferences (for simple key-value).  
- **Offline Mode**: Game should run fully offline after initial load (assets bundled). If online features (leaderboards, cloud save) are future, degrade gracefully offline.  
- **Cross-Device Sync** (Future): Provide optional account login and cloud backup using platform services (Game Center/Google Play Save, or a custom server). Not in MVP.  

### 7.6. Accessibility & Localization

- **Text**: All in-game text (UI labels, species info) should be externalized for localization. Prepare for English, plus placeholders for Spanish, French, etc. Fonts should support accented characters.  
- **Audio**: All narration/subtitles (if any) should be scriptable. Possibly text-to-speech for animal names on demand (optional).  
- **Controls**: Provide UI hints (“Tap icon to take photo”). If VR or AR not targeted, no 3D audio issues beyond positional cues.  
- **Color Blind**: Use colorblind-friendly palette (test with red-green blindness simulator). Use icons + color (not color-only) to distinguish UI states.  
- **UI Scale**: Allow user to scale interface elements by a few percent in settings to aid small-screen readability.  

### 7.7. Monetization & Privacy

- **Monetization**:  
  - **Recommendation**: Single purchase (premium) or free-to-play with cosmetic/DLC. No ads.  
  - Do not compromise experience with microtransactions (no pay-to-skip). If any store, sell cosmetic skins (vehicle paint, camera skins) after launch as optional content, clearly non-essential.  
- **Privacy**:  
  - No personal data collection beyond optional analytics.  
  - If analytics are used, anonymize and comply with GDPR/CCPA (especially if targeting EU/California users). Use third-party services (Unity Analytics, Firebase) as needed but allow opt-out.  
  - Follow all platform guidelines for data and privacy (e.g., COPPA if including child players).  

### 7.8. Risks & Mitigations

- **Performance Issues**: Low-end mobile may struggle. Mitigation: rigorous profiling, quality toggles (e.g. turn off shadows on low end). Use Unity’s Adaptive Performance or Godot’s viewport scaling.  
- **WebGL Memory Limits**: Users on mobile browsers might have memory caps. Mitigate by limiting scene complexity, fewer assets per scene. Use streaming (load zones) and lazy resource loading.  
- **Complex Animal AI**: Risk of bugs (animals glitching). Mitigation: start with simple random roam + fixed paths; incrementally test interactions.  
- **Gameplay Clarity**: Without scoring, players may wonder “what to do”. Mitigation: Friendly tutorial hints (“Take a photo of that bird!”), UI highlights on first visit.  
- **Platform Parity**: Input differences (touch vs keys) might create inconsistencies. Mitigate by designing UI that adapts and playtesting each build on target devices.  

## 8. Agent Implementation & Process

### 8.1. Team Roles & Collaboration

Given an AI-agent-driven development workflow, we define roles and boundaries:

- **Product / Spec Guardian Agent**: Keeps requirements up-to-date, answers questions about game intent, approves change requests. Ensures no locked requirements are violated. Maintains PRD version control.  
- **Technical Architect Agent**: Designs overall system architecture, chooses frameworks, defines code structure (modules, state machine patterns). Reviews integration between modules.  
- **Environment/World Designer Agent**: Implements terrain, foliage, weather system, lighting. Responsible for biomes and visuals. Works closely with UI/UX agent for HUD layout.  
- **Vehicle/Controls Agent**: Implements driving mechanics, input mapping for all platforms, HUD for vehicle stats. Ensures consistent feel across devices.  
- **Wildlife/AI Behavior Agent**: Creates animal models AI. Designs spawning system, behavior state machines (Idle, Wander, Flee). Implements day/night and weather responses of wildlife.  
- **Camera/Photography Agent**: Builds camera mode, zoom/focus mechanics, photo capture logic. Integrates with camera UI elements (crosshair, zoom indicator).  
- **Library/Progression Agent**: Manages the species journal UI and data. Creates data schema for animal info, photo gallery, and unlock logic.  
- **UI/UX Agent**: Designs and implements all UI screens (menus, HUD, popups). Creates responsive layouts for different screen sizes. Ensures accessibility.  
- **Platform/Performance Agent**: Handles builds for Web/Android/iOS, platform-specific code (save, input, packaging). Monitors performance budgets, profiling, and optimizes where needed.  
- **QA/Test Agent**: Writes test plans and automated tests (if possible). Tests features and checks acceptance criteria. Tracks bugs and regressions.  

Each agent has a clear domain. They communicate via defined interfaces/contracts: for example, Wildlife Agent exposes a `SpawnAnimal(speciesID, location)` API that Camera Agent uses to identify species. All code should annotate requirement IDs.

### 8.2. Requirements Traceability

- **Requirement IDs**: Each feature or behavior is a requirement (e.g. `REQ-1001: Player can enter photo mode from vehicle`). Use a numbering scheme in the PRD and link in code comments.  
- **Change Request Template**: For any needed change to locked requirements, use: 
  ```
  Title: [Short desc of change]
  Requirement ID(s) impacted: REQ-xxxx
  Justification: [Why the change is needed]
  Proposed Modification: [Exact change to wording or new feature]
  Owner Approval: [Yes/No]
  ```
- **Traceability Matrix**: Maintain a table linking each REQ to: associated feature module, developer agent, test case IDs. This ensures coverage in implementation and QA.  

### 8.3. Guardrails & Change Control

- **Locked Requirements**: CORE objectives (peaceful photo gameplay, no combat) are flagged `LOCKED`. Agents must not alter or remove them.  
- **Ambiguity Logging**: If any requirement is unclear (e.g., “animals flee if approached”), agents must log a question rather than assume. Clarify with product owner.  
- **No Scope Creep**: Additional features (beyond MVP) must be documented as future roadmap, not coded now. Agents should not add new gameplay features unless specified (preserve scope).  
- **Design Integrity**: All visual and UX design must match the cozy style guidelines. Agents producing UI mockups should ensure they fit the low-poly theme.  
- **Cross-Platform Parity**: Feature A must behave the same on web and mobile (within input differences). If a feature can't be done on web (e.g. certain sensors), log it.  

### 8.4. System Architecture & Modules

- **Overall Architecture**: Use a modular design, e.g. Unity scenes + game objects or Godot scenes/nodes. 
  - Core modules: `GameManager`, `InputManager`, `WorldManager`, `VehicleController`, `AnimalManager`, `CameraController`, `UIManager`, `SaveManager`.  
- **State Machines**: 
  - For animals: base `Animal` class with states (Idle, Walk, Flee, Sleep).  
  - For game states: e.g. `GameState { Exploring, PhotoMode, Menu, Paused }`.  
- **Dependency Graph**: Document which modules call which. E.g. Wildlife AI can emit “AnimalPhotographed” events consumed by Library module. 
- **Integration Protocol**: Use event bus or observer pattern. For example, when CameraAgent captures photo, it raises event `OnPhotoTaken(speciesID)`, which WildlifeAgent and LibraryAgent listen to.  
- **Asset Pipeline**:
  - Place models, textures in organized folders (e.g. `Assets/Models/Animals/Deer.fbx`, `Assets/Textures/Wildlife/deer_diffuse.png`).  
  - Follow naming conventions (lowercase, use underscores).  
  - Audio files in `Assets/Audio/Ambient`, etc.  
  - UI prefabs and art in `Assets/UI/`.  
  - Version control with Git (or similar).  

### 8.5. Data Schemas & State

- **Animal Data** (`AnimalInfo` schema):
  - `id`, `name`, `scientific_name`, `habitat`, `description`, `active_time`, `prefers_weather`, `thumbnail`, `reference_image`.  
- **Species Database**: JSON or ScriptableObjects (Unity) containing all species info.  
- **Player Progress Data**:
  - `unlocked_species[]`, `photos_taken{speciesID:count}`, `photos[]` (file references), `settings{controls, volume, quality}`, `last_played_date`.  
- **Save File**: For cross-platform consistency, use JSON. For WebGL, store in IndexedDB; for mobile, use appropriate local file path.  
- **In-Game State**:
  - Current location coordinates, time of day, weather.  
  - Session log (which animals have been spotted in this session) to avoid immediate respawn.  
  - Camera settings (zoom level).

### 8.6. Interface Contracts & APIs

- **Event System**: Define events (with IDs):
  - `EVT_ANIMAL_SPAWNED(speciesID, position)` – signals new animal presence (UI might highlight track?).  
  - `EVT_PHOTO_CAPTURED(speciesID, quality_flag)` – triggers unlocking species, maybe camera sound.  
  - `EVT_WEATHER_CHANGED(type)` – to adjust audio/animals.  
  - `EVT_TIME_CHANGED(hour)` – for day/night triggers.  
- **APIs**:
  - `WorldManager.LoadRegion(regionID)` – loads scene or generates environment.  
  - `AnimalManager.Spawn(speciesID, position)` – to programmatically spawn animals.  
  - `VehicleController.SetSpeedLimiter(maxSpeed)` – e.g. for rough terrain.  
  - `CameraController.EnterPhotoMode() / ExitPhotoMode()`.  
  - `LibraryManager.UnlockSpecies(speciesID)`.  
  - UI screens should expose methods to open/close, e.g. `UIManager.OpenJournal()`.

Each API should have doc comments specifying input ranges and behavior (e.g., if an invalid speciesID is passed, throw error or ignore).

### 8.7. Definition of Done & QA

- **Done Criteria (for a feature)**:
  - All acceptance criteria (below) for its requirement ID are met.
  - Code is reviewed, merged, and passes integration tests.
  - Gameplay tested on at least two target devices/platforms (e.g. one mobile, one web).  
  - Documentation updated (e.g. any new settings described in game docs).  
- **Acceptance Criteria Examples**:
  - `REQ-2001 (Photography)`: “The camera UI activates on input and can capture a photo of an animal if focused.” **Pass** if: camera view appears, zoom works, capturing registers unlocking species if animal in frame; **Fail** if camera doesn’t activate or photo doesn’t save.  
  - `REQ-3002 (Vehicle Drive)`: “Player can drive vehicle on roads and fields.” **Pass** if: pressing forward moves Jeep, can steer, and movement stops at map boundary, **Fail** if stuck or clipping through everything.  
- **Regression Tests**: After any change, test all core loops: driving, photographing, journal unlocking.  
- **Automated Testing** (if feasible): Unit tests for non-UI logic (e.g. saving/loading data, unlocking entries). Simple scripted playtest bots (like Unity’s automated input) for smoke tests.  
- **QA Documentation**: Test cases organized by feature. Use bug tracker and link to REQ IDs for traceability.

### 8.8. Milestones & Timeline

- **Milestone 1 – Prototype (Month 1)**:
  - Basic world with placeholder ground and one road. Simple player driving a cube. Camera mode switches on/off.  
  - Inventory of species (Data) and Journal UI stub.  
  - Setup project structure, version control, basic build pipeline.  
- **Milestone 2 – Core Loop (Month 2)**:
  - Replace prototypes with actual art (forest ground, trees). Add 10 placeholder animals with roam behavior. Photo mode can lock one species entry.  
  - Basic UI for HUD and Journal with 1 entry.  
  - Implement day/night and simple rain.  
- **Milestone 3 – MVP Complete (Month 3)**:
  - Add remaining animals (total 20), refine behaviors (flee, etc.). Finalize environment art.  
  - Full camera UI with zoom. Journal fully functional with 20 species. Tutorial script.  
  - Polishing: SFX, music, UI polish.  
  - Performance optimization on target devices (30fps on target mobile).  
- **Milestone 4 – QA & Launch Prep (Month 4)**:
  - Internal QA and bug fixes. Write device-specific test matrix (WebGL on Chrome/Firefox, Android on Pixel/OnePlus, iOS on iPhone SE/14).  
  - Finalize builds for Web (host to test), prepare for Android APK/AAB and iOS App Store build.  
  - Acceptance review: check all locked requirements and CRs.  

Each milestone has associated acceptance criteria (detailed above). 

## 9. Visual Design Concept

Our style is **low-poly 3D with a calm, earthy palette**. Scenes feel warm and inviting. The interface is clean, iconographic, and touch-friendly. Below are sample concept images and wireframes illustrating the intended style. These are **illustrative mockups**, not final assets.

### 9.1. Art Style & Mood

- **Geometry**: Simple shapes for trees, rocks, animals (e.g. faceted but smooth forms).  
- **Color**: Muted greens, browns, and natural tones. Accents (flower colors, animal fur) are slightly vibrant to catch the eye.  
- **Lighting**: Soft sunlight (golden hour glow for evening), minimal harsh shadows. Ambient occlusion subtle.  
- **UI Look**: Overlay UI uses semi-transparent panels (like frosted glass or parchment), icons with a hand-drawn vibe, and large touch targets.  
- **Overall Mood**: Cozy, serene, exploratory. (See Sample Scene below for reference ambiance.)

### 9.2. Sample In-Game Scene (Tropical Forest)

 *Fig 1: Concept art of the in-game tropical forest. A low-poly jeep is parked on a dirt path amid lush trees and bushes. A bird perches overhead, and a monkey can be spotted in the branches. Warm sunlight filters through the canopy, creating a peaceful atmosphere. The player’s camera view is implied.*

This scene demonstrates color/tone: greens and browns dominate, with a warm sky. Notice low-detail trees and smooth ground. The jeep model is stylized (simple shapes). Wildlife (bird and monkey) have clear silhouette shapes.

### 9.3. Camera Mode UI

 *Fig 2: Mockup of the Photo Mode interface (overlaid on gameplay). The central crosshair/target helps focus. The zoom slider is on the right, and the shutter button is bottom-center (touch-friendly). In this example, the camera is framing a deer at dusk.*  

- **UI Elements** (annotated):  
  - *(A)* Shutter button: large for finger touch.  
  - *(B)* Zoom slider: vertical bar for pinch/drag to zoom.  
  - *(C)* Focus indicator: turns green when on target.  
  - *(D)* Exit/Cancel camera mode button (e.g. “X”) at top-left.  

The background art (forest and deer) uses the same low-poly style. The overlay is minimal and semi-transparent, keeping the view unobstructed.

### 9.4. Species Library UI

 *Fig 3: Concept art of the Wildlife Field Journal screen. The left column shows a list of species (with thumbnails), and the right pane shows the selected species’ entry.*  

- **Uncovered Entry**: Animal photo, name (“Red Panda”), scientific name, habitat, diet.  
- **Photo Gallery**: Below the text, thumbnails of player’s captured photos of this species.  
- **Design Notes**: The book-like background with subtle leaf motifs reinforces the cozy journal theme. Tabs or buttons allow switching between species categories (Mammals, Birds, etc.). Locked species appear grayed out until discovered.

### 9.5. Home / Destination UI

 *Fig 4: Home/Destination selection screen concept. The player chooses where to go (currently only “Rainforest Reserve”). This menu is stylized as a map laid on a wooden desk, with pins representing regions.*  

- **Elements**: Large “Start Exploration” button, settings and journal icons.  
- **Responsive Layout**: On mobile portrait, elements stack vertically; on landscape/desktop, they spread out. The map artwork (low-poly overhead view) maintains consistency with world art.

### 9.6. Annotated Wireframes

Below are hand-drawn style wireframe sketches (illustrative) for key screens/flows. They show placement of UI elements and how layouts adapt to different device form factors. Each wireframe is labeled with its orientation.

- **Home / Destination Screen**: selection of biome (currently just “Tropical Forest”).  
- **In-World HUD / Vehicle Controls**: shows speedometer (bottom-left), pause/settings (top-right), and mini-map (top-left) on desktop; mobile HUD has a joystick (bottom-left) and action buttons (bottom-right).  
- **Camera Mode (Mobile & Desktop)**: as described above (zoom, shutter).  
- **Wildlife Journal (Mobile & Desktop)**: list of species + entry pane.  
- **Pause/Settings Menu**: Overlays game with options (Resume, Tutorial, Volume, etc.).  

*Due to format constraints, these wireframes are described textually, but final outputs should be a PDF/PNG with boxes and labels.*  

*(In actual deliverables, these wireframes would be included as annotated diagrams. For this text summary, they are described verbally.)*

## 10. Appendix: Change Request Template

Use this template for proposing changes to locked requirements:

```
**Change Request [CR-####]:** [Short Title]

**Affected Requirement ID(s):** REQ-xxxx, REQ-yyyy  
**Requestor (Agent Role):** [Name/Role]  
**Date:** YYYY-MM-DD  

**Current Requirement:**  
Quote the original requirement text here.

**Proposed Change:**  
Describe the new wording or feature.

**Rationale:**  
Why is this change needed? (Bug fix? Clarification? New design constraint?)

**Impact Analysis:**  
List what modules/features this affects and whether it alters core gameplay or objectives.

**Owner Approval:** (Yes/No/Reserved)  
**QA Implications:** [Any new tests needed?]
```

All CRs must be logged in a change log document. If `Core Objective (locked)` is affected, implementers must **stop development and escalate** to the product owner.

---

**Sources & References:** This PRD was informed by design patterns from existing wildlife games (e.g., *New Pokémon Snap*, *Alba*), mobile performance best practices, and UI/UX guidelines. All requirements above are intended to be comprehensive and testable, reflecting the locked design brief.