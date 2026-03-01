import fs from 'fs';
import path from 'path';
import https from 'https';

const owner = 'bartlomiejgibas29-sys';
const repo = 'soul-reflection-engine';
const branch = 'main';

function apiUrl(p) {
  const enc = encodeURIComponent(p).replace(/%2F/g, '/');
  return `https://api.github.com/repos/${owner}/${repo}/contents/${enc}?ref=${branch}`;
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'trae-sync-script',
        'Accept': 'application/vnd.github+json',
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`GET ${url} -> ${res.statusCode}: ${data.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function fetchToFile(url, dest) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dest);
    fs.mkdirSync(dir, { recursive: true });
    const file = fs.createWriteStream(dest);
    https.get(url, {
      headers: { 'User-Agent': 'trae-sync-script' },
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`GET ${url} -> ${res.statusCode}`));
        res.resume();
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    }).on('error', (err) => reject(err));
  });
}

async function syncPath(remotePath, results) {
  const listing = await fetchJSON(apiUrl(remotePath));
  if (Array.isArray(listing)) {
    for (const item of listing) {
      if (item.type === 'file') {
        const local = path.resolve(process.cwd(), item.path);
        try {
          await fetchToFile(item.download_url, local);
          results.push({ file: item.path, status: 'updated' });
        } catch (e) {
          results.push({ file: item.path, status: 'skipped', error: e.message });
        }
      } else if (item.type === 'dir') {
        await syncPath(item.path, results);
      } else {
        results.push({ file: item.path, status: 'skipped', error: `unsupported type ${item.type}` });
      }
    }
  } else if (listing && listing.type === 'file') {
    const local = path.resolve(process.cwd(), listing.path);
    try {
      await fetchToFile(listing.download_url, local);
      results.push({ file: listing.path, status: 'updated' });
    } catch (e) {
      results.push({ file: listing.path, status: 'skipped', error: e.message });
    }
  }
}

async function run() {
  const results = [];
  await syncPath('', results);
  fs.writeFileSync(
    path.resolve(process.cwd(), 'sync-report.json'),
    JSON.stringify({ updatedAt: new Date().toISOString(), results }, null, 2),
    'utf8'
  );
  console.log('Sync completed. Report written to sync-report.json');
  for (const r of results) {
    console.log(`${r.status.toUpperCase()}: ${r.file}${r.error ? ' - ' + r.error : ''}`);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
