import {
  renderRhPulseShareSvg,
  type RhPulseShareArtifactData,
  type RhPulseShareDimensions
} from '../shared/rhPulseShareArtifacts';
import { renderSvgPng } from './narrativeOgPng';

export function renderRhPulseSharePng(
  artifact: RhPulseShareArtifactData,
  dimensions: RhPulseShareDimensions
) {
  return renderSvgPng(renderRhPulseShareSvg(artifact, dimensions), dimensions.width);
}
