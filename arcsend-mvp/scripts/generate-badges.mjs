import fs from 'node:fs/promises';
import path from 'node:path';
import { makeBadge } from 'badge-maker';

const outDir = path.resolve('assets/badges');

const badges = [
  {
    file: 'arcsend-brand.svg',
    spec: {
      label: 'ArcSend',
      message: 'By Circle x DimensionlessDevelopments MVP',
      color: '#2dd4bf',
      style: 'flat-square',
      labelColor: '#0f172a'
    }
  },
  {
    file: 'arcsend-sdk.svg',
    spec: {
      label: 'ArcSend SDK',
      message: 'TypeScript + Python Parity',
      color: '#2563eb',
      style: 'flat-square',
      labelColor: '#0f172a'
    }
  },
  {
    file: 'arcsend-cli.svg',
    spec: {
      label: 'ArcSend CLI',
      message: 'Login • Quote • Send • History',
      color: '#8b5cf6',
      style: 'flat-square',
      labelColor: '#0f172a'
    }
  }
];

await fs.mkdir(outDir, { recursive: true });

for (const badge of badges) {
  const svg = makeBadge(badge.spec);
  await fs.writeFile(path.join(outDir, badge.file), svg, 'utf8');
}

console.log(`Generated ${badges.length} badge assets in ${outDir}`);
