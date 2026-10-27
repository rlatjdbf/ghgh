const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>초정밀 웹 프록시 게이트웨이</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
    .topbar { background: #1e293b; padding: 10px 16px; display: flex; gap: 10px; align-items: center; border-bottom: 1px solid #334155; }
    .logo { font-weight: 800; font-size: 15px; color: #38bdf8; white-space: nowrap; }
    .url-input { flex: 1; padding: 8px 14px; background: #0f172a; border: 1px solid #475569; border-radius: 6px; color: #fff; font-size: 14px; outline: none; }
    .url-input:focus { border-color: #38bdf8; }
    .btn { padding: 8px 18px; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; transition: 0.2s; white-space: nowrap; }
    .btn:hover { background: #1d4ed8; }
    .presets { display: flex; gap: 8px; }
    .btn-preset { padding: 6px 12px; background: #334155; color: #94a3b8; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; }
    .btn-preset:hover { background: #475569; color: #fff; }
    .viewer { flex: 1; width: 100%; border: none; background: #fff; }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="logo">⚡ GATEWAY</div>
    <input type="text" id="targetUrl" class="url-input" placeholder="접속할 전체 URL 입력 (예: https://ko.wikipedia.org)" value="https://ko.wikipedia.org">
    <button class="btn" onclick="navigate()">우회 접속</button>
    <div class="presets">
      <button class="btn-preset" onclick="setPreset('https://ko.wikipedia.org')">위키백과</button>
      <button class="btn-preset" onclick="setPreset('https://namu.wiki')">나무위키</button>
      <button class="btn-preset" onclick="setPreset('https://news.ycombinator.com')">해커뉴스</button>
    </div>
  </div>
  <iframe id="frame" class="viewer" src="/proxy?url=https://ko.wikipedia.org"></iframe>
  <script>
    function navigate() {
      let url = document.getElementById('targetUrl').value.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      document.getElementById('frame').src = '/proxy?url=' + encodeURIComponent(url);
    }
    function setPreset(url) {
      document.getElementById('targetUrl').value = url;
      navigate();
    }
    document.getElementById('targetUrl').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') navigate();
    });
  </script>
</body>
</html>
  `);
});

app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('URL이 지정되지 않았습니다.');

  try {
    const parsedTarget = new URL(targetUrl);
    const origin = parsedTarget.origin;

    const response = await axios({
      method: 'get',
      url: targetUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8'
      },
      responseType: 'arraybuffer',
      maxRedirects: 5,
      validateStatus: () => true
    });

    const headers = { ...response.headers };
    delete headers['x-frame-options'];
    delete headers['content-security-policy'];
    delete headers['content-security-policy-report-only'];

    Object.keys(headers).forEach(header => {
      res.setHeader(header, headers[header]);
    });

    const contentType = headers['content-type'] || '';
    if (contentType.includes('text/html')) {
      const html = response.data.toString('utf-8');
      const $ = cheerio.load(html);

      if ($('head').length) {
        $('head').prepend(`<base href="${origin}/">`);
      }

      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          try {
            const absoluteUrl = new URL(href, origin).href;
            $(el).attr('href', `/proxy?url=${encodeURIComponent(absoluteUrl)}`);
          } catch (e) {}
        }
      });

      return res.status(response.status).send($.html());
    }

    return res.status(response.status).send(response.data);
  } catch (error) {
    return res.status(500).send(`<h2>중계 에러 발생</h2><p>${error.message}</p>`);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});