import { Resvg } from '@resvg/resvg-js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { OG_IMAGE_WIDTH } from '../shared/narrativeOg';

const OG_FONT_FILENAMES = [
  'IBMPlexMono-Regular.otf',
  'IBMPlexMono-SemiBold.otf',
  'IBMPlexMono-Bold.otf'
];

function resolveOgFontFiles() {
  const fontDirectories = [
    join(process.cwd(), 'dist/server/server/fonts'),
    join(process.cwd(), 'src/server/fonts')
  ];

  return fontDirectories.flatMap((directory) => (
    OG_FONT_FILENAMES
      .map((filename) => join(directory, filename))
      .filter((fontPath) => existsSync(fontPath))
  ));
}

const ogFontFiles = resolveOgFontFiles();

export function renderOgPng(svg: string) {
  return renderSvgPng(svg, OG_IMAGE_WIDTH);
}

export function renderSvgPng(svg: string, width: number) {
  const renderer = new Resvg(svg, {
    font: {
      fontFiles: ogFontFiles,
      loadSystemFonts: ogFontFiles.length === 0,
      defaultFontFamily: 'IBM Plex Mono',
      monospaceFamily: 'IBM Plex Mono',
      sansSerifFamily: 'IBM Plex Mono'
    },
    fitTo: {
      mode: 'width' as const,
      value: width
    }
  });
  return Buffer.from(renderer.render().asPng());
}
