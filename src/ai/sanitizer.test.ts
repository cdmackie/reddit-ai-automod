/**
 * Test Suite for ContentSanitizer
 *
 * Comprehensive tests for PII removal and content sanitization functionality.
 * Tests cover all PII types, edge cases, truncation, and batch processing.
 *
 * Run with: npx tsx src/ai/sanitizer.test.ts
 *
 * @module ai/sanitizer.test
 */

import { contentSanitizer } from './sanitizer.js';
import { SanitizationResult } from '../types/ai.js';

// Test utilities
function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ PASSED: ${message}`);
}

function assertEquals(actual: any, expected: any, message: string): void {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    console.error(`❌ FAILED: ${message}`);
    console.error(`   Expected: ${expectedStr}`);
    console.error(`   Actual:   ${actualStr}`);
    throw new Error(message);
  }
  console.log(`✅ PASSED: ${message}`);
}

function assertContains(actual: string, expected: string, message: string): void {
  if (!actual.includes(expected)) {
    console.error(`❌ FAILED: ${message}`);
    console.error(`   Expected "${actual}" to contain "${expected}"`);
    throw new Error(message);
  }
  console.log(`✅ PASSED: ${message}`);
}

function assertNotContains(actual: string, notExpected: string, message: string): void {
  if (actual.includes(notExpected)) {
    console.error(`❌ FAILED: ${message}`);
    console.error(`   Expected "${actual}" to NOT contain "${notExpected}"`);
    throw new Error(message);
  }
  console.log(`✅ PASSED: ${message}`);
}

// Test suites

function testBasicSanitization(): void {
  console.log('\n--- Basic Sanitization Tests ---');

  // Empty string handling
  const empty = contentSanitizer.sanitize('');
  assertEquals(
    empty,
    {
      originalLength: 0,
      sanitizedLength: 0,
      piiRemoved: 0,
      urlsRemoved: 0,
      sanitizedContent: '',
    },
    'Empty string should return zero metrics'
  );

  // No PII in content
  const clean = contentSanitizer.sanitize('Just a normal post with no sensitive data');
  assert(clean.piiRemoved === 0, 'Clean content should have 0 PII removed');
  assert(clean.urlsRemoved === 0, 'Clean content should have 0 URLs removed');
  assertEquals(
    clean.sanitizedContent,
    'Just a normal post with no sensitive data',
    'Clean content should be unchanged'
  );

  // Single email removal
  const singleEmail = contentSanitizer.sanitize('Contact me at john@example.com');
  assertEquals(singleEmail.sanitizedContent, 'Contact me at [EMAIL]', 'Single email replaced');
  assert(singleEmail.piiRemoved === 1, 'Single email: piiRemoved should be 1');
  assert(singleEmail.urlsRemoved === 0, 'Single email: urlsRemoved should be 0');

  // Multiple emails
  const multiEmail = contentSanitizer.sanitize('Emails: john@test.com and jane@example.org');
  assertContains(multiEmail.sanitizedContent, '[EMAIL]', 'Multiple emails replaced');
  assert(multiEmail.piiRemoved === 2, 'Multiple emails: piiRemoved should be 2');
  assertNotContains(multiEmail.sanitizedContent, '@', 'No @ symbols should remain');
}

function testPhoneNumbers(): void {
  console.log('\n--- Phone Number Tests ---');

  // Phone with hyphens
  const phoneHyphen = contentSanitizer.sanitize('Call 555-123-4567');
  assertEquals(phoneHyphen.sanitizedContent, 'Call [PHONE]', 'Phone with hyphens replaced');
  assert(phoneHyphen.piiRemoved === 1, 'Phone with hyphens: piiRemoved should be 1');

  // Phone with dots
  const phoneDot = contentSanitizer.sanitize('Call 555.123.4567');
  assertEquals(phoneDot.sanitizedContent, 'Call [PHONE]', 'Phone with dots replaced');
  assert(phoneDot.piiRemoved === 1, 'Phone with dots: piiRemoved should be 1');

  // Phone without separators
  const phoneNoSep = contentSanitizer.sanitize('Call 5551234567');
  assertEquals(phoneNoSep.sanitizedContent, 'Call [PHONE]', 'Phone without separators replaced');
  assert(phoneNoSep.piiRemoved === 1, 'Phone without separators: piiRemoved should be 1');

  // Multiple phones
  const multiPhone = contentSanitizer.sanitize('555-123-4567 or 555.987.6543');
  assert(multiPhone.piiRemoved === 2, 'Multiple phones: piiRemoved should be 2');
  assertContains(multiPhone.sanitizedContent, '[PHONE]', 'Multiple phones replaced');
}

function testURLs(): void {
  console.log('\n--- URL Tests ---');

  // HTTPS URL
  const https = contentSanitizer.sanitize('Visit https://example.com');
  assertEquals(https.sanitizedContent, 'Visit [URL]', 'HTTPS URL replaced');
  assert(https.urlsRemoved === 1, 'HTTPS: urlsRemoved should be 1');
  assert(https.piiRemoved === 0, 'HTTPS: URLs not counted as PII');

  // HTTP URL
  const http = contentSanitizer.sanitize('Visit http://example.com/path');
  assertEquals(http.sanitizedContent, 'Visit [URL]', 'HTTP URL replaced');
  assert(http.urlsRemoved === 1, 'HTTP: urlsRemoved should be 1');

  // Multiple URLs
  const multiURL = contentSanitizer.sanitize('Links: https://a.com and http://b.com');
  assert(multiURL.urlsRemoved === 2, 'Multiple URLs: urlsRemoved should be 2');
  assertNotContains(multiURL.sanitizedContent, 'http', 'No http should remain');
}

function testCreditCards(): void {
  console.log('\n--- Credit Card Tests ---');

  // Card with spaces
  const cardSpace = contentSanitizer.sanitize('Card: 1234 5678 9012 3456');
  assertEquals(cardSpace.sanitizedContent, 'Card: [CC]', 'Card with spaces replaced');
  assert(cardSpace.piiRemoved === 1, 'Card with spaces: piiRemoved should be 1');

  // Card with hyphens
  const cardHyphen = contentSanitizer.sanitize('Card: 1234-5678-9012-3456');
  assertEquals(cardHyphen.sanitizedContent, 'Card: [CC]', 'Card with hyphens replaced');
  assert(cardHyphen.piiRemoved === 1, 'Card with hyphens: piiRemoved should be 1');

  // Card without separators
  const cardNoSep = contentSanitizer.sanitize('Card: 1234567890123456');
  assertEquals(cardNoSep.sanitizedContent, 'Card: [CC]', 'Card without separators replaced');
  assert(cardNoSep.piiRemoved === 1, 'Card without separators: piiRemoved should be 1');
}

function testSSNs(): void {
  console.log('\n--- SSN Tests ---');

  // Standard SSN format
  const ssn = contentSanitizer.sanitize('SSN: 123-45-6789');
  assertEquals(ssn.sanitizedContent, 'SSN: [SSN]', 'SSN replaced');
  assert(ssn.piiRemoved === 1, 'SSN: piiRemoved should be 1');

  // Multiple SSNs
  const multiSSN = contentSanitizer.sanitize('123-45-6789 and 987-65-4321');
  assert(multiSSN.piiRemoved === 2, 'Multiple SSNs: piiRemoved should be 2');
  assertNotContains(multiSSN.sanitizedContent, '123-45-6789', 'Original SSN should be removed');
}

function testMixedPII(): void {
  console.log('\n--- Mixed PII Tests ---');

  // Email + Phone
  const emailPhone = contentSanitizer.sanitize('Contact john@test.com or 555-123-4567');
  assert(emailPhone.piiRemoved === 2, 'Email + Phone: piiRemoved should be 2');
  assert(emailPhone.urlsRemoved === 0, 'Email + Phone: urlsRemoved should be 0');
  assertContains(emailPhone.sanitizedContent, '[EMAIL]', 'Email replaced');
  assertContains(emailPhone.sanitizedContent, '[PHONE]', 'Phone replaced');

  // All PII types
  const allPII = contentSanitizer.sanitize(
    'Email: john@test.com, Phone: 555-123-4567, SSN: 123-45-6789, Card: 1234 5678 9012 3456, Link: https://test.com'
  );
  assert(allPII.piiRemoved === 4, 'All PII types: piiRemoved should be 4 (email, phone, SSN, card)');
  assert(allPII.urlsRemoved === 1, 'All PII types: urlsRemoved should be 1');
  assertContains(allPII.sanitizedContent, '[EMAIL]', 'All PII: email replaced');
  assertContains(allPII.sanitizedContent, '[PHONE]', 'All PII: phone replaced');
  assertContains(allPII.sanitizedContent, '[SSN]', 'All PII: SSN replaced');
  assertContains(allPII.sanitizedContent, '[CC]', 'All PII: card replaced');
  assertContains(allPII.sanitizedContent, '[URL]', 'All PII: URL replaced');
}

function testTruncation(): void {
  console.log('\n--- Truncation Tests ---');

  // Exactly 5000 characters
  const exactly5000 = contentSanitizer.sanitize('a'.repeat(5000));
  assert(exactly5000.originalLength === 5000, 'Original length should be 5000');
  assert(exactly5000.sanitizedLength === 5000, 'Sanitized length should be 5000');
  assertNotContains(exactly5000.sanitizedContent, '[truncated]', 'Should not be truncated at 5000');

  // 5001 characters (should truncate)
  const over5000 = contentSanitizer.sanitize('a'.repeat(5001));
  assert(over5000.originalLength === 5001, 'Original length should be 5001');
  assert(
    over5000.sanitizedLength === 5000 + '... [truncated]'.length,
    'Sanitized length should be 5000 + suffix'
  );
  assertContains(over5000.sanitizedContent, '... [truncated]', 'Should include truncation suffix');

  // Very long content (10000 chars)
  const veryLong = contentSanitizer.sanitize('b'.repeat(10000));
  assert(veryLong.originalLength === 10000, 'Original length should be 10000');
  assert(
    veryLong.sanitizedLength === 5000 + '... [truncated]'.length,
    'Very long content should truncate to 5000 + suffix'
  );
  assertContains(veryLong.sanitizedContent, '... [truncated]', 'Very long: should include suffix');

  // Truncation with PII
  const longWithPII = contentSanitizer.sanitize('a'.repeat(4980) + ' email@test.com ' + 'b'.repeat(100));
  assertContains(longWithPII.sanitizedContent, '[EMAIL]', 'Email should be replaced before truncation');
  assert(longWithPII.piiRemoved === 1, 'PII should be counted even if content truncated');
}

function testPostHistory(): void {
  console.log('\n--- Post History Tests ---');

  // Empty array
  const emptyArray = contentSanitizer.sanitizePostHistory([]);
  assertEquals(emptyArray.sanitized, [], 'Empty array should return empty array');
  assert(emptyArray.result.piiRemoved === 0, 'Empty array: piiRemoved should be 0');

  // Single post with PII
  const singlePost = contentSanitizer.sanitizePostHistory(['Email me at test@example.com']);
  assertEquals(singlePost.sanitized, ['Email me at [EMAIL]'], 'Single post email replaced');
  assert(singlePost.result.piiRemoved === 1, 'Single post: piiRemoved should be 1');

  // Multiple posts with different PII
  const multiPosts = contentSanitizer.sanitizePostHistory([
    'Post 1: email@test.com',
    'Post 2: 555-123-4567',
    'Post 3: https://test.com',
  ]);
  assert(multiPosts.sanitized.length === 3, 'Should preserve array length');
  assertContains(multiPosts.sanitized[0], '[EMAIL]', 'First post email replaced');
  assertContains(multiPosts.sanitized[1], '[PHONE]', 'Second post phone replaced');
  assertContains(multiPosts.sanitized[2], '[URL]', 'Third post URL replaced');
  assert(multiPosts.result.piiRemoved === 2, 'Multiple posts: piiRemoved should be 2 (email, phone)');
  assert(multiPosts.result.urlsRemoved === 1, 'Multiple posts: urlsRemoved should be 1');

  // Post history preserves array length
  const fivePosts = contentSanitizer.sanitizePostHistory([
    'Post 1',
    'Post 2',
    'Post 3',
    'Post 4',
    'Post 5',
  ]);
  assert(fivePosts.sanitized.length === 5, 'Should preserve 5-post array length');
}

function testEdgeCases(): void {
  console.log('\n--- Edge Case Tests ---');

  // Email-like but not valid
  const notEmail = contentSanitizer.sanitize('test@com');
  // This might actually match depending on regex - document behavior
  // Our regex requires at least 2 chars in TLD, so test@com should NOT match
  assertNotContains(notEmail.sanitizedContent, '[EMAIL]', 'Invalid email should not be replaced');

  // Numbers that aren't PII
  const justNumbers = contentSanitizer.sanitize('I have 1234 items');
  assertEquals(justNumbers.sanitizedContent, 'I have 1234 items', 'Regular numbers unchanged');
  assert(justNumbers.piiRemoved === 0, 'Regular numbers: no PII removed');

  // Partial phone numbers (too short)
  const partialPhone = contentSanitizer.sanitize('Call 123-45-67');
  // This is 7 digits in XXX-XX-XX format, could match SSN pattern partially, but shouldn't
  // Let's verify it doesn't match our patterns
  assertNotContains(partialPhone.sanitizedContent, '[PHONE]', 'Partial phone should not match');

  // Unicode and special characters
  const unicode = contentSanitizer.sanitize('Email: tëst@example.com 📧');
  assertContains(unicode.sanitizedContent, '[EMAIL]', 'Unicode email should be replaced');
  assertContains(unicode.sanitizedContent, '📧', 'Emoji should be preserved');

  // Mixed case email
  const mixedCase = contentSanitizer.sanitize('Contact JOHN@EXAMPLE.COM');
  assertContains(mixedCase.sanitizedContent, '[EMAIL]', 'Mixed case email should be replaced');

  // Multiple spaces in content
  const spaces = contentSanitizer.sanitize('Email:  test@example.com  Phone: 555-123-4567');
  assertContains(spaces.sanitizedContent, '[EMAIL]', 'Email with spaces replaced');
  assertContains(spaces.sanitizedContent, '[PHONE]', 'Phone with spaces replaced');

  // Content with only whitespace
  const whitespace = contentSanitizer.sanitize('   ');
  assert(whitespace.piiRemoved === 0, 'Whitespace: no PII removed');
  assertEquals(whitespace.sanitizedContent, '   ', 'Whitespace preserved');
}

function testPerformance(): void {
  console.log('\n--- Performance Tests ---');

  // Large post history (100 posts)
  const startLarge = Date.now();
  const largePosts = Array(100)
    .fill('This is a test post with email@test.com and phone 555-123-4567');
  const largeResult = contentSanitizer.sanitizePostHistory(largePosts);
  const largeDuration = Date.now() - startLarge;
  assert(largeDuration < 1000, `100 posts should complete in <1s (took ${largeDuration}ms)`);
  // Note: 100 posts will exceed 5000 chars, so array will be shorter after truncation
  assert(largeResult.sanitized.length > 0, '100 posts: result should have some posts');
  assert(largeResult.result.piiRemoved > 0, '100 posts: should detect PII');

  // Content with many URLs (100 URLs for reasonable test time)
  const startURLs = Date.now();
  const manyURLs = Array(100).fill('https://example.com').join(' ');
  const urlResult = contentSanitizer.sanitize(manyURLs);
  const urlDuration = Date.now() - startURLs;
  assert(urlDuration < 1000, `100 URLs should complete in <1s (took ${urlDuration}ms)`);
  assert(urlResult.urlsRemoved === 100, '100 URLs should be removed');

  console.log(`   Performance: 100 posts in ${largeDuration}ms, 100 URLs in ${urlDuration}ms`);
}

// Main test runner
export function runTests(): void {
  console.log('=== ContentSanitizer Test Suite ===');

  try {
    testBasicSanitization();
    testPhoneNumbers();
    testURLs();
    testCreditCards();
    testSSNs();
    testMixedPII();
    testTruncation();
    testPostHistory();
    testEdgeCases();
    testPerformance();

    console.log('\n=== ✅ All tests passed! ===\n');
  } catch (error) {
    console.error('\n=== ❌ Test suite failed ===');
    console.error(error);
    process.exit(1);
  }
}

// Run tests if executed directly (check for direct execution)
// Note: This works when running with tsx/node but may not work in all environments
try {
  // @ts-ignore - import.meta.url is supported in ESM but TypeScript might complain
  if (typeof import.meta !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
    runTests();
  }
} catch {
  // Fallback: if this file is being run directly, process.argv[1] will contain this file path
  if (process.argv[1]?.includes('sanitizer.test')) {
    runTests();
  }
}
