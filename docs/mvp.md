Insurance Agency CRM System - MVP Requirements Document
Project Name: Insurance Agency Telemarketing CRM
Version: 1.0 (MVP)
Date: November 15, 2025
Document Type: System Requirements Specification
Executive Summary
This document outlines the requirements for building an MVP CRM system for an insurance agency that sells life insurance through telemarketing. The system manages the complete lead lifecycle from call center submission through sales conversion and carrier integration.
Core Objectives
Lead Management: Capture and route leads from call centers to appropriate sales teams
Dynamic Pipeline Management: Track leads through configurable stages and pipelines
Multi-Role Access: Support call centers, sales agents, managers with role-based permissions
Carrier Integration: Daily updates from insurance carriers with dynamic field mapping
Real-time Notifications: Keep all stakeholders informed of lead status changes
Drive Link:
https://drive.google.com/drive/folders/1IrNmtYwKcpTGYvrCcVVJ2jiXfovM7NWM?usp=sharing










1. System Architecture Overview
Technology Stack
Component
Technology
Purpose
Frontend
Next.js 14+ (App Router)
User interface and application logic
Backend
Supabase (PostgreSQL + Auth)
Database, authentication, real-time subscriptions
Hosting
Vercel
Frontend deployment and serverless functions
File Storage
Supabase Storage
Document and recording storage
Real-time
Supabase Realtime
Live updates and notifications
API Layer
Next.js API Routes + Supabase Edge Functions
Business logic and integrations
























2. User Roles & Permissions
2.1 Role Definitions
Call Center Agent
Access Level: Limited
Permissions:
Submit new leads via form
View their own submitted leads
Call Center Admin
Access Level: Medium
Permissions:
View all leads from their own center
Manage call center agents
View center performance metrics (dashboard)
Access pipeline views for center leads 
Can view lead details + notes + updates carrier
Training and guide section











Sales Manager
Access Level: High
Permissions:
View + create + edit + delete all leads + their details 
View team performance dashboards
Access all call recordings 
Daily deal flow sales performance 
Generate multiple reports 
Training plan for agents 
Create REMOVE onboarding for new sales agent, buffer agent, license agent, retention agent
Can view/edit carrier deals tracker 
Can view/edit commission tracker 
Pages:
A page to configure carrier product type and licensed agents buffer agents, in the systems. That will be used throughout the systems in dropdown etc.
A new page to manage daily deal flow. 








Sales Agent (Licensed)
Access Level: Medium
Permissions:
View all leads submitted by publishers. 
View their own performance metrics
Can view their own commission metrics 
Can do lead/call Verification + disposition 

Sales Agent (Unlicensed)
Access Level: Limited Sales
Permissions:
View all leads submitted by publishers. 
Can do lead/call Verification + disposition 
System Administrator
Access Level: Full
Permissions:
Manage all users and roles
Configure pipelines and stages
Set up carrier integrations
Configure routing rules
Access all system data
Access all lead system 
Access reports, dashboards, team performance, commission , HR


HR
Access Level: medium
Permissions:
Can create/update/delete user in system and assign them role 




Accounting
Access Level: Limited
Permissions:
View update deal tracker 
View daily deal flow 
View update commission tracker
Can view manage leads 


































3. Functional Requirements
3.1 Lead Submission Module (Call Centers)
FR-LS-001: Lead Capture Form
Description: Call center agents submit leads through a comprehensive form
Required Fields:
Personal Information


Full Name (First, Last, Middle)
Date of Birth (calendar picker)
Age (auto calculate from dob)
Social Security Number  (validation)
Driver License Number
Phone Number
Email Address
Full Address (Street, City, State, ZIP)
Birth State (dropdown american/us )
Medical Information


Height (text)
Weight (text)
Doctor's Name
Tobacco Use (Yes/No)
Health Conditions (Text Area)
Current Medications (Text Area)
Existing Coverage (TEXT AREA)
Previous Applications (in last 2 years) (boolean)
Insurance Details


Desired Coverage Amount (input)
Monthly Premium Budget 
Preferred Carrier (Dropdown from carrier)
Product Type (dropdown)
Draft Date (date picker)
Future Draft Date (date picker)
Beneficiary Information


Beneficiary Name
Beneficiary Phone
Beneficiary Relationship
Beneficiary Information (Additional)
Banking Information


Bank/Institution Name
Routing Number 
Account Number
Call Center Metadata


Call Center ID
Call Center Agent User ID
Submission Date/Time
Customer Buying Motive
Additional Notes
FR-LS-002: Real-time Form Validation
Validate SSN format (XXX-XX-XXXX)
Validate phone numbers
Validate email format
Validate routing/account numbers
Required field enforcement
Age calculation from DOB
FR-LS-003: Duplicate Detection
Check for duplicate SSN
Check for duplicate phone + name combination
Show warning if potential duplicate found
Allow override with justification
FR-LS-004: Auto-save Draft
Auto-save form data every 30 seconds
Allow agents to resume incomplete submissions
Clear draft after successful submission



AUTOSAVE FORM/ DRAFT FUNCTIONALITY





3.2 Lead Routing Module
FR-LR-001: Automatic Lead Assignment
Description: System automatically routes leads to appropriate sales team based on rules
Routing Criteria:
Primary: Customer State


Map states to specific sales teams
Support multi-state assignments
Secondary: Insurance Carrier


Route to agents licensed for specific carriers
Carrier-agent mapping table
Tertiary: Agent Availability


Round-robin distribution
Workload balancing (lead count per agent)
Agent capacity limits
Quaternary: Lead Value


High-value leads to senior agents
Configurable value thresholds
FR-LR-002: Manual Assignment Override
Sales managers can reassign leads
Reassignment requires reason/note
Track reassignment history
Notify affected agents
FR-LR-003: Lead Pool Management
Unassigned leads pool
Auto-assignment from pool when agent available
Manager can claim leads from pool






3.3 Dynamic Pipeline Management
FR-PM-001: Pipeline Configuration
Description: System supports three main pipelines with dynamic stages
Pipeline Types:
Transfer Pipeline


Purpose: Track lead qualification and initial contact
Default Stages (Configurable):
New Lead
Contacted
Qualified
Not Qualified
Callback Scheduled
No Answer
Do Not Call
Converted
Lost
Customer Pipeline


Purpose: Track converted customers through application process
Default Stages:
Application Started
Application Submitted
Underwriting Review
Medical Exam Required
Medical Exam Completed
Approved
Policy Issued
Active Policy
Lapsed
Chargeback Pipeline


Purpose: Track problematic policies/cancellations
Default Stages:
Chargeback Received
Under Investigation
Customer Contact Attempted
Resolution in Progress
Resolved - Reinstated
Resolved - Closed
Written Off
FR-PM-002: Dynamic Stage Management
Admin can add/remove stages
Admin can reorder stages
Each stage has:
Name
Color (for visual distinction)
Description
Required actions before moving forward
Auto-transition rules (optional)
Notification triggers
FR-PM-003: Stage Transition Rules
Define which stages can transition to which
Require fields/actions before transition
Trigger notifications on transition
Log all stage changes with timestamp and user
FR-PM-004: Pipeline Views
Kanban board view (drag-and-drop)
List view (filterable/sortable)
Calendar view (for scheduled callbacks)
Timeline view (lead history)



















3.4 Lead Management Module
FR-LM-001: Lead Detail Page
Description: Comprehensive view of all lead information
Sections:
Lead Summary


Current pipeline and stage
Lead value/priority
Assigned owner
Creation date
Last activity date
Days in current stage
Contact Information


All personal details
Communication history
Contact preferences
Medical Profile


All health-related information
Risk assessment score (calculated)
Insurance Details


Coverage preferences
Quote history
Carrier information
Activity Timeline


All interactions (calls, emails, notes)
Stage transitions
Ownership changes
System events
Notes Section


Add/view notes
Rich text editor
Tag important notes
Search within notes
Call Recordings


List of all recorded calls
Play/download recordings
Transcription (future enhancement)
Documents


Upload/view documents
Application forms
Medical records
Policy documents
Related Records


Family members (potential cross-sell)
Existing policies
Previous applications
FR-LM-002: Lead Value Calculation
Auto-calculate based on coverage amount
Adjust based on conversion probability
Display prominently in UI
Filter/sort by value
FR-LM-003: Lead Ownership
Clear owner assignment
Transfer ownership workflow
Track ownership history
Notify on ownership change
FR-LM-004: Notes Management
Add notes with timestamp
Tag notes (Important, Follow-up, etc.)
Pin important notes to top
Note visibility (private vs team)
@mention team members in notes
FR-LM-005: Activity Logging
Auto-log all lead interactions
Manual activity entry
Activity types:
Inbound call
Outbound call
Email sent/received
SMS sent/received
Meeting scheduled
Document uploaded
Stage changed
Note added

3.5 Sales Team Module
FR-ST-001: Sales Dashboard
Description: Agent dashboard showing their work queue
Dashboard Widgets:
My Leads (Categorized)


New leads (uncontacted)
Follow-ups due today
Callbacks scheduled
Hot leads (high priority)
Stale leads (no activity > 7 days)
Performance Metrics


Leads assigned (this week/month)
Leads contacted
Conversion rate
Average response time
Revenue generated
Quick Actions


Call next lead
Add note
Schedule callback
Move to stage
Pipeline Overview


Leads by stage
Pipeline velocity
Stage conversion rates




FR-ST-003: Callback Scheduling
Schedule follow-up calls
Set date, time, and reason
Add to agent's calendar
Reminder notifications
Recurring callback options
Bulk reschedule capability
FR-ST-004: Lead Conversion
"Convert to Customer" action
Moves lead from Transfer to Customer Pipeline
Assign policy number (manual entry)
Set policy details:
Carrier
Product type
Coverage amount
Monthly premium
Policy start date
Commission amount
FR-ST-005: Mobile-Responsive Interface
Optimized for tablets
Quick actions accessible
One-hand operation friendly
Offline capability (view cached leads)














3.6 Carrier Integration Module
FR-CI-001: Policy Assignment
Description: When lead converts, assign carrier policy
Policy Data:
Carrier Name (from predefined list)
Policy Number (unique identifier)
Product Type
Coverage Amount
Monthly Premium
Policy Start Date
Policy Status (Active/Pending/Lapsed)
Commission Amount
Commission Status (Pending/Paid)
Next Premium Due Date
FR-CI-002: Dynamic Carrier Update Fields
Description: System supports carrier-specific update fields
Configuration:
Admin defines carrier-specific fields
Each carrier can have different update schema
Example fields:
Policy Status
Premium Payment Status
Coverage Changes
Beneficiary Updates
Medical Exam Status
Underwriting Decision
Lapse Date
Reinstatement Date
Cancellation Reason




FR-CI-003: Daily Carrier Updates
Description: Process daily update files from carriers
Update Process:
File Upload


Support CSV/Excel formats
Manual upload or API integration
FTP/SFTP scheduled imports
Field Mapping


Map carrier file columns to system fields
Save mapping configurations per carrier
Handle missing/extra columns gracefully
Data Processing


Match records by policy number
Update lead/customer records
Flag unmatched records
Validation and error handling
Update History


Log all updates with timestamp
Track field changes (before/after)
Audit trail for compliance
Notifications


Notify owners of status changes
Alert managers of chargebacks
Daily summary report
FR-CI-004: Chargeback Detection
Auto-detect chargeback indicators:
Policy cancelled within X days
Specific status codes
Premium refund processed
Automatically move to Chargeback Pipeline
Calculate chargeback amount
Notify relevant parties


3.7 Data Access & Permissions
FR-DA-001: Call Center Data Isolation
Each call center sees only their own leads
Filter all queries by center ID
Row-level security in database
Cannot view other centers' data
FR-DA-002: Sales Agent Data Access
View only assigned leads
View team leads if manager
Cannot access unassigned leads (except pool)
Cannot view other teams' leads
FR-DA-003: Manager Overrides
Sales managers: View all sales team data
Call center managers: View all center data
System admin: View all data
Audit log for admin access
FR-DA-004: Export Restrictions
Users can export only their accessible data
Exports include watermark/timestamp
Log all exports for compliance
Rate limit exports to prevent abuse















3.8 Notification System
FR-NS-001: Real-time Notifications
Description: Keep users informed of important events.
Notification Types:
For Call Center Manager:


When a call agent submits a lead we show that notification to him (new transfer has been submitted)
In slack channel we send the notification too (two one about lead info + along with a button to open the lead info directly from slack.
Another notification in which we will show recommendations on this lead will go to which agent. 

For Sales Agents:
When a call agent submits a lead we show that notification to him (new transfer has been submitted)
In slack channel we send the notification too (two one about lead info + along with a button to open the lead info directly from slack.
Another notification in which we will show recommendations on this lead will go to which agent. 

For Sales Managers:


When a call agent submits a lead we show that notification to him (new transfer has been submitted)
In slack channel we send the notification too (two one about lead info + along with a button to open the lead info directly from slack.
Another notification in which we will show recommendations on this lead will go to which agent. 





Notification Channels:
In-app notifications (bell icon)
Slack notifications
FR-NS-003: Notification Center
Central inbox for all notifications
Mark as read/unread
Click to navigate to relevant record
Filter by type/date
Archive old notifications
3.9 Admin System
FR-NS-001: Create Users
Description: Manage users (we need email and password we will create ourselves)
If User is a publisher we create a slack channel (saving channel id in db)




4.0 Verification Panel
FR-NS-001: Verify Submission Data
Description: Validate submitted customer data before it proceeds to downstream workflows.
On form submission, the system performs required-field and format checks.
Address is validated through USPS and normalized to a standard format.
USPS deliverability/correction response is stored with the record.
Phone number is validated for structure and usability
If validation passes, record status is set to Verified.
If validation fails, the user is prompted to correct and resubmit.
On resubmission, verification runs again automatically.
Verified records are then available for quoting/underwriting/follow-up.


Call update Form:



