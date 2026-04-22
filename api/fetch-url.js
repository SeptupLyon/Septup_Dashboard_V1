export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    const youtubeId = getYouTubeId(url);
    if (youtubeId) {
      const result = await fetchYouTubeTranscript(youtubeId);
      return res.json({ type: 'youtube', ...result });
    }
    const result = await fetchWebPage(url);
    return res.json({ type: 'web', ...result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function getYouTubeId(url) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

async function fetchYouTubeTranscript(videoId) {
  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
    }
  });
  if (!pageRes.ok) throw new Error('YouTube inaccessible');
  const html = await pageRes.text();

  const titleMatch = html.match(/"title":\{"runs":\[\{"text":"([^"]+)"\}/);
  const title = titleMatch ? titleMatch[1] : 'Vidéo YouTube';

  const captionsMatch = html.match(/"captionTracks":(\[.+?\])/);
  if (!captionsMatch) throw new Error('no_captions');

  const tracks = JSON.parse(captionsMatch[1]);
  const track = tracks.find(t => t.languageCode === 'fr')
    || tracks.find(t => t.languageCode === 'en')
    || tracks[0];
  if (!track) throw new Error('no_captions');

  const xmlRes = await fetch(track.baseUrl);
  const xml = await xmlRes.text();

  const segments = xml.match(/<text[^>]*>([^<]+)<\/text>/g) || [];
  const content = segments
    .map(s => s.replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'").replace(/&quot;/g, '"'))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000);

  if (!content) throw new Error('no_captions');
  return { title, content };
}

async function fetchWebPage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
    }
  });
  if (!res.ok) throw new Error('Page inaccessible');
  const html = await res.text();

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim().slice(0, 100) : new URL(url).hostname;

  const content = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000);

  return { title, content };
}
