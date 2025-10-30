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
 * Type definitions for Reddit events handled by the AI Automod
 */

import { Post, Comment } from '@devvit/public-api';

/**
 * Event data for post submissions
 */
export interface PostSubmitEvent {
  /** The submitted post */
  post: Post;
  /** Subreddit name where post was submitted */
  subreddit: string;
  /** Author username */
  author: string;
  /** Post title */
  title: string;
  /** Post content (selftext for text posts, url for links) */
  content: string;
  /** Timestamp when post was created */
  timestamp: Date;
}

/**
 * Event data for comment submissions
 */
export interface CommentSubmitEvent {
  /** The submitted comment */
  comment: Comment;
  /** Subreddit name where comment was posted */
  subreddit: string;
  /** Author username */
  author: string;
  /** Comment body text */
  body: string;
  /** Parent post/comment ID */
  parentId: string;
  /** Timestamp when comment was created */
  timestamp: Date;
}

/**
 * Union type for all handled events
 */
export type ModEvent = PostSubmitEvent | CommentSubmitEvent;

/**
 * Event type discriminator
 */
export enum EventType {
  POST_SUBMIT = 'POST_SUBMIT',
  COMMENT_SUBMIT = 'COMMENT_SUBMIT',
}
