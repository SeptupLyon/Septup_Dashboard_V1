export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { audio, mimeType } = req.body;
  if (!audio) return res.status(400).json({ error: 'No audio provided' });

  const buffer = Buffer.from(audio, 'base64');
  const ext = mimeType && mimeType.includes('mp4') ? 'mp4' : 'webm';
  const filename = 'audio.' + ext;
  const contentType = mimeType || 'audio/webm';

  const boundary = '----WaveformBoundary' + Date.now();
  const CRLF = '\r\n';

  const preamble = Buffer.from(
    '--' + boundary + CRLF +
    'Content-Disposition: form-data; name="file"; filename="' + filename + '"' + CRLF +
    'Content-Type: ' + contentType + CRLF + CRLF
  );
  const middle = Buffer.from(
    CRLF + '--' + boundary + CRLF +
    'Content-Disposition: form-data; name="model"' + CRLF + CRLF +
    'whisper-1' + CRLF +
    '--' + boundary + CRLF +
    'Content-Disposition: form-data; name="language"' + CRLF + CRLF +
    'fr' + CRLF +
    '--' + boundary + '--' + CRLF
  );

  const body = Buffer.concat([preamble, buffer, middle]);

  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY,
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': body.length
      },
      body: body
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'Transcription failed' });
    res.json({ text: data.text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
