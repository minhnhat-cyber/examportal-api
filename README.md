# ExamPortal API

ExamPortal is an online multiple-choice examination management system for teachers and students. This repository contains the Next.js REST API and MongoDB data layer used by the ExamPortal frontend.

## Team members

- [Nguyen Nhat Minh](https://github.com/minhnhat-cyber)
- Krisdipas Kongsakul

## Project repositories

- [Frontend](https://github.com/minhnhat-cyber/examportal-frontend)
- [REST API](https://github.com/minhnhat-cyber/examportal-api)

## Main data models

- **User** — teacher and student accounts, roles, passwords, and account status
- **Question** — question text, answer choices, correct answer, topic, difficulty, and points
- **Exam** — title, subject, duration, availability, publication status, and selected questions
- **Attempt** — student answers, start and submission times, status, score, and grading result

Questions, exams, and student accounts expose complete create, read, update, and delete operations. Attempts support starting, resuming, saving answers, submission, automatic expiry, grading, and result review.

## Main features

- REST API built with Next.js route handlers
- MongoDB persistence
- Password hashing with bcrypt
- Teacher dashboards, reports, and management endpoints
- Student dashboards, exam lists, profiles, and result history
- Server-side examination deadlines and grading
- Automatic submission after an attempt expires
- Correct answers hidden from students until submission
- CORS configuration for the frontend application

## Technology

- Next.js 16
- React 19
- MongoDB Node.js driver
- bcrypt
- Docker Compose for local MongoDB

## Requirements

- Node.js 20 or later
- npm
- Docker Desktop with Docker Compose, or a compatible MongoDB 8 server

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the example environment file:

   ```bash
   cp .env.example .env.local
   ```

   On Windows PowerShell, use:

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Start MongoDB:

   ```bash
   docker compose up -d
   ```

4. Create the indexes and demonstration data:

   ```bash
   npm run seed
   ```

5. Start the API:

   ```bash
   npm run dev
   ```

The API is available at `http://localhost:3000/backend`.

## Authentication

Sign in with `POST /backend/api/auth/login` using email and password. Sessions use an eight-hour HttpOnly cookie; clients must include credentials. `GET /backend/api/auth/me` returns the signed-in account and `POST /backend/api/auth/logout` revokes its session. Teacher management endpoints require the teacher role; student endpoints use the authenticated student's identity, not a caller-supplied ID. Production requires HTTPS and an exact `FRONTEND_URL` origin.

Seeded demo accounts: `teacher@examportal`, `alice@examportal`, and `john@examportal`, with password `Password123!`. These are for evaluation only: change demo passwords and remove unused accounts before real use. Never rerun the seed against live data because it resets demo accounts and exams.

Run authentication checks with `node --test src/lib/auth.test.js`.

## Environment variables

| Variable | Description | Example |
| --- | --- | --- |
| `MONGODB_URI` | MongoDB connection string | `mongodb://examportal_admin:examportal_local_password@localhost:27017/examportal?authSource=admin` |
| `DB_NAME` | MongoDB database name | `examportal` |
| `FRONTEND_URL` | Allowed frontend origin | `http://localhost:5173` |

Do not commit production credentials or secrets.

## REST API overview

| Resource | Endpoints |
| --- | --- |
| Questions | `GET/POST /api/questions`, `GET/PUT/DELETE /api/questions/:id` |
| Exams | `GET/POST /api/exams`, `GET/PUT/DELETE /api/exams/:id` |
| Students | `GET/POST /api/students`, `GET/PUT/DELETE /api/students/:id` |
| Attempts | `GET/POST /api/attempts`, `GET/PATCH /api/attempts/:id`, `POST /api/attempts/:id/submit` |
| Dashboards | `GET /api/dashboard/teacher`, `GET /api/dashboard/student` |
| Reports | `GET /api/reports/teacher` |
| Profiles | `GET/PUT /api/settings/teacher`, `GET/PUT /api/student/profile` |
| Student views | `GET /api/student/exams`, `GET /api/student/attempts` |

## Production build

```bash
npm run build
npm start
```

Deploy the API and MongoDB on a virtual machine. Restrict MongoDB to the private host/network, configure production environment variables, and expose the API through HTTPS using a reverse proxy.


## Current project scope

The proof of concept focuses on multiple-choice examinations. Webcam monitoring, AI proctoring, video calls, essay grading, and advanced anti-cheating features are outside the committed scope.

## License

This project was created for academic use.

