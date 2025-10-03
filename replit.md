# ScamShield Anti-Telemarketing System

## Overview

ScamShield is a comprehensive anti-telemarketing and spam call protection system that combines hardware modem integration, AI-powered voice analysis, and real-time call screening. The system intercepts incoming calls at the hardware level using a V.92 USB modem (supports USRobotics 5637 and StarTech 56k USB models), analyzes caller patterns and voice characteristics, and automatically blocks or screens spam calls before they reach the user's phone.

The application provides both a master interface for administrators to manage the entire system and device interfaces for end users to monitor their protected lines.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **State Management**: TanStack Query for server state, Zustand for local auth state
- **UI Components**: Radix UI primitives with shadcn/ui styling
- **Styling**: Tailwind CSS with custom theme configuration
- **Routing**: Wouter for lightweight client-side routing
- **Animations**: Framer Motion for smooth UI transitions

**Design Pattern**: Component-based architecture with role-based interfaces (Master Interface for admins, Device Interface for users)

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: JWT-based authentication with bcrypt password hashing
- **API Design**: RESTful API with role-based access control middleware

**Key Services**:
- **SpamDetectionService**: TensorFlow.js-based machine learning for spam prediction
- **VoiceAnalysisService**: Real-time voice pattern analysis using audio processing
- **CallScreeningService**: Orchestrates screening logic combining multiple detection methods
- **ReputationScoringService**: Calculates dynamic reputation scores based on community reports and call patterns
- **ModemInterface**: Hardware integration layer for USB modem control

### Data Storage
- **Primary Database**: PostgreSQL (configured via DATABASE_URL)
- **ORM**: Drizzle with Neon serverless PostgreSQL driver
- **Schema Structure**:
  - User management (users, sessions, access control)
  - Phone number tracking (blacklist/whitelist with reputation scores)
  - Call logging and analytics
  - Voice pattern storage for ML training
  - Device registration and configuration
  - Spam reports and verification

**Caching Strategy**: LRU cache for call results (30-minute TTL, 10k entry limit)

### Authentication & Authorization
- **Method**: JWT tokens with 24-hour expiry
- **Password Storage**: bcrypt hashing with salt rounds
- **Session Management**: Database-backed sessions with device info tracking
- **Access Control**: Role-based (admin/user) with resource-level permissions
- **Device Authentication**: AES-256 encryption using device auth tokens

### Hardware Integration
- **Modem Support**: V.92 USB modems via SerialPort
  - USRobotics 5637 USB Fax Modem
  - StarTech 56k USB Dial-up and Fax Modem V.92 External
- **Communication Protocol**: Standard AT command set for call control
- **Features**:
  - Caller ID capture (VCID)
  - Hardware-level call blocking (ATH)
  - Call answering for screening (ATA)
  - Voice quality sampling

**Device Client**: Python-based service running on Linux devices (Raspberry Pi) with:
- Encrypted communication with central server
- Modem initialization and monitoring
- Real-time call event transmission
- Automatic modem detection via udev rules

### AI/ML Components
- **Framework**: TensorFlow.js Node bindings
- **Voice Analysis**: MFCC extraction, spectral analysis, rhythm detection
- **Spam Prediction**: Random Forest-style classification with feature importance
- **Pattern Learning**: Continuous learning from verified spam reports
- **Features Analyzed**:
  - Voice characteristics (pitch, energy, naturalness)
  - Call patterns (frequency, timing, duration)
  - Caller ID verification
  - Geographic patterns
  - Carrier reputation

## External Dependencies

### Third-Party APIs
- **Twilio Lookup API**: Phone number carrier lookup and line type detection (optional - gracefully degrades if not configured)
- **FCC Spam Database**: Periodic refresh of known spam numbers (24-hour sync cycle)
- **DNC Registry**: Do Not Call registry verification (placeholder for future integration)

### External Services
- **GitHub Integration**: Repository creation wizard for backup/version control
- **Spam Database Service**: Maintains cache of reported spam numbers with community verification

### Development Tools
- **Build System**: Vite for frontend bundling, esbuild for backend compilation
- **Database Migrations**: Drizzle Kit for schema management
- **Type Checking**: TypeScript with strict mode enabled
- **Development Server**: Vite dev server with HMR and error overlay

### Key Environment Variables
- `DATABASE_URL`: PostgreSQL connection string (required)
- `JWT_SECRET`: Secret key for JWT signing
- `TWILIO_ACCOUNT_SID`: Twilio account identifier (optional)
- `TWILIO_AUTH_TOKEN`: Twilio authentication token (optional)
- `DNC_REGISTRY_API_KEY`: DNC registry API key (placeholder)

### Hardware Requirements
- **Modem**: V.92 USB modem with AT command support
  - Supported models: USRobotics 5637, StarTech 56k USB V.92 (USB56KEMH2)
  - Any V.92 modem with standard Caller ID support should work
- **Device Client**: Linux-based system (Raspberry Pi recommended) with USB support
- **Network**: Stable connection between device client and central server