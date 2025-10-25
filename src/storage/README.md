# Storage Layer

This directory contains Redis storage abstraction and data access logic.

## Structure

- `redis.ts` - Redis client wrapper
- `rules.ts` - Rule storage and retrieval
- `stats.ts` - Statistics and analytics storage
- `cache.ts` - General-purpose caching
- `audit.ts` - Audit log storage

## Purpose

Abstracts all data storage operations using Devvit's built-in Redis. Provides type-safe access to configuration, rules, statistics, and audit logs.
