/**
 * ═══════════════════════════════════════════════════════════════════
 *  Adarsh Vidyapeeth Command Center — OTP Backend (Google Apps Script)
 * ═══════════════════════════════════════════════════════════════════
 *  Uses a Google Sheet as the OTP log + Gmail (MailApp) to send real
 *  OTP emails. Endpoints:
 *
 *    POST  { action: 'sendOtp',   email }   → generates OTP, logs to
 *                                             sheet, emails it
 *    POST  { action: 'verifyOtp', email, otp } → checks OTP, marks
 *                                             VERIFIED in sheet
 *    GET   ?action=status                    → health check
 *
 *  ── DEPLOYMENT STEPS ──────────────────────────────────────────────
 *  1. Create a Google Sheet (any name, e.g. "AVCC OTP Log").
 *  2. In the sheet: Extensions → Apps Script. Delete the default
 *     code and paste this whole file. (Script must be BOUND to the
 *     sheet so getActiveSpreadsheet() works.)
 *  3. Click Deploy → New deployment → type "Web app":
 *       - Description:  OTP backend
 *       - Execute as:   Me (email will be sent from YOUR Gmail)
 *       - Who has access: Anyone
 *     → Deploy → authorize (grant Gmail + Spreadsheet access).
 *  4. Copy the Web app URL (ends with /exec).
 *  5. In script.js set:  const OTP_BACKEND_URL = '<that /exec URL>';
 *  6. Reload the dashboard. OTPs now arrive as real emails.
 *
 *  Notes:
 *  - MailApp quota: ~100 recipients/day on free Google accounts.
 *  - The "OTP_Log" sheet is created automatically on first use.
 *  - OTPs expire after 5 minutes; max 5 wrong attempts per OTP.
 * ═══════════════════════════════════════════════════════════════════
 */

var SHEET_NAME = 'OTP_Log';
var OTP_TTL_MS = 5 * 60 * 1000;   // 5 minutes
var MAX_ATTEMPTS = 5;

/* ── GET: health check ─────────────────────────────────────────── */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'status';
  if (action === 'status') {
    return jsonResponse_({ ok: true, service: 'pw-otp-backend', time: new Date().toISOString() });
  }
  return jsonResponse_({ ok: false, error: 'Unknown action' }, 400);
}

/* ── POST: sendOtp / verifyOtp ─────────────────────────────────── */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    if (action === 'sendOtp') return handleSendOtp_(body);
    if (action === 'verifyOtp') return handleVerifyOtp_(body);
    return jsonResponse_({ ok: false, error: 'Unknown action' }, 400);
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) }, 500);
  }
}

/* ── sendOtp ───────────────────────────────────────────────────── */
function handleSendOtp_(body) {
  var email = String(body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@pw\.live$/i.test(email)) {
    return jsonResponse_({ ok: false, error: 'Only @pw.live emails are allowed.' }, 400);
  }

  var otp = String(Math.floor(100000 + Math.random() * 900000));
  var now = new Date();
  var expires = new Date(now.getTime() + OTP_TTL_MS);

  getSheet_().appendRow([email, otp, now, expires, 'PENDING', 0, '']);

  MailApp.sendEmail({
    to: email,
    subject: 'Your OTP for Adarsh Vidyapeeth Command Center',
    htmlBody: buildOtpEmail_(otp, expires)
  });

  return jsonResponse_({ ok: true, message: 'OTP sent to ' + email });
}

/* ── verifyOtp ─────────────────────────────────────────────────── */
function handleVerifyOtp_(body) {
  var email = String(body.email || '').trim().toLowerCase();
  var otp = String(body.otp || '').trim();
  var sheet = getSheet_();
  var data = sheet.getDataRange().getValues();
  var latestPendingIndex = -1;

  // Scan ALL pending rows for this email (newest first), so any
  // outstanding OTP the user received still works.
  for (var i = data.length - 1; i >= 1; i--) {
    var row = data[i];
    if (row[0] === email && row[4] === 'PENDING') {
      if (latestPendingIndex === -1) latestPendingIndex = i;
      var expires = new Date(row[3]);
      if (new Date() > expires) {
        sheet.getRange(i + 1, 5).setValue('EXPIRED');
        continue;
      }
      // IMPORTANT: Sheets may store the OTP as a NUMBER (e.g. 123456)
      // even though we appended a string — compare as strings.
      if (String(row[1]) === otp) {
        sheet.getRange(i + 1, 5).setValue('VERIFIED');
        sheet.getRange(i + 1, 6).setValue((Number(row[5]) || 0) + 1);
        sheet.getRange(i + 1, 7).setValue(new Date());
        return jsonResponse_({ ok: true, message: 'OTP verified' });
      }
    }
  }

  if (latestPendingIndex === -1) {
    return jsonResponse_({ ok: false, error: 'No pending OTP found for this email. Please request a new one.' }, 400);
  }

  // No OTP matched — count the attempt against the latest pending row
  var latest = data[latestPendingIndex];
  var attempts = Number(latest[5]) || 0;
  if (attempts >= MAX_ATTEMPTS) {
    sheet.getRange(latestPendingIndex + 1, 5).setValue('LOCKED');
    return jsonResponse_({ ok: false, error: 'Too many attempts. Please request a new OTP.' }, 400);
  }
  sheet.getRange(latestPendingIndex + 1, 6).setValue(attempts + 1);
  return jsonResponse_({ ok: false, error: 'Incorrect OTP. Please try again.' }, 400);
}

/* ── helpers ───────────────────────────────────────────────────── */
function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['Email', 'OTP', 'CreatedAt', 'ExpiresAt', 'Status', 'Attempts', 'VerifiedAt']);
    sheet.getRange(1, 1, 1, 7).setFontWeight('bold');
  }
  return sheet;
}

function buildOtpEmail_(otp, expires) {
  var timeStr = Utilities.formatDate(expires, Session.getScriptTimeZone(), 'hh:mm a');
  return '' +
    '<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;background:#131318;border-radius:16px;padding:32px;color:#ffffff">' +
      '<div style="text-align:center;margin-bottom:20px">' +
        '<div style="width:56px;height:56px;margin:0 auto 12px;background:#ffffff;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#e21b38">PW</div>' +
      '</div>' +
      '<h2 style="text-align:center;margin:0 0 6px;font-size:18px">Adarsh Vidyapeeth Command Center</h2>' +
      '<p style="text-align:center;color:#94a3b8;font-size:13px;margin:0 0 24px">Your one-time password</p>' +
      '<div style="background:#0a0a0c;border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:20px;text-align:center">' +
        '<div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#e21b38">' + otp + '</div>' +
      '</div>' +
      '<p style="color:#94a3b8;font-size:12px;margin-top:20px;text-align:center">' +
        'This OTP is valid until <b style="color:#ffffff">' + timeStr + '</b>.<br>Do not share it with anyone.' +
      '</p>' +
    '</div>';
}

function jsonResponse_(obj, status) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}