#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MAX_BYTES = 1024 * 1024;

const secretPatterns = [
  ['OpenAI API key', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/g],
  ['GitHub token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g],
  ['GitHub fine-grained token', /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/g],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g],
  ['Private key block', /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/g],
];

const sensitiveEnvName = /^\.env(?:[.\w-]+)?$/;
const allowedEnvFiles = new Set(['.env.example']);

function gitLsFiles() {
  const output = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return output.split('\0').filter(Boolean);
}

function isBinary(buffer) {
  return buffer.includes(0);
}

function lineAndColumn(content, index) {
  const before = content.slice(0, index);
  const lines = before.split(/\r\n|\r|\n/);
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

const findings = [];
const files = gitLsFiles();

for (const file of files) {
  const base = path.basename(file);
  if (sensitiveEnvName.test(base) && !allowedEnvFiles.has(base)) {
    findings.push({
      file,
      line: 1,
      detail: `${file} must stay out of git; commit a sanitized .env.example instead.`,
    });
    continue;
  }

  const absolute = path.join(ROOT, file);
  let buffer;
  try {
    buffer = readFileSync(absolute);
  } catch {
    continue;
  }
  if (buffer.length > MAX_BYTES || isBinary(buffer)) {
    continue;
  }

  const content = buffer.toString('utf8');
  for (const [label, pattern] of secretPatterns) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      const position = lineAndColumn(content, match.index ?? 0);
      findings.push({
        file,
        line: position.line,
        column: position.column,
        detail: `matched ${label}`,
      });
    }
  }
}

if (findings.length > 0) {
  console.error('Security scan failed. Potential secrets or unsafe files were found:');
  for (const finding of findings) {
    const column = finding.column ? `:${finding.column}` : '';
    console.error(`- ${finding.file}:${finding.line}${column} ${finding.detail}`);
  }
  process.exit(1);
}

console.log(`Security scan passed (${files.length} commit-candidate files scanned).`);
