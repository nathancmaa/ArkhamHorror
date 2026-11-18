/* Where the in-game "File a bug" button sends reports.
 *
 * This fork runs on a home server. It cannot write to upstream's bug bucket
 * (the S3 upload Api.fileBug does), and its bugs are this fork's to triage, so
 * reports open an issue here instead and the game state is downloaded for the
 * reporter to attach.
 */
export const BUG_REPORT_REPO = 'nathancmaa/ArkhamHorror'

export function bugIssueUrl(title: string, body: string): string {
  const query = new URLSearchParams({ labels: 'bug', title, body })
  return `https://github.com/${BUG_REPORT_REPO}/issues/new?${query}`
}
