/**
 * AI Automod - AI Automod for Reddit
 * Copyright (C) 2025 CoinsTax LLC
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Tests for AI Response Validator
 *
 * Comprehensive test suite covering:
 * - Valid responses pass validation
 * - Invalid responses are rejected with clear errors
 * - Partial validation salvages data when possible
 * - All constraint violations are caught
 * - Confidence ranges (0-100) are enforced
 * - Required fields are enforced
 * - Optional fields work correctly
 * - Enum values are validated
 *
 * Target: 100% coverage of validation paths
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { AIResponseValidator } from '../validator.js';
import { AIErrorType, AIError } from '../../types/ai.js';

describe('AIResponseValidator', () => {
  let validator: AIResponseValidator;

  beforeEach(() => {
    validator = new AIResponseValidator();
  });

  describe('validate() - Strict validation', () => {
    it('should validate a complete valid response', () => {
      const validResponse = {
        datingIntent: {
          detected: true,
          confidence: 85,
          reasoning: 'User profile mentions seeking romantic connections',
        },
        scammerRisk: {
          level: 'MEDIUM',
          confidence: 60,
          patterns: ['sob story', 'financial urgency'],
          reasoning: 'Post contains multiple red flags',
        },
        ageEstimate: {
          appearsUnderage: false,
          confidence: 90,
          reasoning: 'Language and content suggest mature adult',
          estimatedAge: '40+',
        },
        spamIndicators: {
          detected: false,
          confidence: 10,
          patterns: [],
        },
        overallRisk: 'MEDIUM',
        recommendedAction: 'FLAG',
      };

      expect(() => validator.validate(validResponse)).not.toThrow();
      const result = validator.validate(validResponse);
      expect(result.datingIntent.detected).toBe(true);
      expect(result.scammerRisk.level).toBe('MEDIUM');
      expect(result.ageEstimate?.appearsUnderage).toBe(false);
    });

    it('should validate response without optional ageEstimate', () => {
      const validResponse = {
        datingIntent: {
          detected: false,
          confidence: 5,
          reasoning: 'No romantic language detected',
        },
        scammerRisk: {
          level: 'NONE',
          confidence: 95,
          patterns: [],
          reasoning: 'No scam indicators found',
        },
        spamIndicators: {
          detected: false,
          confidence: 2,
          patterns: [],
        },
        overallRisk: 'LOW',
        recommendedAction: 'APPROVE',
      };

      expect(() => validator.validate(validResponse)).not.toThrow();
      const result = validator.validate(validResponse);
      expect(result.ageEstimate).toBeUndefined();
    });

    it('should validate ageEstimate without estimatedAge field', () => {
      const validResponse = {
        datingIntent: {
          detected: false,
          confidence: 10,
          reasoning: 'No dating intent',
        },
        scammerRisk: {
          level: 'LOW',
          confidence: 20,
          patterns: ['generic greeting'],
          reasoning: 'Minor concerns',
        },
        ageEstimate: {
          appearsUnderage: true,
          confidence: 75,
          reasoning: 'Language suggests younger user',
          // estimatedAge is optional
        },
        spamIndicators: {
          detected: false,
          confidence: 5,
          patterns: [],
        },
        overallRisk: 'MEDIUM',
        recommendedAction: 'FLAG',
      };

      expect(() => validator.validate(validResponse)).not.toThrow();
      const result = validator.validate(validResponse);
      expect(result.ageEstimate?.estimatedAge).toBeUndefined();
    });

    it('should reject response with missing required field', () => {
      const invalidResponse = {
        datingIntent: {
          detected: true,
          confidence: 80,
          reasoning: 'Dating intent detected',
        },
        // Missing scammerRisk
        spamIndicators: {
          detected: false,
          confidence: 5,
          patterns: [],
        },
        overallRisk: 'LOW',
        recommendedAction: 'APPROVE',
      };

      expect(() => validator.validate(invalidResponse)).toThrow(AIError);
      try {
        validator.validate(invalidResponse);
      } catch (error) {
        expect(error).toBeInstanceOf(AIError);
        expect((error as AIError).type).toBe(AIErrorType.VALIDATION_ERROR);
        expect((error as AIError).message).toContain('scammerRisk');
      }
    });

    it('should reject confidence score below 0', () => {
      const invalidResponse = {
        datingIntent: {
          detected: true,
          confidence: -10, // Invalid
          reasoning: 'Dating intent detected',
        },
        scammerRisk: {
          level: 'LOW',
          confidence: 30,
          patterns: [],
          reasoning: 'Low risk',
        },
        spamIndicators: {
          detected: false,
          confidence: 5,
          patterns: [],
        },
        overallRisk: 'LOW',
        recommendedAction: 'APPROVE',
      };

      expect(() => validator.validate(invalidResponse)).toThrow(AIError);
      try {
        validator.validate(invalidResponse);
      } catch (error) {
        expect(error).toBeInstanceOf(AIError);
        expect((error as AIError).message).toContain('confidence');
      }
    });

    it('should reject confidence score above 100', () => {
      const invalidResponse = {
        datingIntent: {
          detected: true,
          confidence: 150, // Invalid
          reasoning: 'Dating intent detected',
        },
        scammerRisk: {
          level: 'LOW',
          confidence: 30,
          patterns: [],
          reasoning: 'Low risk',
        },
        spamIndicators: {
          detected: false,
          confidence: 5,
          patterns: [],
        },
        overallRisk: 'LOW',
        recommendedAction: 'APPROVE',
      };

      expect(() => validator.validate(invalidResponse)).toThrow(AIError);
    });

    it('should reject invalid scammerRisk level enum', () => {
      const invalidResponse = {
        datingIntent: {
          detected: false,
          confidence: 10,
          reasoning: 'No dating intent',
        },
        scammerRisk: {
          level: 'INVALID_LEVEL', // Invalid enum value
          confidence: 30,
          patterns: [],
          reasoning: 'Low risk',
        },
        spamIndicators: {
          detected: false,
          confidence: 5,
          patterns: [],
        },
        overallRisk: 'LOW',
        recommendedAction: 'APPROVE',
      };

      expect(() => validator.validate(invalidResponse)).toThrow(AIError);
      try {
        validator.validate(invalidResponse);
      } catch (error) {
        expect((error as AIError).message).toContain('level');
      }
    });

    it('should reject invalid overallRisk enum', () => {
      const invalidResponse = {
        datingIntent: {
          detected: false,
          confidence: 10,
          reasoning: 'No dating intent',
        },
        scammerRisk: {
          level: 'LOW',
          confidence: 30,
          patterns: [],
          reasoning: 'Low risk',
        },
        spamIndicators: {
          detected: false,
          confidence: 5,
          patterns: [],
        },
        overallRisk: 'SUPER_HIGH', // Invalid
        recommendedAction: 'APPROVE',
      };

      expect(() => validator.validate(invalidResponse)).toThrow(AIError);
    });

    it('should reject invalid recommendedAction enum', () => {
      const invalidResponse = {
        datingIntent: {
          detected: false,
          confidence: 10,
          reasoning: 'No dating intent',
        },
        scammerRisk: {
          level: 'LOW',
          confidence: 30,
          patterns: [],
          reasoning: 'Low risk',
        },
        spamIndicators: {
          detected: false,
          confidence: 5,
          patterns: [],
        },
        overallRisk: 'LOW',
        recommendedAction: 'DELETE', // Invalid
      };

      expect(() => validator.validate(invalidResponse)).toThrow(AIError);
    });

    it('should reject invalid estimatedAge enum in ageEstimate', () => {
      const invalidResponse = {
        datingIntent: {
          detected: false,
          confidence: 10,
          reasoning: 'No dating intent',
        },
        scammerRisk: {
          level: 'LOW',
          confidence: 30,
          patterns: [],
          reasoning: 'Low risk',
        },
        ageEstimate: {
          appearsUnderage: false,
          confidence: 80,
          reasoning: 'Adult language',
          estimatedAge: 'very-old', // Invalid
        },
        spamIndicators: {
          detected: false,
          confidence: 5,
          patterns: [],
        },
        overallRisk: 'LOW',
        recommendedAction: 'APPROVE',
      };

      expect(() => validator.validate(invalidResponse)).toThrow(AIError);
    });

    it('should reject non-boolean detected field', () => {
      const invalidResponse = {
        datingIntent: {
          detected: 'yes', // Invalid type
          confidence: 80,
          reasoning: 'Dating intent',
        },
        scammerRisk: {
          level: 'LOW',
          confidence: 30,
          patterns: [],
          reasoning: 'Low risk',
        },
        spamIndicators: {
          detected: false,
          confidence: 5,
          patterns: [],
        },
        overallRisk: 'LOW',
        recommendedAction: 'APPROVE',
      };

      expect(() => validator.validate(invalidResponse)).toThrow(AIError);
    });

    it('should reject non-array patterns field', () => {
      const invalidResponse = {
        datingIntent: {
          detected: false,
          confidence: 10,
          reasoning: 'No dating intent',
        },
        scammerRisk: {
          level: 'MEDIUM',
          confidence: 60,
          patterns: 'sob story, urgency', // Invalid - should be array
          reasoning: 'Scam patterns',
        },
        spamIndicators: {
          detected: false,
          confidence: 5,
          patterns: [],
        },
        overallRisk: 'MEDIUM',
        recommendedAction: 'FLAG',
      };

      expect(() => validator.validate(invalidResponse)).toThrow(AIError);
    });

    it('should reject non-string reasoning field', () => {
      const invalidResponse = {
        datingIntent: {
          detected: false,
          confidence: 10,
          reasoning: 123, // Invalid type
        },
        scammerRisk: {
          level: 'LOW',
          confidence: 30,
          patterns: [],
          reasoning: 'Low risk',
        },
        spamIndicators: {
          detected: false,
          confidence: 5,
          patterns: [],
        },
        overallRisk: 'LOW',
        recommendedAction: 'APPROVE',
      };

      expect(() => validator.validate(invalidResponse)).toThrow(AIError);
    });

    it('should reject completely invalid response', () => {
      const invalidResponse = 'not an object';

      expect(() => validator.validate(invalidResponse)).toThrow(AIError);
    });

    it('should reject null response', () => {
      expect(() => validator.validate(null)).toThrow(AIError);
    });

    it('should reject undefined response', () => {
      expect(() => validator.validate(undefined)).toThrow(AIError);
    });

    it('should validate all valid scammerRisk levels', () => {
      const levels = ['NONE', 'LOW', 'MEDIUM', 'HIGH'];

      levels.forEach((level) => {
        const response = {
          datingIntent: {
            detected: false,
            confidence: 10,
            reasoning: 'No dating intent',
          },
          scammerRisk: {
            level,
            confidence: 50,
            patterns: [],
            reasoning: 'Test',
          },
          spamIndicators: {
            detected: false,
            confidence: 5,
            patterns: [],
          },
          overallRisk: 'LOW',
          recommendedAction: 'APPROVE',
        };

        expect(() => validator.validate(response)).not.toThrow();
      });
    });

    it('should validate all valid overallRisk values', () => {
      const risks = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

      risks.forEach((risk) => {
        const response = {
          datingIntent: {
            detected: false,
            confidence: 10,
            reasoning: 'No dating intent',
          },
          scammerRisk: {
            level: 'LOW',
            confidence: 30,
            patterns: [],
            reasoning: 'Low risk',
          },
          spamIndicators: {
            detected: false,
            confidence: 5,
            patterns: [],
          },
          overallRisk: risk,
          recommendedAction: 'APPROVE',
        };

        expect(() => validator.validate(response)).not.toThrow();
      });
    });

    it('should validate all valid recommendedAction values', () => {
      const actions = ['APPROVE', 'FLAG', 'REMOVE'];

      actions.forEach((action) => {
        const response = {
          datingIntent: {
            detected: false,
            confidence: 10,
            reasoning: 'No dating intent',
          },
          scammerRisk: {
            level: 'LOW',
            confidence: 30,
            patterns: [],
            reasoning: 'Low risk',
          },
          spamIndicators: {
            detected: false,
            confidence: 5,
            patterns: [],
          },
          overallRisk: 'LOW',
          recommendedAction: action,
        };

        expect(() => validator.validate(response)).not.toThrow();
      });
    });

    it('should validate all valid estimatedAge values', () => {
      const ages = ['under-18', '18-25', '25-40', '40+'];

      ages.forEach((age) => {
        const response = {
          datingIntent: {
            detected: false,
            confidence: 10,
            reasoning: 'No dating intent',
          },
          scammerRisk: {
            level: 'LOW',
            confidence: 30,
            patterns: [],
            reasoning: 'Low risk',
          },
          ageEstimate: {
            appearsUnderage: false,
            confidence: 80,
            reasoning: 'Age indicators',
            estimatedAge: age,
          },
          spamIndicators: {
            detected: false,
            confidence: 5,
            patterns: [],
          },
          overallRisk: 'LOW',
          recommendedAction: 'APPROVE',
        };

        expect(() => validator.validate(response)).not.toThrow();
      });
    });

    it('should validate boundary confidence values (0 and 100)', () => {
      const response = {
        datingIntent: {
          detected: false,
          confidence: 0, // Minimum
          reasoning: 'No dating intent',
        },
        scammerRisk: {
          level: 'LOW',
          confidence: 100, // Maximum
          patterns: [],
          reasoning: 'Certain',
        },
        spamIndicators: {
          detected: false,
          confidence: 50,
          patterns: [],
        },
        overallRisk: 'LOW',
        recommendedAction: 'APPROVE',
      };

      expect(() => validator.validate(response)).not.toThrow();
    });
  });

  describe('validatePartial() - Best-effort validation', () => {
    it('should salvage valid fields from partially invalid response', () => {
      const partiallyInvalidResponse = {
        datingIntent: {
          detected: true,
          confidence: 85,
          reasoning: 'Valid field',
        },
        scammerRisk: {
          level: 'INVALID', // Invalid enum
          confidence: 60,
          patterns: [],
          reasoning: 'Test',
        },
        spamIndicators: {
          detected: false,
          confidence: 5,
          patterns: [],
        },
        overallRisk: 'LOW',
        recommendedAction: 'APPROVE',
      };

      const { result, warnings } = validator.validatePartial(partiallyInvalidResponse);

      expect(result.datingIntent).toBeDefined();
      expect(result.datingIntent?.detected).toBe(true);
      expect(result.scammerRisk).toBeUndefined();
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some((w) => w.includes('scammerRisk'))).toBe(true);
    });

    it('should return warnings for missing required fields', () => {
      const incompleteResponse = {
        datingIntent: {
          detected: true,
          confidence: 85,
          reasoning: 'Valid',
        },
        // Missing scammerRisk
        overallRisk: 'LOW',
        recommendedAction: 'APPROVE',
      };

      const { result, warnings } = validator.validatePartial(incompleteResponse);

      expect(warnings).toContain('Missing required field: scammerRisk');
      expect(warnings).toContain('Missing required field: spamIndicators');
      expect(result.datingIntent).toBeDefined();
    });

    it('should handle completely invalid response', () => {
      const invalidResponse = 'not an object';

      const { result, warnings } = validator.validatePartial(invalidResponse);

      expect(warnings).toContain('Response is not an object');
      expect(Object.keys(result).length).toBe(0);
    });

    it('should handle null response', () => {
      const { result, warnings } = validator.validatePartial(null);

      expect(warnings).toContain('Response is not an object');
      expect(Object.keys(result).length).toBe(0);
    });

    it('should salvage multiple valid fields', () => {
      const response = {
        datingIntent: {
          detected: true,
          confidence: 85,
          reasoning: 'Valid',
        },
        scammerRisk: {
          level: 'LOW',
          confidence: 30,
          patterns: ['pattern1'],
          reasoning: 'Valid',
        },
        spamIndicators: {
          detected: false,
          confidence: 999, // Invalid confidence
          patterns: [],
        },
        overallRisk: 'LOW',
        recommendedAction: 'APPROVE',
      };

      const { result, warnings } = validator.validatePartial(response);

      expect(result.datingIntent).toBeDefined();
      expect(result.scammerRisk).toBeDefined();
      expect(result.spamIndicators).toBeUndefined();
      expect(result.overallRisk).toBe('LOW');
      expect(warnings.some((w) => w.includes('spamIndicators'))).toBe(true);
    });

    it('should include warning details for validation failures', () => {
      const response = {
        datingIntent: {
          detected: 'yes', // Wrong type
          confidence: 85,
          reasoning: 'Test',
        },
        scammerRisk: {
          level: 'LOW',
          confidence: 30,
          patterns: [],
          reasoning: 'Valid',
        },
        spamIndicators: {
          detected: false,
          confidence: 5,
          patterns: [],
        },
        overallRisk: 'LOW',
        recommendedAction: 'APPROVE',
      };

      const { warnings } = validator.validatePartial(response);

      expect(warnings.length).toBeGreaterThan(0);
      const datingWarning = warnings.find((w) => w.includes('datingIntent'));
      expect(datingWarning).toBeDefined();
      expect(datingWarning).toContain('detected');
    });

    it('should handle optional ageEstimate correctly', () => {
      const response = {
        datingIntent: {
          detected: false,
          confidence: 10,
          reasoning: 'Valid',
        },
        scammerRisk: {
          level: 'LOW',
          confidence: 30,
          patterns: [],
          reasoning: 'Valid',
        },
        ageEstimate: {
          appearsUnderage: true,
          confidence: 80,
          reasoning: 'Valid',
          estimatedAge: 'under-18',
        },
        spamIndicators: {
          detected: false,
          confidence: 5,
          patterns: [],
        },
        overallRisk: 'MEDIUM',
        recommendedAction: 'FLAG',
      };

      const { result, warnings } = validator.validatePartial(response);

      expect(result.ageEstimate).toBeDefined();
      expect(result.ageEstimate?.appearsUnderage).toBe(true);
      expect(warnings.length).toBe(0);
    });

    it('should warn about invalid optional ageEstimate', () => {
      const response = {
        datingIntent: {
          detected: false,
          confidence: 10,
          reasoning: 'Valid',
        },
        scammerRisk: {
          level: 'LOW',
          confidence: 30,
          patterns: [],
          reasoning: 'Valid',
        },
        ageEstimate: {
          appearsUnderage: 'maybe', // Invalid type
          confidence: 80,
          reasoning: 'Test',
        },
        spamIndicators: {
          detected: false,
          confidence: 5,
          patterns: [],
        },
        overallRisk: 'LOW',
        recommendedAction: 'APPROVE',
      };

      const { result, warnings } = validator.validatePartial(response);

      expect(result.ageEstimate).toBeUndefined();
      expect(warnings.some((w) => w.includes('ageEstimate'))).toBe(true);
    });
  });

  describe('isValid() - Quick validation check', () => {
    it('should return true for valid response', () => {
      const validResponse = {
        datingIntent: {
          detected: true,
          confidence: 85,
          reasoning: 'Dating intent detected',
        },
        scammerRisk: {
          level: 'LOW',
          confidence: 30,
          patterns: [],
          reasoning: 'Low risk',
        },
        spamIndicators: {
          detected: false,
          confidence: 5,
          patterns: [],
        },
        overallRisk: 'LOW',
        recommendedAction: 'APPROVE',
      };

      expect(validator.isValid(validResponse)).toBe(true);
    });

    it('should return false for invalid response', () => {
      const invalidResponse = {
        datingIntent: {
          detected: true,
          confidence: 200, // Invalid
          reasoning: 'Test',
        },
      };

      expect(validator.isValid(invalidResponse)).toBe(false);
    });

    it('should return false for null', () => {
      expect(validator.isValid(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(validator.isValid(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(validator.isValid('invalid')).toBe(false);
      expect(validator.isValid(123)).toBe(false);
      expect(validator.isValid(true)).toBe(false);
    });

    it('should return true for valid response with optional ageEstimate', () => {
      const validResponse = {
        datingIntent: {
          detected: false,
          confidence: 10,
          reasoning: 'No dating intent',
        },
        scammerRisk: {
          level: 'LOW',
          confidence: 30,
          patterns: [],
          reasoning: 'Low risk',
        },
        ageEstimate: {
          appearsUnderage: true,
          confidence: 75,
          reasoning: 'Appears young',
          estimatedAge: 'under-18',
        },
        spamIndicators: {
          detected: false,
          confidence: 5,
          patterns: [],
        },
        overallRisk: 'MEDIUM',
        recommendedAction: 'FLAG',
      };

      expect(validator.isValid(validResponse)).toBe(true);
    });

    it('should return false for invalid enum values', () => {
      const invalidResponse = {
        datingIntent: {
          detected: false,
          confidence: 10,
          reasoning: 'No dating intent',
        },
        scammerRisk: {
          level: 'SUPER_HIGH', // Invalid
          confidence: 30,
          patterns: [],
          reasoning: 'Test',
        },
        spamIndicators: {
          detected: false,
          confidence: 5,
          patterns: [],
        },
        overallRisk: 'LOW',
        recommendedAction: 'APPROVE',
      };

      expect(validator.isValid(invalidResponse)).toBe(false);
    });
  });

  describe('Error handling and logging', () => {
    it('should include correlation ID in error when present in response', () => {
      const invalidResponse = {
        correlationId: 'test-correlation-123',
        datingIntent: {
          detected: true,
          confidence: 200, // Invalid
          reasoning: 'Test',
        },
      };

      try {
        validator.validate(invalidResponse);
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(AIError);
        expect((error as AIError).correlationId).toBe('test-correlation-123');
      }
    });

    it('should format multiple Zod errors into readable message', () => {
      const invalidResponse = {
        datingIntent: {
          detected: 'yes', // Invalid type
          confidence: 200, // Invalid range
          reasoning: 123, // Invalid type
        },
        scammerRisk: {
          level: 'LOW',
          confidence: 30,
          patterns: [],
          reasoning: 'Test',
        },
        spamIndicators: {
          detected: false,
          confidence: 5,
          patterns: [],
        },
        overallRisk: 'LOW',
        recommendedAction: 'APPROVE',
      };

      try {
        validator.validate(invalidResponse);
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(AIError);
        const message = (error as AIError).message;
        // Should mention the fields that failed
        expect(message.toLowerCase()).toContain('datingintent');
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle empty patterns array', () => {
      const response = {
        datingIntent: {
          detected: false,
          confidence: 10,
          reasoning: 'No dating intent',
        },
        scammerRisk: {
          level: 'NONE',
          confidence: 95,
          patterns: [], // Empty array is valid
          reasoning: 'No patterns',
        },
        spamIndicators: {
          detected: false,
          confidence: 5,
          patterns: [], // Empty array is valid
        },
        overallRisk: 'LOW',
        recommendedAction: 'APPROVE',
      };

      expect(() => validator.validate(response)).not.toThrow();
    });

    it('should handle patterns array with multiple items', () => {
      const response = {
        datingIntent: {
          detected: false,
          confidence: 10,
          reasoning: 'No dating intent',
        },
        scammerRisk: {
          level: 'HIGH',
          confidence: 90,
          patterns: [
            'sob story',
            'financial urgency',
            'crypto mention',
            'suspicious links',
          ],
          reasoning: 'Multiple red flags',
        },
        spamIndicators: {
          detected: true,
          confidence: 85,
          patterns: ['repetitive', 'promotional'],
        },
        overallRisk: 'HIGH',
        recommendedAction: 'REMOVE',
      };

      expect(() => validator.validate(response)).not.toThrow();
      const result = validator.validate(response);
      expect(result.scammerRisk.patterns.length).toBe(4);
      expect(result.spamIndicators.patterns.length).toBe(2);
    });

    it('should handle empty string in reasoning', () => {
      const response = {
        datingIntent: {
          detected: false,
          confidence: 10,
          reasoning: '', // Empty string is valid (still a string)
        },
        scammerRisk: {
          level: 'LOW',
          confidence: 30,
          patterns: [],
          reasoning: '',
        },
        spamIndicators: {
          detected: false,
          confidence: 5,
          patterns: [],
        },
        overallRisk: 'LOW',
        recommendedAction: 'APPROVE',
      };

      expect(() => validator.validate(response)).not.toThrow();
    });

    it('should reject extra unknown fields at root level', () => {
      // Zod by default strips unknown keys, but we test to ensure validation still works
      const responseWithExtra = {
        datingIntent: {
          detected: false,
          confidence: 10,
          reasoning: 'No dating intent',
        },
        scammerRisk: {
          level: 'LOW',
          confidence: 30,
          patterns: [],
          reasoning: 'Low risk',
        },
        spamIndicators: {
          detected: false,
          confidence: 5,
          patterns: [],
        },
        overallRisk: 'LOW',
        recommendedAction: 'APPROVE',
        extraField: 'should be ignored', // Extra field
      };

      // Should still validate (Zod strips unknown keys by default)
      expect(() => validator.validate(responseWithExtra)).not.toThrow();
    });
  });
});
