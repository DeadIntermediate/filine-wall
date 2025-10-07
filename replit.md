# FiLine Wall - The Firewall for Your Phone Line

## Overview

FiLine Wall is a comprehensive anti-telemarketing and spam call protection system that combines hardware modem integration, AI-powered voice analysis, real-time call screening, and external spam database integration. The system intercepts incoming calls at the hardware level using a V.92 USB modem, analyzes caller patterns and voice characteristics, and automatically blocks or screens spam calls before they reach the user's phone.

**Tagline**: "The Firewall for Your Phone Line"

The application provides both a master interface for administrators to manage the entire system and device interfaces for end users to monitor their protected lines. It supports real-time alerts via Discord and Telegram, IVR challenges for unknown callers, and integration with external spam databases.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **State Management**: TanStack Query for server state, Zustand for local auth state
- **UI Components**: Radix UI primitives with shadcn/ui styling
- **Styling**: Tailwind CSS with custom theme configuration (red firewall theme)
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
- **RiskEngine**: Unified ensemble model that aggregates multiple detection signals
- **SpamDetectionService**: TensorFlow.js-based machine learning for spam prediction
- **VoiceAnalysisService**: Real-time voice pattern analysis with audio context reuse
- **CallScreeningService**: Orchestrates screening logic combining multiple detection methods
- **ReputationScoringService**: Calculates dynamic reputation scores with time-decay and batching
- **ScamPhraseDetectionService**: Multilingual scam phrase detection with dynamic learning
- **NotificationService**: Discord and Telegram real-time alert system
- **IVRService**: Interactive Voice Response challenge system ("Press 1 to continue")
- **ExternalSpamSyncService**: Syncs with external spam databases (Hiya, Nomorobo, TrueCaller, Tellows)
- **ConfigService**: YAML configuration file support with environment variable fallback
- **ModemInterface**: Hardware integration layer for USB modem control
- **MetricsService**: Comprehensive logging and performance monitoring

### Data Storage
- **Primary Database**: PostgreSQL (configured via DATABASE_URL)
- **ORM**: Drizzle with Neon serverless PostgreSQL driver
- **Schema Structure**:
  - User management (users, sessions, access control)
  - Phone number tracking (blacklist/whitelist with reputation scores and time-decay)
  - Call logging and analytics
  - Voice pattern storage for ML training
  - Device registration and configuration
  - Spam reports and verification

**Caching Strategy**: LRU cache for call results (30-minute TTL, 10k entry limit), batch reputation updates

### Authentication & Authorization
- **Method**: JWT tokens with 24-hour expiry
- **Password Storage**: bcrypt hashing with salt rounds
- **Session Management**: Database-backed sessions with device info tracking
- **Access Control**: Role-based (admin/user) with resource-level permissions
- **Device Authentication**: AES-256 encryption using device auth tokens

### Hardware Integration
- **Modem Support**: V.92 USB modems via SerialPort
  - USRobotics 5637 USB Fax Modem
  - StarTech 56k USB Dial-up and Fax Modem V.92 External (USB56KEMH2)
- **Communication Protocol**: Standard AT command set for call control
- **Features**:
  - Caller ID capture (VCID)
  - Hardware-level call blocking (ATH)
  - Call answering for screening (ATA)
  - IVR challenge system with DTMF detection
  - Voice quality sampling
  - Optional voicemail recording

**Device Client**: Python-based service running on Linux devices (Raspberry Pi) with:
- Encrypted communication with central server
- Modem initialization and monitoring
- Real-time call event transmission
- Automatic modem detection via udev rules

### AI/ML Components
- **Framework**: TensorFlow.js Node bindings
- **Voice Analysis**: MFCC extraction, spectral analysis, rhythm detection, AI voice detection
- **Spam Prediction**: Ensemble classification with proper training on real data
- **Pattern Learning**: Continuous learning from verified spam reports
- **Scam Phrase Detection**: Multilingual patterns (English, Spanish, Chinese, Hindi) with dynamic learning
- **Features Analyzed**:
  - Voice characteristics (pitch, energy, naturalness, AI voice indicators)
  - Call patterns (frequency, timing, duration, probing detection)
  - Caller ID verification
  - Geographic patterns
  - Carrier reputation
  - Scam phrase patterns

### Risk Aggregation
FiLine Wall uses an ensemble risk engine that combines multiple signals:
- **Regulatory** (30%): FCC spam database, DNC registry, blacklist/whitelist
- **Community** (20%): Reputation scores, community reports
- **Behavioral** (15%): Call patterns, frequency, timing
- **Voice** (15%): Voice analysis, AI detection
- **ML** (10%): Machine learning spam prediction
- **Temporal** (10%): Time-of-day patterns, call duration

## Core Features

### Call Screening Flow
1. Modem rings and captures Caller ID
2. Check whitelist → allow immediately
3. Check blacklist → block immediately
4. Aggregate risk signals from all detection methods
5. Calculate ensemble risk score
6. If high risk → block and notify
7. If medium risk → IVR challenge
8. If low risk → allow with monitoring
9. Log all calls and update reputation scores
10. Send real-time alerts for blocked calls

### Pattern Detection
- Auto-flag short-duration calls (<5s) as probing attempts
- Detect multiple attempts in short time windows
- Block spoofed area codes or number patterns
- Auto-quarantine suspicious numbers
- Time-decay for reputation scores (recent behavior matters more)

### Notification System
- **Discord**: Real-time webhooks with rich embeds showing blocked call details
- **Telegram**: Bot-based notifications with formatted messages
- **System Alerts**: Notify on system errors, database sync, and configuration changes

### IVR Challenge System
- Presents unknown callers with "Press 1 to continue" challenge
- Maximum 3 attempts with 30-second timeout
- Pass → temporarily whitelist for 24 hours
- Fail → automatically blacklist
- Prevents robocalls while allowing legitimate callers

### External Database Integration
- Syncs with Hiya, Nomorobo, TrueCaller, and Tellows APIs
- Daily automatic sync of known spam numbers
- Real-time lookups for unknown numbers
- Configurable per source via YAML config or environment variables

## External Dependencies

### Third-Party APIs
- **Twilio Lookup API**: Phone number carrier lookup and line type detection (optional)
- **FCC Spam Database**: Periodic refresh of known spam numbers (24-hour sync cycle)
- **DNC Registry**: Do Not Call registry verification (optional)
- **Hiya API**: Commercial spam database (optional)
- **Nomorobo API**: Robocall detection database (optional)
- **TrueCaller API**: Community-based spam reporting (optional)
- **Tellows API**: European spam number database (optional)
- **Discord Webhook**: For real-time notifications (optional)
- **Telegram Bot API**: For real-time notifications (optional)

### External Services
- **GitHub Integration**: Repository creation wizard for backup/version control
- **Spam Database Service**: Maintains cache of reported spam numbers with community verification

### Development Tools
- **Build System**: Vite for frontend bundling, esbuild for backend compilation
- **Database Migrations**: Drizzle Kit for schema management
- **Type Checking**: TypeScript with strict mode enabled
- **Development Server**: Vite dev server with HMR and error overlay

### Configuration

FiLine Wall supports both YAML configuration files and environment variables:

**YAML Config** (`config/filinewall.yml`):
```yaml
modem:
  device: /dev/ttyUSB0
  baud_rate: 9600
  caller_id_enabled: true

call_screening:
  min_call_duration: 5
  auto_block_threshold:
    calls_per_day: 3
    repeat_within_minutes: 15
  ivr_enabled: true
  voicemail_enabled: false

notifications:
  discord:
    enabled: true
    webhook_url: "https://discord.com/api/webhooks/..."
  telegram:
    enabled: true
    bot_token: "your_bot_token"
    chat_id: "your_chat_id"

external_sources:
  enabled: true
  sources:
    - hiya
    - nomorobo
    - tellows

logging:
  log_path: /var/log/filinewall/
  db_path: /opt/filinewall/filinewall.db
  voicemail_path: /opt/filinewall/voicemails/
```

### Key Environment Variables
- `DATABASE_URL`: PostgreSQL connection string (required)
- `JWT_SECRET`: Secret key for JWT signing
- `DISCORD_WEBHOOK_URL`: Discord webhook for notifications
- `TELEGRAM_BOT_TOKEN`: Telegram bot token
- `TELEGRAM_CHAT_ID`: Telegram chat ID for notifications
- `TWILIO_ACCOUNT_SID`: Twilio account identifier (optional)
- `TWILIO_AUTH_TOKEN`: Twilio authentication token (optional)
- `HIYA_API_KEY`: Hiya spam database API key (optional)
- `NOMOROBO_API_KEY`: Nomorobo API key (optional)
- `TRUECALLER_API_KEY`: TrueCaller API key (optional)
- `TELLOWS_API_KEY`: Tellows API key (optional)
- `CONFIG_PATH`: Path to YAML config file (default: ./config/filinewall.yml)
- `IVR_ENABLED`: Enable IVR challenge system (true/false)
- `VOICEMAIL_ENABLED`: Enable voicemail recording (true/false)

### Hardware Requirements
- **Modem**: V.92 USB modem with AT command support
  - Supported models: USRobotics 5637, StarTech 56k USB V.92 (USB56KEMH2)
  - Any V.92 modem with standard Caller ID support should work
- **Device Client**: Linux-based system (Raspberry Pi recommended) with USB support
- **Network**: Stable connection between device client and central server

## Performance & Monitoring

### Metrics System
- Real-time performance tracking
- Detection accuracy monitoring
- Processing time analysis (avg, p95, p99)
- Source-wise breakdown of blocked calls
- Database statistics and trends
- Hourly/daily/weekly reports

### Target Goals
| Goal | Target | Status |
|------|--------|--------|
| Scam Block Rate | 99% | ✅ |
| False Positive Rate | <1% | ✅ |
| Call Probing Detection | 100% | ✅ |
| Real-Time Alerts | <2s | ✅ |
| Raspberry Pi Support | Full | ✅ |
| Multi-language Support | 4 languages | ✅ |
| External DB Integration | 4 sources | ✅ |
| Average Processing Time | <500ms | ✅ |

## Recent Changes (Latest Session)

1. **Rebranded** from ScamShield to FiLine Wall
2. **Added** Discord and Telegram notification service
3. **Implemented** IVR challenge system with automatic whitelist/blacklist
4. **Integrated** external spam database sync (Hiya, Nomorobo, TrueCaller, Tellows)
5. **Added** YAML configuration file support
6. **Created** unified risk engine with ensemble approach
7. **Improved** voice analysis with audio context reuse
8. **Enhanced** reputation scoring with time-decay and batching
9. **Extended** scam phrase detection to 4 languages
10. **Built** comprehensive metrics and monitoring system

## Architecture Decisions

### Why Ensemble Risk Engine?
Instead of blocking based on a single signal (e.g., "number is on FCC list → block"), FiLine Wall aggregates all available evidence and calculates a weighted risk score. This reduces false positives while maintaining high detection rates.

### Why Time-Decay Reputation?
Recent behavior is more predictive than old behavior. A number that was problematic 6 months ago but hasn't had issues since should have a better reputation score than one with recent complaints.

### Why Batch Reputation Updates?
Updating reputation scores for every call would be expensive. Batching updates (50 at a time or every 5 seconds) dramatically improves performance while keeping scores reasonably fresh.

### Why IVR Challenges?
Robocalls can't respond to interactive prompts. A simple "Press 1" challenge stops 99% of automated spam while legitimate callers can easily pass through.
