/*
  SakeOfThought order log.

  Paste this into Extensions > Apps Script inside the Google Sheet,
  then deploy it as a web app (steps are in README.md).

  It can only ADD rows. It never returns sheet contents, so the web app
  URL being visible in the site code does not expose customer data.
*/

var SHEET_NAME = 'Orders';
var HEADERS = ['Received', 'Order ref', 'Name', 'Deliver to', 'Needed by', 'Occasion', 'Subtotal (Rs)', 'Items'];
var MAX_TEXT = 500;
var MAX_ITEMS = 40;

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var order = JSON.parse(e.postData.contents);
    var sheet = getSheet_();

    var items = (order.items || []).slice(0, MAX_ITEMS).map(function (item) {
      return clean_(item.qty) + ' x ' + clean_(item.title) + ' @ ' + clean_(item.unitPrice) +
        (item.details ? ' (' + clean_(item.details) + ')' : '');
    }).join('\n');

    sheet.appendRow([
      new Date(),
      clean_(order.ref),
      clean_(order.name),
      clean_(order.place),
      clean_(order.neededBy),
      clean_(order.occasion),
      Number(order.subtotal) || 0,
      items
    ]);
    return reply_({ ok: true });
  } catch (err) {
    return reply_({ ok: false });
  } finally {
    lock.releaseLock();
  }
}

function getSheet_() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(SHEET_NAME) || book.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/* Trim long text, and stop anything that starts like a formula from
   being run by the sheet. */
function clean_(value) {
  var text = String(value == null ? '' : value).slice(0, MAX_TEXT);
  return /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
}

function reply_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
