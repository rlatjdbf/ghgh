const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. 게이트웨이 사용자 메인 UI
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ULTRA STEALTH GATEWAY</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #090d16; color: #f8fafc; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
    .nav { background: #0f172a; border-bottom: 1px solid #1e293b; padding: 8px 16px; display: flex; align-items: center; gap: 12px; z-index: 100; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
    .brand { font-size: 14px; font-weight: 900; letter-spacing: 1px; color: #38bdf8; display: flex; align-items: center; gap: 6px; }
    .input-box { flex: 1; display: flex; align-items: center; background: #020617; border: 1px solid #334155; border-radius: 8px; overflow: hidden; }
    .url-input { flex: 1; background: transparent; border: none; padding: 10px 14px; color: #fff; font-size: 14px; outline: none; }
    .btn-run { background: #2563eb; color: #fff; border: none; padding: 10px 22px; font-weight: 700; cursor: pointer; transition: 0.2s; white-space: nowrap; font-size: 13px; }
    .btn-run:hover { background: #1d4ed8; }
    .quick { display: flex; gap: 6px; }
    .btn-q { background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; transition: 0.2s; white-space: nowrap; }
    .btn-q:hover { color: #fff; background: #334155; border-color: #475569; }
    .viewport { flex: 1; width: 100%; border: none; background: #fff; }
  </style>
</head>
<body>
  <div class="nav">
    <div class="brand">⚡ STEALTH GATEWAY</div>
    <div class="input-box">
      <input type="text" id="target" class="url-input" placeholder="URL을 입력하세요 (예: https://comic.naver.com 또는 https://www.youtube.com)" value="https://comic.naver.com">
      <button class="btn-run" onclick="go()">우회 연결</button>
    </div>
    <div class="quick">
      <button class="btn-q" onclick="quick('https://comic.naver.com')">네이버 웹툰</button>
      <button class="btn-q" onclick="quick('https://namu.wiki')">나무위키</button>
      <button class="btn-q" onclick="quick('https://ko.wikipedia.org')">위키백과</button>
      <button class="btn-q" onclick="quick('https://www.youtube.com')">유튜브</button>
    </div>
  </div>
  <iframe id="view" class="viewport" src="/gateway?url=https://comic.naver.com" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreeen"></iframe>

  <script>
    function go() {
      let u = document.getElementById('target').value.trim();
      if (!u.startsWith('http://') && !u.startsWith('https://')) {
        u = 'https://' + u;
      }
      document.getElementById('view').src = '/gateway?url=' + encodeURIComponent(u);
    }
    function quick(u) {
      document.getElementById('target').value = u;
      go();
    }
    document.getElementById('target').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') go();
    });
  </script>
</body>
</html>
  `);
});

// 2. 유튜브 동영상 링크 자동 임베드 감지 (광고/CORS 우회 최적화)
function handleSpecialServices(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    // 유튜브 단일 영상 URL인 경우 임베드 플레이어로 즉시 변환
    if (parsed.hostname.includes('youtube.com') && parsed.searchParams.has('v')) {
      const vid = parsed.searchParams.get('v');
      return `https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&enablejsapi=1`;
    }
    if (parsed.hostname.includes('youtu.be')) {
      const vid = parsed.pathname.replace('/', '');
      return `https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&enablejsapi=1`;
    }
  } catch (e) {}
  return targetUrl;
}

// 3. 중계 게이트웨이 핵심 코어
app.all('/gateway', async (req, res) => {
  let targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('Target URL required.');

  targetUrl = handleSpecialServices(targetUrl);

  try {
    const targetObj = new URL(targetUrl);
    const origin = targetObj.origin;

    // 브라우저 위장 헤더 구축
    const forwardHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
      'Accept': req.headers['accept'] || '*/*',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
      'Referer': origin,
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    };

    if (req.headers['cookie']) {
      forwardHeaders['Cookie'] = req.headers['cookie'];
    }

    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: forwardHeaders,
      data: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : undefined,
      responseType: 'arraybuffer',
      maxRedirects: 10,
      validateStatus: () => true
    });

    // 응답 헤더 필터링
    const resHeaders = { ...response.headers };

    // 보안 및 프레임 차단 헤더 완전 박멸
    delete resHeaders['x-frame-options'];
    delete resHeaders['content-security-policy'];
    delete resHeaders['content-security-policy-report-only'];
    delete resHeaders['strict-transport-security'];
    delete resHeaders['cross-origin-opener-policy'];
    delete resHeaders['cross-origin-embedder-policy'];
    delete resHeaders['content-encoding']; // 압축 헤더 제거하여 브라우저 디코딩 충돌 방지

    // 리다이렉트 발생 시 우회 경로로 강제 포획
    if (resHeaders['location']) {
      try {
        const nextUrl = new URL(resHeaders['location'], origin).href;
        resHeaders['location'] = `/gateway?url=${encodeURIComponent(nextUrl)}`;
      } catch (err) {}
    }

    // 쿠키 도메인 및 SameSite 강제 재조정
    if (resHeaders['set-cookie']) {
      resHeaders['set-cookie'] = resHeaders['set-cookie'].map(cookieStr => {
        return cookieStr
          .replace(/Domain=[^;]+/gi, '')
          .replace(/SameSite=Lax/gi, 'SameSite=None; Secure')
          .replace(/SameSite=Strict/gi, 'SameSite=None; Secure');
      });
    }

    Object.keys(resHeaders).forEach(key => {
      res.setHeader(key, resHeaders[key]);
    });

    const cType = resHeaders['content-type'] || '';

    // HTML 응답일 경우 내부 링크 및 탈출 방지 스크립트 정밀 인젝션
    if (cType.includes('text/html')) {
      const html = response.data.toString('utf-8');
      const $ = cheerio.load(html);

      // base href 설정으로 정적 파일(CSS, 이미지, JS) 원본 경로 자동 해석
      if ($('head').length) {
        $('head').prepend(`<base href="${origin}/">`);
        // 프레임 탈출 방지(Frame-buster bypass) 및 top/parent 객체 섀도잉
        $('head').prepend(`
          <script>
            try {
              Object.defineProperty(window, 'top', { get: function() { return window.self; } });
              Object.defineProperty(window, 'parent', { get: function() { return window.self; } });
            } catch (e) {}
          </script>
        `);
      }

      // 페이지 내부의 모든 a 태그 링크를 프록시 게이트웨이 주소로 변환
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          try {
            const abs = new URL(href, origin).href;
            $(el).attr('href', `/gateway?url=${encodeURIComponent(abs)}`);
          } catch (e) {}
        }
      });

      // 폼(POST/GET) 제출 시 프록시 주소로 경유하도록 변환
      $('form[action]').each((_, el) => {
        const act = $(el).attr('action');
        if (act) {
          try {
            const abs = new URL(act, origin).href;
            $(el).attr('action', `/gateway?url=${encodeURIComponent(abs)}`);
          } catch (e) {}
        }
      });

      return res.status(response.status).send($.html());
    }

    return res.status(response.status).send(response.data);
  } catch (err) {
    return res.status(500).send(`
      <div style="padding: 24px; font-family: sans-serif; background: #0f172a; color: #f87171; min-height: 100vh;">
        <h2>중계 게이트웨이 연결 실패</h2>
        <p style="color: #94a3b8; margin-top: 8px;">원인: ${err.message}</p>
        <p style="color: #64748b; margin-top: 4px;">타겟 사이트의 강력한 IP 블록 또는 클라우드 방화벽 감지</p>
      </div>
    `);
  }
});

app.listen(PORT, () => {
  console.log(`Stealth Proxy Engine is listening on port ${PORT}`);
});
