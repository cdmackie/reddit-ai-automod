# Event Handlers

This directory contains Reddit event handlers that respond to various Reddit events.

## Structure

- `postSubmit.ts` - Handles new post submissions
- `commentSubmit.ts` - Handles new comment submissions
- `reportSubmit.ts` - Handles user reports
- `scheduled.ts` - Scheduled jobs for periodic tasks

## Purpose

Event handlers are the entry points for all moderation actions. They receive Reddit events and pass them to the rule engine for processing.
