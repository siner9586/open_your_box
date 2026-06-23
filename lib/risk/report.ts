import type { ExposureReport } from '../adapters/types';
export function reportToMarkdown(report: ExposureReport) {
  return `# ${report.reportType} exposure report\n\nGenerated: ${report.generatedAt}\n\nScope: ${report.authorizedScope}\n\nScore: ${report.totalScore}\n\n${report.summary}`;
}
