const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const EmailSchema = new Schema({
  email: {
    type: String,
    required: true
  },
  opened: {
    type: Boolean,
    default: false
  },
  days: {
    type: Number,
    default: 4
  }
});

module.exports = Email = mongoose.model("emails", EmailSchema);