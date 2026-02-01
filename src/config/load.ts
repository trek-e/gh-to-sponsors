/**
 * Configuration file loader
 *
 * Loads and validates YAML configuration files.
 */

import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { validateConfig } from './schema.js';
import type { Config } from '../types/config.js';

/**
 * Loads and validates configuration from a YAML file
 *
 * @param path - Path to configuration file (default: gh-to-sponsors.config.yaml)
 * @returns Validated Config object
 * @throws Error if file cannot be read or configuration is invalid
 */
export async function loadConfig(
  path: string = 'gh-to-sponsors.config.yaml'
): Promise<Config> {
  try {
    const fileContents = await readFile(path, 'utf-8');
    const data = parse(fileContents);

    return validateConfig(data);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to load configuration from ${path}: ${error.message}`
      );
    }
    throw error;
  }
}
