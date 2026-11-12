import { writeFile } from 'node:fs/promises';

const input = process.argv[2];
let url;
try {
  url = new URL(input);
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.onrender\.com$/.test(url.hostname)
      || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) {
    throw new Error();
  }
} catch {
  console.error('Cung cấp URL Render HTTPS, ví dụ: npm run configure:vercel -- https://ten-service.onrender.com');
  process.exit(1);
}

const config = {
  rewrites: [
    { source: '/api/v1/:path*', destination: `${url.origin}/api/v1/:path*` },
    { source: '/actuator/health', destination: `${url.origin}/actuator/health` },
    { source: '/:path*', destination: '/index.html' },
  ],
};
try {
  await writeFile('vercel.json', `${JSON.stringify(config, null, 2)}\n`, { flag: 'wx' });
  console.log('Đã tạo vercel.json; hãy review và kiểm thử trên Vercel Preview.');
} catch (error) {
  if (error?.code === 'EEXIST') {
    console.error('vercel.json đã tồn tại; không ghi đè.');
    process.exit(1);
  }
  throw error;
}
