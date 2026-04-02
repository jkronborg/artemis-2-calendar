#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const readmePath = path.resolve(__dirname, 'README.md');
const outputPath = path.resolve(__dirname, 'events.ics');
const livestreamUrl = 'https://www.youtube.com/watch?v=m3kR2KK8TEs';

function formatUtcDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  const second = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hour}${minute}${second}Z`;
}

function escapeIcsText(value) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function parseTableRows(readmeContent) {
  const lines = readmeContent.split(/\r?\n/);
  const rows = [];

  let inEventTable = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();

    if (!inEventTable) {
      if (!line.startsWith('|')) {
        continue;
      }

      const columns = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());

      const hasExpectedHeaders =
        columns.length >= 3 &&
        columns[0] === 'Start time (UTC)' &&
        columns[1] === 'End time (UTC)' &&
        columns[2] === 'Event';

      if (hasExpectedHeaders) {
        inEventTable = true;
        i += 1; // Skip separator row.
      }
      continue;
    }

    if (!line.startsWith('|')) {
      break;
    }

    const columns = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (columns.length < 3) {
      continue;
    }

    const startTimeUtc = columns[0];
    const endTimeUtc = columns[1];
    const title = columns[2];
    const start = new Date(startTimeUtc);
    const end = new Date(endTimeUtc);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      continue;
    }

    rows.push({ start, end, title });
  }

  return rows;
}

function buildIcs(events) {
  const nowStamp = formatUtcDate(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Artemis II//Mission Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  events.forEach((event, index) => {
    const uid = `${formatUtcDate(event.start)}-${index}@artemis-2-calendar`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART:${formatUtcDate(event.start)}`);
    lines.push(`DTEND:${formatUtcDate(event.end)}`);
    lines.push(`SUMMARY:${escapeIcsText(event.title)}`);
    lines.push(`URL:${livestreamUrl}`);
    lines.push(`DESCRIPTION:${escapeIcsText(`NASA live stream: ${livestreamUrl}`)}`);
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

function main() {
  const readme = fs.readFileSync(readmePath, 'utf8');
  const events = parseTableRows(readme);

  if (events.length === 0) {
    throw new Error('No event rows found in README markdown table.');
  }

  const ics = buildIcs(events);
  fs.writeFileSync(outputPath, ics, 'utf8');

  console.log(`Created ${path.basename(outputPath)} with ${events.length} events.`);
}

main();