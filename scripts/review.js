#!/usr/bin/env node

import { runLocalReviewCli } from '../src/services/local-review/cli.js';

const exitCode = await runLocalReviewCli();
process.exitCode = exitCode;
