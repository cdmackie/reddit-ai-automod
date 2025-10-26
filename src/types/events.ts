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
