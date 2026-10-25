import type { Page, TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

/** Start after GPU warmup: recording the shader compilation can stall software WebGL. */
export async function recordGameplay(page: Page, info: TestInfo) {
  const session = await page.context().newCDPSession(page);
  await session.send('Page.enable');
  const frames: { at: number; jpeg: Buffer }[] = [];
  const start = Date.now();
  session.on('Page.screencastFrame', (frame) => {
    frames.push({
      at: Date.now() - start,
      jpeg: Buffer.from(frame.data, 'base64'),
    });
    void session
      .send('Page.screencastFrameAck', { sessionId: frame.sessionId })
      .catch(() => {});
  });
  await session.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 85,
    maxWidth: 1366,
    maxHeight: 768,
    everyNthFrame: 2,
  });
  return async (destination: string): Promise<void> => {
    await session.send('Page.stopScreencast');
    await session.detach();
    await page.evaluate(() => {
      window.requestAnimationFrame = () => 0;
    });
    if (frames.length < 2)
      throw new Error('The browser did not produce gameplay video frames.');
    const folder = info.outputPath('gameplay-frames');
    await mkdir(folder, { recursive: true });
    const lines: string[] = [];
    for (let i = 0; i < frames.length; i++) {
      const filename = folder + '/frame-' + i + '.jpg';
      await writeFile(filename, frames[i]!.jpeg);
      const from = i === 0 ? 0 : Math.min(10_000, frames[i]!.at);
      const to = Math.min(10_000, frames[i + 1]?.at ?? 10_000);
      if (to <= from) continue;
      lines.push(
        "file '" + filename.replaceAll('\\', '/') + "'",
        'duration ' + (to - from) / 1000,
      );
    }
    lines.push(lines.at(-2)!); // concat requires the final frame again to honour its duration.
    const manifest = folder + '/frames.txt';
    await writeFile(manifest, lines.join('\n') + '\n');
    const ffmpeg =
      process.env.FFMPEG_PATH ??
      (process.platform === 'win32' ? 'C:/ffmpeg/bin/ffmpeg.exe' : 'ffmpeg');
    const result = spawnSync(
      ffmpeg,
      [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        manifest,
        '-t',
        '10',
        '-vf',
        'fps=30,scale=1366:768',
        '-an',
        '-c:v',
        'libvpx-vp9',
        '-deadline',
        'realtime',
        '-cpu-used',
        '6',
        '-row-mt',
        '1',
        '-threads',
        '4',
        '-b:v',
        '1100k',
        destination,
      ],
      { windowsHide: true, encoding: 'utf8', timeout: 45_000 },
    );
    if (result.status !== 0) throw new Error(result.stderr);
  };
}
