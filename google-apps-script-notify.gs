/**
 * Google Apps Script webhook for EMDP apply notifications.
 *
 * Deploy:
 * 1) Extensions -> Apps Script (new project)
 * 2) Paste this file
 * 3) Deploy -> New deployment -> Web app
 * 4) Execute as: Me
 * 5) Who has access: Anyone
 * 6) Copy /exec URL and set it in apply.html data-notify-webhook-url
 */

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var data = JSON.parse(raw);

    var to = 'hodh123@gmail.com';
    var cc = 'hodh123@dgist.ac.kr';

    var subject = '[EMDP Apply] ' + safe(data.applicant_name) + ' (' + safe(data.program_track) + ')';
    var body =
      'A new application was submitted from the EMDP website.\n\n' +
      'Submitted at: ' + safe(data.submitted_at) + '\n' +
      'Name: ' + safe(data.applicant_name) + '\n' +
      'Email: ' + safe(data.applicant_email) + '\n' +
      'Track: ' + safe(data.program_track) + '\n' +
      'Affiliation: ' + safe(data.affiliation) + '\n' +
      'CV file: ' + safe(data.files && data.files.cv_file_name) + '\n' +
      'Cover letter file: ' + safe(data.files && data.files.cover_letter_file_name) + '\n' +
      'Source page: ' + safe(data.source_page) + '\n\n' +
      'Research proposal note:\n' + safe(data.research_proposal_note) + '\n\n' +
      'Special note:\n' + safe(data.special_note);

    GmailApp.sendEmail(to, subject, body, { cc: cc });

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: String(error) })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function safe(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}
