# JARVIS — AI Voice Assistant

JARVIS is a full-stack AI voice assistant built with React, TypeScript, TanStack Start, Supabase, Capacitor, and an OmniRoute-based multi-provider AI routing layer.

The project is designed for conversational AI, voice interaction, image understanding/generation, persistent user memory, conversation history, file storage, web-grounded answers, configurable personas, and Android-native assistant capabilities.

> **Project status:** Active development  
> **Primary frontend:** React + TypeScript + TanStack Start + Vite  
> **Backend/data:** Supabase  
> **Mobile:** Capacitor Android  
> **AI routing:** OmniRoute-based provider routing and fallback

---

## 🌐 Project Links

- **Live application:** https://jarvis-aiassistant.lovable.app
- **Lovable project:** https://lovable.dev/projects/37523722-6521-438b-a8f9-bbec8f0be004
- **Lovable:** https://lovable.dev

---

## ✨ Features

### 🤖 AI Conversation

- Conversational AI assistant with a JARVIS-style personality
- Text and voice interaction
- General, developer, and creative conversation modes
- Configurable assistant personas
- Concise responses optimized for voice playback
- Automatic language detection
- Telugu/Tenglish input support with Telugu-script responses
- Image-aware conversations using vision-capable models

### 🎙️ Voice

- Speech-to-text input
- Text-to-speech responses
- Configurable voice speed
- Configurable voice pitch
- Hands-free / automatic listening mode
- Live voice interaction UI
- Audio feedback and JARVIS boot/search sound effects

### 👁️ Vision & Images

- Image attachments in conversations
- Image analysis through vision-capable AI providers
- AI image generation
- Generated-image gallery
- Image download and deletion
- Generated images can be persisted to user cloud storage

### 🔎 Web Grounding

JARVIS includes lightweight web-search grounding for requests that need fresh information.

It can automatically recognize queries involving terms such as:

- latest
- current
- today
- news
- weather
- prices
- scores
- releases
- updates
- search / browse / look up requests

Search results are injected into the AI context so the assistant can answer using recently retrieved information.

### 🧠 Long-Term Memory

Authenticated users can have persistent memories stored in Supabase.

JARVIS can recognize explicit or useful personal facts such as:

- "Remember that..."
- "My name is..."
- Preferences
- Favorites
- User-provided background information

Memories are associated with the authenticated user and can be supplied to future conversations.

### 💬 Conversations & History

- Persistent conversations
- User/assistant message storage
- Conversation titles generated automatically
- Conversation history
- Search/filtering of history
- Chat deletion
- Cloud-backed conversation storage

### 👤 Authentication & Profiles

- Supabase authentication
- User profiles
- Display name
- Avatar support
- Persona selection
- Per-user data isolation using Supabase Row Level Security

### 📁 Files & Storage

- User file uploads
- Image uploads
- Cloud-backed file metadata
- Signed file URLs
- Generated-image persistence
- File deletion
- Personal storage/library interface

### 🗂️ Workspace

The JARVIS workspace contains:

- **Images** — generated-image collection
- **Projects** — organize saved conversations
- **Library** — saved transcripts
- **Plugins** — enable/disable selected JARVIS capabilities

Workspace data that is intentionally local is stored through browser local storage, while account data and uploaded files use Supabase.

### 🔐 Data Controls

The project includes user-facing data management functionality, including:

- Exporting account data
- Managing memories
- Managing conversations
- Managing stored files
- Deleting chat data
- Account deletion support

### 📱 Android

The repository contains a Capacitor Android application.

The Android project includes support for capabilities such as:

- Microphone
- Camera
- Media access
- Notifications
- Vibration
- Network access
- Native JARVIS command handling
- App launching
- Contact lookup
- Phone-related actions
- Accessibility-based UI automation

Native automation requires the relevant Android permissions/services to be enabled by the user.

---

# 🧠 AI Provider Routing

JARVIS contains a server-side OmniRoute-based routing layer under:

```text
src/lib/omniroute/
```

The routing layer provides:

- Provider registry
- Provider discovery from environment variables
- Model selection
- Text model selection
- Vision model selection
- Utility model selection
- Provider priority ordering
- Automatic fallback
- Provider health tracking
- Cooldown handling
- Retry handling for short retry windows
- Request timeouts
- Provider diagnostics

## Default Provider

Gemini is configured as the preferred primary provider.

The project also contains the Lovable AI Gateway as a built-in fallback.

Additional providers from the OmniRoute catalog can become available when their corresponding API keys are configured.

## Provider Configuration

Provider credentials are read from environment variables.

Examples:

```text
GEMINI_API_KEY
GROQ_API_KEY
OPENROUTER_API_KEY
DEEPINFRA_API_KEY
LOVABLE_API_KEY
```

The exact providers available depend on the provider registry and which credentials are configured.

Provider order can be customized with:

```text
OMNIROUTE_PROVIDER_ORDER
```

Model overrides are supported through variables such as:

```text
OMNIROUTE_MODEL_<PROVIDER>
OMNIROUTE_VISION_MODEL_<PROVIDER>
OMNIROUTE_UTILITY_MODEL_<PROVIDER>
```

Never commit real API keys or secrets to source control.

---

# 🏗️ Architecture

```text
                         ┌─────────────────────┐
                         │      JARVIS UI      │
                         │ React + TypeScript  │
                         └──────────┬──────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     │                             │
              Voice / Vision                 Chat / Workspace
                     │                             │
                     └──────────────┬──────────────┘
                                    │
                           TanStack Start API
                                    │
                 ┌──────────────────┴──────────────────┐
                 │                                     │
          JARVIS Chat API                         Utility APIs
                 │                           ┌─────────┼─────────┐
                 │                           │         │         │
          OmniRoute Router                   STT       TTS     Images
                 │
       ┌─────────┼─────────┐
       │         │         │
    Gemini   Other      Lovable
             Providers   Gateway
       │         │         │
       └─────────┴─────────┘
                 │
             AI Response

                 │
                 ▼
             Supabase
       ┌─────────┼─────────────┐
       │         │             │
   Auth      Database       Storage
       │         │             │
    Profiles  Memories    User Files
              Chats       Images
              Messages
```

---

# 🧩 Main Project Structure

```text
.
├── android/                       # Capacitor Android project
│
├── public/                        # Static assets
│
├── src/
│   ├── components/
│   │   ├── ui/                    # Reusable UI components
│   │   ├── JarvisOrb.tsx
│   │   ├── JarvisWorkspace.tsx
│   │   ├── JarvisSidebar.tsx
│   │   ├── JarvisLogin.tsx
│   │   ├── JarvisProfileSheet.tsx
│   │   ├── JarvisStorageSheet.tsx
│   │   ├── JarvisDataControls.tsx
│   │   ├── JarvisScreenShare.tsx
│   │   └── ...
│   │
│   ├── integrations/
│   │   └── supabase/              # Supabase clients/auth integration
│   │
│   ├── lib/
│   │   ├── omniroute/             # AI provider routing/fallback
│   │   ├── jarvisCloud.ts         # User data, memories, chats, files
│   │   ├── jarvisNative.ts        # Android/native commands
│   │   ├── jarvisPersonas.ts      # Assistant personas
│   │   ├── websearch.server.ts    # Web grounding
│   │   ├── wav.ts                 # Audio/WAV helpers
│   │   └── ...
│   │
│   ├── routes/
│   │   ├── index.tsx              # Main JARVIS application
│   │   └── api/
│   │       ├── jarvis-chat.ts     # Main AI chat endpoint
│   │       ├── stt.ts             # Speech-to-text
│   │       ├── tts.ts             # Text-to-speech
│   │       ├── generate-image.ts  # Image generation
│   │       ├── chat-title.ts      # AI conversation titles
│   │       └── ai-health.ts       # Provider health diagnostics
│   │
│   ├── router.tsx
│   ├── server.ts
│   └── start.ts
│
├── supabase/
│   ├── migrations/                # Database and RLS migrations
│   └── config.toml
│
├── package.json
├── vite.config.*
├── tsconfig.*
├── AGENTS.md
└── README.md
```

---

# 🗄️ Supabase Data Model

The current migrations define the following main data structures:

### `profiles`

Stores per-user profile information and selected persona.

### `memories`

Stores long-term user memories.

### `conversations`

Stores conversation metadata and titles.

### `messages`

Stores user and assistant messages.

### `user_files`

Stores metadata for user-uploaded and generated files.

### Storage

The project uses user-scoped storage policies for:

- `avatars`
- `user-files`

Row Level Security and storage policies restrict authenticated users to their own data.

---

# 🔐 Security

JARVIS is designed around user-scoped data access.

Important security practices:

- Keep API keys in environment variables.
- Never expose private provider credentials in frontend code.
- Never commit `.env` files containing secrets.
- Use Supabase Row Level Security for user-owned records.
- Keep privileged/service-role credentials server-side.
- Use signed URLs for private stored files.
- Keep native permissions limited to required capabilities.
- Review production authentication and storage policies before deployment.

> The repository archive may contain a `.env` file. Do not commit real secrets from that file to GitHub. Use a local/environment-secret configuration instead.

---

# ⚙️ Requirements

Before running JARVIS locally, install:

- Node.js
- npm
- Git

For Android development, also install the Android development toolchain required by Capacitor.

---

# 🚀 Local Development

## 1. Clone the repository

```bash
git clone <your-repository-url>
cd <repository-name>
```

## 2. Install dependencies

```bash
npm install
```

## 3. Configure environment variables

Create the required environment configuration for your deployment.

At minimum, the project may require credentials for:

```text
Supabase
AI provider(s)
Lovable AI Gateway
```

Use the environment variable names expected by the source code.

## 4. Start development

```bash
npm run dev
```

Vite will display the local development URL.

---

# 🏭 Production Build

Build the application:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

---

# 🧹 Code Quality

Lint the project:

```bash
npm run lint
```

Format the project:

```bash
npm run format
```

---

# 📱 Android Development

The repository contains the Android project under:

```text
android/
```

The web application uses Capacitor for native Android integration.

Before creating a production Android build, verify:

1. Web assets are synchronized with the Android project.
2. Required Android permissions are appropriate.
3. Native JARVIS capabilities are tested on a real device.
4. Accessibility-dependent automation is tested separately.
5. Production API configuration is correctly supplied.

---

# 🔌 API Endpoints

The application currently exposes server routes for major AI capabilities.

| Endpoint | Purpose |
|---|---|
| `/api/jarvis-chat` | Main AI conversation and routing |
| `/api/stt` | Speech-to-text |
| `/api/tts` | Text-to-speech |
| `/api/generate-image` | AI image generation |
| `/api/chat-title` | Automatic conversation titles |
| `/api/ai-health` | AI provider diagnostics |

---

# 🔄 Request Flow

A normal JARVIS chat request follows this general flow:

```text
User Input
   ↓
JARVIS UI
   ↓
/api/jarvis-chat
   ↓
Persona + Mode + Memory
   ↓
Optional Web Grounding
   ↓
OmniRoute
   ↓
Primary Provider
   ↓
Fallback Provider if required
   ↓
AI Response
   ↓
JARVIS UI
   ↓
Optional Text-to-Speech
```

For image conversations, the router selects the vision tier and uses a provider/model capable of handling image input.

---

# 🌐 Web Search Flow

When a request appears to require current information:

```text
User Query
    ↓
Search Detection
    ↓
DuckDuckGo HTML Search
    ↓
Relevant Results
    ↓
Compact Grounding Context
    ↓
AI Provider
    ↓
JARVIS Response
```

The search layer is implemented in:

```text
src/lib/websearch.server.ts
```

---

# 🧠 Memory Flow

```text
User Message
     ↓
Memory Extraction
     ↓
Supabase `memories`
     ↓
Future Conversation
     ↓
Relevant Memories Added to AI Context
```

Only authenticated user data should be associated with the signed-in user's account.

---

# 🛡️ Lovable Integration

This project was originally created and developed through Lovable.

The repository is connected to Lovable, so commits pushed to the connected branch can synchronize back to the Lovable project.

See `AGENTS.md` for the repository's Lovable-specific development guidance.

### Important

Do not rewrite published Git history through force-pushes, rebases, amended commits, or history-rewriting workflows when working with the Lovable-connected repository.

Keep the connected branch in a working state.

---

# 🔧 Development Guidelines

When modifying JARVIS:

1. Preserve existing functionality.
2. Avoid unnecessary UI/UX changes.
3. Prefer small, modular changes.
4. Keep AI provider logic server-side.
5. Keep secrets in environment variables.
6. Preserve Supabase RLS policies.
7. Test both web and Android-specific functionality when relevant.
8. Run the production build after significant changes.
9. Do not remove existing features without understanding their dependencies.
10. Keep provider routing and fallback behavior deterministic and observable.
11. Avoid breaking the Lovable/Git synchronization workflow.

---

# 🧪 Verification Checklist

Before considering a major change complete, verify:

### Web

- [ ] `npm install` succeeds
- [ ] `npm run build` succeeds
- [ ] `npm run lint` succeeds
- [ ] Authentication works
- [ ] Chat works
- [ ] Voice input works
- [ ] Voice output works
- [ ] Image attachment works
- [ ] Image generation works
- [ ] Conversation history works
- [ ] Memory works
- [ ] File storage works
- [ ] Web grounding works
- [ ] Provider fallback works

### Android

- [ ] App launches
- [ ] Microphone permission works
- [ ] Camera permission works
- [ ] Notifications work where required
- [ ] Native commands are handled correctly
- [ ] Accessibility-dependent features behave correctly
- [ ] Network requests work
- [ ] No production secrets are bundled into the client

### Security

- [ ] No API keys committed
- [ ] Supabase RLS enabled
- [ ] Storage policies verified
- [ ] Private files use appropriate access controls
- [ ] Authentication boundaries tested

---

# 📌 Current Technology Stack

| Layer | Technology |
|---|---|
| UI | React 19 |
| Language | TypeScript |
| Framework | TanStack Start |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| UI Components | Radix UI |
| Icons | Lucide React |
| 3D/Visuals | Three.js / React Three Fiber |
| Backend | TanStack Start server routes |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Storage | Supabase Storage |
| AI Routing | OmniRoute-based routing layer |
| AI Gateway | Lovable AI Gateway |
| Web Grounding | DuckDuckGo HTML search |
| Mobile | Capacitor 8 / Android |
| Validation | Zod |
| Charts | Recharts |

---

# 📊 Project Status

JARVIS is an actively developed AI assistant project.

The current repository contains:

- Web application
- Server-side AI routes
- Multi-provider AI routing
- Supabase integration
- Persistent conversations
- Long-term memory
- File storage
- Image generation
- Web grounding
- Voice input/output
- Workspace features
- Android/Capacitor integration
- Native assistant command handling

---

# 📄 License

No explicit open-source license is currently defined by the project repository.

If this project will be distributed publicly, add an appropriate `LICENSE` file and update this section.

---

## JARVIS

**An AI voice assistant built for conversation, memory, vision, voice, and intelligent provider routing.**
