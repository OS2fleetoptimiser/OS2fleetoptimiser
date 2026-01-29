# Frontend Overview

> Technical overview of the OS2fleetoptimiser frontend.

*Last updated: 2026-01-29*

---

## Table of Contents

- [📋 Overview](#-overview)
- [📁 Project Structure](#-project-structure)
- [🔐 Authentication](#-authentication)
- [🗺️ Application Routes](#️-application-routes)
- [🔄 State & Data](#-state--data)
- [🎨 UI Layer](#-ui-layer)

---

## 📋 Overview

### Tech Stack

| Category       | Technology               |
|----------------|--------------------------|
| Framework      | Next.js 14 (App Router)  |
| Language       | TypeScript               |
| UI             | Material UI 5 + Tailwind |
| Client State   | Redux Toolkit            |
| Server State   | TanStack React Query     |
| Forms          | Formik + Yup             |
| Charts         | Nivo                     |
| Tables         | Material React Table     |
| Auth           | NextAuth.js + Keycloak   |
| HTTP           | Axios                    |
| Maps           | Leaflet                  |

---

## 📁 Project Structure

```
fleetoptimiser-frontend/
│
├── app/
│   ├── (logged-in)/                    # Protected routes
│   │   ├── layout.tsx                  # Nav wrapper (TopNav + InfoNav)
│   │   ├── (landing-page)/             # KPI dashboard (/)
│   │   ├── dashboard/                  # Analytics
│   │   ├── configuration/              # Vehicle CRUD
│   │   ├── fleet/                      # Manual simulation
│   │   ├── goal/                       # Auto optimization
│   │   ├── location/                   # Location management
│   │   ├── setup/                      # Simulation wizard
│   │   └── simulation-history/         # Past simulations
│   │
│   ├── (logged-out)/login/             # Public login page
│   │
│   ├── providers/
│   │   ├── providerWrapper.tsx         # Redux, Query, Session
│   │   ├── WritePrivilegeProvider.tsx  # Write permissions context
│   │   └── ValueCheckProvider.tsx      # Data validation context
│   │
│   ├── api/auth/[...nextauth]/         # NextAuth handler
│   ├── authOptions.ts                  # Keycloak config
│   ├── env.ts                          # Type-safe env vars
│   └── layout.tsx                      # Root layout
│
├── components/
│   ├── hooks/                          # React Query hooks
│   ├── redux/                          # Store, slice, typed hooks
│   ├── data/                           # Server-side fetching
│   ├── AxiosBase.ts                    # Axios instance
│   └── *SettingsForm.tsx               # Formik forms
│
├── middleware.ts                       # Route protection, JWT validation
├── theme.ts                            # MUI theme
├── tailwind.config.js                  # Custom colors
└── next.config.js                      # API proxy config
```

### Critical Files

| File                                  | Purpose                         |
|---------------------------------------|---------------------------------|
| `app/layout.tsx`                      | Root layout, providers          |
| `app/authOptions.ts`                  | Keycloak configuration          |
| `middleware.ts`                       | JWT validation, route protection|
| `components/redux/SimulationSlice.ts` | Core simulation state              |
| `components/AxiosBase.ts`             | API client configuration        |

---

## 🔐 Authentication

### Flow

```
┌────────┐     ┌──────────┐     ┌──────────┐     ┌───────────┐     ┌────────────┐
│  User  │────►│ NextAuth │────►│ Keycloak │────►│ JWT Token │────►│ middleware │
└────────┘     └──────────┘     └──────────┘     └───────────┘     └────────────┘
                                                                          │
                                                                          ▼
                                                                   Validates JWT
                                                                   Checks roles
                                                                   Redirects if invalid
```

### Role-Based Access

| Role         | Env Variable      | Access              |
|--------------|-------------------|---------------------|
| Write access | `ROLE_CHECK`      | Full CRUD           |
| Read-only    | `ROLE_CHECK_READ` | View only           |

**Usage:** `WritePrivilegeProvider` → `useWritePrivilegeContext()` → `hasWritePrivilege`

---

## 🗺️ Application Routes

| Route                    | Purpose                         |
|--------------------------|---------------------------------|
| `/`                      | Landing page (KPIs)             |
| `/dashboard/*`           | Analytics dashboards            |
| `/configuration`         | Vehicle management              |
| `/fleet`                 | Manual simulation setup         |
| `/fleet/[simulationId]`  | Simulation results              |
| `/goal`                  | Auto optimization setup         |
| `/goal/[simulationId]`   | Optimization results            |
| `/location`              | Location list                   |
| `/location/[id]`         | Edit location                   |
| `/setup`                 | Simulation wizard               |
| `/simulation-history`    | Previous simulations            |

### Dashboard Sub-routes

| Route                      | Purpose                       |
|----------------------------|-------------------------------|
| `/dashboard/activity`      | Vehicle activity heatmap      |
| `/dashboard/availability`  | Availability charts           |
| `/dashboard/driving`       | Driving statistics            |
| `/dashboard/timeactivity`  | Time-based activity           |
| `/dashboard/trip-segments` | Round trip analysis           |

---

## 🔄 State & Data

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Component                                │
│                            │                                    │
│              ┌─────────────┴─────────────┐                      │
│         read │                           │ fetch                │
│              ▼                           ▼                      │
│     ┌────────────────┐          ┌────────────────┐              │
│     │    Redux *     │          │  React Query   │              │
│     │ (user choices) │          │  (API data)    │              │
│     └────────────────┘          └───────┬────────┘              │
│                                         │                       │
│                                         ▼                       │
│                                   ┌───────────┐                 │
│                                   │ AxiosBase │                 │
│                                   └─────┬─────┘                 │
│                                         │                       │
│                                         ▼                       │
│                                   ┌───────────┐                 │
│                                   │  Backend  │                 │
│                                   └───────────┘                 │
│                                                                 │
│  * Redux async thunks also use AxiosBase (rare)                 │
└─────────────────────────────────────────────────────────────────┘
```

### Client State (Redux)

**File:** `components/redux/SimulationSlice.ts`

Stores user selections: vehicles, date range, location, simulation config.

| State Group             | Contents                                |
|-------------------------|-----------------------------------------|
| Vehicle selection       | Selected vehicles for simulation        |
| Date range              | Start/end dates                         |
| Location selection      | Location IDs, departments               |
| Simulation options      | Intelligent allocation, km limits       |
| Settings                | Bike, shift, emission settings          |
| Fleet simulation config | Vehicle counts, extra vehicles          |
| Goal simulation config  | Fixed/test vehicles, CO2/cost goals     |

**Common actions:** `addCar`, `removeCarById`, `setCars`, `setStartDate`, `setEndDate`, `setLocationIds`, `setSimulationSettings`, `setBikeSettings`, `setGoalSimulationVehicles`

### Server State (React Query)

Located in `components/hooks/`. Simulation hooks read Redux state via `useAppSelector` to build API requests. Dashboard hooks accept filter params as arguments. Static data hooks fetch independently.

**Queries:**
`useGetVehicles` · `useGetVehiclesByLocation` · `useGetDrivingData` · `useGetSettings` · `useGetDropDownData` · `useGetLandingPage` · `useGetSimulationHistory` · `useGetStatisticsOverview` · `useGetSummedStatistics` · `useGetFleetSimulation` · `useGetGoalSimulation` · `useGetLocationPrecision` · `useGetUniqueVehicles` · `useAddressSearch`

**Mutations:**

| Hook                     | Purpose                            |
|--------------------------|------------------------------------|
| `useSimulateFleet`       | Start fleet sim + poll (500ms)     |
| `useSimulateGoal`        | Start goal sim + poll + cancel     |
| `usePatchConfigurations` | Update settings                    |
| `usePatchAllShifts`      | Update shifts globally             |
| `patchVehicle`           | Update/delete vehicle              |

**Polling:** Both simulation hooks poll every 500ms while status is `PENDING`, `STARTED`, `PROGRESS`, `RETRY`, or `RECEIVED`.

### HTTP Layer (AxiosBase)

Single Axios instance shared by React Query hooks and Redux async thunks.

- **Development:** `localhost:3001` directly
- **Production:** `/api/fleet/*` → rewritten to `backend:3001` via `next.config.js`

### API Endpoints

```
/api/fleet/
│
├── /configuration
│   ├── /vehicles ........................ GET     List all vehicles
│   ├── /vehicle/{id} .................... PATCH   Update vehicle
│   │                                      DELETE  Delete vehicle
│   ├── /dropdown-data ................... GET     Form options
│   └── /simulation-configurations ....... GET     Get settings
│                                          PATCH   Update settings
│
├── /statistics
│   ├── /driving-data .................... POST    Filtered driving stats
│   ├── /grouped-driving-data ............ POST    Grouped stats
│   ├── /availability .................... POST    Vehicle availability
│   ├── /kpis ............................ GET     Landing page KPIs
│   └── /overview ........................ POST    Dashboard overview
│
├── /fleet-simulation
│   └── /simulation
│       ├── (root) ....................... POST    Start simulation
│       └── /{id} ........................ GET     Get status / result
│
├── /goal-simulation
│   └── /simulation
│       ├── (root) ....................... POST    Start simulation
│       └── /{id} ........................ GET     Get status / result
│                                          DELETE  Cancel
│
├── /simulation-setup
│   ├── /locations ....................... GET     List locations
│   └── /locations-vehicles .............. GET     Vehicles by location
│
└── /location
    ├── (root) ........................... POST    Create location
    └── /{id} ............................ GET     Get location
                                           PATCH   Update location
```

### Error Handling

Error handling is **component-level**, not global. No React error boundaries or Axios interceptors are configured.

**API errors:** Caught with try-catch at call sites using `isAxiosError` type guards:
```typescript
catch (error: unknown) {
    if (isAxiosError(error) && error.response?.status === 422) {
        const errorMessages = matchErrors(error.response.data.detail);
        handleOpenSnackbar(errorMessages, 'error');
    }
}
```

**User feedback:** MUI `Snackbar` + `Alert` for success/error notifications (see `ConfigTable.tsx`, `CreateOrUpdateVehicle.tsx`).

**Backend validation errors:** Mapped via `ErrorFeedback.tsx` which translates error codes to user-friendly messages.

**Error state components:** Located in `components/`:
- `NoConnectionError.tsx` — Network issues
- `NoSolutionError.tsx` — Simulation found no valid solution
- `NoTripsError.tsx` — No driving data in period
- `ApiError.tsx` — Generic API error with retry

---

## 🎨 UI Layer

### Theming

| System   | Primary     | Secondary      | Files                |
|----------|-------------|----------------|----------------------|
| MUI      | `#224bb4`   | `#607fd2`      | `theme.ts`           |
| Tailwind | `blaa`      | `moerkeblaa`   | `tailwind.config.js` |

### Tables

| Library              | Usage                                     |
|----------------------|-------------------------------------------|
| Material React Table | Configuration page (CRUD)                 |
| TanStack React Table | Simulation results (display-only)         |

### Charts (Nivo)

| Component                     | Usage                    |
|-------------------------------|--------------------------|
| `ResponsiveLine`              | Time series, availability|
| `ResponsiveBar`               | Driving stats, emissions |
| `ResponsiveHeatMapCanvas`     | Activity patterns        |
| `ResponsiveScatterPlotCanvas` | Trip segment analysis    |

### Forms

Settings forms use **Formik + Yup**:
- `BikeSettingsForm.tsx` — Bike speed, intervals
- `ShiftSettingsForm.tsx` — Work shifts, overlap rules
- `SimulationSettingsForm.tsx` — Emissions, pricing



