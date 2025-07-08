# Real-time Voting System

## Overview

This is a real-time voting system designed for classroom environments, built with a modern web stack. The application allows teachers to create interactive polls with image support and students to vote in real-time using QR codes or direct links. The system features live vote counting, result visualization, and social sharing capabilities.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **UI Components**: Radix UI primitives with shadcn/ui design system
- **Styling**: Tailwind CSS with custom theme configuration
- **State Management**: TanStack Query for server state management
- **Animations**: Framer Motion for smooth transitions and visual feedback
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Session Management**: express-session for tracking user votes
- **Storage**: In-memory storage implementation with interface for future database integration
- **API**: RESTful endpoints for question management and voting

### Data Storage Solutions
- **Current**: In-memory storage (MemStorage class) for development and testing
- **Database Schema**: Drizzle ORM with PostgreSQL schema definitions ready for production
- **Session Storage**: Express sessions for preventing duplicate votes

## Key Components

### Core Features
1. **Question Management**: Create questions with image support and multiple choice options
2. **Real-time Voting**: Live vote counting with WebSocket-like polling
3. **QR Code Generation**: Automatic QR code creation for easy student access
4. **Image Tools**: Built-in whiteboard, image annotation, and screenshot upload capabilities
5. **Result Visualization**: Animated progress bars and statistics
6. **Social Sharing**: Share results on Facebook, X (Twitter), and LINE

### Image Handling
- **Screenshot Upload**: Drag-and-drop and clipboard paste support
- **Image Cropping**: React Image Crop integration for precise image editing
- **Whiteboard**: Canvas-based drawing tool with multiple colors and brush sizes
- **Image Annotation**: Overlay drawing on uploaded images with pen/eraser tools

### User Interface
- **Teacher View**: Question creation, QR code display, live results, and control panel
- **Student View**: Mobile-optimized voting interface with visual feedback
- **Floating Advertisement**: Modern gradient-designed promotional button with click protection
- **Responsive Design**: Optimized for both desktop and mobile devices
- **Accessibility**: ARIA labels and keyboard navigation support

## Data Flow

1. **Question Creation**: Teacher uploads image → Creates options → Question stored in memory → QR code generated
2. **Student Voting**: Student scans QR code → Accesses voting page → Submits vote → Session tracked to prevent duplicates
3. **Real-time Updates**: Client polls server every second → Vote counts updated → UI animations triggered
4. **Result Display**: Live progress bars → Percentage calculations → Optional correct answer reveal

## External Dependencies

### Core Libraries
- **React Ecosystem**: React, React DOM, React Router (Wouter)
- **UI Framework**: Radix UI primitives, Tailwind CSS
- **State Management**: TanStack Query for server state
- **Animation**: Framer Motion, Canvas Confetti
- **Image Processing**: React Image Crop, HTML Canvas API
- **QR Codes**: react-qr-code library

### Development Tools
- **Build System**: Vite with React plugin
- **TypeScript**: Full type safety across frontend and backend
- **Database**: Drizzle ORM with PostgreSQL (configured but not yet implemented)
- **Session Management**: connect-pg-simple for production session storage

### External Services
- **Neon Database**: PostgreSQL database service (configured via @neondatabase/serverless)
- **Social Platforms**: Facebook, X, LINE sharing APIs

## Deployment Strategy

### Build Process
- **Frontend**: Vite builds to `dist/public` directory
- **Backend**: esbuild bundles server code to `dist` directory
- **Post-build**: Custom script moves frontend files from `dist/public` to `dist` for Replit deployment

### Production Configuration
- **Static Serving**: Express serves built frontend in production
- **Environment Variables**: DATABASE_URL for PostgreSQL connection
- **Session Security**: Configurable session secrets and cookie settings

### Replit Deployment
- **Build Command**: Custom `build.sh` script handles directory structure
- **Static Files**: Configured for Replit's static deployment expectations
- **Development Mode**: Vite dev server with HMR for local development

## Changelog
- July 08, 2025. Initial setup
- July 08, 2025. Added floating advertisement button with modern gradient design and animations
- July 08, 2025. Implemented secure session-based voting system with duplicate vote prevention
- July 08, 2025. Enhanced privacy with random string IDs for voting URLs
- July 08, 2025. Fixed floating button double-click issue with global click protection mechanism

## User Preferences

Preferred communication style: Simple, everyday language.