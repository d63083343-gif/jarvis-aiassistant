

# AURA — Student-First AI Assistant

AURA is a student-focused AI assistant platform designed to bring conversational AI, memory, knowledge retrieval, web-grounded assistance, voice interaction, multimodal capabilities, and a future custom-model development path into one system.

The project is being developed as a modular, production-style AI platform that can evolve from an assistant prototype into a more independent and optimized AI system.

---

## Project Status

**Status: Active development**

AURA currently contains a full-stack assistant foundation with:

- AI conversation
- Multi-provider AI routing and fallback
- Gemini integration
- Supabase authentication, database and storage
- Persistent conversations
- User memory
- Knowledge retrieval / RAG foundation
- Conditional web grounding
- Voice input and output
- Image understanding and image-generation routes
- User file storage
- Configurable assistant personas
- Workspace functionality
- Capacitor Android project
- Dataset validation and preprocessing foundations
- LoRA / QLoRA training configuration foundations
- Training and inference verification tooling

AURA's custom-model training and production-scale deployment are future engineering stages and are not represented as already completed.

---

# Vision

AURA is intended to become a student-first AI platform that makes capable AI assistance more accessible and sustainable.

The long-term direction is:

```text
Student
   │
   ▼
AURA Application
   │
   ▼
AURA Core
Context + Orchestration
   │
   ├───────────────┐
   │               │
   ▼               ▼
AI Models       Tools + Data
   │               │
   │        ┌──────┼────────┐
   │        │      │        │
   │      Memory   RAG     Web
   │
   ▼
Response
   │
   ▼
Student

The system is designed so that models and capabilities can evolve without requiring the entire application to be rebuilt.


---

Core Capabilities

AI Conversation

AURA provides a conversational AI interface for:

General questions

Learning assistance

Coding assistance

Creative tasks

Research support

Multilingual conversations

Context-aware responses

Image-aware conversations


The AI layer is separated from the application UI through server-side API routes and provider-routing logic.


---

AI Routing

AURA uses an OmniRoute-based routing layer to manage AI providers.

The routing architecture is designed to support:

Primary provider selection

Provider fallback

Model capability selection

Timeout handling

Provider health tracking

Model lockout handling

Context fitting

Error-aware fallback


The intended primary direct AI provider is Gemini, while the existing routing architecture can use configured fallback providers when required.

Provider credentials are kept server-side through environment variables.


---

Knowledge Retrieval / RAG

AURA contains a retrieval-augmented generation foundation.

The knowledge flow is:

User Query
    │
    ▼
Query Embedding
    │
    ▼
Supabase Vector Search
    │
    ▼
Relevant Knowledge
    │
    ▼
AI Context
    │
    ▼
AURA Response

The RAG system is designed to retrieve relevant knowledge from the application's knowledge store when retrieval is required.

It uses:

Query embeddings

Supabase vector search

Knowledge chunks

Top-K retrieval

Server-side retrieval functions


RAG is an extensible foundation and is not intended to be unnecessarily invoked for every ordinary conversation.


---

Web Grounding

AURA includes conditional web grounding for requests where fresh or external information is required.

Examples include requests involving:

Current information

Recent information

Latest updates

News

Prices

Scores

Weather

Releases

Explicit search requests

Browse / lookup requests


The system determines when grounding is needed and can retrieve web results before generating the final response.


---

Voice Interaction

AURA includes a voice interaction pipeline:

Voice Input
     │
     ▼
Speech-to-Text
     │
     ▼
AURA Conversation
     │
     ▼
Text-to-Speech
     │
     ▼
Voice Output

The application contains dedicated server routes for:

Speech-to-text

Text-to-speech


Voice functionality is integrated into the existing assistant experience rather than being implemented as a separate application.


---

Vision & Images

AURA supports multimodal interaction through:

Image attachments

Vision-capable AI requests

Image analysis

Image generation

Generated-image persistence

Image gallery functionality

Image file management


Image generation availability depends on the configured provider and current provider/account limits.


---

Memory

AURA supports authenticated user memory through Supabase.

The memory system is designed to allow useful user-provided information and preferences to be retained and used in future conversations.

Memory is associated with the authenticated user and is protected by the application's user-data access model.


---

Conversations & History

AURA supports persistent conversations including:

Conversation creation

Message storage

Conversation history

Conversation titles

Conversation management

Chat deletion

Cloud-backed conversation data


Conversation data is associated with authenticated users.


---

Authentication

Authentication is implemented through Supabase Auth.

The application includes:

User authentication

User profiles

Persona configuration

User-specific data

User-scoped database access

Row Level Security


Private user data is intended to remain isolated between accounts.


---

Files & Storage

AURA includes cloud-backed user storage functionality for:

User files

Image uploads

Generated images

File metadata

Signed file URLs

File deletion

Personal storage/library functionality


Supabase Storage is used as part of the backend storage layer.


---

Workspace

The AURA workspace provides areas for managing assistant-related content and capabilities.

The current application includes functionality around:

Images

Projects

Library

Plugins

Conversations

User data controls


The exact behavior of individual workspace features depends on their current implementation and configuration.


---

Android

The repository contains a Capacitor Android application.

AURA Web Application
        │
        ▼
     Capacitor
        │
        ▼
 Android Application

The Android project provides the foundation for native assistant capabilities and device integrations supported by the application.

Native capabilities are kept separate from the main web application where possible.


---

System Architecture

A simplified representation of the current architecture:

┌─────────────────────┐
                         │      AURA UI        │
                         │ React + TypeScript  │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   TanStack Start    │
                         │    Server Routes    │
                         └──────────┬──────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 │                  │                  │
                 ▼                  ▼                  ▼
          ┌────────────┐     ┌────────────┐     ┌────────────┐
          │ OmniRoute  │     │    RAG     │     │    Web     │
          │ AI Routing │     │ Knowledge  │     │ Grounding  │
          └─────┬──────┘     └─────┬──────┘     └─────┬──────┘
                │                  │                  │
                ▼                  ▼                  ▼
          AI Providers        Supabase DB        Web Search
                │
                ▼
          AI Response
                │
                ▼
             AURA UI


---

Technology Stack

Layer	Technology

Frontend	React
Language	TypeScript
Framework	TanStack Start
Build Tool	Vite
Styling	Tailwind CSS
UI Components	Radix UI
Backend	TanStack Start Server Routes
Database	Supabase PostgreSQL
Authentication	Supabase Auth
Storage	Supabase Storage
AI Routing	OmniRoute
Primary AI	Gemini
Web Grounding	DuckDuckGo-based search
Mobile	Capacitor / Android
Validation	Zod
Package Management	Bun



---

Repository Structure

.
├── android/
│   └── Capacitor Android project
│
├── public/
│   └── Static assets
│
├── src/
│   ├── components/
│   │   ├── UI components
│   │   └── AURA assistant components
│   │
│   ├── integrations/
│   │   └── supabase/
│   │
│   ├── lib/
│   │   ├── omniroute/
│   │   ├── RAG
│   │   ├── web search
│   │   ├── cloud data
│   │   ├── personas
│   │   ├── native functionality
│   │   └── utilities
│   │
│   ├── routes/
│   │   ├── index.tsx
│   │   └── api/
│   │       ├── jarvis-chat.ts
│   │       ├── stt.ts
│   │       ├── tts.ts
│   │       ├── generate-image.ts
│   │       ├── chat-title.ts
│   │       └── ai-health.ts
│   │
│   ├── router.tsx
│   ├── server.ts
│   └── start.ts
│
├── supabase/
│   ├── migrations/
│   └── config.toml
│
├── package.json
├── bun.lock
├── bunfig.toml
├── tsconfig.json
├── vite.config.ts
├── AGENTS.md
└── README.md

> Some internal source filenames still use the historical Jarvis naming. This is an internal implementation detail; the product/project identity is AURA.




---

Data Layer

The Supabase backend provides the application's persistent data layer.

The project contains structures for areas such as:

User profiles

Memories

Conversations

Messages

User files

Knowledge chunks

Storage


Row Level Security is used to enforce user-scoped access where configured.


---

Security

AURA follows server-side secret handling principles.

Important rules:

API keys must remain in environment variables.

Secrets must never be hard-coded into frontend code.

Real .env secrets must never be committed to Git.

Supabase Row Level Security must remain enabled for protected user data.

Service-role credentials must remain server-side.

Private storage should use appropriate access controls and signed URLs.

Authentication boundaries should be verified before production deployment.



---

AURA Model Forge

AURA is also being developed toward a future custom-model capability.

The model-development lifecycle is:

DATA
  │
  ▼
VALIDATE
  │
  ▼
CLEAN
  │
  ▼
PREPROCESS
  │
  ▼
DEDUPLICATE
  │
  ▼
FORMAT
  │
  ▼
SPLIT
  │
  ▼
TRAIN / TUNE
  │
  ▼
EVALUATE
  │
  ▼
DEPLOY

The repository contains foundations for dataset preparation and training configuration.


---

Dataset Engineering

The dataset pipeline supports:

JSONL datasets

Schema validation

Required-field validation

Role validation

Message ordering validation

Tool-call linkage validation

Malformed JSON detection

Duplicate-ID detection

Duplicate-example detection

Exact duplicate detection

Near-duplicate detection

Length filtering

System-prompt injection

Chat formatting

ChatML-style rendering

Deterministic train/validation/test splitting


The intended processing flow is:

RAW
 │
 ▼
VALIDATE
 │
 ▼
CLEAN
 │
 ▼
PREPROCESS
 │
 ▼
DEDUP
 │
 ▼
FORMAT
 │
 ▼
SPLIT
 ├── train
 ├── validation
 └── test

Synthetic and intentionally invalid fixtures used for testing are not represented as production training data.


---

Training Configuration

The model-development foundation includes configuration support for:

LoRA

QLoRA

Optimizer settings

Runtime settings

Precision configuration

Checkpoint configuration

Reproducibility settings

Dataset configuration


Training configuration is separated from smoke-test configuration so that development tests do not accidentally launch a large production-model training job.


---

Target Foundation Model

The current planned foundation model for the own-model direction is:

Qwen/Qwen3-235B-A22B

This repository does not claim that this model has already been trained as AURA.

No trained AURA weights are included or claimed unless explicitly produced and verified by an actual training run.

Large-model training requires appropriate compute, GPU memory, storage, software compatibility, and runtime infrastructure.


---

Current Model Development Status

The current project has engineering foundations for:

Dataset validation

Dataset preprocessing

Deduplication

Deterministic splitting

Chat formatting

Training configuration

LoRA / QLoRA configuration

Training smoke testing

Inference dry-run foundations

Evaluation dry-run foundations


The following remain dependent on actual execution and hardware:

Large-scale model training

Production fine-tuning

Model-quality benchmarking

Production inference benchmarking

Large-model deployment

Distributed/sharded training

Production-scale serving


No training result or benchmark should be considered valid unless it was actually executed and recorded.


---

Performance & Latency

AURA is being optimized for responsive interaction.

Current engineering focus includes reducing unnecessary work in the conversational request path, particularly:

Avoiding unnecessary knowledge retrieval for ordinary requests

Avoiding unnecessary web searches

Reducing sequential network operations where safe

Improving perceived response latency

Preserving OmniRoute fallback reliability


Performance improvements should be measured with real runtime timings rather than estimated from source code alone.


---

Testing & Verification

The project contains automated verification around the data and model-development foundations.

Important verification areas include:

Dataset schema validation

Invalid-data handling

Duplicate detection

Preprocessing

Deterministic splitting

Training configuration

Training smoke tests

Inference dry-runs

Evaluation dry-runs


For application changes, the following should be verified where applicable:

Build
Lint
Type checking
Authentication
Chat
Voice input
Voice output
Image handling
Web grounding
RAG
Provider fallback
Storage
Android functionality

A feature should not be described as fully verified unless it has actually been tested.


---

Development Principles

AURA follows these engineering principles:

1. Preserve existing working functionality.


2. Avoid unnecessary UI/UX redesign.


3. Prefer minimal, focused changes.


4. Do not duplicate existing systems.


5. Keep AI provider logic server-side.


6. Keep secrets in environment variables.


7. Preserve Supabase security policies.


8. Separate test fixtures from production data.


9. Keep hardware-dependent operations separate from CPU-safe tests.


10. Verify changes before claiming completion.


11. Do not claim benchmarks without measured results.


12. Do not claim model training without an actual training run.


13. Avoid unrelated refactoring.


14. Preserve deterministic provider routing and fallback behavior.




---

Roadmap

Phase 1 — Assistant Foundation

[x] Full-stack assistant foundation

[x] Supabase integration

[x] Authentication foundation

[x] Conversation persistence

[x] User memory foundation

[x] File storage foundation

[x] AI routing architecture

[x] Web grounding foundation

[x] Voice API foundation

[x] Image capability foundation

[x] Capacitor Android foundation


Phase 2 — Model Development Foundation

[x] Dataset schema validation

[x] Invalid fixture testing

[x] Duplicate detection

[x] Dataset preprocessing

[x] Deterministic dataset splitting

[x] Chat formatting

[x] LoRA / QLoRA configuration

[x] Training smoke-test foundation

[x] Inference/evaluation dry-run foundation


Phase 3 — Optimization

[ ] Complete latency optimization

[ ] Runtime performance measurement

[ ] Production preflight

[ ] Hardware compatibility verification

[ ] Storage and deployment planning

[ ] Complete end-to-end verification


Phase 4 — Custom Model

[ ] Production dataset preparation

[ ] Training infrastructure

[ ] Fine-tuning

[ ] Evaluation

[ ] Benchmarking

[ ] Model optimization

[ ] AURA model integration


Phase 5 — Production

[ ] Production inference

[ ] Scalable model serving

[ ] Monitoring

[ ] Reliability testing

[ ] Security review

[ ] Production deployment



---

Important Project Disclaimer

AURA is an actively developed project.

The existence of training configuration, dataset tooling, or model-development code does not mean that a custom AURA foundation model has already been trained.

Similarly, future architecture diagrams represent planned evolution and should not be interpreted as proof that every future component is already deployed.

Only features and results that have been actually implemented and verified should be considered completed.


---

License

No explicit open-source license is currently defined for this repository.

If AURA is publicly distributed, an appropriate license should be added before redistribution.


---

AURA

A student-first AI platform evolving from an intelligent assistant toward an independent, evaluated, and scalable AI system.
