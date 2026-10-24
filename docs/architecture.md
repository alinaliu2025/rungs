# Architecture

## System

```mermaid
flowchart TB
  subgraph Browser["Browser: client/ (React + React Router, built by Vite)"]
    UIS[Student views<br/>feed · profile · join · my team]
    UIC[Company views<br/>survey · CSV import · your challenges · team metrics · simulator]
    UIR[Reviewer views<br/>review queue · simulator]
  end

  subgraph Server["Node + Express 5: server/"]
    AUTH[auth.js<br/>scrypt · session cookie · role guards]
    API[app.js<br/>REST routes]
    MATCH[matching.js<br/>feed scoring + reasons]
    TEAMS[teams.js<br/>snake draft + hill-climb]
    LIFE[lifecycle.js<br/>every 60s: close sign-ups,<br/>form teams]
  end

  DB[(SQLite via node:sqlite<br/>data/rungs.db)]

  UIS & UIC & UIR -->|fetch /api/*| AUTH --> API
  API --> MATCH
  API --> TEAMS
  API --> DB
  LIFE --> TEAMS
  LIFE --> DB
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
  profiles { int user_id string major int grad_year int hours_per_week string preferred_role json skills json interests }
  challenges { int id string company_name string status string source string review_note string format string mode int team_size int hours_per_week json skills json tags string status bool teams_formed string signup_deadline string starts_at string ends_at string timezone int max_participants }
  registrations { int challenge_id int user_id string note }
  teams { int id int challenge_id string name json metrics }
```

`teams.metrics` is internal only. No student-facing route returns it.

## Challenge lifecycle

Every survey post or CSV import starts as `pending`. A reviewer approves it (`published`) or rejects it with a note (`rejected`). For published challenges, the phase is worked out from the dates (`server/time.js`).

```mermaid
stateDiagram-v2
  [*] --> pending: survey or CSV import
  pending --> open: reviewer approves
  pending --> rejected: reviewer rejects (note required)
  open --> open: students join / leave (capacity + overlap checks)
  open --> locked: sign-up deadline (teams auto-formed)
  locked --> live: starts_at
  live --> ended: ends_at
```

The posting company, if it has an account, can close sign-ups early, which moves the deadline to now and forms teams. It can also re-sort while the challenge is `locked`.

## Who can see what

| Data | Student | Company (owner) | Reviewer | Anyone |
|---|---|---|---|---|
| Published challenges | ✓ | ✓ | ✓ | ✓ |
| Submit / import challenges (go to review) | ✓ | ✓ (owns them) | ✓ | ✓ (no owner) |
| Pending / rejected challenges + review notes | | own | ✓ | |
| Approve / reject | | | ✓ | |
| Personal feed + reasons | own | | | |
| Own team (names, majors, grad year, roles) | ✓ | | | |
| All teams + metrics + skill levels | | ✓ | | |
| Team simulator | | ✓ | ✓ | |

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
| POST | `/api/challenges` | anyone (lands in review) |
| POST | `/api/challenges/import` `{rows, dry_run}` | anyone (≤100 rows; valid rows land in review) |
| GET | `/api/review/challenges` | reviewer |
| POST | `/api/review/challenges/:id` `{decision, note}` | reviewer |
| POST | `/api/simulate` | company, reviewer |
| GET | `/api/company/challenges` | company |
| POST | `/api/company/challenges/:id/form-teams` | owning company |
| GET | `/api/challenges/:id/teams` | owning company |
