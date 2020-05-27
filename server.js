const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const cron = require("node-cron");
const fetch = require('node-fetch');

// mongo config
const config = require("./config/keys");

// email model
const Email = require("./models/Email");

// initialize express
const app = express();

//body-parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

let usersEmail = [];
let testAccount;
let transporter;

cron.schedule("0 0 * * *", () => {
  console.log('Starting scheduled email service');
  startDB();
})

// connect mongodb
const startDB =  () => {
  mongoose.connect(config.mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(async() => {
      console.log('MongoDB Connected');
      // create test account
      testAccount = await nodemailer.createTestAccount();
      setupTransporter();
      sendMail().catch(console.error);
    })
    .catch(err => console.log(err));
}

// get today's date
const date = () => {
  const date = new Date();
  const day = `${date.getDate()}`;
  const month = (date.getMonth() + 1) <= 9 ? `0${(date.getMonth() + 1)}` : (date.getMonth() + 1);
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// set up the nodemailer transporter
function setupTransporter() {
  transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
}

// to send mail
async function sendMail() {
  await fetch("http://localhost:8080/email/get-users-email-data")
    .then(res => res.json())
    .then(body => usersEmail = body);

  usersEmail = usersEmail.map(email => {
    if (!email.opened && email.days > 0)
      return email.email
  });
  usersEmail = usersEmail.filter(email => email);

  if (usersEmail.length) {
    Promise.all(usersEmail.map(async email => {
      const info = await transporter.sendMail({
        from: testAccount.user,
        to: email,
        subject: `Daily Notifier - ${date()}`,
        html: '<p>Click <a href="http://localhost:8080/email/user-accept-notification?email=' + email + '">here</a> Accept mandatory emails</p>'
      });
      // console.log("info", info);
      console.log("Message sent: %s", info.messageId);
      
      // Preview only available when sending through an Ethereal account
      console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
      return info;
    })).then(() => fetch("http://localhost:8080/email/decrease-days"));
  } else {
    console.log('no email meet the requirement');
  }
}

async function sendThankYouEmail(email) {
  const info = await transporter.sendMail({
    from: testAccount.user,
    to: email,
    subject: `Thank You Email`,
    html: '<h5>Thank you for accepting the future mandatory mails :)</h5>'
  });
  // console.log("info", info);
  console.log("Message sent: %s", info.messageId);
  
  // Preview only available when sending through an Ethereal account
  console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
}

//@route  POST /user/add-user-email
//@desc   Add an email address to database
app.post("/email/add-user-email", (req, res) => {
  Email.findOne({ email: req.body.email })
    .then((email) => {
      if (email) {
        return res.status(400).json({ error: "Email already exists" });
      } else {
        const newEmail = new Email({ email: req.body.email });
        newEmail.save()
          .then((email) => res.json(email))
          .catch((err) => res.status(400).json({ error: err }));
      }
    });
});


//@route  GET /user/get-users-email-data
//@desc   Get email data for all users
app.get("/email/get-users-email-data", (req, res) => {
  Email.find()
    .then((emails) => {
      if (emails) {
        return res.json(emails);
      }
      return res.json({ error: "error occured" });
    })
    .catch((err) => res.status(404).json({ error: err}));
});

//@route  GET /user/user-accept-notification
//@desc   Get email and set the opened true
app.get("/email/user-accept-notification", (req, res) => {
  Email.findOne({ email: req.query.email })
    .then((email) => {
      email.opened = true;
      email.save().then(() => {
        sendThankYouEmail(email);
        return res.json({ success: true });
      }).catch(err => {
        return res.json({ error: err})
      });
    })
    .catch((err) => {
      return res.json({ error: err })
    });
});

//@route  GET /user/decrease-days
//@desc   Get users email and decrease days
app.get("/email/decrease-days", (req, res) => {
  Email.find()
    .then((emails) => {
      emails.forEach(async email => {
        console.log('email', email);
        if (!email.opened) {
          email.days -= 1;
          await email.save().then(() => console.log(`updated ${email}`));
          return;
        }
      });
    })
    .catch((err) => res.json({ error: err }));
});

//port configurations
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running at port ${PORT}`));