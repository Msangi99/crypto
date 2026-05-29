/**
 * Register an APK copied manually onto the server (bypasses browser / Cloudflare upload limits).
 * Writes to uploads/apk/<uuid>.apk and inserts a draft row — then publish in Admin → Mobile app.
 *
 * Local (after `npm run build`, same DATABASE_URL as API):
 *   node dist/cli/registerMobileApk.js /path/to/app.apk 1.4.2
 *   npm run mobile-apk:register -- /path/to/app.apk 1.4.2
 *
 * Dev without build:
 *   npm run mobile-apk:register:dev -- /path/to/app.apk 1.4.2
 *
 * Docker (APK path must exist *inside* the container; image includes this script in dist/):
 *   docker cp /path/on/host/your.apk clb-backend:/tmp/app.apk
 *   docker exec -it clb-backend node dist/cli/registerMobileApk.js /tmp/app.apk 1.4.2
 */
import 'dotenv/config';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';

const MAX_APK_BYTES = 200 * 1024 * 1024;
const APK_SUBDIR = 'apk';

function uploadsRoot(): string {
  return path.join(process.cwd(), 'uploads');
}

async function main() {
  const args = process.argv.slice(2);
  const publish = args.includes('--publish');
  const positional = args.filter((a) => a !== '--publish');
  const fileArg = positional[0];
  const version = (positional[1] || '').trim();
  const releaseNotes = (positional[2] || '').trim() || null;

  if (!fileArg || !version) {
    console.error(
      'Usage: node dist/cli/registerMobileApk.js <path-to.apk-inside-container> <version> [release-notes]\n' +
        'Example: node dist/cli/registerMobileApk.js /tmp/app.apk 1.4.2 "Bug fixes"'
    );
    process.exit(1);
  }

  const src = path.resolve(fileArg);
  if (!src.toLowerCase().endsWith('.apk')) {
    console.error('File must end with .apk');
    process.exit(1);
  }

  let st;
  try {
    st = await fs.stat(src);
  } catch {
    console.error(`Not found or not readable: ${src}`);
    process.exit(1);
  }

  if (!st.isFile()) {
    console.error('Path is not a file');
    process.exit(1);
  }

  if (st.size > MAX_APK_BYTES) {
    console.error(`APK too large (${st.size} bytes). Max ${MAX_APK_BYTES} bytes.`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const id = randomUUID();
  const relPath = path.join(APK_SUBDIR, `${id}.apk`).replace(/\\/g, '/');
  const destDir = path.join(uploadsRoot(), APK_SUBDIR);
  const destAbs = path.join(destDir, `${id}.apk`);

  await fs.mkdir(destDir, { recursive: true });

  try {
    await fs.copyFile(src, destAbs);
  } catch (e) {
    console.error('Failed to copy APK into uploads/:', e);
    process.exit(1);
  }

  const originalFileName = path.basename(src);

  try {
    const row = await prisma.$transaction(async (tx) => {
      if (publish) {
        await tx.mobileAppRelease.updateMany({
          where: { isPublished: true },
          data: { isPublished: false },
        });
      }
      return tx.mobileAppRelease.create({
        data: {
          id,
          version,
          originalFileName,
          storagePath: relPath,
          fileSizeBytes: BigInt(st.size),
          releaseNotes,
          isPublished: publish,
        },
      });
    });

    console.log('\n✓ Release created' + (publish ? ' and published.' : ' (draft).'));
    console.log('  id:              ', row.id);
    console.log('  version:         ', row.version);
    console.log('  file:            ', row.originalFileName);
    console.log('  size (bytes):    ', st.size);
    console.log('  storagePath:     ', row.storagePath);
    console.log('\nOpen Admin → Mobile app (Android APK)' + (publish ? ' — live on landing now.' : ' → Publish this row when ready.') + '\n');
  } catch (e) {
    await fs.unlink(destAbs).catch(() => undefined);
    console.error('Failed to insert DB row:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
