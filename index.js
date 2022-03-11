const express = require("express");
const { firestore } = require("firebase-admin");
const { Storage } = require("@google-cloud/storage");
const app = express();
const path = require("path");
const xl = require("excel4node");
const fs = require("fs");
const PDFDocument = require("pdfkit-table");
const jsonToTable = require("json-to-table");
const mt940 = require("mt940-nodejs");
const fetch = require("node-fetch");
const pathtokey = "/keys/jazia-51e09-firebase-adminsdk-4a8eo-3feaa92f8c.json";
const wb = new xl.Workbook();
var filename = "";
let bucketName = "jazia-51e09.appspot.com";
app.use(express.json({ extended: false }));
app.get("/", (req, res) => res.status(200).send("mt940 server is up and running"));

var ws;
const storage = new Storage({
  keyFilename: __dirname + pathtokey,
});
var url = "";

const uploadFile = async (filename) => {
  // Uploads a local file to the bucket
  await storage
    .bucket(bucketName)
    .upload(filename, {
      // Support for HTTP requests made with `Accept-Encoding: gzip`
      gzip: true,
      predefinedAcl: "publicRead",
      metadata: {
        cacheControl: "no-cache",
      },
    })
    .then((val) => {
      url = val[0].publicUrl();
      //console.log(url);
    });

  console.log(`${filename} uploaded to ${bucketName}.`);
  return url;
};

const convertToExcel = async (
  username,
  data,
  headingColumnNames,
  statement
//   accountNumber,
//   openingBalance,
//   closingBalance,
//   closingAvailableBalance
) => {

    filename = __dirname + `/${username}.xlsx`;

for(var j in data){

  ws = wb.addWorksheet(((statement[j]).referenceNumber).toString());

  //Write Column Title in Excel file
  let headingColumnIndex = 1;
  headingColumnNames.forEach((heading) => {
    ws.cell(1, headingColumnIndex++).string(
      heading == "isCredit" ? "type" : heading
    );
  });
  ws.cell(2, headingColumnNames.length + 1).string((statement[j]).openingBalance==undefined?"":
    `OPENING BALANCE AS AT ${(statement[j]).openingBalance.date}`
  );
  ws.cell(3, headingColumnNames.length + 1).string((statement[j]).closingBalance==undefined?"":
    `CLOSING BALANCE AS AT ${(statement[j]).closingBalance.date}`
  );
  ws.cell(4, headingColumnNames.length + 1).string((statement[j]).closingAvailableBalance==undefined?"":
    `CLOSING AVAILABLE BALANCE AS AT ${(statement[j]).closingAvailableBalance.date}`
  );
  ws
    .cell(2, headingColumnNames.length + 2)
    .string((statement[j]).openingBalance==undefined?"":
        (statement[j]).openingBalance.value.toString()),
    ws
      .cell(3, headingColumnNames.length + 2)
      .string((statement[j]).closingBalance==undefined?"":
          (statement[j]).closingBalance.value.toString()),
    ws
      .cell(4, headingColumnNames.length + 2)
      .string((statement[j]).closingAvailableBalance==undefined?"":
          (statement[j]).closingAvailableBalance.value.toString());
  ws.cell(2, headingColumnNames.length + 3).string((statement[j]).openingBalance==undefined?"":
      (statement[j]).openingBalance.currency),
    ws.cell(3, headingColumnNames.length + 3).string((statement[j]).closingBalance==undefined?"":
        (statement[j]).closingBalance.currency),
    ws
      .cell(4, headingColumnNames.length + 3)
      .string((statement[j]).closingAvailableBalance==undefined?"":
          (statement[j]). closingAvailableBalance.currency);
  ws
    .cell(2, headingColumnNames.length + 4)
    .string((statement[j]).openingBalance==undefined?"":
        ((statement[j])).openingBalance.isCredit == true ? "credit" : "debit"),
    ws
      .cell(3, headingColumnNames.length + 4)
      .string((statement[j]).closingBalance==undefined?"":
          ((statement[j])).closingBalance.isCredit == true ? "credit" : "debit"),
    ws
      .cell(4, headingColumnNames.length + 4)
      .string((statement[j]).closingAvailableBalance==undefined?"":
          ((statement[j])).closingAvailableBalance.isCredit == true ? "credit" : "debit");
  //Write Data in Excel file
  let rowIndex = 2;
  ((data[j])).forEach((record) => {
    let columnIndex = 1;

    for (var i in headingColumnNames) {
      // console.log(record[header]);
      ws.cell(rowIndex, columnIndex++).string(
        headingColumnNames[i] == "isCredit"
          ? record[headingColumnNames[i]] === true
            ? "Credit"
            : "Debit"
          : record[headingColumnNames[i]].toString()
      );
    }
    rowIndex++;
  });}
  wb.write(`${username}.xlsx`);
  return filename;
};

const convertToPDF = async (
  //referenceNumber,
  data,
  username,
  headingColumnNames,
  statement
//   accountNumber,
//   openingBalance,
//   closingBalance,
//   closingAvailableBalance
) => {
  var pdfDoc = new PDFDocument({ margin: 30, size: "A4" });
  pdfDoc.pipe(fs.createWriteStream(`${username}.pdf`));

  filename = __dirname + `/${username}.pdf`;


for(var j in data){  
  var indices = [];
  var newtable = [];
  const tabled = jsonToTable((data[j]));
  headingColumnNames.forEach((header) => {
    indices.push(tabled[0].indexOf(header));
  });
  //console.log(indices);
  for (var i in tabled) {
    var tmp = [];
    indices.forEach((index) => {
      tmp.push(tabled[i][index]??"");
    });
    newtable.push(tmp);
  }
  console.log(newtable)
  //console.log(statement[j].openingBalance.date);

  pdfDoc.text(`Account Statement`, {
    align: "left",
    underline: true,
  });
  pdfDoc.moveDown();
  // requires
  const table = {
    title: `Account Id: ${statement[j].accountId}`??"",
    subtitle: `Reference Number: ${statement[j].referenceNumber}`??"",
    headers: newtable.shift(),
    rows: newtable,
  };

  pdfDoc.table(table, {
    // A4 595.28 x 841.89 (portrait) (about width sizes)
    width: 500,
  });

  pdfDoc.moveDown();
  pdfDoc.text(
    statement[j].openingBalance == undefined
      ? ""
      : `Opening Balance as at ${statement[j].openingBalance.date}:\n${
        statement[j].openingBalance.value
        } ${statement[j].openingBalance.currency} .${
            statement[j].openingBalance.isCredit == false ? "Dr" : "Cr"
        }`,
    {
      align: "left",
      height: 50,
    }
  );
  pdfDoc.moveDown();
  pdfDoc.text(
    statement[j].closingBalance == undefined
      ? ""
      : `Closing Balance as at ${statement[j].closingBalance.date}:\n${
        statement[j].closingBalance.value
        } ${statement[j].closingBalance.currency} .${
            statement[j].closingBalance.isCredit == false ? "Dr" : "Cr"
        }`,
    {
      align: "left",
      height: 50,
    }
  );
  pdfDoc.moveDown();
  pdfDoc.text(
    statement[j].closingAvailableBalance == undefined
      ? ""
      : `Closing Available Balance as at ${statement[j].closingAvailableBalance.date}:\n${
        statement[j].closingAvailableBalance.value
        } ${statement[j].closingAvailableBalance.currency} .${
            statement[j].closingAvailableBalance.isCredit == false ? "Dr" : "Cr"
        }`,
    {
      align: "left",
      height: 50,
    }
  );
  pdfDoc.addPage();
}
  pdfDoc.end();

  return filename;
};

app.post("/mt940", async (req, res) => {
  var rawUrl = req.body.url;
  var fields = req.body.fields;
  var get = req.body.get;
  var date = req.body.date;
  var format = req.body.format;
  var user = req.body.sender;
  var type = req.body.type;
  // var startDate = req.body.range.start;
  //var endDate = req.body.range.end;
  var newArr = [];
  var tempArr = [];
  var statement=[];

  await fetch(rawUrl, {
    headers: { Authorization: `token ${process.env.GIT_TOKEN}` },
  })
    .then((response) => response.arrayBuffer())
    .then((buffer) => {
      try {
        mt940
          .read(buffer)
          .then((statements) => {
           // console.log(statements);
            // console.log(statement);
            if (statements != undefined) {
              statements.forEach((stmt) => {
                statement.push(stmt);
               var trans = stmt.transactions;
                // console.log(trans);
                if (get === "range") {
                  
                  newArr.push (trans.filter(function (x) {
                    return (
                      parseInt(x.valueDate) <= parseInt(req.body.range.start) &&
                      parseInt(x.valueDate) >= parseInt(req.body.range.end)
                    );
                  }));
                } else if (get === "all") {
                  newArr.push( stmt.transactions);
                } else {
                  
                  newArr.push (trans.filter(function (x) {
                    return x.valueDate == date;
                  }));
                }
              });
            } else {
              console.log("an error occurred");
            }
          })
          .then((_) => {
            if (statement != undefined) {
              const uploadFileAsync = () => {
                return new Promise((resolve) => {
                  setTimeout(() => resolve(uploadFile(filename)), 2000);
                });
              };

              const doit = async () => {
                await uploadFileAsync().then((promise) => {
                  res.status(200).send({
                    url: url,
                  });
                  console.log(url);
                });
              };

              const removefile = () => {
                return new Promise((resolve) => {
                  setTimeout(() => resolve(fs.rmSync(filename)), 5000);
                });
              };

              const rmf = async () => {
                await removefile();
                res.end();
              };

              if (format === "pdf") {
                // console.log(newArr);
                 // console.log(statement);
                convertToPDF(
                  //statement.referenceNumber,
                  newArr,
                  user,
                  fields,
                  statement,
                //   statement.accountId,
                //   statement.openingBalance,
                //   statement.closingBalance,
                //   statement.closingAvailableBalance
                ).then((fname) => {
                  filename = fname;
                  doit();
                  rmf();
                });
              } else {
                convertToExcel(
                  user,
                  newArr,
                  fields,
                  statement,
                //   statement.accountId,
                //   statement.openingBalance,
                //   statement.closingBalance,
                //   statement.closingAvailableBalance
                ).then((fname) => {
                  filename = fname;
                  doit();
                  rmf();
                });
              }
            } else {
              console.log("not mt940");
              res.sendStatus(403);
            }
          });
      } catch (error) {
        console.log(error);
      }
    });
});

// Start the server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log("Press Ctrl+C to quit.");
});
