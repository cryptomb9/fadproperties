const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const root = __dirname;
const port = Number(process.argv[2] || process.env.PORT || 4178);

const routes = new Map([
  ['/', 'index.html'],
  ['/about', 'about.html'],
  ['/contact', 'contact.html'],
  ['/properties', 'properties.html'],
  ['/property', 'property.html'],
  ['/admin', 'admin.html'],
]);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
};

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = contentTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store, max-age=0',
    });
    res.end(data);
  });
}

http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  let pathname = decodeURIComponent(parsed.pathname || '/');

  if (routes.has(pathname)) {
    return sendFile(res, path.join(root, routes.get(pathname)));
  }

  if (pathname === '/') {
    return sendFile(res, path.join(root, 'index.html'));
  }

  const candidate = path.join(root, pathname);
  if (candidate.startsWith(root) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return sendFile(res, candidate);
  }

  const htmlCandidate = path.join(root, `${pathname}.html`);
  if (htmlCandidate.startsWith(root) && fs.existsSync(htmlCandidate)) {
    return sendFile(res, htmlCandidate);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}).listen(port, () => {
  console.log(`Local server running at http://localhost:${port}`);
});
