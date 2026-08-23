2. Technical Design Document (TDD)
A. Tech Stack
Frontend
React (Vite)
Tailwind CSS
Backend
Node.js
Express.js
Database
PostgreSQL
Prisma ORM
Authentication
JWT
Bcrypt
B. API Design
Method	Endpoint	Description
POST	/api/auth/register	Register new user
POST	/api/auth/login	Login user
GET	/api/profile	Get user profile
PUT	/api/profile	Update profile
GET	/api/skills	Get all skills
POST	/api/skills	Add a skill
PUT	/api/skills/:id	Update skill
DELETE	/api/skills/:id	Delete skill
GET	/api/skills/category/:category	View skills by category
POST	/api/request	Send exchange request
PUT	/api/request/:id	Accept/Reject request
GET	/api/messages	Get messages
POST	/api/messages	Send message
GET	/api/notifications	Get notifications
C. Database Schema (Prisma)
User
id
name
email
password
bio
profileImage
Skill
id
title
category
description
userId
SkillRequest
id
senderId
receiverId
skillId
status
Message
id
senderId
receiverId
message
timestamp
Notification
id
userId
title
type
isRead
createdAt
D. Implementation Strategy
Phase 1 (Database)
Design PostgreSQL database.
Create Prisma models.
Apply migrations.
Test database connection.
Phase 2 (Backend)

Develop REST APIs for

Authentication
User Profile
Skills
Skill Requests
Messaging
Notifications
Phase 3 (Frontend)

Develop

Login Page
Register Page
Dashboard
User Profile
Skill Listing
Search & Filter
Chat Page
Notifications Page
Phase 4 (Deployment)

Deploy

Frontend: Vercel
Backend: Render / Railway
Database: PostgreSQL
Sprint 1 – Infrastructure & Authentication
Goal

Prepare the development environment and implement secure authentication.

Story 1: Database Setup

As a Developer, I want to create the database schema so that user and skill information can be stored.

Acceptance Criteria
Prisma schema created.
PostgreSQL connected.
Migration completed successfully.
Story 2: User Registration

As a User, I want to register so that I can access the platform.

Acceptance Criteria
Password encrypted using Bcrypt.
User stored successfully.
Returns HTTP Status 201.
Story 3: User Login

As a User, I want to log in securely.

Acceptance Criteria
JWT token generated.
Invalid login returns HTTP 401.
Sprint 2 – Core Features
Goal

Allow users to share skills and connect with other learners.

Story 4: Create Skill

As a User, I want to add a skill I can teach.

Acceptance Criteria
Skill saved successfully.
Category selected.
Skill linked to logged-in user.
Story 5: Search Skills

As a User, I want to search and filter skills.

Acceptance Criteria
Search by skill name.
Filter by category.
Accurate search results displayed.
Story 6: Send Skill Exchange Request

As a User, I want to request learning from another user.

Acceptance Criteria
Request stored successfully.
Receiver notified.
Duplicate requests prevented.
Sprint 3 – Messaging & Quality
Goal

Complete communication features and ensure application quality.

Story 7: Messaging

As a User, I want to chat with another user after my request is accepted.

Acceptance Criteria
Messages stored in the database.
Real-time chat updates.
Only accepted users can chat.
Story 8: Notifications

As a User, I want notifications for requests and messages.

Acceptance Criteria
Notifications appear instantly.
Notifications can be marked as read.
Story 9: Testing & Bug Fixes

As a Team, we want to verify that the application works correctly.

Acceptance Criteria
APIs tested successfully.
No console errors.
Documentation completed.
Responsive UI verified.
All major bugs resolved.
