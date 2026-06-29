import { Resvg } from '@resvg/resvg-js';
import { OG_IMAGE_WIDTH } from '../shared/narrativeOg';

const RESVG_OPTIONS = {
  fitTo: {
    mode: 'width' as const,
    value: OG_IMAGE_WIDTH
  }
};

export function renderOgPng(svg: string) {
  const renderer = new Resvg(svg, RESVG_OPTIONS);
  return Buffer.from(renderer.render().asPng());
}
