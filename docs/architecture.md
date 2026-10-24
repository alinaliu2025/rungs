# Architecture

## System

```mermaid
flowchart TB
  subgraph Browser["Browser: public/ (vanilla JS SPA, hash routes)"]
    UIS[Student views<br/>feed · profile · join · my team]
    UIC[Company views<br/>challenge survey · status]
    UIA[Admin views<br/>publish · form teams · team metrics]
  end

  subgraph Server["Node + Express 5: server/"]
    AUTH[auth.js<br/>scrypt · session cookie · role guards]
    API[app.js<br/>REST routes]
    MATCH[matching.js<br/>feed scoring + reasons]
    TEAMS[teams.js<br/>snake draft + hill-climb]
  end

  DB[(SQLite via node:sqlite<br/>data/rungs.db)]

  UIS & UIC & UIA -->|fetch /api/*| AUTH --> API
  API --> MATCH
  API --> TEAMS
  API --> DB
```

## Data model

```mermaid
erDiagram
  users ||--o| profiles : "student has"
  users ||--o{ sessions : has
  users ||--o{ challenges : "company posts"
  challenges ||--o{ registrations : ""
  users ||--o{ registrations : "student joins"
  challenges ||--o{ teams : ""
  teams ||--o{ team_members : ""
  users ||--o{ team_members : ""

  users { int id string email string role string name }
  profiles { int user_id string major int hours_per_week string preferred_role json skills json interests }
  challenges { int id string format string mode int team_size int hours_per_week json skills json tags string status bool teams_formed }
  registrations { int challenge_id int user_id string note }
  teams { int id int challenge_id string name json metrics }
```

`teams.metrics` is internal only. No student-facing route returns it.

## Challenge lifecycle

```mermaid
stateDiagram-v2
  [*] --> pending: company submits survey
  pending --> published: admin publishes
  published --> published: students join / leave
  published --> teams_set: admin forms teams (team mode)
  teams_set --> teams_set: admin re-sorts
```

## Who can see what

| Data | Student | Company (owner) | Admin |
|---|---|---|---|
| Published challenges | ✓ | ✓ | ✓ |
| Personal feed + reasons | own | | |
| Own team (names, majors, roles) | ✓ | | |
| All teams + metrics + skill levels | | ✓ | ✓ |
| Pending challenges | | own | ✓ |

## API

| Method | Path | Role |
|---|---|---|
| POST | `/api/auth/signup` · `/login` · `/logout` | public |
| GET | `/api/me` · `/api/meta` | public |
| PUT | `/api/profile` | student |
| GET | `/api/challenges?format=mini\|project` | public |
| GET | `/api/challenges/recommended` | student |
| GET | `/api/challenges/:id` | public (adds `joined`, `myTeam` for students) |
| POST/DELETE | `/api/challenges/:id/join` | student |
| GET | `/api/my/challenges` | student |
| POST/GET | `/api/company/challenges` | company |
| GET | `/api/admin/challenges` | admin |
| POST | `/api/admin/challenges/:id/publish` | admin |
| POST | `/api/admin/challenges/:id/form-teams` | admin |
| GET | `/api/challenges/:id/teams` | admin, owning company |
