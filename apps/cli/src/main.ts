#!/usr/bin/env node

import { createInterface } from 'node:readline/promises';
import { RunCli } from './app/Cli';

RunCli(
  process.argv.slice(2),
  {
    HOME: process.env['HOME'],
    XDG_CONFIG_HOME: process.env['XDG_CONFIG_HOME'],
    FIATDESK_ACTIVATION_URL: process.env['FIATDESK_ACTIVATION_URL'],
    FIATDESK_AUTH_POLL_INTERVAL_MS:
      process.env['FIATDESK_AUTH_POLL_INTERVAL_MS'],
    FIATDESK_AUTH_URL: process.env['FIATDESK_AUTH_URL'],
    FIATDESK_API_KEY: process.env['FIATDESK_API_KEY'],
    FIATDESK_API_URL: process.env['FIATDESK_API_URL'],
    FIATDESK_PROFILE: process.env['FIATDESK_PROFILE'],
  },
  {
    isInteractive: Boolean(process.stdin.isTTY && process.stderr.isTTY),
    readLine: ReadLine,
    stdout: process.stdout,
    stderr: process.stderr,
  }
)
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`error: ${message}\n`);
    process.exitCode = 4;
  });

async function ReadLine(): Promise<string> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  try {
    return await readline.question('');
  } finally {
    readline.close();
  }
}
