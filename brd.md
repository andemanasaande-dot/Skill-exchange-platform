SkillSwap
1. Business Requirements Document (BRD)
Project Name

SkillSwap – Peer-to-Peer Skill Exchange Platform

Objective

Provide a web-based platform where users can share their skills, discover skills offered by others, and connect with people for peer-to-peer learning in a secure and user-friendly environment.

Functional Requirements
User Authentication
Users must be able to register with their email and password.
Users must be able to log in securely.
Passwords must be encrypted.
Users can log out securely.
User Profile Management

Users must be able to:

Add their Name
Upload a Profile Picture
Write a Bio
Add Skills They Can Teach
Add Skills They Want to Learn
Edit profile information anytime.
Skill Management

Users must be able to:

Add new skills.
Edit skills.
Delete skills.
View all available skills.
Skill Categories

Users can browse skills under categories such as:

Programming
Music
Languages
Art
Sports
Cooking
Photography
Search & Filter

Users must be able to:

Search skills by keyword.
Filter skills by category.
View matching search results.
Skill Exchange Requests

Users must be able to:

Send exchange requests.
Accept requests.
Reject requests.
View request status.
Messaging

Users can communicate through private chat only after a request has been accepted.

Notifications

Users receive notifications for:

New exchange requests
Accepted requests
New messages
Non-Functional Requirements
Security
Passwords must be hashed using Bcrypt.
Authentication must use JWT.
Protected API routes.
Performance
Search results should load within 2 seconds.
API response time should be minimal.
Scalability

The application should support thousands of concurrent users.

Responsiveness

The application must work properly on

Desktop
Tablet
Mobile
Availability

System availability should be 99%.
